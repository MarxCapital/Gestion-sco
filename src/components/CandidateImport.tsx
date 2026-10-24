import { useState, useRef } from "react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Eye, Check, Loader2, X } from "lucide-react";
import { sortAlphabetically } from "@/lib/calculations";
import { getSchoolYear } from "@/lib/school-year";
import { useSchoolYear } from "@/contexts/SchoolYearContext";

interface ExtractedCandidate {
  numero_table: string | null;
  nom: string;
  prenoms: string | null;
  sexe: string | null;
  ecole_provenance: string | null;
}

interface Props {
  centers?: { id: string; identifier: string; display_name: string | null; role?: string }[];
  onImported: () => void;
  /** When provided, hides the center picker and uses this id (e.g. for independent accounts importing into their own account). */
  fixedCenterId?: string;
}

const CandidateImport = ({ centers, onImported, fixedCenterId }: Props) => {
  const { readOnly } = useSchoolYear();
  const [centerId, setCenterId] = useState(fixedCenterId || "");
  const [extracting, setExtracting] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [preview, setPreview] = useState<ExtractedCandidate[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(Array.from(e.target.files || []));
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleExtract = async () => {
    if (selectedFiles.length === 0 || !centerId) {
      toast.error("Sélectionnez un centre et au moins un fichier");
      return;
    }

    setExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let allCandidates: ExtractedCandidate[] = [...preview];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setCurrentFileIndex(i + 1);
        toast.info(`Extraction fichier ${i + 1}/${selectedFiles.length}...`);

        const base64 = await readFileAsBase64(file);

        const resp = await fetch(
          `${SUPABASE_URL}/functions/v1/extract-candidates`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({ file_base64: base64 }),
          }
        );

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error);

        const extracted = (data.candidates || []) as ExtractedCandidate[];
        if (data.warnings?.length) toast.warning(`${file.name} : ${data.warnings.length} point(s) à vérifier (ex. ${data.warnings[0]})`);
        allCandidates = [...allCandidates, ...extracted];
      }

      const sorted = sortAlphabetically(allCandidates);
      setPreview(sorted);
      toast.success(`${allCandidates.length} candidats extraits au total`);
    } catch (e: any) {
      toast.error(e.message || "Erreur d'extraction");
    } finally {
      setExtracting(false);
      setCurrentFileIndex(0);
    }
  };

  const updatePreview = (index: number, field: keyof ExtractedCandidate, value: string) => {
    setPreview(prev => prev.map((c, i) => i === index ? { ...c, [field]: value || null } : c));
  };

  const removeFromPreview = (index: number) => {
    setPreview(prev => prev.filter((_, i) => i !== index));
  };

  const handleValidate = async () => {
    if (preview.length === 0) return;
    setInserting(true);
    try {
      // Récupérer le sort_order le plus haut existant pour ne pas écraser l'ordre des candidats déjà présents
      const { data: existing } = await supabase
        .from("candidates")
        .select("sort_order")
        .eq("school_year", getSchoolYear())
        .eq("center_id", centerId)
        .order("sort_order" as any, { ascending: false })
        .limit(1);
      const baseOrder = (existing && existing[0]?.sort_order) ? existing[0].sort_order : 0;

      const rows = preview.map((c, i) => ({
        center_id: centerId,
        school_year: getSchoolYear(),
        numero_table: c.numero_table,
        nom: c.nom,
        prenoms: c.prenoms,
        sexe: c.sexe,
        ecole_provenance: c.ecole_provenance,
        is_absent: false,
        sort_order: baseOrder + i + 1,
      }));
      const { error } = await supabase.from("candidates").insert(rows as any);
      if (error) throw error;
      toast.success(`${preview.length} candidats ajoutés au centre`);
      setPreview([]);
      setSelectedFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch (e: any) {
      toast.error(e.message || "Erreur d'insertion");
    } finally {
      setInserting(false);
    }
  };

  if (readOnly) {
    return <p className="text-sm text-muted-foreground">Année archivée : consultation et téléchargement uniquement.</p>;
  }

  return (
    <div className="space-y-4">
      <div className={`grid grid-cols-1 ${fixedCenterId ? "md:grid-cols-2" : "md:grid-cols-3"} gap-4`}>
        {!fixedCenterId && (
          <div className="space-y-2">
            <Label>Centre</Label>
            <Select value={centerId} onValueChange={setCenterId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un centre" /></SelectTrigger>
              <SelectContent>
                {(centers || []).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name || c.identifier}
                    {c.role === 'independent' && <span className="text-xs text-muted-foreground ml-1">(indépendant)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Fichiers PDF ({selectedFiles.length} sélectionné{selectedFiles.length > 1 ? "s" : ""})</Label>
          <p className="text-xs text-muted-foreground">Vous pouvez sélectionner plusieurs listes en une fois. L'extraction se fait fichier par fichier.</p>
          <Input ref={fileRef} type="file" accept="application/pdf" multiple onChange={handleFilesChange} />
        </div>
        <div className="flex items-end">
          <Button onClick={handleExtract} disabled={extracting || !centerId || selectedFiles.length === 0}>
            {extracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {extracting ? `Extraction ${currentFileIndex}/${selectedFiles.length}...` : "Extraire les données"}
          </Button>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <h3 className="font-semibold">Prévisualisation ({preview.length} candidats)</h3>
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="p-2 text-left">N° Table</th>
                  <th className="p-2 text-left">Nom</th>
                  <th className="p-2 text-left">Prénom(s)</th>
                  <th className="p-2 text-left">Sexe</th>
                  <th className="p-2 text-left">École</th>
                  <th className="p-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {preview.map((c, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1"><Input className="h-7 text-xs" value={c.numero_table ?? ""} onChange={e => updatePreview(i, "numero_table", e.target.value)} /></td>
                    <td className="p-1"><Input className="h-7 text-xs" value={c.nom ?? ""} onChange={e => updatePreview(i, "nom", e.target.value)} /></td>
                    <td className="p-1"><Input className="h-7 text-xs" value={c.prenoms ?? ""} onChange={e => updatePreview(i, "prenoms", e.target.value)} /></td>
                    <td className="p-1"><Input className="h-7 text-xs w-14" value={c.sexe ?? ""} onChange={e => updatePreview(i, "sexe", e.target.value)} /></td>
                    <td className="p-1"><Input className="h-7 text-xs" value={c.ecole_provenance ?? ""} onChange={e => updatePreview(i, "ecole_provenance", e.target.value)} /></td>
                    <td className="p-1"><Button variant="ghost" size="sm" onClick={() => removeFromPreview(i)}><X className="w-3 h-3 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={handleValidate} disabled={inserting} className="w-full">
            {inserting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            {inserting ? "Ajout en cours..." : `Valider et ajouter ${preview.length} candidats`}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CandidateImport;
