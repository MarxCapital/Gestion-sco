import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, WifiOff } from "lucide-react";
import { SUBJECTS, computeResults, sortByOrder, getUniqueSchools, matchesSchool, type CandidateRow, type NotesRow, type CandidateResult } from "@/lib/calculations";
import { generateResultsPdf } from "@/lib/pdf-utils";
import { useAuth } from "@/contexts/AuthContext";
import { getOfflineCandidatesWithNotes } from "@/lib/offline-data";
import { saveCandidatesOffline, saveAllNotesOffline } from "@/lib/offline-storage";
import { getSchoolYear } from "@/lib/school-year";
import SkeletonLoader from "@/components/portal/SkeletonLoader";

interface Props {
  centerId?: string;
  requireFilter?: boolean;
  centers?: { id: string; identifier: string; display_name?: string }[];
}

const ResultsTable = ({ centerId, requireFilter = false, centers }: Props) => {
  const { role, profile } = useAuth();
  const sigRole: 'center' | 'ccs' | 'none' = role === 'csbante' ? 'ccs' : role === 'admin' ? 'none' : 'center';
  const [results, setResults] = useState<CandidateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCenter, setFilterCenter] = useState("");
  const [filterSchool, setFilterSchool] = useState("");
  const [filterSeuil, setFilterSeuil] = useState("");
  const [filterRang, setFilterRang] = useState("");
  const [sortByRank, setSortByRank] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const cId = centerId || (filterCenter && filterCenter !== "__global__" ? filterCenter : "");
    const isGlobal = filterCenter === "__global__";

    if (false /* hors ligne : géré par la passerelle */) {
      try {
        const offline = await getOfflineCandidatesWithNotes(cId || undefined);
        setResults(computeResults(offline));
        if (offline.length > 0) toast.info("Données chargées hors ligne");
      } catch { toast.error("Erreur chargement hors ligne"); }
      setLoading(false);
      return;
    }

    if (isGlobal || !cId) {
      const filters = cId ? [{ column: "center_id", value: cId }] : undefined;
      const { data, error } = await fetchAllRows("candidates", "*, notes(*)", filters);
      if (error) {
        try { const offline = await getOfflineCandidatesWithNotes(cId || undefined); setResults(computeResults(offline)); toast.info("Données hors ligne"); } catch { toast.error("Erreur"); }
        setLoading(false); return;
      }
      const sorted = sortByOrder((data || []) as (CandidateRow & { notes: NotesRow | null })[]);
      setResults(computeResults(sorted));
      // Cache offline
      saveCandidatesOffline(sorted.map(({ notes: _n, ...c }) => c)).catch(() => {});
      saveAllNotesOffline(sorted.filter(c => c.notes).map(c => ({ candidate_id: c.id, ...c.notes }))).catch(() => {});
    } else {
      const { data, error } = await supabase.from("candidates").select("*, notes(*)").eq("school_year", getSchoolYear()).eq("center_id", cId);
      if (error) {
        try { const offline = await getOfflineCandidatesWithNotes(cId); setResults(computeResults(offline)); toast.info("Données hors ligne"); } catch { toast.error("Erreur"); }
        setLoading(false); return;
      }
      const sorted = sortByOrder((data || []) as (CandidateRow & { notes: NotesRow | null })[]); 
      setResults(computeResults(sorted));
      saveCandidatesOffline(sorted.map(({ notes: _n, ...c }) => c)).catch(() => {});
      saveAllNotesOffline(sorted.filter(c => c.notes).map(c => ({ candidate_id: c.id, ...c.notes }))).catch(() => {});
    }
    setLoading(false);
  }, [centerId, filterCenter]);

  useEffect(() => {
    if (requireFilter && !centerId && !filterCenter) return;
    fetchData();
  }, [fetchData, requireFilter, isOffline]);

  const schools = getUniqueSchools(results);
  let filtered = results;
  if (filterSchool && filterSchool !== "__all__") filtered = filtered.filter(c => matchesSchool(c, filterSchool));
  if (filterSeuil === "oui") filtered = filtered.filter(c => c.seuilAtteint);
  else if (filterSeuil === "non") filtered = filtered.filter(c => !c.seuilAtteint && !c.is_absent);
  if (filterRang && filterRang !== "__all__") {
    const maxRang = parseInt(filterRang, 10);
    if (!isNaN(maxRang)) filtered = filtered.filter(c => c.rang !== null && c.rang <= maxRang);
  }
  if (sortByRank || (filterRang && filterRang !== "__all__")) {
    filtered = [...filtered].sort((a, b) => (a.rang ?? 9999) - (b.rang ?? 9999));
  }

  if (requireFilter && !centerId && !filterCenter) {
    return (
      <div className="space-y-4">
        {centers && (
          <div className="space-y-2">
            <Label>Centre</Label>
            <Select value={filterCenter} onValueChange={setFilterCenter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Choisir un filtre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">Global (tous les centres)</SelectItem>
                {centers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name || c.identifier}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="text-muted-foreground">Sélectionnez un filtre pour afficher les résultats.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isOffline && <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-md"><WifiOff className="w-4 h-4" />Mode hors ligne</div>}
       <div className="flex gap-4 flex-wrap items-end border bg-card p-4 shadow-soft">
        {centers && !centerId && (
          <div className="space-y-2">
            <Label>Centre</Label>
            <Select value={filterCenter} onValueChange={v => { setFilterCenter(v); setFilterSchool(""); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Choisir un filtre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">Global (tous les centres)</SelectItem>
                {centers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name || c.identifier}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {schools.length > 0 && (
          <div className="space-y-2">
            <Label>École</Label>
            <Select value={filterSchool} onValueChange={setFilterSchool}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes</SelectItem>
                {schools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Seuil</Label>
          <Select value={filterSeuil} onValueChange={setFilterSeuil}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous</SelectItem>
              <SelectItem value="oui">Seuil atteint</SelectItem>
              <SelectItem value="non">Seuil non atteint</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Rang</Label>
          <Select value={filterRang} onValueChange={setFilterRang}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Tous" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous</SelectItem>
              <SelectItem value="1">1er</SelectItem>
              <SelectItem value="3">Top 3</SelectItem>
              <SelectItem value="5">Top 5</SelectItem>
              <SelectItem value="10">Top 10</SelectItem>
              <SelectItem value="20">Top 20</SelectItem>
              <SelectItem value="50">Top 50</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSortByRank(!sortByRank)}>
          {sortByRank ? "Tri alphabétique" : "Tri par rang"}
        </Button>
        <Button size="sm" onClick={() => {
          const selectedCenter = centers?.find(c => c.id === (centerId || filterCenter));
          const centerName = selectedCenter ? (selectedCenter.display_name || selectedCenter.identifier) : (profile?.display_name || profile?.identifier || undefined);
          generateResultsPdf(filtered, { documentTitle: "Résultats", centerName, effectif: filtered.length, signatureRole: sigRole });
        }}>
          <Download className="w-4 h-4 mr-2" />Télécharger
        </Button>
      </div>

       {loading ? <SkeletonLoader rows={7} /> : filtered.length === 0 ? <p className="text-muted-foreground">Aucun résultat.</p> : (
         <div className="max-w-full overflow-x-auto border">
           <table className="portal-table text-xs">
             <thead>
              <tr>
                <th className="p-1 border text-left">N°</th>
                <th className="p-1 border text-left">Nom</th>
                <th className="p-1 border text-left">Prénom(s)</th>
                <th className="p-1 border text-left">Sexe</th>
                <th className="p-1 border text-left">École</th>
                {SUBJECTS.map(s => <th key={s.key} className="p-1 border text-center">{s.label}</th>)}
                 <th className="p-1 border text-center">Total</th>
                 <th className="p-1 border text-center">Moy.</th>
                 <th className="p-1 border text-center">Rang</th>
                 <th className="p-1 border text-center">Seuil</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className={`border-t ${r.is_absent ? 'bg-muted/50 opacity-50' : ''}`}>
                  <td className="p-1 border">{r.numero_table}</td>
                  <td className="p-1 border font-medium">{r.nom}</td>
                  <td className="p-1 border">{r.prenoms}</td>
                  <td className="p-1 border">{r.sexe}</td>
                  <td className="p-1 border">{r.ecole_provenance}</td>
                  {SUBJECTS.map(s => <td key={s.key} className="p-1 border text-center">{r.notes ? ((r.notes as any)[s.key]?.toFixed(2) ?? '-') : '-'}</td>)}
                  <td className="p-1 border text-center font-semibold">{r.total?.toFixed(2) ?? '-'}</td>
                  <td className="p-1 border text-center font-semibold">{r.moyenne?.toFixed(2) ?? '-'}</td>
                  <td className="p-1 border text-center font-bold">{r.rang ? (r.rang === 1 ? `1${r.sexe === 'F' ? 'ère' : 'er'}` : `${r.rang}ième`) : '-'}</td>
                  <td className={`p-1 border text-center font-bold ${r.seuilAtteint ? 'text-green-600' : 'text-red-600'}`}>{r.is_absent ? 'ABS' : r.seuilAtteint ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ResultsTable;
