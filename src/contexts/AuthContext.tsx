import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isAdminMode } from "@/lib/app-mode";
import { useInactivityLogout, getSessionToken, setSessionToken, clearSessionToken } from "@/hooks/use-inactivity-logout";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

type AppRole = "admin" | "center" | "csbante" | "independent" | "school";

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface Profile {
  id: string;
  identifier: string;
  display_name: string | null;
  must_change_password: boolean;
  photo_url?: string | null;
  school_name?: string | null;
  class_name?: string | null;
  teacher_name?: string | null;
  phone?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = useCallback(async (userId: string) => {
    const [profileRes, roleRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
    ]);

    setProfile((profileRes.data as Profile) ?? null);
    setRole((roleRes.data?.role as AppRole) ?? null);
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await fetchProfileAndRole(user.id);
    } finally {
      setLoading(false);
    }
  };

  // Clean up session record on sign out
  const removeSession = async (userId: string) => {
    await (supabase.from as any)("active_sessions")
      .delete()
      .eq("user_id", userId);
  };

  const signOut = useCallback(async () => {
    const uid = user?.id;
    if (uid) await removeSession(uid);
    clearSessionToken();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setRole(null);
    navigate(isAdminMode ? "/Marx" : "/login", { replace: true });
  }, [user, navigate]);

  // Inactivity auto-logout
  const handleInactivityTimeout = useCallback(async () => {
    toast.info("Vous avez été déconnecté pour inactivité");
    await signOut();
  }, [signOut]);

  useInactivityLogout(user?.id, handleInactivityTimeout);

  useEffect(() => {
    let mounted = true;

    let currentUserId: string | null = null;

    const syncAuthState = async (sessionUser: User | null) => {
      if (!mounted) return;

      if (!sessionUser) {
        currentUserId = null;
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      // Skip re-fetch when the same user is just refreshed (TOKEN_REFRESHED, focus events).
      // Without this, opening a file picker / returning to the tab toggles `loading` to true
      // and ProtectedRoute unmounts the dashboard, losing in-page state (selected files, tab, etc.).
      if (currentUserId === sessionUser.id) {
        setUser(sessionUser);
        return;
      }

      currentUserId = sessionUser.id;
      setLoading(true);
      setUser(sessionUser);

      try {
        await fetchProfileAndRole(sessionUser.id);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthState(session?.user ?? null);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => syncAuthState(session?.user ?? null));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileAndRole]);

  const signIn = async (identifier: string, password: string) => {
    const email = `${identifier.toLowerCase().replace(/\s+/g, "")}@gestionsco.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const userId = data.user.id;

    // Check role — only block concurrent sessions for center accounts
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    const userRole = roleData?.role as AppRole | null;

    if (userRole === "center" || userRole === "independent") {
      // Vérifier si les connexions concurrentes sont autorisées par l'admin
      const { data: settingRow } = await (supabase.from as any)("app_settings")
        .select("value")
        .eq("key", "allow_concurrent_center_sessions")
        .single();
      const allowConcurrent = settingRow?.value === true;

      if (!allowConcurrent) {
        // Check for existing active session from another device
        const { data: existing } = await (supabase.from as any)("active_sessions")
          .select("*")
          .eq("user_id", userId)
          .single();

        if (existing && existing.last_active_at) {
          const lastActive = new Date(existing.last_active_at).getTime();
          const isStillActive = Date.now() - lastActive < INACTIVITY_TIMEOUT_MS;

          if (isStillActive) {
            await supabase.auth.signOut();
            throw new Error("CONCURRENT_SESSION");
          }
        }
      }
    }

    // Register our session
    const sessionToken = crypto.randomUUID();
    await (supabase.from as any)("active_sessions")
      .upsert(
        {
          user_id: userId,
          session_token: sessionToken,
          last_active_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    setSessionToken(sessionToken);
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
