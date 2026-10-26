import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { sdb } from "@/lib/school-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, Loader2, Pencil, Plus, Save, Trash2, Upload, X, XCircle } from "lucide-react";
import { sortStudents, type Student } from "@/lib/school";
import { generateTablePdf } from "@/lib/pdf-utils";
import { getSchoolYear } from "@/lib/school-year";
import { useSchoolYear } from "@/contexts/SchoolYearContext";
import SkeletonLoader from "@/components/portal/SkeletonLoader";

interface Props {
  schoolId: string;
  className?: string;
  schoolLabel: string;
}

interface Extracted {
  matricule: string | null;
  nom: string;
  prenoms: string | null;
  sexe: string | null;
}

const StudentsList = ({ schoolId, schoolLabel }: Props) => {
  const { readOnly } = useSchoolYear();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, Partial<Student>>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [preview, setPreview] = useState<Extracted[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sdb("students").select("*").eq("school_year", getSchoolYear()).eq("school_id", schoolId);
    if (error) toast.error("Erreur de chargement des élèves");
    setStudents(sortStudents((data || []) as Student[]));
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const readBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const extract = async () => {
    if (files.length === 0) return;
    setExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let all: Extracted[] = [...preview];
      for (const file of files) {
        const base64 = await readBase64(file);
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/extract-candidates`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ file_base64: base64 }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);
        // Le numéro détecté sur la liste est ici le matricule de l'apprenant
        const rows = (data.candidates || []).map((c: any) => ({
          matricule: c.matricule ?? c.numero_table ?? null,
          nom: c.nom,
          prenoms: c.prenoms ?? null,
          sexe: c.sexe ?? null,
        }));
        all = [...all, ...rows];
      }
      setPreview(all);
      toast.success(`${all.length} apprenants extraits`);
    } catch (e: any) {
      toast.error(e.message || "Erreur d'extraction");
    } finally {
      setExtracting(false);
    }
  };

  const validate = async () => {
    if (preview.length === 0) return;
    setInserting(true);
    const base = students.length;
    const rows = preview.map((p, i) => ({
      school_id: schoolId,
      school_year: getSchoolYear(),
      matricule: p.matricule,
      nom: p.nom,
      prenoms: p.prenoms,
      sexe: p.sexe,
      sort_order: base + i + 1,
    }));
    const { error } = await sdb("students").insert(rows);
    setInserting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} apprenants ajoutés`);
    setPreview([]); setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const addEmpty = async () => {
    const { error } = await sdb("students").insert({
      school_id: schoolId, school_year: getSchoolYear(), nom: "Nouvel apprenant", sort_order: students.length + 1,
    });
    if (error) { toast.error(error.message); return; }
    load();
  };

  const save = async (id: string) => {
    const changes = editing[id];
    if (!changes) return;
    const { error } = await sdb("students").update(changes).eq("id", id);
    if (error) { toast.error("Erreur de sauvegarde"); return; }
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
    toast.success("Modifié");
  };

  const remove = async (id: string) => {
    const { error } = await sdb("students").delete().eq("id", id);
    if (error) { toast.error("Erreur de suppression"); return; }
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const download = async () => {
    await generateTablePdf(
      ["N°", "Matricule", "Nom", "Prénom(s)", "Sexe"],
      students.map((s, i) => [i + 1, s.matricule ?? "", s.nom, s.prenoms ?? "", s.sexe ?? ""]),
      {
        documentTitle: `Liste des apprenants - ${schoolLabel}`,
        centerName: schoolLabel,
        effectif: students.length,
        signatureRole: "school",
      },
    );
    toast.success("Liste téléchargée");
  };

  return (
    <div className="space-y-6">
      {!readOnly && (
      <Card>
        <CardHeader><CardTitle className="text-base">Importer une liste (PDF)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Fichiers PDF ({files.length})</Label>
              <Input ref={fileRef} type="file" accept="application/pdf" multiple onChange={e => setFiles(Array.from(e.target.files || []))} />
              <p className="text-xs text-muted-foreground">Le numéro figurant sur la liste est enregistré comme matricule.</p>
            </div>
            <div className="flex items-end">
              <Button onClick={extract} disabled={extracting || files.length === 0}>
                {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                Extraire les données
              </Button>
            </div>
          </div>

          {preview.length > 0 && (
            <div className="space-y-3">
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted"><tr>
                    <th className="p-2 text-left">Matricule</th><th className="p-2 text-left">Nom</th>
                    <th className="p-2 text-left">Prénom(s)</th><th className="p-2 text-left">Sexe</th><th className="w-8" />
                  </tr></thead>
                  <tbody>
                    {preview.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1"><Input className="h-7 text-xs" value={p.matricule ?? ""} onChange={e => setPreview(prev => prev.map((x, j) => j === i ? { ...x, matricule: e.target.value } : x))} /></td>
                        <td className="p-1"><Input className="h-7 text-xs" value={p.nom} onChange={e => setPreview(prev => prev.map((x, j) => j === i ? { ...x, nom: e.target.value } : x))} /></td>
                        <td className="p-1"><Input className="h-7 text-xs" value={p.prenoms ?? ""} onChange={e => setPreview(prev => prev.map((x, j) => j === i ? { ...x, prenoms: e.target.value } : x))} /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-14" value={p.sexe ?? ""} onChange={e => setPreview(prev => prev.map((x, j) => j === i ? { ...x, sexe: e.target.value } : x))} /></td>
                        <td className="p-1"><Button variant="ghost" size="sm" onClick={() => setPreview(prev => prev.filter((_, j) => j !== i))}><X className="w-3 h-3 text-destructive" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button className="w-full" onClick={validate} disabled={inserting}>
                {inserting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Valider et ajouter {preview.length} apprenants
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">{students.length} apprenant(s)</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addEmpty}><Plus className="w-4 h-4 mr-1" />Ajouter</Button>
          <Button variant="outline" size="sm" onClick={download}><Download className="w-4 h-4 mr-1" />Télécharger</Button>
        </div>
      </div>

      {loading ? <SkeletonLoader rows={6} /> : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted"><tr>
              <th className="p-2 text-left">N°</th><th className="p-2 text-left">Matricule</th>
              <th className="p-2 text-left">Nom</th><th className="p-2 text-left">Prénom(s)</th>
              <th className="p-2 text-left">Sexe</th><th className="p-2">Actions</th>
            </tr></thead>
            <tbody>
              {students.map((s, i) => {
                const ed = editing[s.id];
                return (
                  <tr key={s.id} className="border-t">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">{ed ? <Input className="h-7 text-xs" value={ed.matricule ?? s.matricule ?? ""} onChange={e => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], matricule: e.target.value } }))} /> : s.matricule}</td>
                    <td className="p-2">{ed ? <Input className="h-7 text-xs" value={ed.nom ?? s.nom} onChange={e => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], nom: e.target.value } }))} /> : s.nom}</td>
                    <td className="p-2">{ed ? <Input className="h-7 text-xs" value={ed.prenoms ?? s.prenoms ?? ""} onChange={e => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], prenoms: e.target.value } }))} /> : s.prenoms}</td>
                    <td className="p-2">{ed ? <Input className="h-7 text-xs w-14" value={ed.sexe ?? s.sexe ?? ""} onChange={e => setEditing(p => ({ ...p, [s.id]: { ...p[s.id], sexe: e.target.value } }))} /> : s.sexe}</td>
                    <td className="p-2 text-center">
                      {ed ? (
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="sm" onClick={() => save(s.id)}><Save className="w-3 h-3 text-green-600" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => setEditing(p => { const n = { ...p }; delete n[s.id]; return n; })}><XCircle className="w-3 h-3 text-destructive" /></Button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(p => ({ ...p, [s.id]: {} }))}><Pencil className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => remove(s.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StudentsList;
