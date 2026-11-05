import { useCallback, useEffect, useState } from "react";
import { sdb } from "@/lib/school-db";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download } from "lucide-react";
import EvaluationPicker from "./EvaluationPicker";
import {
  SCHOOL_SUBJECTS, computeStudentResults, evaluationLabel, sortStudents,
  type Student, type StudentNote,
} from "@/lib/school";
import { generateTablePdf } from "@/lib/pdf-utils";
import { getSchoolYear } from "@/lib/school-year";

interface Props { schoolId: string; schoolLabel: string }

const isBoy = (s: { sexe: string | null }) => (s.sexe ?? "").trim().toUpperCase().startsWith("M");
const isGirl = (s: { sexe: string | null }) => (s.sexe ?? "").trim().toUpperCase().startsWith("F");

const EvaluationStats = ({ schoolId, schoolLabel }: Props) => {
  const [evaluationKey, setEvaluationKey] = useState<string | null>(null);
  const [view, setView] = useState<"classe" | "matiere">("classe");
  const [students, setStudents] = useState<Student[]>([]);
  const [notes, setNotes] = useState<StudentNote[]>([]);

  useEffect(() => {
    sdb("students").select("*").eq("school_year", getSchoolYear()).eq("school_id", schoolId).then(({ data }: any) =>
      setStudents(sortStudents((data || []) as Student[])));
  }, [schoolId]);

  const load = useCallback(async () => {
    if (!evaluationKey) { setNotes([]); return; }
    const { data } = await sdb("student_notes").select("student_id,evaluation_key,subject_key,note")
      .eq("school_year", getSchoolYear()).eq("school_id", schoolId).eq("evaluation_key", evaluationKey);
    setNotes((data || []) as StudentNote[]);
  }, [schoolId, evaluationKey]);

  useEffect(() => { load(); }, [load]);

  const results = computeStudentResults(students, notes);

  const countTrio = (predicate: (s: Student) => boolean) => {
    const list = students.filter(predicate);
    return { g: list.filter(isBoy).length, f: list.filter(isGirl).length, t: list.length };
  };

  // ------- Vue classe -------
  const inscrits = countTrio(() => true);
  const composed = results.filter(r => r.moyenne !== null);
  const admis = composed.filter(r => (r.moyenne ?? 0) >= 10);
  const trio = (list: { sexe: string | null }[]) => ({ g: list.filter(isBoy).length, f: list.filter(isGirl).length, t: list.length });
  const cComposed = trio(composed);
  const cAdmis = trio(admis);
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

  const classHeaders = ["Rubrique", "G", "F", "T"];
  const classBody: (string | number)[][] = [
    ["Inscrits", inscrits.g, inscrits.f, inscrits.t],
    ["Ont composé", cComposed.g, cComposed.f, cComposed.t],
    ["Ont la moyenne", cAdmis.g, cAdmis.f, cAdmis.t],
    ["Pourcentage de réussite", `${pct(cAdmis.g, cComposed.g)}%`, `${pct(cAdmis.f, cComposed.f)}%`, `${pct(cAdmis.t, cComposed.t)}%`],
  ];

  // ------- Vue matière -------
  const subjectHeaders = [
    "Matières",
    "Inscrits G", "Inscrits F", "Inscrits T",
    "Ont composé G", "Ont composé F", "Ont composé T",
    "Ont la moyenne G", "Ont la moyenne F", "Ont la moyenne T",
    "% réussite G", "% réussite F", "% réussite T",
  ];
  const subjectBody: (string | number)[][] = SCHOOL_SUBJECTS.map(sub => {
    const withNote = results.filter(r => r.notes[sub.key] !== null && r.notes[sub.key] !== undefined);
    const ok = withNote.filter(r => (r.notes[sub.key] ?? 0) >= 10);
    const i = inscrits, c = trio(withNote), a = trio(ok);
    return [
      sub.label,
      i.g, i.f, i.t,
      c.g, c.f, c.t,
      a.g, a.f, a.t,
      `${pct(a.g, c.g)}%`, `${pct(a.f, c.f)}%`, `${pct(a.t, c.t)}%`,
    ];
  });

  const headers = view === "classe" ? classHeaders : subjectHeaders;
  const body = view === "classe" ? classBody : subjectBody;

  const download = async () => {
    if (!evaluationKey) return;
    await generateTablePdf(headers, body, {
      documentTitle: `Statistique de l'évaluation (${view === "classe" ? "classe" : "par matière"}) - ${evaluationLabel(evaluationKey)}`,
      centerName: schoolLabel,
      effectif: students.length,
      signatureRole: "school",
      orientation: view === "classe" ? "portrait" : "landscape",
    });
    toast.success("Statistique téléchargée");
  };

  return (
    <div className="space-y-6">
      <EvaluationPicker value={evaluationKey} onChange={setEvaluationKey} />

      {evaluationKey && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Type de statistique</Label>
              <Select value={view} onValueChange={v => setView(v as "classe" | "matiere")}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classe">La classe</SelectItem>
                  <SelectItem value="matiere">Par matière</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={download} className="ml-auto">
              <Download className="w-4 h-4 mr-2" />Télécharger
            </Button>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted"><tr>{headers.map(h => <th key={h} className="p-2 text-left whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody>
                {body.map((row, i) => (
                  <tr key={i} className="border-t">
                    {row.map((cell, j) => <td key={j} className="p-2 whitespace-nowrap">{String(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default EvaluationStats;
