import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, gateway } from "@/integrations/supabase/client";
import { isAdminMode, SUPABASE_STORAGE_KEY } from "@/lib/app-mode";
import {
  rememberCredentials, saveSnapshot, snapshotForUid, verifyCredentials, hasOfflineAccount, setActiveOffline, getActiveOffline,
  offlineUser, isNetworkError, setMemPassword, getMemPassword, clearMemPassword, type OfflineSnapshot,
} from "@/lib/offline/auth-offline";
import { setOfflineUid, prepareOffline } from "@/lib/offline/runtime";
import { useInactivityLogout, getSessionToken, setSessionToken, clearSessionToken } from "@/hooks/use-inactivity-logout";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

type AppRole = "admin" | "center" | "csbante" | "independent" | "school" | "prestataire";

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
    const snap = snapshotForUid(userId);
    // Sans réponse exploitable (hors ligne, copie locale absente) : on reprend la dernière copie du profil.
    const prof = ((profileRes.data as Profile) ?? (snap?.profile as Profile) ?? null);
    const rol = ((roleRes.data?.role as AppRole) ?? (snap?.role as AppRole) ?? null);
    setProfile(prof);
    setRole(rol);
    if (profileRes.data && roleRes.data) saveSnapshot({ uid: userId, email: snap?.email ?? "", profile: profileRes.data, role: roleRes.data.role });
  }, []);

  /** Ouvre une session « hors ligne » à partir de la copie du compte gardée sur l'appareil. */
  const applyOffline = useCallback((snap: OfflineSnapshot) => {
    setOfflineUid(snap.uid);
    setActiveOffline(snap.uid);
    gateway.holdLocal = true;
    setUser(offlineUser(snap) as User);
    setProfile(snap.profile as Profile);
    setRole(snap.role as AppRole);
    setLoading(false);
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
    const wasOffline = !!getActiveOffline();
    if (uid && !gateway.down && !wasOffline) { try { await removeSession(uid); } catch { /* ignore */ } }
    clearSessionToken();
    clearMemPassword();
    try { await supabase.auth.signOut(); } catch { /* hors ligne */ }
    // Hors ligne, signOut ne retire pas toujours la session : on la retire à la main.
    try { localStorage.removeItem(SUPABASE_STORAGE_KEY); } catch { /* ignore */ }
    setActiveOffline(null); setOfflineUid(null); gateway.holdLocal = false;
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
        // Pas de session valide : session hors ligne mémorisée ? (jeton expiré sans internet, ou ouverture hors ligne)
        let snap = getActiveOffline();
        if (!snap) {
          try {
            const raw = localStorage.getItem(SUPABASE_STORAGE_KEY);
            const uid = raw ? JSON.parse(raw)?.user?.id : null;
            if (uid && (gateway.down || !navigator.onLine)) snap = snapshotForUid(uid);
          } catch { /* ignore */ }
        }
        if (snap) { currentUserId = snap.uid; applyOffline(snap); return; }
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
        gateway.holdLocal = false; setActiveOffline(null);
        setUser(sessionUser);
        return;
      }
      gateway.holdLocal = false; setActiveOffline(null);

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
  }, [fetchProfileAndRole, applyOffline]);

  // Retour d'internet pendant une session hors ligne : reconnexion silencieuse pour envoyer les modifications.
  useEffect(() => {
    let resuming = false;
    const tryResume = async () => {
      if (resuming || !getActiveOffline()) return;
      resuming = true;
      try { await resume(); } finally { resuming = false; }
    };
    const resume = async () => {
      const mp = getMemPassword();
      if (!mp) { gateway.needsLogin = true; gateway.emit(); return; }
      const { error } = await supabase.auth.signInWithPassword({ email: `${mp.id}@gestionsco.app`, password: mp.pw });
      if (!error) { gateway.holdLocal = false; setActiveOffline(null); gateway.needsLogin = false; await gateway.flush(); }
      else if (!isNetworkError(error)) { gateway.needsLogin = true; gateway.emit(); }
    };
    return gateway.subscribe((s) => { if (!s.down && getActiveOffline() && !gateway.syncing) void tryResume(); }) as () => void;
  }, []);

  // Prépare la copie hors ligne dès qu'un compte est connecté.
  useEffect(() => {
    if (!user || !role) return;
    const go = () => { if (!gateway.down && !gateway.holdLocal) void prepareOffline(gateway, role); };
    go();
    window.addEventListener("gestionsco:online", go);
    return () => window.removeEventListener("gestionsco:online", go);
  }, [user?.id, role]);

  const signIn = async (identifier: string, password: string) => {
    const email = `${identifier.toLowerCase().replace(/\s+/g, "")}@gestionsco.app`;

    const offlineLogin = async () => {
      const snap = await verifyCredentials(identifier, password);
      if (!snap) throw new Error(hasOfflineAccount(identifier) ? "OFFLINE_BAD_PASSWORD" : "OFFLINE_FIRST_LOGIN");
      setMemPassword(identifier, password);
      applyOffline(snap);
    };
    if (gateway.down || !navigator.onLine) return offlineLogin();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (isNetworkError(error)) { gateway.markDown(); return offlineLogin(); }
      throw error;
    }

    const userId = data.user.id;
    gateway.holdLocal = false; setActiveOffline(null); setOfflineUid(userId);

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

    // Mémorise le compte sur l'appareil : les connexions suivantes marcheront sans internet.
    try {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      ]);
      await rememberCredentials(identifier, password, { uid: userId, email, profile: p.data ?? null, role: (r.data?.role as string) ?? null });
      setMemPassword(identifier, password);
    } catch { /* ignore */ }
    void gateway.flush();
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
