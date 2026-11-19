import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Save, XCircle, WifiOff } from "lucide-react";
import { sortByOrder, getUniqueSchools, matchesSchool, type CandidateRow } from "@/lib/calculations";
import { getOfflineCandidates } from "@/lib/offline-data";
import { saveCandidatesOffline, addToSyncQueue } from "@/lib/offline-storage";
import { getSchoolYear } from "@/lib/school-year";
import { useSchoolYear } from "@/contexts/SchoolYearContext";
import SkeletonLoader from "@/components/portal/SkeletonLoader";

interface Props {
  centerId?: string;
  canMarkAbsent?: boolean;
  canEdit?: boolean;
  requireFilter?: boolean;
  centers?: { id: string; identifier: string; display_name?: string }[];
}

const CandidatesList = ({ centerId, canMarkAbsent = false, canEdit = false, requireFilter = false, centers }: Props) => {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCenter, setFilterCenter] = useState<string>("");
  const [filterSchool, setFilterSchool] = useState<string>("");
  const [editing, setEditing] = useState<Record<string, Partial<CandidateRow>>>({});
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  const { readOnly } = useSchoolYear();
  const effectiveCanEdit = canEdit && !readOnly;
  const effectiveCanMarkAbsent = canMarkAbsent && !readOnly;

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const cId = centerId || filterCenter || undefined;

    if (false /* hors ligne : géré par la passerelle */) {
      try {
        const offline = await getOfflineCandidates(cId) as CandidateRow[];
        setCandidates(offline);
        if (offline.length > 0) toast.info("Données chargées hors ligne");
      } catch { toast.error("Erreur chargement hors ligne"); }
      setLoading(false);
      return;
    }

    let query = supabase.from("candidates").select("*").eq("school_year", getSchoolYear());
    if (centerId) query = query.eq("center_id", centerId);
    else if (filterCenter) query = query.eq("center_id", filterCenter);
    const { data, error } = await query;
    if (error) {
      // Fallback offline
      try {
        const offline = await getOfflineCandidates(cId) as CandidateRow[];
        setCandidates(offline);
        toast.info("Données chargées hors ligne");
      } catch { toast.error("Erreur chargement"); }
      setLoading(false);
      return;
    }
    const sorted = sortByOrder((data || []) as CandidateRow[]);
    setCandidates(sorted);
    // Cache for offline
    saveCandidatesOffline(sorted).catch(() => {});
    setLoading(false);
  }, [centerId, filterCenter]);

  useEffect(() => {
    if (requireFilter && !centerId && !filterCenter && !filterSchool) return;
    fetchCandidates();
  }, [fetchCandidates, requireFilter, filterSchool, isOffline]);

  const toggleAbsent = async (id: string, current: boolean) => {
    if (false /* hors ligne : géré par la passerelle */) {
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, is_absent: !current } : c));
      addToSyncQueue({ table: "candidates", operation: "update", data: { id, is_absent: !current } });
      toast.info("Modification sauvegardée localement");
      return;
    }
    const { error } = await supabase.from("candidates").update({ is_absent: !current } as any).eq("id", id);
    if (error) { toast.error("Erreur"); return; }
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, is_absent: !current } : c));
  };

  const saveEdit = async (id: string) => {
    const changes = editing[id];
    if (!changes) return;
    if (false /* hors ligne : géré par la passerelle */) {
      setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
      addToSyncQueue({ table: "candidates", operation: "update", data: { id, ...changes } });
      setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
      toast.info("Modification sauvegardée localement");
      return;
    }
    const { error } = await supabase.from("candidates").update(changes as any).eq("id", id);
    if (error) { toast.error("Erreur sauvegarde"); return; }
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
    toast.success("Modifié");
  };

  const cancelEdit = (id: string) => {
    setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const schools = getUniqueSchools(candidates);
  const filtered = filterSchool && filterSchool !== "__all__" ? candidates.filter(c => matchesSchool(c, filterSchool)) : candidates;

  if (requireFilter && !centerId && !filterCenter) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4 items-end border bg-card p-4 shadow-soft">
          {centers && (
            <div className="space-y-2">
              <Label>Centre</Label>
              <Select value={filterCenter} onValueChange={v => { setFilterCenter(v); setFilterSchool(""); }}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Choisir un centre" /></SelectTrigger>
                <SelectContent>{centers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name || c.identifier}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p className="text-muted-foreground">Sélectionnez un filtre pour afficher les candidats.</p>
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
              <SelectTrigger className="w-48"><SelectValue placeholder="Tous les centres" /></SelectTrigger>
              <SelectContent>{centers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name || c.identifier}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {schools.length > 0 && (
          <div className="space-y-2">
            <Label>École</Label>
            <Select value={filterSchool} onValueChange={setFilterSchool}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Toutes les écoles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes</SelectItem>
                {schools.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonLoader />
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Aucun candidat.</p>
      ) : (
        <div className="max-w-full overflow-x-auto border">
          <table className="portal-table">
            <thead>
              <tr>
                {effectiveCanMarkAbsent && <th className="p-2">Absent</th>}
                <th className="p-2 text-left">N° Table</th>
                <th className="p-2 text-left">Nom</th>
                <th className="p-2 text-left">Prénom(s)</th>
                <th className="p-2 text-left">Sexe</th>
                <th className="p-2 text-left">École</th>
                {effectiveCanEdit && <th className="p-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const isEditing = !!editing[c.id];
                return (
                  <tr key={c.id} className={`${c.is_absent ? 'bg-destructive/10 opacity-60' : ''}`}>
                    {effectiveCanMarkAbsent && (
                      <td className="p-2 text-center">
                        <Checkbox checked={c.is_absent} onCheckedChange={() => toggleAbsent(c.id, c.is_absent)} />
                      </td>
                    )}
                    <td className="p-2">{isEditing ? <Input className="h-7 text-xs w-20" value={editing[c.id].numero_table ?? c.numero_table ?? ''} onChange={e => setEditing(prev => ({ ...prev, [c.id]: { ...prev[c.id], numero_table: e.target.value } }))} /> : c.numero_table}</td>
                    <td className="p-2">{isEditing ? <Input className="h-7 text-xs" value={editing[c.id].nom ?? c.nom} onChange={e => setEditing(prev => ({ ...prev, [c.id]: { ...prev[c.id], nom: e.target.value } }))} /> : c.nom}</td>
                    <td className="p-2">{isEditing ? <Input className="h-7 text-xs" value={editing[c.id].prenoms ?? c.prenoms ?? ''} onChange={e => setEditing(prev => ({ ...prev, [c.id]: { ...prev[c.id], prenoms: e.target.value } }))} /> : c.prenoms}</td>
                    <td className="p-2">{isEditing ? <Input className="h-7 text-xs w-14" value={editing[c.id].sexe ?? c.sexe ?? ''} onChange={e => setEditing(prev => ({ ...prev, [c.id]: { ...prev[c.id], sexe: e.target.value } }))} /> : c.sexe}</td>
                    <td className="p-2">{isEditing ? <Input className="h-7 text-xs" value={editing[c.id].ecole_provenance ?? c.ecole_provenance ?? ''} onChange={e => setEditing(prev => ({ ...prev, [c.id]: { ...prev[c.id], ecole_provenance: e.target.value } }))} /> : c.ecole_provenance}</td>
                    {effectiveCanEdit && (
                      <td className="p-2 text-center">
                        {isEditing ? (
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="sm" onClick={() => saveEdit(c.id)}><Save className="w-3 h-3 text-green-600" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => cancelEdit(c.id)}><XCircle className="w-3 h-3 text-destructive" /></Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setEditing(prev => ({ ...prev, [c.id]: {} }))}><Pencil className="w-3 h-3" /></Button>
                        )}
                      </td>
                    )}
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

export default CandidatesList;
