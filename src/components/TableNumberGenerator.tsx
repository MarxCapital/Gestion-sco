import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Hash, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { sortAlphabetically } from "@/lib/calculations";
import { getSchoolYear } from "@/lib/school-year";

interface CenterRow {
  id: string;
  identifier: string;
  display_name: string | null;
  role: string;
}

const ROOMS_PER_CENTER = 30;
const STUDENTS_PER_ROOM = 35;
const ROOM_OPTIONS = Array.from({ length: ROOMS_PER_CENTER }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);

const TableNumberGenerator = () => {
  const [centers, setCenters] = useState<CenterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [centerId, setCenterId] = useState("");
  const [centerCode, setCenterCode] = useState("");
  const [salleStart, setSalleStart] = useState<string>("S01");
  const [salleEnd, setSalleEnd] = useState<string>("S01");
  const [sallesAvec36, setSallesAvec36] = useState<string[]>([]);
  const [resort, setResort] = useState<boolean>(true);
  const [generating, setGenerating] = useState(false);
  const [previewCount, setPreviewCount] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").neq("identifier", "Marx"),
        supabase.from("user_roles").select("*"),
      ]);
      const all = ((profiles as any) || []).map((p: any) => ({
        ...p,
        role: ((roles as any) || []).find((r: any) => r.user_id === p.id)?.role,
      })) as CenterRow[];
      setCenters(all.filter(c => c.role === "center" || c.role === "independent"));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!centerId) { setPreviewCount(0); return; }
    (async () => {
      const { count } = await supabase
        .from("candidates")
        .select("id", { count: "exact", head: true })
        .eq("school_year", getSchoolYear())
        .eq("center_id", centerId);
      setPreviewCount(count || 0);
    })();
  }, [centerId]);

  // Build the ordered list of (salle, ordre) slots based on the chosen room range
  const slots = useMemo(() => {
    const startIdx = ROOM_OPTIONS.indexOf(salleStart);
    const endIdx = ROOM_OPTIONS.indexOf(salleEnd);
    if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return [] as { salle: string; ordre: number }[];
    const list: { salle: string; ordre: number }[] = [];
    for (let r = startIdx; r <= endIdx; r++) {
      const cap = sallesAvec36.includes(ROOM_OPTIONS[r]) ? 36 : STUDENTS_PER_ROOM;
      for (let n = 1; n <= cap; n++) {
        list.push({ salle: ROOM_OPTIONS[r], ordre: n });
      }
    }
    return list;
  }, [salleStart, salleEnd, sallesAvec36]);

  const total = slots.length;
  const sampleFirst = centerCode && slots[0]
    ? `${centerCode}${slots[0].salle}${String(slots[0].ordre).padStart(2, "0")}`
    : "—";
  const sampleLast = centerCode && slots[slots.length - 1]
    ? `${centerCode}${slots[slots.length - 1].salle}${String(slots[slots.length - 1].ordre).padStart(2, "0")}`
    : "—";

  const handleGenerate = async () => {
    if (!centerId) { toast.error("Sélectionnez un centre"); return; }
    if (!centerCode.trim()) { toast.error("Renseignez le numéro d'identification du centre"); return; }
    if (total <= 0) { toast.error("Plage de salles invalide"); return; }

    setGenerating(true);
    try {
      const { data: candidates, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("school_year", getSchoolYear())
        .eq("center_id", centerId)
        .order("sort_order" as any);
      if (error) throw error;
      let list = (candidates as any[]) || [];

      if (resort) list = sortAlphabetically(list);

      if (list.length === 0) {
        toast.error("Ce centre n'a aucun candidat");
        setGenerating(false);
        return;
      }

      const code = centerCode.trim();
      const slice = list.slice(0, Math.min(total, list.length));

      const updates = slice.map((c, i) => {
        const { salle, ordre } = slots[i];
        const numero_table = `${code}${salle}${String(ordre).padStart(2, "0")}`;
        return { id: c.id, numero_table, sort_order: i + 1 };
      });

      let okCount = 0;
      for (const u of updates) {
        const { error: upErr } = await supabase
          .from("candidates")
          .update({ numero_table: u.numero_table, sort_order: u.sort_order } as any)
          .eq("id", u.id);
        if (!upErr) okCount++;
      }

      if (resort && list.length > slice.length) {
        for (let i = slice.length; i < list.length; i++) {
          await supabase
            .from("candidates")
            .update({ sort_order: i + 1 } as any)
            .eq("id", list[i].id);
        }
      }

      toast.success(
        `${okCount} numéro(s) attribué(s) (${updates[0].numero_table} → ${updates[updates.length - 1].numero_table})`
      );
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="w-4 h-4" /> Générateur de numéros de table
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Choisissez la plage de salles (de S01 à S30). Chaque salle reçoit automatiquement {STUDENTS_PER_ROOM} apprenants.
          Lorsque le 35ᵉ numéro est atteint, le système passe à la salle suivante et recommence à 01.
          <br />Exemple : <code className="text-xs bg-muted px-1 rounded">125285 + S01→S02 → 125285S0101 … 125285S0135 → 125285S0201 … 125285S0235</code>.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2 sm:col-span-2">
            <Label>Centre</Label>
            <Select value={centerId} onValueChange={setCenterId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un centre ou indépendant" /></SelectTrigger>
              <SelectContent>
                {centers.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {(c.display_name || c.identifier)}{" "}
                    <span className="text-xs text-muted-foreground">({c.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {centerId && (
              <p className="text-xs text-muted-foreground">{previewCount} candidat(s) dans ce centre.</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>N° d'identification du centre</Label>
            <Input value={centerCode} onChange={e => setCenterCode(e.target.value)} placeholder="ex: 125285" />
          </div>

          <div className="space-y-2">
            <Label>Salle de début</Label>
            <Select value={salleStart} onValueChange={(v) => {
              setSalleStart(v);
              if (ROOM_OPTIONS.indexOf(v) > ROOM_OPTIONS.indexOf(salleEnd)) setSalleEnd(v);
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {ROOM_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Salle de fin</Label>
            <Select value={salleEnd} onValueChange={setSalleEnd}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {ROOM_OPTIONS
                  .filter(r => ROOM_OPTIONS.indexOf(r) >= ROOM_OPTIONS.indexOf(salleStart))
                  .map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label>Salles ayant 36 candidats (optionnel)</Label>
            <p className="text-xs text-muted-foreground">
              Cochez les salles concernées : ces salles recevront 36 numéros au lieu de 35.
            </p>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-auto rounded-md border p-2 bg-muted/20">
              {ROOM_OPTIONS
                .filter(r => ROOM_OPTIONS.indexOf(r) >= ROOM_OPTIONS.indexOf(salleStart) && ROOM_OPTIONS.indexOf(r) <= ROOM_OPTIONS.indexOf(salleEnd))
                .map(r => {
                  const checked = sallesAvec36.includes(r);
                  return (
                    <label key={r} className={`flex items-center gap-1 text-xs px-2 py-1 rounded border cursor-pointer ${checked ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        onChange={() => setSallesAvec36(prev => checked ? prev.filter(x => x !== r) : [...prev, r])}
                      />
                      {r}
                    </label>
                  );
                })}
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2 flex items-end">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={resort} onChange={e => setResort(e.target.checked)} />
              Reclasser par ordre alphabétique avant attribution
            </label>
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p>
            <span className="text-muted-foreground">Capacité totale : </span>
            <strong>{total}</strong> place(s) sur {Math.max(0, ROOM_OPTIONS.indexOf(salleEnd) - ROOM_OPTIONS.indexOf(salleStart) + 1)} salle(s)
            {previewCount > 0 && (
              <> — <strong>{Math.min(total, previewCount)}</strong> candidat(s) recevront un numéro.</>
            )}
          </p>
          <p className="mt-1">
            <span className="text-muted-foreground">Premier : </span><code className="text-xs">{sampleFirst}</code>
            <span className="text-muted-foreground ml-3">Dernier : </span><code className="text-xs">{sampleLast}</code>
          </p>
        </div>

        <Button onClick={handleGenerate} disabled={generating || !centerId || total <= 0} className="w-full sm:w-auto">
          {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
          Générer & attribuer les numéros
        </Button>
      </CardContent>
    </Card>
  );
};

export default TableNumberGenerator;
