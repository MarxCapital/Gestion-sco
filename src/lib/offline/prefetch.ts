/* Quelles tables copier sur l'appareil selon le type de compte (pour tout avoir hors ligne dès la première connexion). */
export const PUBLIC_TABLES = ["app_settings"];

export function tablesForRole(role: string | null | undefined): string[] {
  switch (role) {
    case "admin": return ["app_settings", "profiles", "user_roles", "candidates", "notes", "class_resources", "holidays"];
    case "csbante": return ["app_settings", "profiles", "user_roles", "candidates", "notes", "holidays"];
    case "center":
    case "independent": return ["app_settings", "profiles", "user_roles", "candidates", "notes", "holidays"];
    case "school": return ["app_settings", "profiles", "user_roles", "students", "student_notes", "attendance_sessions", "attendance_absences", "notifications", "class_resources", "holidays"];
    case "prestataire": return ["app_settings", "profiles", "user_roles"];
    default: return PUBLIC_TABLES;
  }
}
