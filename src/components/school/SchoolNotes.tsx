import { useCallback, useEffect, useRef, useState } from "react";
import { sdb } from "@/lib/school-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import EvaluationPicker from "./EvaluationPicker";
import {
  SCHOOL_SUBJECTS, evaluationLabel, sortStudents,
  type Student, type StudentNote,
} from "@/lib/school";
import { downloadEducmasterNotes } from "@/lib/school-excel";
import { getSchoolYear } from "@/lib/school-year";
import { useSchoolYear } from "@/contexts/SchoolYearContext";

interface Props { schoolId: string; schoolLabel: string }

type Mode = "subject" | "student";

const SchoolNotes = ({ schoolId, schoolLabel }: Props) => {
  const { readOnly } = useSchoolYear();
  const [evaluationKey, setEvaluationKey] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("subject");
  const [subject, setSubject] = useState<string>(SCHOOL_SUBJECTS[0].key);
  const [studentIndex, setStudentIndex] = useState(0);
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<StudentNote[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    sdb("students").select("*").eq("school_year", getSchoolYear()).eq("school_id", schoolId).then(({ data }: any) => {
      setStudents(sortStudents((data || []) as Student[]));
    });
  }, [schoolId]);

  const loadNotes = useCallback(async () => {
    if (!evaluationKey) { setNotes([]); return; }
    const { data } = await sdb("student_notes").select("student_id,evaluation_key,subject_key,note")
      .eq("school_year", getSchoolYear()).eq("school_id", schoolId).eq("evaluation_key", evaluationKey);
    setNotes((data || []) as StudentNote[]);
  }, [schoolId, evaluationKey]);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  const getNote = (studentId: string, subjectKey: string): string => {
    const n = notes.find(x => x.student_id === studentId && x.subject_key === subjectKey);
    return n && n.note !== null && n.note !== undefined ? String(n.note) : "";
  };

  const setNote = (studentId: string, subjectKey: string, raw: string) => {
    if (!evaluationKey) return;
    const parsed = raw === "" ? null : Number(raw.replace(",", "."));
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > 20)) {
      toast.error("La note doit être comprise entre 0 et 20");
      return;
    }
    setNotes(prev => {
      const rest = prev.filter(n => !(n.student_id === studentId && n.subject_key === subjectKey));
      return [...rest, { student_id: studentId, evaluation_key: evaluationKey, subject_key: subjectKey, note: parsed }];
    });

    const tk = `${studentId}:${subjectKey}`;
    clearTimeout(timers.current[tk]);
    timers.current[tk] = setTimeout(async () => {
      const { error } = await sdb("student_notes").upsert(
        { school_id: schoolId, school_year: getSchoolYear(), student_id: studentId, evaluation_key: evaluationKey, subject_key: subjectKey, note: parsed, updated_at: new Date().toISOString() },
        { onConflict: "student_id,evaluation_key,subject_key" },
      );
      if (error) toast.error("Erreur d'enregistrement de la note");
    }, 700);
  };

  /** Entrée = champ suivant (vertical en mode matière, matière suivante en mode apprenant). */
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number, group: string) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`input[data-cell="${group}-${index + 1}"]`);
    if (next) { next.focus(); next.select(); }
  };

  const exportExcel = async () => {
    if (!evaluationKey) return;
    await downloadEducmasterNotes(students, notes, evaluationKey,
      `Notes ${evaluationLabel(evaluationKey)} - ${schoolLabel}`);
    toast.success("Fichier EducMaster généré");
  };

  const current = students[studentIndex];

  return (
    <div className="space-y-6">
      <EvaluationPicker value={evaluationKey} onChange={k => setEvaluationKey(k)} />

      {evaluationKey && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Mode de saisie</Label>
              <Select value={mode} onValueChange={v => setMode(v as Mode)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="subject">Par matière</SelectItem>
                  <SelectItem value="student">Par apprenant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "subject" && (
              <div className="space-y-2">
                <Label>Matière</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>{SCHOOL_SUBJECTS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            <Button variant="outline" onClick={exportExcel} className="ml-auto">
              <FileDown className="w-4 h-4 mr-2" />Télécharger fichier note educmaster
            </Button>
          </div>

          {mode === "subject" ? (
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr>
                  <th className="p-2 text-left w-10">N°</th>
                  <th className="p-2 text-left">Apprenant</th>
                  <th className="p-2 text-left w-32">Note /20</th>
                </tr></thead>
                <tbody>
                  {students.map((s, i) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">{s.nom} {s.prenoms}</td>
                      <td className="p-2">
                        <Input
                          data-cell={`col-${i}`}
                          className="h-8 w-24"
                          inputMode="decimal"
                          value={getNote(s.id, subject)}
                          onChange={e => setNote(s.id, subject, e.target.value)}
                          onKeyDown={e => onKeyDown(e, i, "col")}
                          disabled={readOnly}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : current ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {studentIndex + 1}/{students.length} — {current.nom} {current.prenoms}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={studentIndex === 0} onClick={() => setStudentIndex(i => i - 1)}>
                    <ChevronLeft className="w-4 h-4 mr-1" />Précédent
                  </Button>
                  <Button size="sm" disabled={studentIndex >= students.length - 1} onClick={() => setStudentIndex(i => i + 1)}>
                    Suivant<ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SCHOOL_SUBJECTS.map((sub, i) => (
                  <div key={sub.key} className="space-y-1">
                    <Label className="text-xs">{sub.label}</Label>
                    <Input
                      data-cell={`row-${i}`}
                      className="h-8"
                      inputMode="decimal"
                      value={getNote(current.id, sub.key)}
                      onChange={e => setNote(current.id, sub.key, e.target.value)}
                      onKeyDown={e => onKeyDown(e, i, "row")}
                      disabled={readOnly}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground">Aucun apprenant enregistré.</p>
          )}
        </>
      )}
    </div>
  );
};

export default SchoolNotes;
