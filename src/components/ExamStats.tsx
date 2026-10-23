import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, WifiOff } from "lucide-react";
import { computeResults, getUniqueSchools, normalizeSchoolName, SUBJECTS, type CandidateResult, type SubjectKey } from "@/lib/calculations";
import { generateExamStatsPdf } from "@/lib/pdf-utils";
import { useAuth } from "@/contexts/AuthContext";
import { getOfflineCandidatesWithNotes } from "@/lib/offline-data";
import { saveCandidatesOffline, saveAllNotesOffline } from "@/lib/offline-storage";
import SkeletonLoader from "@/components/portal/SkeletonLoader";

interface Props {
  centerId?: string;
  centers?: { id: string; identifier: string; display_name?: string }[];
  filterMode?: string;
  requireFilter?: boolean;
}

type ViewMode = 'ecole' | 'matiere' | 'centre';
type GFT = { g: number; f: number; t: number };

const ordinal = (n: number) => n === 1 ? '1er' : `${n}ième`;
const isG = (s?: string | null) => { const v = (s || '').toUpperCase(); return v.startsWith('M') || v === 'G'; };
const isF = (s?: string | null) => (s || '').toUpperCase().startsWith('F');
const cnt = (arr: CandidateResult[]): GFT => ({
  g: arr.filter(c => isG(c.sexe)).length,
  f: arr.filter(c => isF(c.sexe)).length,
  t: arr.length,
});
const pctOf = (s: GFT, c: GFT): GFT => ({
  g: c.g === 0 ? 0 : (s.g / c.g) * 100,
  f: c.f === 0 ? 0 : (s.f / c.f) * 100,
  t: c.t === 0 ? 0 : (s.t / c.t) * 100,
});
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const sub = (a: GFT, b: GFT): GFT => ({ g: a.g - b.g, f: a.f - b.f, t: a.t - b.t });

const ExamStats = ({ centerId, centers }: Props) => {
  const { role } = useAuth();
  const sigRole: 'center' | 'ccs' | 'none' = role === 'csbante' ? 'ccs' : role === 'admin' ? 'none' : 'center';
  const isCsbante = !!centers && !centerId;

  const [results, setResults] = useState<CandidateResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('ecole');
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
    const filterCId = centerId || undefined;

    if (!navigator.onLine) {
      try {
        const offline = await getOfflineCandidatesWithNotes(filterCId);
        setResults(computeResults(offline));
        if (offline.length > 0) toast.info("Données chargées hors ligne");
      } catch { toast.error("Erreur chargement hors ligne"); }
      setLoading(false);
      return;
    }

    const filters = filterCId ? [{ column: "center_id", value: filterCId }] : undefined;
    const { data, error } = await fetchAllRows("candidates", "*, notes(*)", filters);
    if (error) {
      try { const offline = await getOfflineCandidatesWithNotes(filterCId); setResults(computeResults(offline)); toast.info("Données hors ligne"); } catch { toast.error("Erreur"); }
      setLoading(false); return;
    }
    const result = (data as any) || [];
    setResults(computeResults(result));
    saveCandidatesOffline(result.map(({ notes: _notes, ...c }: any) => c)).catch(() => {});
    saveAllNotesOffline(result.filter((c: any) => c.notes).map((c: any) => ({ candidate_id: c.id, ...c.notes }))).catch(() => {});
    setLoading(false);
  }, [centerId]);

  useEffect(() => { fetchData(); }, [fetchData, isOffline]);

  const center = centerId && centers ? centers.find(c => c.id === centerId) : null;
  const centerLabel = center ? (center.display_name || center.identifier) : (isCsbante ? 'Tous les centres' : '');

  // -------- "Par école" rows --------
  const schools = useMemo(() => getUniqueSchools(results), [results]);
  type GroupRow = { label: string; inscrit: GFT; composé: GFT; seuil: GFT; pct: GFT };
  const ecoleRows: GroupRow[] = useMemo(() => schools.map(s => {
    const all = results.filter(c => normalizeSchoolName(c.ecole_provenance) === s);
    const present = all.filter(c => !c.is_absent);
    const seuil = present.filter(c => c.seuilAtteint);
    const inscrit = cnt(all), composé = cnt(present), seuilC = cnt(seuil);
    return { label: s, inscrit, composé, seuil: seuilC, pct: pctOf(seuilC, composé) };
  }).filter(r => r.inscrit.t > 0), [results, schools]);

  // -------- "Par centre" rows (CS only) --------
  const centerRows: GroupRow[] = useMemo(() => {
    if (!centers) return [];
    return centers.map(c => {
      const all = results.filter(r => r.center_id === c.id);
      const present = all.filter(r => !r.is_absent);
      const seuil = present.filter(r => r.seuilAtteint);
      const inscrit = cnt(all), composé = cnt(present), seuilC = cnt(seuil);
      return { label: c.display_name || c.identifier, inscrit, composé, seuil: seuilC, pct: pctOf(seuilC, composé) };
    }).filter(r => r.inscrit.t > 0);
  }, [results, centers]);

  // -------- "Par Matière" rows --------
  type MatRow = { label: string; inscrit: GFT; composé: GFT; seuil: GFT; echec: GFT; pct: GFT };
  const matiereRows: MatRow[] = useMemo(() => {
    const present = results.filter(c => !c.is_absent);
    const inscrit = cnt(results);
    const composé = cnt(present);
    return SUBJECTS.map(s => {
      const reussi = present.filter(c => {
        const v = c.notes ? (c.notes as any)[s.key as SubjectKey] as number | null : null;
        return v !== null && v !== undefined && v >= 10;
      });
      const seuilC = cnt(reussi);
      const echec = sub(composé, seuilC);
      return { label: s.label, inscrit, composé, seuil: seuilC, echec, pct: pctOf(seuilC, composé) };
    });
  }, [results]);

  // Ranks (single, by Total) for ecole/centre
  const rankMap = (rows: GroupRow[]) => {
    const sorted = [...rows].sort((a, b) => b.pct.t - a.pct.t);
    const m = new Map<string, number>();
    let lastPct = -1, lastRank = 0;
    sorted.forEach((r, i) => {
      const rank = r.pct.t === lastPct ? lastRank : i + 1;
      m.set(r.label, rank); lastPct = r.pct.t; lastRank = rank;
    });
    return m;
  };
  const rankedEcole = useMemo(() => { const m = rankMap(ecoleRows); return ecoleRows.map(r => ({ ...r, rang: m.get(r.label)! })); }, [ecoleRows]);
  const rankedCentre = useMemo(() => { const m = rankMap(centerRows); return centerRows.map(r => ({ ...r, rang: m.get(r.label)! })); }, [centerRows]);

  // ENSEMBLE totals for group views
  const totalsAll = useMemo(() => {
    const all = results;
    const present = all.filter(c => !c.is_absent);
    const seuil = present.filter(c => c.seuilAtteint);
    const inscrit = cnt(all), composé = cnt(present), seuilC = cnt(seuil);
    return { inscrit, composé, seuil: seuilC, pct: pctOf(seuilC, composé) };
  }, [results]);

  // Build PDF + UI heads for École/Centre (with single Rang)
  const headerStyle = { halign: 'center' as const, fillColor: [255,255,255] as [number,number,number], textColor: [0,0,0] as [number,number,number], fontStyle: 'bold' as const };
  const buildGroupHead = (firstCol: string) => ([
    [
      { content: firstCol, rowSpan: 2, styles: { ...headerStyle, valign: 'middle' as const } },
      { content: 'Inscrit', colSpan: 3, styles: headerStyle },
      { content: 'Ont composé', colSpan: 3, styles: headerStyle },
      { content: 'Ont atteint le seuil', colSpan: 3, styles: headerStyle },
      { content: 'Pourcentage de réussite', colSpan: 3, styles: headerStyle },
      { content: 'Rang', rowSpan: 2, styles: { ...headerStyle, valign: 'middle' as const } },
    ],
    Array.from({ length: 12 }).map((_, i) => ({ content: ['G','F','T'][i % 3], styles: { halign: 'center' as const, fillColor: [255,255,255] as [number,number,number], textColor: [0,0,0] as [number,number,number], fontSize: 7 } })),
  ]);
  const buildGroupBody = (rows: (GroupRow & { rang: number })[]) => rows.map(r => [
    r.label,
    String(r.inscrit.g), String(r.inscrit.f), String(r.inscrit.t),
    String(r.composé.g), String(r.composé.f), String(r.composé.t),
    String(r.seuil.g), String(r.seuil.f), String(r.seuil.t),
    fmtPct(r.pct.g), fmtPct(r.pct.f), fmtPct(r.pct.t),
    ordinal(r.rang),
  ]);

  const buildMatiereHead = () => ([
    [
      { content: 'Matières', rowSpan: 2, styles: { ...headerStyle, valign: 'middle' as const } },
      { content: 'Inscrits', colSpan: 3, styles: headerStyle },
      { content: 'Ont composé', colSpan: 3, styles: headerStyle },
      { content: 'Ont atteint le seuil de réussite', colSpan: 3, styles: headerStyle },
      { content: 'N\'ont pas atteint le seuil de réussite', colSpan: 3, styles: headerStyle },
      { content: 'Pourcentage de réussite', colSpan: 3, styles: headerStyle },
    ],
    Array.from({ length: 15 }).map((_, i) => ({ content: ['G','F','T'][i % 3], styles: { halign: 'center' as const, fillColor: [255,255,255] as [number,number,number], textColor: [0,0,0] as [number,number,number], fontSize: 7 } })),
  ]);
  const buildMatiereBody = (rows: MatRow[]) => rows.map(r => [
    r.label,
    String(r.inscrit.g), String(r.inscrit.f), String(r.inscrit.t),
    String(r.composé.g), String(r.composé.f), String(r.composé.t),
    String(r.seuil.g), String(r.seuil.f), String(r.seuil.t),
    String(r.echec.g), String(r.echec.f), String(r.echec.t),
    fmtPct(r.pct.g), fmtPct(r.pct.f), fmtPct(r.pct.t),
  ]);



  const downloadPdf = () => {
    let head: any[][] = []; let body: string[][] = [];
    let title = 'Synthèse de l\'examen blanc';
    if (viewMode === 'matiere') {
      title = 'Synthèse par matière';
      head = buildMatiereHead();
      body = buildMatiereBody(matiereRows);
    } else if (viewMode === 'centre') {
      title = 'Synthèse par centre';
      head = buildGroupHead('Centre');
      body = buildGroupBody(rankedCentre);
      body.push(['ENSEMBLE',
        String(totalsAll.inscrit.g), String(totalsAll.inscrit.f), String(totalsAll.inscrit.t),
        String(totalsAll.composé.g), String(totalsAll.composé.f), String(totalsAll.composé.t),
        String(totalsAll.seuil.g), String(totalsAll.seuil.f), String(totalsAll.seuil.t),
        fmtPct(totalsAll.pct.g), fmtPct(totalsAll.pct.f), fmtPct(totalsAll.pct.t), '']);
    } else {
      head = buildGroupHead('École');
      body = buildGroupBody(rankedEcole);
      body.push(['ENSEMBLE',
        String(totalsAll.inscrit.g), String(totalsAll.inscrit.f), String(totalsAll.inscrit.t),
        String(totalsAll.composé.g), String(totalsAll.composé.f), String(totalsAll.composé.t),
        String(totalsAll.seuil.g), String(totalsAll.seuil.f), String(totalsAll.seuil.t),
        fmtPct(totalsAll.pct.g), fmtPct(totalsAll.pct.f), fmtPct(totalsAll.pct.t), '']);
    }
    generateExamStatsPdf({ head, body }, {
      documentTitle: title,
      centerName: centerLabel || undefined,
      effectif: totalsAll.inscrit.t,
      signatureRole: sigRole,
    });
  };

  const renderGroupTable = (rows: (GroupRow & { rang: number })[], firstCol: string, showEnsemble: boolean) => (
    <table className="w-full text-xs border-collapse">
      <thead className="bg-muted">
        <tr>
          <th rowSpan={2} className="p-2 border text-left align-middle min-w-[200px]">{firstCol}</th>
          <th colSpan={3} className="p-2 border text-center">Inscrit</th>
          <th colSpan={3} className="p-2 border text-center">Ont composé</th>
          <th colSpan={3} className="p-2 border text-center">Ont atteint le seuil</th>
          <th colSpan={3} className="p-2 border text-center">Pourcentage de réussite</th>
          <th rowSpan={2} className="p-2 border text-center align-middle">Rang</th>
        </tr>
        <tr>
          {Array.from({ length: 4 }).flatMap((_, i) => [
            <th key={`g${i}`} className="p-1 border text-center">G</th>,
            <th key={`f${i}`} className="p-1 border text-center">F</th>,
            <th key={`t${i}`} className="p-1 border text-center">T</th>,
          ])}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label} className="border-t">
            <td className="p-2 border font-medium">{r.label}</td>
            <td className="p-1 border text-center">{r.inscrit.g}</td>
            <td className="p-1 border text-center">{r.inscrit.f}</td>
            <td className="p-1 border text-center font-semibold">{r.inscrit.t}</td>
            <td className="p-1 border text-center">{r.composé.g}</td>
            <td className="p-1 border text-center">{r.composé.f}</td>
            <td className="p-1 border text-center font-semibold">{r.composé.t}</td>
            <td className="p-1 border text-center">{r.seuil.g}</td>
            <td className="p-1 border text-center">{r.seuil.f}</td>
            <td className="p-1 border text-center font-semibold">{r.seuil.t}</td>
            <td className="p-1 border text-center">{r.pct.g.toFixed(1)}%</td>
            <td className="p-1 border text-center">{r.pct.f.toFixed(1)}%</td>
            <td className="p-1 border text-center font-semibold">{r.pct.t.toFixed(1)}%</td>
            <td className="p-1 border text-center font-semibold">{ordinal(r.rang)}</td>
          </tr>
        ))}
        {showEnsemble && (
          <tr className="border-t bg-muted font-bold">
            <td className="p-2 border">ENSEMBLE</td>
            <td className="p-1 border text-center">{totalsAll.inscrit.g}</td>
            <td className="p-1 border text-center">{totalsAll.inscrit.f}</td>
            <td className="p-1 border text-center">{totalsAll.inscrit.t}</td>
            <td className="p-1 border text-center">{totalsAll.composé.g}</td>
            <td className="p-1 border text-center">{totalsAll.composé.f}</td>
            <td className="p-1 border text-center">{totalsAll.composé.t}</td>
            <td className="p-1 border text-center">{totalsAll.seuil.g}</td>
            <td className="p-1 border text-center">{totalsAll.seuil.f}</td>
            <td className="p-1 border text-center">{totalsAll.seuil.t}</td>
            <td className="p-1 border text-center">{totalsAll.pct.g.toFixed(1)}%</td>
            <td className="p-1 border text-center">{totalsAll.pct.f.toFixed(1)}%</td>
            <td className="p-1 border text-center">{totalsAll.pct.t.toFixed(1)}%</td>
            <td className="p-1 border text-center">—</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const renderMatiereTable = () => (
    <table className="w-full text-xs border-collapse">
      <thead className="bg-muted">
        <tr>
          <th rowSpan={2} className="p-2 border text-left align-middle min-w-[160px]">Matières</th>
          <th colSpan={3} className="p-2 border text-center">Inscrits</th>
          <th colSpan={3} className="p-2 border text-center">Ont composé</th>
          <th colSpan={3} className="p-2 border text-center">Ont atteint le seuil</th>
          <th colSpan={3} className="p-2 border text-center">N'ont pas atteint le seuil</th>
          <th colSpan={3} className="p-2 border text-center">Pourcentage de réussite</th>
        </tr>
        <tr>
          {Array.from({ length: 5 }).flatMap((_, i) => [
            <th key={`g${i}`} className="p-1 border text-center">G</th>,
            <th key={`f${i}`} className="p-1 border text-center">F</th>,
            <th key={`t${i}`} className="p-1 border text-center">T</th>,
          ])}
        </tr>
      </thead>
      <tbody>
        {matiereRows.map(r => (
          <tr key={r.label} className="border-t">
            <td className="p-2 border font-medium">{r.label}</td>
            <td className="p-1 border text-center">{r.inscrit.g}</td>
            <td className="p-1 border text-center">{r.inscrit.f}</td>
            <td className="p-1 border text-center font-semibold">{r.inscrit.t}</td>
            <td className="p-1 border text-center">{r.composé.g}</td>
            <td className="p-1 border text-center">{r.composé.f}</td>
            <td className="p-1 border text-center font-semibold">{r.composé.t}</td>
            <td className="p-1 border text-center">{r.seuil.g}</td>
            <td className="p-1 border text-center">{r.seuil.f}</td>
            <td className="p-1 border text-center font-semibold">{r.seuil.t}</td>
            <td className="p-1 border text-center">{r.echec.g}</td>
            <td className="p-1 border text-center">{r.echec.f}</td>
            <td className="p-1 border text-center font-semibold">{r.echec.t}</td>
            <td className="p-1 border text-center">{r.pct.g.toFixed(1)}%</td>
            <td className="p-1 border text-center">{r.pct.f.toFixed(1)}%</td>
            <td className="p-1 border text-center font-semibold">{r.pct.t.toFixed(1)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="space-y-4">
      {isOffline && <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded-md"><WifiOff className="w-4 h-4" />Mode hors ligne</div>}
      <div className="flex gap-4 flex-wrap items-end">
        <div className="space-y-2">
          <Label>Filtre</Label>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {isCsbante && <SelectItem value="centre">Par centre</SelectItem>}
              <SelectItem value="ecole">Par école</SelectItem>
              <SelectItem value="matiere">Par Matière</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={downloadPdf}><Download className="w-4 h-4 mr-2" />Télécharger</Button>
      </div>

      {loading ? <SkeletonLoader rows={6} /> : (
        <div className="overflow-x-auto border rounded-lg">
          {viewMode === 'matiere' && renderMatiereTable()}
          {viewMode === 'ecole' && renderGroupTable(rankedEcole, 'École', true)}
          {viewMode === 'centre' && renderGroupTable(rankedCentre, 'Centre', true)}
        </div>
      )}
    </div>
  );
};

export default ExamStats;
