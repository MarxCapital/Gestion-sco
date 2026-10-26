import { useState, useEffect, useCallback } from "react";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, WifiOff } from "lucide-react";
import { getUniqueSchools, normalizeSchoolName, type CandidateRow } from "@/lib/calculations";
import { generateCenterStatsPdf } from "@/lib/pdf-utils";
import { useAuth } from "@/contexts/AuthContext";
import { getOfflineCandidates } from "@/lib/offline-data";
import { saveCandidatesOffline } from "@/lib/offline-storage";
import SkeletonLoader from "@/components/portal/SkeletonLoader";

type ViewMode = "school" | "center";

interface Props {
  centerId?: string;
  centers?: { id: string; identifier: string; display_name?: string }[];
}

const CenterStats = ({ centerId, centers }: Props) => {
  const { role } = useAuth();
  const sigRole: 'center' | 'ccs' | 'none' = role === 'csbante' ? 'ccs' : role === 'admin' ? 'none' : 'center';
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCenter, setFilterCenter] = useState(centerId || "");
  const [viewMode, setViewMode] = useState<ViewMode>("school");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, []);

  const needsCenterFilter = viewMode !== "center";

  const fetchData = useCallback(async () => {
    if (needsCenterFilter && !filterCenter && !centerId) return;
    setLoading(true);
    const cId = centerId || filterCenter;
    const filterCId = (cId && needsCenterFilter) ? cId : undefined;

    if (false /* hors ligne : géré par la passerelle */) {
      try {
        const offline = await getOfflineCandidates(filterCId);
        setCandidates(offline);
        if (offline.length > 0) toast.info("Données chargées hors ligne");
      } catch { toast.error("Erreur chargement hors ligne"); }
      setLoading(false);
      return;
    }

    const filters = filterCId ? [{ column: "center_id", value: filterCId }] : undefined;
    const { data, error } = await fetchAllRows("candidates", "*", filters);
    if (error) {
      try { const offline = await getOfflineCandidates(filterCId); setCandidates(offline); toast.info("Données hors ligne"); } catch { toast.error("Erreur"); }
      setLoading(false); return;
    }
    const result = (data as any) || [];
    setCandidates(result);
    saveCandidatesOffline(result).catch(() => {});
    setLoading(false);
  }, [centerId, filterCenter, needsCenterFilter]);

  useEffect(() => { fetchData(); }, [fetchData, isOffline]);

  const schools = getUniqueSchools(candidates);

  const getStats = (filterFn?: (c: CandidateRow) => boolean) => {
    const filtered = filterFn ? candidates.filter(filterFn) : candidates;
    const g = (sex: string, absent?: boolean) => filtered.filter(c => c.sexe === sex && (absent !== undefined ? c.is_absent === absent : true)).length;
    const t = (absent?: boolean) => filtered.filter(c => absent !== undefined ? c.is_absent === absent : true).length;
    return {
      inscritG: g('M'), inscritF: g('F'), inscritT: t(),
      absentG: g('M', true), absentF: g('F', true), absentT: t(true),
      presentG: g('M', false), presentF: g('F', false), presentT: t(false),
    };
  };

  const getSchoolStats = (school: string) => getStats(c => normalizeSchoolName(c.ecole_provenance) === school);
  const getTotalStats = () => getStats();

  const absentList = candidates.filter(c => c.is_absent).map(c => ({
    numero_table: c.numero_table || '', nom: c.nom, prenoms: c.prenoms || '', sexe: c.sexe || '', ecole: c.ecole_provenance || ''
  }));

  const buildRows = (): { label: string; stats: ReturnType<typeof getTotalStats> }[] => {
    if (viewMode === "center" && centers) {
      return centers.map(center => ({
        label: center.display_name || center.identifier,
        stats: getStats(c => c.center_id === center.id),
      }));
    }
    return schools.map(s => ({ label: s, stats: getSchoolStats(s) }));
  };

  const rows = buildRows();
  const total = getTotalStats();

  const downloadPdf = () => {
    const firstCol = viewMode === "center" ? "Centre" : "École";
    const head = [[firstCol, 'Inscrit G', 'Inscrit F', 'Inscrit T', 'Présent G', 'Présent F', 'Présent T', 'Absent G', 'Absent F', 'Absent T', 'Abandon G', 'Abandon F', 'Abandon T']];
    const body = rows.map(r => [r.label, r.stats.inscritG, r.stats.inscritF, r.stats.inscritT, r.stats.presentG, r.stats.presentF, r.stats.presentT, r.stats.absentG, r.stats.absentF, r.stats.absentT, 0, 0, 0].map(String));
    body.push(['TOTAL', total.inscritG, total.inscritF, total.inscritT, total.presentG, total.presentF, total.presentT, total.absentG, total.absentF, total.absentT, 0, 0, 0].map(String));
    const center = centerId && centers ? centers.find(c => c.id === centerId) : filterCenter && centers ? centers.find(c => c.id === filterCenter) : null;
    const centerLabel = center ? (center.display_name || center.identifier) : (viewMode === "center" ? "Tous les centres" : "Centre");
    generateCenterStatsPdf({ head, body }, absentList, {
      documentTitle: viewMode === "center" ? "Statistique par centre" : "Statistique du centre",
      centerName: centerLabel,
      effectif: total.inscritT,
      signatureRole: sigRole,
    });
  };

  const firstColLabel = viewMode === "center" ? "Centre" : "École";

  if (needsCenterFilter && !centerId && !filterCenter) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4 flex-wrap items-end">
          {centers && (
            <div className="space-y-2">
              <Label>Centre</Label>
              <Select value={filterCenter} onValueChange={setFilterCenter}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Choisir un centre" /></SelectTrigger>
                <SelectContent>{centers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name || c.identifier}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {centers && (
            <div className="space-y-2">
              <Label>Vue</Label>
              <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="school">Par école</SelectItem>
                  <SelectItem value="center">Par centre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p className="text-muted-foreground">Sélectionnez un centre.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isOffline && <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-md"><WifiOff className="w-4 h-4" />Mode hors ligne</div>}
      <div className="flex gap-4 flex-wrap items-end">
        {centers && !centerId && needsCenterFilter && (
          <div className="space-y-2">
            <Label>Centre</Label>
            <Select value={filterCenter} onValueChange={setFilterCenter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{centers.map(c => <SelectItem key={c.id} value={c.id}>{c.display_name || c.identifier}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        {centers && (
          <div className="space-y-2">
            <Label>Vue</Label>
            <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="school">Par école</SelectItem>
                <SelectItem value="center">Par centre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <Button size="sm" onClick={downloadPdf}><Download className="w-4 h-4 mr-2" />Télécharger</Button>
      </div>

      {loading ? <SkeletonLoader rows={6} /> : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted">
                <tr>
                  <th rowSpan={2} className="p-2 border">{firstColLabel}</th>
                  <th colSpan={3} className="p-1 border text-center">Inscrit</th>
                  <th colSpan={3} className="p-1 border text-center">Présent</th>
                  <th colSpan={3} className="p-1 border text-center">Absent</th>
                  <th colSpan={3} className="p-1 border text-center">Abandons</th>
                </tr>
                <tr>
                  {['Inscrit','Présent','Absent','Abandons'].map((_, idx) => (
                    <>{['G','F','T'].map((l, i) => <th key={`${idx}${l}${i}`} className="p-1 border text-center">{l}</th>)}</>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.label} className="border-t">
                    <td className="p-1 border font-medium">{r.label}</td>
                    <td className="p-1 border text-center">{r.stats.inscritG}</td>
                    <td className="p-1 border text-center">{r.stats.inscritF}</td>
                    <td className="p-1 border text-center font-semibold">{r.stats.inscritT}</td>
                    <td className="p-1 border text-center">{r.stats.presentG}</td>
                    <td className="p-1 border text-center">{r.stats.presentF}</td>
                    <td className="p-1 border text-center font-semibold">{r.stats.presentT}</td>
                    <td className="p-1 border text-center">{r.stats.absentG}</td>
                    <td className="p-1 border text-center">{r.stats.absentF}</td>
                    <td className="p-1 border text-center font-semibold">{r.stats.absentT}</td>
                    <td className="p-1 border text-center">0</td>
                    <td className="p-1 border text-center">0</td>
                    <td className="p-1 border text-center font-semibold">0</td>
                  </tr>
                ))}
                <tr className="bg-muted font-bold">
                  <td className="p-1 border">TOTAL</td>
                  <td className="p-1 border text-center">{total.inscritG}</td>
                  <td className="p-1 border text-center">{total.inscritF}</td>
                  <td className="p-1 border text-center">{total.inscritT}</td>
                  <td className="p-1 border text-center">{total.presentG}</td>
                  <td className="p-1 border text-center">{total.presentF}</td>
                  <td className="p-1 border text-center">{total.presentT}</td>
                  <td className="p-1 border text-center">{total.absentG}</td>
                  <td className="p-1 border text-center">{total.absentF}</td>
                  <td className="p-1 border text-center">{total.absentT}</td>
                  <td className="p-1 border text-center">0</td>
                  <td className="p-1 border text-center">0</td>
                  <td className="p-1 border text-center">0</td>
                </tr>
              </tbody>
            </table>
          </div>
          {absentList.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Candidats absents</h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-destructive/10"><tr><th className="p-1 border">N° Table</th><th className="p-1 border">Nom</th><th className="p-1 border">Prénom(s)</th><th className="p-1 border">Sexe</th><th className="p-1 border">École</th></tr></thead>
                  <tbody>{absentList.map((a, i) => (<tr key={i} className="border-t"><td className="p-1 border">{a.numero_table}</td><td className="p-1 border">{a.nom}</td><td className="p-1 border">{a.prenoms}</td><td className="p-1 border">{a.sexe}</td><td className="p-1 border">{a.ecole}</td></tr>))}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CenterStats;
