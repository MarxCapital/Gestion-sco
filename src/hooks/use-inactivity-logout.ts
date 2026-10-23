import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isAdminMode } from "@/lib/app-mode";

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const HEARTBEAT_INTERVAL = 2 * 60 * 1000; // 2 minutes
const SESSION_TOKEN_KEY = isAdminMode ? "gs_admin_session_token" : "gs_session_token";

export const getSessionToken = () => localStorage.getItem(SESSION_TOKEN_KEY);
export const setSessionToken = (token: string) => localStorage.setItem(SESSION_TOKEN_KEY, token);
export const clearSessionToken = () => localStorage.removeItem(SESSION_TOKEN_KEY);

export function useInactivityLogout(userId: string | undefined, onTimeout: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onTimeout();
    }, INACTIVITY_TIMEOUT);
  }, [onTimeout]);

  // Heartbeat: update last_active_at
  useEffect(() => {
    if (!userId) return;
    const token = getSessionToken();
    if (!token) return;

    const sendHeartbeat = async () => {
      await (supabase.from as any)("active_sessions")
        .update({ last_active_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("session_token", token);
    };

    heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [userId]);

  // Inactivity tracking
  useEffect(() => {
    if (!userId) return;

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    const handler = () => resetTimer();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [userId, resetTimer]);
}
