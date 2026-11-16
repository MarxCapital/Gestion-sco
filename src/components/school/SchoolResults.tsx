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
  type Student, type StudentNote, type StudentResult,
} from "@/lib/school";
import { generateTablePdf } from "@/lib/pdf-utils";
import { getSchoolYear } from "@/lib/school-year";

interface Props { schoolId: string; schoolLabel: string }

type Order = "alpha" | "merite" | "sexe";

const SchoolResults = ({ schoolId, schoolLabel }: Props) => {
  const [evaluationKey, setEvaluationKey] = useState<string | null>(null);
  const [order, setOrder] = useState<Order>("alpha");
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

  const sorted: StudentResult[] = [...results].sort((a, b) => {
    if (order === "merite") return (b.moyenne ?? -1) - (a.moyenne ?? -1);
    if (order === "sexe") {
      const sa = (a.sexe ?? "").toUpperCase();
      const sb = (b.sexe ?? "").toUpperCase();
      if (sa !== sb) return sa.localeCompare(sb, "fr");
    }
    const n = a.nom.localeCompare(b.nom, "fr");
    return n !== 0 ? n : (a.prenoms ?? "").localeCompare(b.prenoms ?? "", "fr");
  });

  const headers = ["N°", "Matricule", "Nom", "Prénom(s)", "Sexe", ...SCHOOL_SUBJECTS.map(s => s.label), "Total", "Moy.", "Rang"];
  const body = sorted.map((r, i) => [
    i + 1, r.matricule ?? "", r.nom, r.prenoms ?? "", r.sexe ?? "",
    ...SCHOOL_SUBJECTS.map(s => r.notes[s.key] ?? ""),
    r.total ?? "", r.moyenne ?? "", r.rang ?? "",
  ]);

  const download = async () => {
    if (!evaluationKey) return;
    await generateTablePdf(headers, body, {
      documentTitle: `Résultats - ${evaluationLabel(evaluationKey)}`,
      centerName: schoolLabel,
      effectif: students.length,
      signatureRole: "school",
      orientation: "landscape",
    });
    toast.success("Résultats téléchargés");
  };

  return (
    <div className="space-y-6">
      <EvaluationPicker value={evaluationKey} onChange={setEvaluationKey} />

      {evaluationKey && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Ordre d'affichage</Label>
              <Select value={order} onValueChange={v => setOrder(v as Order)}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alpha">Ordre alphabétique</SelectItem>
                  <SelectItem value="merite">Ordre de mérite</SelectItem>
                  <SelectItem value="sexe">Par sexe</SelectItem>
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

export default SchoolResults;
