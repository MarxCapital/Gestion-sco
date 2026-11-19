import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getSchoolYear } from "@/lib/school-year";

export interface ExamCounts { total: number; filles: number; garcons: number; absents: number }

/** Chiffres clés des candidats de l'année (un centre précis, ou tous ceux que le compte peut voir). Silencieux hors ligne. */
export function useExamCounts(centerId?: string | null, enabled = true): ExamCounts | null {
  const [c, setC] = useState<ExamCounts | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    (async () => {
      try {
        const q = (f?: (b: any) => any) => {
          let b: any = (supabase.from as any)("candidates").select("id", { count: "exact", head: true }).eq("school_year", getSchoolYear());
          if (centerId) b = b.eq("center_id", centerId);
          return f ? f(b) : b;
        };
        const [t, f, m, a] = await Promise.all([q(), q(b => b.eq("sexe", "F")), q(b => b.eq("sexe", "M")), q(b => b.eq("is_absent", true))]);
        if (live && !t.error) setC({ total: t.count ?? 0, filles: f.count ?? 0, garcons: m.count ?? 0, absents: a.count ?? 0 });
      } catch { /* hors ligne : on affiche seulement les vignettes */ }
    })();
    return () => { live = false; };
  }, [centerId, enabled]);
  return c;
}
