import { useCallback, useEffect, useMemo, useState } from "react";
import { sdb } from "@/lib/school-db";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CalendarCheck, Lock, Loader2 } from "lucide-react";
import { useHolidays } from "@/hooks/use-holidays";
import { HALF_DAY_LABEL, halfDaysOf, sortStudents, toISODate, type HalfDay, type Student } from "@/lib/school";
import { getSchoolYear } from "@/lib/school-year";
import { useSchoolYear } from "@/contexts/SchoolYearContext";
import SkeletonLoader from "@/components/portal/SkeletonLoader";

interface Props { schoolId: string }

const AttendanceToday = ({ schoolId }: Props) => {
  const { holidays, holidayLabels } = useHolidays();
  const [students, setStudents] = useState<Student[]>([]);
  const [absent, setAbsent] = useState<Record<HalfDay, Set<string>>>({ morning: new Set(), afternoon: new Set() });
  const [saved, setSaved] = useState<Record<HalfDay, boolean>>({ morning: false, afternoon: false });
  const [saving, setSaving] = useState<HalfDay | null>(null);
  const [loading, setLoading] = useState(true);

  const { readOnly, year } = useSchoolYear();
  const today = useMemo(() => toISODate(new Date()), []);
  const halves = halfDaysOf(today, holidays);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: st }, { data: abs }, { data: sessions }] = await Promise.all([
      sdb("students").select("*").eq("school_year", getSchoolYear()).eq("school_id", schoolId),
      sdb("attendance_absences").select("student_id,half_day").eq("school_year", getSchoolYear()).eq("school_id", schoolId).eq("session_date", today),
      sdb("attendance_sessions").select("half_day").eq("school_year", getSchoolYear()).eq("school_id", schoolId).eq("session_date", today),
    ]);
    setStudents(sortStudents((st || []) as Student[]));
    const next: Record<HalfDay, Set<string>> = { morning: new Set(), afternoon: new Set() };
    (abs || []).forEach((a: any) => next[a.half_day as HalfDay].add(a.student_id));
    setAbsent(next);
    setSaved({
      morning: !!(sessions || []).find((s: any) => s.half_day === "morning"),
      afternoon: !!(sessions || []).find((s: any) => s.half_day === "afternoon"),
    });
    setLoading(false);
  }, [schoolId, today]);

  useEffect(() => { load(); }, [load, holidays]);

  const toggle = (half: HalfDay, id: string) => {
    setAbsent(prev => {
      const set = new Set(prev[half]);
      if (set.has(id)) set.delete(id); else set.add(id);
      return { ...prev, [half]: set };
    });
  };

  const submit = async (half: HalfDay) => {
    setSaving(half);
    try {
      await sdb("attendance_absences").delete().eq("school_year", getSchoolYear()).eq("school_id", schoolId).eq("session_date", today).eq("half_day", half);
      const ids = Array.from(absent[half]);
      if (ids.length > 0) {
        const { error } = await sdb("attendance_absences").insert(
          ids.map(id => ({ school_id: schoolId, school_year: getSchoolYear(), student_id: id, session_date: today, half_day: half })),
        );
        if (error) throw error;
      }
      const { error: sErr } = await sdb("attendance_sessions").upsert(
        { school_id: schoolId, school_year: getSchoolYear(), session_date: today, half_day: half, taken_at: new Date().toISOString() },
        { onConflict: "school_id,session_date,half_day" },
      );
      if (sErr) throw sErr;
      setSaved(prev => ({ ...prev, [half]: true }));
      toast.success(`Appel de la ${HALF_DAY_LABEL[half].toLowerCase()} enregistré`);
    } catch (e: any) {
      toast.error(e.message || "Erreur d'enregistrement");
    } finally {
      setSaving(null);
    }
  };

  const dateLabel = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  if (loading) return <SkeletonLoader rows={6} />;

  if (readOnly) {
    return (
      <Card><CardContent className="py-8 text-center space-y-2">
        <Lock className="w-6 h-6 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          L'année {year} est archivée : consultation et téléchargement uniquement.
        </p>
      </CardContent></Card>
    );
  }

  if (halves.length === 0) {
    return (
      <Card><CardContent className="py-8 text-center space-y-2">
        <Lock className="w-6 h-6 mx-auto text-muted-foreground" />
        <p className="font-medium capitalize">{dateLabel}</p>
        <p className="text-sm text-muted-foreground">
          {holidays.has(today) ? `Jour férié : ${holidayLabels[today]}` : "Pas de classe aujourd'hui"} — aucun appel à faire.
        </p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
      {halves.map(half => (
        <Card key={half}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="w-4 h-4" />Appel — {HALF_DAY_LABEL[half]}
              {saved[half] && <span className="text-xs font-normal text-green-600">(enregistré)</span>}
            </CardTitle>
            <Button size="sm" onClick={() => submit(half)} disabled={saving === half}>
              {saving === half ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              {saved[half] ? "Mettre à jour" : "Enregistrer l'appel"}
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Cochez uniquement les apprenants absents. Après aujourd'hui, cet appel ne sera plus modifiable.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {students.map(s => (
                <label key={s.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${absent[half].has(s.id) ? "border-destructive bg-destructive/10" : ""}`}>
                  <Checkbox checked={absent[half].has(s.id)} onCheckedChange={() => toggle(half, s.id)} />
                  <span>{s.nom} {s.prenoms}</span>
                </label>
              ))}
            </div>
            {students.length === 0 && <p className="text-sm text-muted-foreground">Aucun apprenant enregistré.</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default AttendanceToday;
