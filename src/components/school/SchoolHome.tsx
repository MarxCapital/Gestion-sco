import { useEffect, useState } from "react";
import { CalendarCheck, UserRound, Users } from "lucide-react";
import { sdb } from "@/lib/school-db";
import { getSchoolYear } from "@/lib/school-year";
import { toISODate } from "@/lib/school";
import DashboardHome, { type HomeGroup, type HomeStat } from "@/components/portal/DashboardHome";

/** Tableau de bord du compte École : chiffres du jour + une vignette par rubrique. */
export default function SchoolHome({ schoolId, name, schoolLabel, groups, onSelect }: { schoolId: string; name: string; schoolLabel: string; groups: HomeGroup[]; onSelect: (v: string) => void }) {
  const [counts, setCounts] = useState<{ total: number; m: number; f: number; calls: number } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const year = getSchoolYear();
        const [{ data: st }, { data: ses }] = await Promise.all([
          sdb("students").select("sexe").eq("school_year", year).eq("school_id", schoolId),
          sdb("attendance_sessions").select("half_day").eq("school_year", year).eq("school_id", schoolId).eq("session_date", toISODate(new Date())),
        ]);
        if (!live) return;
        const rows = (st || []) as { sexe?: string | null }[];
        setCounts({ total: rows.length, m: rows.filter(r => r.sexe === "M").length, f: rows.filter(r => r.sexe === "F").length, calls: (ses || []).length });
      } catch { /* hors ligne : on affiche seulement les vignettes */ }
    })();
    return () => { live = false; };
  }, [schoolId]);

  const stats: HomeStat[] | undefined = counts ? [
    { icon: Users, value: counts.total, label: "Élèves", tone: "blue" },
    { icon: UserRound, value: counts.m, label: "Garçons", tone: "indigo" },
    { icon: UserRound, value: counts.f, label: "Filles", tone: "rose" },
    { icon: CalendarCheck, value: `${counts.calls}/2`, label: "Appels du jour", tone: counts.calls >= 2 ? "green" : "amber" },
  ] : undefined;

  return (
    <DashboardHome name={name} subtitle={`${schoolLabel} · Tout votre travail de classe, au même endroit.`} stats={stats} groups={groups} onSelect={onSelect}
      tip="Faites l'appel chaque matin et chaque soir : les statistiques de présence de la classe se calculent toutes seules." />
  );
}
