import { useCallback, useEffect, useMemo, useState } from "react";
import { sdb } from "@/lib/school-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { useHolidays } from "@/hooks/use-holidays";
import {
  HALF_DAY_LABEL, computeMonthlyStats, halfDaysOf, monthLabel, sortStudents, toISODate,
  type HalfDay, type Student,
} from "@/lib/school";
import { generateKeyValuePdf, generateTablePdf } from "@/lib/pdf-utils";
import { getSchoolYear } from "@/lib/school-year";

interface Props { schoolId: string; schoolLabel: string }

interface AbsenceRow { student_id: string; session_date: string; half_day: HalfDay }

const ClassStats = ({ schoolId, schoolLabel }: Props) => {
  const { holidays, holidayLabels } = useHolidays();
  const [students, setStudents] = useState<Student[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [day, setDay] = useState<string>(toISODate(new Date()));
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());

  const load = useCallback(async () => {
    const [{ data: st }, { data: abs }] = await Promise.all([
      sdb("students").select("*").eq("school_year", getSchoolYear()).eq("school_id", schoolId),
      sdb("attendance_absences").select("student_id,session_date,half_day").eq("school_year", getSchoolYear()).eq("school_id", schoolId),
    ]);
    setStudents(sortStudents((st || []) as Student[]));
    setAbsences((abs || []) as AbsenceRow[]);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const nameOf = (id: string) => {
    const s = students.find(x => x.id === id);
    return s ? `${s.nom} ${s.prenoms ?? ""}`.trim() : "—";
  };

  const dayHalves = halfDaysOf(day, holidays);
  const dayAbsences = absences.filter(a => a.session_date === day);

  const monthly = useMemo(
    () => computeMonthlyStats(year, month0, holidays, students, absences),
    [year, month0, holidays, students, absences],
  );

  const downloadDay = async () => {
    await generateTablePdf(
      ["N°", "Apprenant", "Demi-journée"],
      dayAbsences.map((a, i) => [i + 1, nameOf(a.student_id), HALF_DAY_LABEL[a.half_day]]),
      {
        documentTitle: `Absences du ${day}`,
        centerName: schoolLabel,
        effectif: students.length,
        signatureRole: "school",
      },
    );
    toast.success("Document téléchargé");
  };

  const downloadMonth = async () => {
    await generateKeyValuePdf(
      [
        ["Mois", monthly.monthLabel],
        ["Nombre de demi-journées de classe", monthly.halfDays],
        ["Total des élèves ayant fréquenté la classe", monthly.studentsCount],
        ["Total des présences possibles (par demi-journée)", monthly.possiblePresences],
        ["Total des absences du mois", monthly.absences],
        ["Total des présences effectives", monthly.effectivePresences],
        ["Pourcentage des présences effectives", `${monthly.presenceRate}%`],
        ["Élèves n'ayant pas manqué plus de 4 classes", monthly.studentsUnder5],
        ["Élèves ayant manqué plus de 4 classes", monthly.studentsOver4],
        ["Total des absences des élèves ayant manqué plus de 4 classes", monthly.absencesOfOver4],
      ],
      {
        documentTitle: `Statistique mensuelle - ${monthly.monthLabel}`,
        centerName: schoolLabel,
        effectif: students.length,
        signatureRole: "school",
      },
    );
    toast.success("Statistique mensuelle téléchargée");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Statistique du jour</CardTitle>
          <Button variant="outline" size="sm" onClick={downloadDay}><Download className="w-4 h-4 mr-1" />Télécharger</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label>Jour</Label>
            <Input type="date" value={day} onChange={e => setDay(e.target.value)} />
          </div>
          {dayHalves.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {holidays.has(day) ? `Jour férié : ${holidayLabels[day]}` : "Pas de classe ce jour-là."}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3 text-sm">
              <div className="rounded-lg border p-3"><p className="text-muted-foreground">Effectif</p><p className="text-xl font-bold">{students.length}</p></div>
              <div className="rounded-lg border p-3"><p className="text-muted-foreground">Absences du jour</p><p className="text-xl font-bold">{dayAbsences.length}</p></div>
              <div className="rounded-lg border p-3"><p className="text-muted-foreground">Demi-journées</p><p className="text-xl font-bold">{dayHalves.length}</p></div>
            </div>
          )}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted"><tr><th className="p-2 text-left">N°</th><th className="p-2 text-left">Apprenant absent</th><th className="p-2 text-left">Demi-journée</th></tr></thead>
              <tbody>
                {dayAbsences.length === 0 ? (
                  <tr><td colSpan={3} className="p-3 text-muted-foreground">Aucune absence enregistrée ce jour.</td></tr>
                ) : dayAbsences.map((a, i) => (
                  <tr key={a.student_id + a.half_day} className="border-t">
                    <td className="p-2">{i + 1}</td><td className="p-2">{nameOf(a.student_id)}</td><td className="p-2">{HALF_DAY_LABEL[a.half_day]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Statistique du mois</CardTitle>
          <Button variant="outline" size="sm" onClick={downloadMonth}><Download className="w-4 h-4 mr-1" />Télécharger</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Mois</Label>
              <Select value={String(month0)} onValueChange={v => setMonth0(Number(v))}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i} value={String(i)}>{monthLabel(year, i).split(" ")[0]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Année</Label>
              <Input type="number" className="w-28" value={year} onChange={e => setYear(Number(e.target.value))} />
            </div>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ["Mois", monthly.monthLabel],
                  ["Nombre de demi-journées de classe", monthly.halfDays],
                  ["Total des élèves ayant fréquenté la classe", monthly.studentsCount],
                  ["Total des présences possibles (par demi-journée)", monthly.possiblePresences],
                  ["Total des absences du mois", monthly.absences],
                  ["Total des présences effectives", monthly.effectivePresences],
                  ["Pourcentage des présences effectives", `${monthly.presenceRate}%`],
                  ["Élèves n'ayant pas manqué plus de 4 classes", monthly.studentsUnder5],
                  ["Élèves ayant manqué plus de 4 classes", monthly.studentsOver4],
                  ["Total des absences des élèves ayant manqué plus de 4 classes", monthly.absencesOfOver4],
                ].map(([k, v]) => (
                  <tr key={String(k)} className="border-t">
                    <td className="p-2 text-muted-foreground">{k}</td>
                    <td className="p-2 font-medium">{String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClassStats;
