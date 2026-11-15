import { supabase } from "@/integrations/supabase/client";

export type SchoolStatus = "publique" | "privee";
export const STATUS_LABEL: Record<SchoolStatus, string> = { publique: "École publique", privee: "École privée" };

const key = (id: string) => `gestionsco.school_status.${id}`;
const valid = (v: unknown): v is SchoolStatus => v === "publique" || v === "privee";

function readLocal(id: string): SchoolStatus | null {
  try { const v = localStorage.getItem(key(id)); return valid(v) ? v : null; } catch { return null; }
}

/** Statut gardé seulement sur cet appareil (écoles d'un prestataire, sans compte). */
export const readLocalStatus = readLocal;
export function saveLocalStatus(id: string, status: SchoolStatus) { try { localStorage.setItem(key(id), status); } catch { /* ignore */ } }

/** Statut enregistré dans le profil de l'école (copie locale si la colonne n'existe pas encore). */
export async function loadSchoolStatus(id: string): Promise<SchoolStatus | null> {
  if (!id) return null;
  try {
    const { data } = await (supabase.from as any)("profiles").select("*").eq("id", id).maybeSingle();
    const v = data?.school_status;
    if (valid(v)) {
      try { localStorage.setItem(key(id), v); } catch { /* ignore */ }
      return v;
    }
  } catch { /* hors ligne */ }
  return readLocal(id);
}

/** Enregistre le statut. `db` vaut false si la base n'a pas encore la colonne school_status. */
export async function saveSchoolStatus(id: string, status: SchoolStatus): Promise<{ db: boolean }> {
  try { localStorage.setItem(key(id), status); } catch { /* ignore */ }
  try {
    const { error } = await (supabase.from as any)("profiles").update({ school_status: status }).eq("id", id);
    return { db: !error };
  } catch { return { db: false }; }
}
