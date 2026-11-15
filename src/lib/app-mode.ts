/**
 * Detects whether the app is running in "admin mode" (launched from /Marx or /admin).
 * Once detected, the mode is persisted in sessionStorage so it survives in-app navigation.
 * Each browser tab / PWA instance gets its own sessionStorage, enabling true isolation.
 */

const ADMIN_MODE_KEY = "gestionsco_admin_mode";

function detectAdminMode(): boolean {
  const stored = sessionStorage.getItem(ADMIN_MODE_KEY);
  if (stored !== null) return stored === "true";

  const path = window.location.pathname;
  const isAdmin = path.startsWith("/Marx") || path.startsWith("/admin");

  sessionStorage.setItem(ADMIN_MODE_KEY, String(isAdmin));
  return isAdmin;
}

export const isAdminMode = detectAdminMode();

/** Storage key used by Supabase auth - different per app mode */
export const SUPABASE_STORAGE_KEY = isAdminMode
  ? "sb-xacfojsohshvnyvqaoil-admin-auth-token"
  : "sb-xacfojsohshvnyvqaoil-auth-token";

/**
 * PWA identity (manifest, theme-color, apple meta tags) is injected
 * directly in index.html before any script runs, based on the URL path.
 * No runtime swap needed here.
 */

