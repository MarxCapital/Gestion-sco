/**
 * Deux applications installables sur la même adresse :
 *  - l'espace utilisateurs (centre, CS, école, prestataire…) : portée « / »
 *  - l'espace administration : portée « /Marx » (accueil /Marx, tableau de bord /Marx/tableau)
 *
 * Le mode est déterminé UNIQUEMENT par l'adresse ouverte (aucune mémoire de session) : chaque application a donc
 * son propre manifeste, sa propre portée, son propre jeton de connexion, sa propre copie hors ligne. On peut être
 * connecté à l'une avec un compte utilisateur et à l'autre avec le compte administrateur, sur le même appareil.
 */

function detectAdminMode(): boolean {
  const path = window.location.pathname;
  return path === "/Marx" || path.startsWith("/Marx/") || path === "/admin" || path.startsWith("/admin/");
}

export const isAdminMode = detectAdminMode();

/** Clé de stockage Supabase : différente dans chaque application */
export const SUPABASE_STORAGE_KEY = isAdminMode
  ? "sb-xacfojsohshvnyvqaoil-admin-auth-token"
  : "sb-xacfojsohshvnyvqaoil-auth-token";

/** Adresses propres à l'application d'administration (toutes sous « /Marx » pour rester dans sa portée). */
export const ADMIN_LOGIN = "/Marx";
export const ADMIN_HOME = "/Marx/tableau";
export const CHANGE_PASSWORD_PATH = isAdminMode ? "/Marx/mot-de-passe" : "/changer-mot-de-passe";

/** Où envoyer chaque rôle après connexion. */
export const ROLE_HOME: Record<string, string> = {
  admin: ADMIN_HOME,
  center: "/centre",
  csbante: "/csbante",
  independent: "/independant",
  school: "/ecole",
  prestataire: "/prestataire",
};
