import { downloadFiles } from "@/lib/download-many";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, Printer, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CM2_INDEX, NIVEAUX_DEFAUT, getJSZip, detectMoyenneColumns, ficheHtml, getLearner, guessMap, imprimerHtml,
  nomFichier, readListFile, trierPhotos, versJpg,
  type FicheOptions, type ListMap, type ListRow, type PhotoOrder,
} from "@/lib/cm2-tools";
import InscriptionTab from "./InscriptionTab";
import CarteTab from "./CarteTab";
import { usePhotoBook } from "@/hooks/usePhotoBook";
import { exportBackup, importBackup, loadRoster, nameKey, saveRoster } from "@/lib/photo-library";
import { useSchoolYear } from "@/contexts/SchoolYearContext";
import { sdb } from "@/lib/school-db";
import { sortStudents } from "@/lib/school";
import { mergeDbRoster } from "@/lib/school-roster";
import { examYear } from "@/lib/school-year";
import { loadSchoolStatus, readLocalStatus, saveLocalStatus, saveSchoolStatus, type SchoolStatus } from "@/lib/school-status";
import { DEFAULT_COMMON, EMPTY_MANUAL, getCandidate, matchPhotos, missingFiche, withDefaults, type Candidate, type Common, type Manual } from "@/lib/cep-inscription";
import { loadCommon, loadManual, saveCommon, saveManual } from "@/lib/cm2-manual";
import "./cm2-fiche.css";

const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm max-w-full";
const FIELDS: { key: keyof ListMap; label: string; optional?: boolean }[] = [
  { key: "mat", label: "Matricule", optional: true },
  { key: "nom", label: "Nom" },
  { key: "pre", label: "Prénom(s)" },
  { key: "nai", label: "Date de naissance", optional: true },
  { key: "lie", label: "Lieu de naissance", optional: true },
  { key: "sex", label: "Sexe", optional: true },
];

function ColumnSelect({ value, headers, optional, onChange }: { value: string; headers: string[]; optional?: boolean; onChange: (v: string) => void }) {
  return (
    <select className={selectClass} value={value} onChange={e => onChange(e.target.value)}>
      {optional && <option value="">— aucune —</option>}
      {headers.map(h => <option key={h} value={h}>{h}</option>)}
    </select>
  );
}

function PhotoOrderSelect({ value, onChange }: { value: PhotoOrder; onChange: (v: PhotoOrder) => void }) {
  return (
    <select className={selectClass} value={value} onChange={e => onChange(e.target.value as PhotoOrder)}>
      <option value="nom">Par nom de fichier (IMG_001, IMG_002…)</option>
      <option value="date">Par date de modification</option>
      <option value="sel">Ordre de sélection</option>
    </select>
  );
}

/** `scopeKey` : identifiant local d'une école sans compte (espace prestataire) ; les photos et la liste lui sont rattachées. */
export default function Cm2Tools({ schoolName, schoolId, scopeKey, listFromDb }: { schoolName?: string | null; schoolId?: string | null; scopeKey?: string | null; listFromDb?: boolean }) {
  /** Compte École : la liste de la classe (onglet « Élèves ») sert directement, sans nouvel import. */
  const fixedList = !!listFromDb && !!schoolId;
  const { year, readOnly } = useSchoolYear();
  const schoolKey = scopeKey || schoolId || "local";

  // ----- Renseignements manuels (fiche d'inscription + fiche scolaire) -----
  const [manual, setManualAll] = useState<Record<string, Manual>>(() => loadManual(schoolKey, year));
  const [common, setCommonState] = useState<Common>(() => loadCommon(schoolKey));
  const [statut, setStatut] = useState<SchoolStatus | null>(null);
  useEffect(() => { let on = true; if (schoolId) loadSchoolStatus(schoolId).then(s => { if (on) setStatut(s); }); else if (scopeKey) setStatut(readLocalStatus(scopeKey)); return () => { on = false; }; }, [schoolId, scopeKey]);
  const setManual = (key: string, patch: Partial<Manual>) =>
    setManualAll(all => { const next = { ...all, [key]: withDefaults({ ...(all[key] ?? EMPTY_MANUAL), ...patch }) }; saveManual(schoolKey, year, next); return next; });
  const applyAll = (patch: Partial<Manual>) =>
    setManualAll(all => {
      const next = { ...all };
      cands.forEach(c => {
        const cur = withDefaults(next[c.key]);
        const merged: any = { ...cur };
        Object.keys(patch).forEach(k => { if (!(cur as any)[k]) merged[k] = (patch as any)[k]; });
        next[c.key] = merged;
      });
      saveManual(schoolKey, year, next);
      return next;
    });
  const setCommon = (patch: Partial<Common>) => setCommonState(c => { const next = { ...c, ...patch }; saveCommon(schoolKey, next); return next; });
  const changeStatut = async (s: SchoolStatus) => {
    setStatut(s);
    if (!schoolId) { if (scopeKey) saveLocalStatus(scopeKey, s); return; }
    const r = await saveSchoolStatus(schoolId, s);
    if (!r.db) toast.warning("Statut gardé sur cet appareil. Pour l'enregistrer dans le profil, exécutez la migration SQL « school_status ».");
  };

  // ----- Liste commune -----
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [map, setMap] = useState<ListMap>({ mat: "", nom: "", pre: "", nai: "", lie: "", sex: "" });
  const [listMsg, setListMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reading, setReading] = useState(false);
  const [dbCount, setDbCount] = useState<number | null>(null);
  const loadFromDb = async (quiet = false) => {
    const { data, error } = await sdb("students").select("*").eq("school_year", year).eq("school_id", schoolId);
    if (error) { if (!quiet) setListMsg({ ok: false, text: "Impossible de lire la liste de la classe pour le moment." }); return; }
    const list = sortStudents((data || []) as any[]) as any[];
    setDbCount(list.length);
    const local = await loadRoster(schoolKey, year);
    const m = mergeDbRoster(list, local);
    setHeaders(m.headers); setRows(m.rows); setMap(m.map);
    setListMsg(list.length ? { ok: true, text: `${list.length} apprenants de la classe (liste de l'onglet « Élèves »).` } : null);
  };
  // La liste est gardée : elle revient toute seule à la prochaine ouverture (même école, même année)
  useEffect(() => {
    let on = true;
    if (fixedList) { void loadFromDb(); return () => { on = false; }; }
    loadRoster(schoolKey, year).then(r => { if (on && r && r.rows.length) { setHeaders(r.headers); setRows(r.rows); setMap(r.map); setListMsg({ ok: true, text: `${r.rows.length} apprenants retrouvés (liste mémorisée sur cet appareil).` }); } });
    return () => { on = false; };
  }, [schoolKey, year, fixedList]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Photos (renommage) -----
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoOrder, setPhotoOrder] = useState<PhotoOrder>("nom");
  const [zipping, setZipping] = useState<string | null>(null);

  // ----- Fiche scolaire -----
  const [ecole, setEcole] = useState(schoolName ?? "");
  const [dateFiche, setDateFiche] = useState(new Date().toLocaleDateString("fr-FR"));
  const [scolariteComplete, setScolariteComplete] = useState(false);
  const [niveaux, setNiveaux] = useState(NIVEAUX_DEFAUT.map(n => ({ ...n })));
  const [usePhoto, setUsePhoto] = useState(false);
  const [sel, setSel] = useState(0);

  useEffect(() => { if (!ecole && schoolName) setEcole(schoolName); }, [schoolName]); // eslint-disable-line react-hooks/exhaustive-deps

  const moyCols = useMemo(() => detectMoyenneColumns(headers), [headers]);
  const moyDetectees = moyCols.map((h, i) => (h ? niveaux[i].k : null)).filter(Boolean) as string[];

  // URL d'aperçu des photos, libérées au démontage
  const urls = useRef(new Map<File, string>());
  const urlOf = (f: File) => {
    if (!urls.current.has(f)) urls.current.set(f, URL.createObjectURL(f));
    return urls.current.get(f)!;
  };
  useEffect(() => () => { urls.current.forEach(u => URL.revokeObjectURL(u)); urls.current.clear(); }, []);

  const photosTriees = useMemo(() => trierPhotos(photos, photoOrder), [photos, photoOrder]);

  const options: FicheOptions = { ecole, date: dateFiche, scolariteComplete, niveaux };
  const photoUrl = (i: number | null) => {
    if (!usePhoto || i === null) return "";
    const c = cands[i];
    const f = c ? book.photos[c.key] : undefined;
    return f ? urlOf(f) : "";
  };
  const cands = useMemo<Candidate[]>(() => rows.map(r => getCandidate(r, map)).filter(Boolean) as Candidate[], [rows, map]);
  const book = usePhotoBook(schoolKey, cands);
  // Compte École : une correction faite dans l'assistant est aussi enregistrée dans « Élèves » (une seule liste pour tout).
  const dbQueue = useRef(new Map<string, Record<string, string | null>>());
  const dbTimer = useRef<ReturnType<typeof setTimeout>>();
  const flushDb = async () => {
    const q = dbQueue.current; dbQueue.current = new Map();
    for (const [id, ch] of q) {
      const { error } = await sdb("students").update(ch).eq("id", id);
      if (error && /date_naissance|lieu_naissance/.test(error.message || "")) {
        const { date_naissance: _a, lieu_naissance: _b, ...rest } = ch;
        if (Object.keys(rest).length) await sdb("students").update(rest).eq("id", id);
      }
    }
  };
  const pushToDb = (before: ListRow[], after: ListRow[]) => {
    if (!fixedList || readOnly) return;
    after.forEach((r, i) => {
      const b = before[i]; const id = r._id; if (!id || !b || b._id !== id) return;
      const ch: Record<string, string | null> = {};
      const cmp = (col: string, key: string, required = false) => { if (!col || r[col] === b[col]) return; const v = String(r[col] ?? "").trim(); if (required && !v) return; ch[key] = v || null; };
      cmp(map.mat, "matricule"); cmp(map.nom, "nom", true); cmp(map.pre, "prenoms"); cmp(map.sex, "sexe"); cmp(map.nai, "date_naissance"); cmp(map.lie, "lieu_naissance");
      if (Object.keys(ch).length) dbQueue.current.set(String(id), { ...dbQueue.current.get(String(id)), ...ch });
    });
    clearTimeout(dbTimer.current); dbTimer.current = setTimeout(() => { void flushDb(); }, 900);
  };
  const setRowsSaved = (r: ListRow[]) => { pushToDb(rows, r); setRows(r); saveRoster(schoolKey, year, { headers, rows: r, map }); };
  useEffect(() => { if (rows.length) saveRoster(schoolKey, year, { headers, rows, map }); }, [map]); // eslint-disable-line react-hooks/exhaustive-deps
  const learner = (i: number) => {
    const l = getLearner(rows[i], map, moyCols);
    const c = cands[i];
    if (!l || !c) return l;
    const m = manual[c.key];
    if (!m) return l;
    return {
      ...l,
      extra: { piece: m.piece, pere: m.pere, profPere: m.profPere, mere: m.mere, profMere: m.profMere, tuteur: m.tuteur },
      moyennes: l.moyennes.map((v, k) => (k !== CM2_INDEX && m.moy[k]?.trim() ? m.moy[k].trim() : v)),
    };
  };
  const apercuHtml = useMemo(() => {
    const i = rows.length ? Math.min(sel, rows.length - 1) : null;
    return ficheHtml(i === null ? null : learner(i), options, photoUrl(i));
  }, [rows, map, moyCols, manual, cands, sel, ecole, dateFiche, scolariteComplete, niveaux, usePhoto, book.photos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mise à l'échelle de l'aperçu (la fiche fait 937 px de large)
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const fit = () => {
    const wrap = wrapRef.current, inner = innerRef.current;
    if (!wrap || !inner) return;
    const k = Math.min(1, wrap.clientWidth / 937);
    inner.style.transform = `scale(${k})`;
    inner.style.transformOrigin = "top left";
    wrap.style.height = inner.offsetHeight * k + "px";
  };
  useLayoutEffect(fit, [apercuHtml]);
  useEffect(() => { window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit); }, []);
  // Les onglets masqués ont une largeur nulle : on recalcule à l'affichage
  const [tab, setTab] = useState("photos");
  useEffect(() => { const t = setTimeout(fit, 50); return () => clearTimeout(t); }, [tab]);

  const onListFile = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      const { headers: h, rows: r, map: gm, notes } = await readListFile(file);
      setHeaders(h); setRows(r); setMap(gm); setSel(0); saveRoster(schoolKey, year, { headers: h, rows: r, map: gm });
      setListMsg({ ok: true, text: `${r.length} apprenants importés. Vérifiez les colonnes choisies.${notes.length ? " " + notes.join(" ") : ""}${gm.mat ? "" : " Aucune colonne « matricule » trouvée dans le fichier."}` });
    } catch {
      setListMsg({ ok: false, text: "Fichier illisible. Utilisez un PDF contenant du texte (pas une image scannée), un Excel (.xlsx) ou un CSV." });
    } finally { setReading(false); }
  };

  const n = rows.length;
  const photoMsg = (k: number) =>
    k === 0 ? null : { ok: k === n, text: `${k} photos pour ${n} apprenants${k === n ? "" : " : les nombres ne correspondent pas, le décalage touchera tous les suivants."}` };

  // Dès que chaque photo a son apprenant (même nombre), le lien est mémorisé automatiquement.
  const lastSig = useRef("");
  const sigOf = () => photosTriees.map((f, i) => `${f.name}:${f.size}>${cands[i] ? nameKey(cands[i].nom, cands[i].prenoms) : ""}`).join("|");
  const memoriser = async (force = false) => {
    const k = Math.min(photosTriees.length, cands.length);
    const pairs = Array.from({ length: k }, (_, i) => ({ cand: cands[i], file: photosTriees[i] }));
    const { ok, ko } = await book.putMany(pairs);
    lastSig.current = sigOf();
    toast.success(`${ok} photo(s) mémorisée(s) pour l'école${ko ? `, ${ko} illisible(s)` : ""}. Elles serviront seules pour la fiche, l'inscription et la carte.${force ? "" : ""}`);
  };
  useEffect(() => {
    if (!photosTriees.length || photosTriees.length !== cands.length) return;
    if (sigOf() === lastSig.current) return;
    memoriser();
  }, [photosTriees, cands]); // eslint-disable-line react-hooks/exhaustive-deps

  const importerNommees = async (files: File[]) => {
    if (!files.length) return;
    const res = matchPhotos(files.map(f => f.name), cands);
    const pairs = [...res.matched].map(([key, idx]) => ({ cand: cands.find(c => c.key === key)!, file: files[idx] }));
    const { ok } = await book.putMany(pairs);
    toast.success(`${ok} photo(s) rattachée(s) et mémorisée(s).${res.unmatchedFiles.length ? ` Non reconnus : ${res.unmatchedFiles.map(i => files[i].name).join(", ")}.` : ""}`);
  };
  const sauvegarder = async () => {
    const { blob, count } = await exportBackup(schoolKey, await getJSZip());
    if (!count) { toast.info("Aucune photo à sauvegarder."); return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "photos_ecole_sauvegarde.zip"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  };
  const restaurer = async (f?: File) => {
    if (!f) return;
    try { const k = await importBackup(schoolKey, f, await getJSZip()); await book.refresh(); toast.success(`${k} photo(s) restaurée(s).`); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Sauvegarde illisible"); }
  };

  const telechargerZip = async () => {
    setZipping("Préparation…");
    try {
      const used: Record<string, number> = {};
      const total = Math.min(photosTriees.length, rows.length);
      const items = [];
      for (let i = 0; i < total; i++) {
        let nom = nomFichier(rows[i], map);
        if (used[nom]) { used[nom]++; nom = nom.replace(/\.jpg$/, `_${used[nom]}.jpg`); } else used[nom] = 1;
        const f = photosTriees[i];
        items.push({ name: nom, get: async () => new Blob([await versJpg(f)], { type: "image/jpeg" }) });
      }
      await downloadFiles(items, (d, n) => setZipping(`Téléchargement ${d}/${n}…`));
      toast.success(`${total} photos renommées enregistrées une à une.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du téléchargement");
    } finally { setZipping(null); }
  };

  const imprimer = (liste: (number | null)[]) => {
    const manquants = liste.filter((i): i is number => i !== null && !!cands[i] && missingFiche(withDefaults(manual[cands[i].key])).length > 0).length;
    if (manquants > 0 && !window.confirm(`${manquants} fiche(s) ont encore des renseignements non remplis (pièce d'état civil, parents…). Tirer quand même ?`)) return;
    return imprimerHtml(liste.map(i => ficheHtml(i === null ? null : learner(i), options, photoUrl(i))).join(""));
  };

  const pm = photoMsg(photos.length);
  const max = Math.max(n, photosTriees.length);

  return (
    <div className="space-y-6">
      {fixedList ? (
        <section className="rounded-md border bg-muted/30 p-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <h2 className="font-semibold">Liste de la classe</h2>
            <p className="text-sm text-muted-foreground">
              {dbCount === null ? "Chargement…" : dbCount === 0
                ? "Aucun apprenant pour le moment : ajoutez d'abord la liste de votre classe dans l'onglet « Élèves »."
                : `${dbCount} apprenants, repris automatiquement de l'onglet « Élèves » : aucun nouvel import n'est nécessaire.`}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => loadFromDb()}><RefreshCw className="h-4 w-4 mr-1" />Actualiser</Button>
        </section>
      ) : (
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Liste alphabétique des apprenants</h2>
          <p className="text-sm text-muted-foreground">PDF avec texte, Excel ou CSV. La liste sert au renommage des photos et aux fiches. Elle reste dans votre navigateur : rien n'est envoyé sur un serveur.</p>
        </div>
        <Input type="file" accept=".pdf,.xlsx,.xls,.csv" disabled={reading} onChange={e => onListFile(e.target.files?.[0])} className="max-w-md" />
        {reading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Lecture du fichier…</p>}
        {headers.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            {FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{f.label}{f.optional ? " (facultatif)" : ""}</Label>
                <ColumnSelect value={map[f.key]} headers={headers} optional={f.optional} onChange={v => setMap(m => ({ ...m, [f.key]: v }))} />
              </div>
            ))}
          </div>
        )}
        {listMsg && <p role="status" className={`text-sm ${listMsg.ok ? "text-green-700" : "text-destructive"}`}>{listMsg.text}</p>}
        {rows.length > 0 && (
          <div className="max-h-48 overflow-auto border rounded-md">
            <table className="w-full text-xs">
              <thead><tr>{headers.map(h => <th key={h} className="sticky top-0 bg-card text-left px-2 py-1 whitespace-nowrap border-b">{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i}>{headers.map(h => <td key={h} className="px-2 py-1 whitespace-nowrap border-b">{String(r[h])}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="photos">1. Photos</TabsTrigger>
          <TabsTrigger value="fiche">2. Fiche scolaire</TabsTrigger>
          <TabsTrigger value="individuelle">3. Fiche d'inscription au CEP</TabsTrigger>
          <TabsTrigger value="carte">4. Carte scolaire</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <p className="text-sm"><strong>Mémoire des photos de l'école :</strong> {book.total} photo(s){n > 0 && <> · {book.matched}/{n} retrouvées pour cette liste</>}{book.busy && " · enregistrement…"}.
              <span className="text-muted-foreground"> Une photo rattachée à un apprenant est gardée sur cet appareil et réutilisée seule pour la fiche scolaire, la fiche d'inscription et la carte.</span></p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border bg-background px-3 py-1.5 hover:bg-muted"><Upload className="h-4 w-4" />Photos déjà nommées nom_prénoms_.jpg
                <input type="file" accept="image/*" multiple className="hidden" disabled={!n} onChange={e => { importerNommees([...(e.target.files ?? [])]); e.target.value = ""; }} /></label>
              <Button size="sm" variant="outline" onClick={sauvegarder}>Sauvegarder (ZIP)</Button>
              <label className="inline-flex items-center text-sm cursor-pointer rounded-md border bg-background px-3 py-1.5 hover:bg-muted">Restaurer une sauvegarde
                <input type="file" accept=".zip" className="hidden" onChange={e => { restaurer(e.target.files?.[0]); e.target.value = ""; }} /></label>
              {book.total > 0 && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (window.confirm("Effacer toutes les photos mémorisées de cette école ?")) book.clear(); }}>Tout effacer</Button>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1"><Label>Photos (dans l'ordre de la liste)</Label><Input type="file" accept="image/*" multiple onChange={e => setPhotos([...(e.target.files ?? [])])} /></div>
            <div className="space-y-1"><Label>Ordre des photos</Label><PhotoOrderSelect value={photoOrder} onChange={setPhotoOrder} /></div>
          </div>
          {pm && <p role="status" className={`text-sm ${pm.ok ? "text-green-700" : "text-destructive"}`}>{pm.text}</p>}
          {max > 0 && (
            <div className="max-h-96 overflow-auto border rounded-md">
              <table className="w-full text-sm">
                <thead><tr className="text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Photo</th><th className="px-2 py-1">Fichier d'origine</th><th className="px-2 py-1">Nouveau nom</th></tr></thead>
                <tbody>
                  {Array.from({ length: max }, (_, i) => {
                    const r = rows[i], f = photosTriees[i];
                    return (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{i + 1}</td>
                        <td className="px-2 py-1">{f ? <img src={urlOf(f)} alt="" className="h-9 rounded" /> : "—"}</td>
                        <td className="px-2 py-1">{f ? f.name : <span className="text-destructive">manquante</span>}</td>
                        <td className="px-2 py-1">{r ? nomFichier(r, map) : <span className="text-destructive">pas d'apprenant</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {pm && !pm.ok && photos.length > 0 && n > 0 && <Button variant="outline" onClick={() => memoriser(true)} className="mr-2">Mémoriser quand même</Button>}
          <Button onClick={telechargerZip} disabled={!n || !photos.length || zipping !== null}>
            {zipping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {zipping ?? "Télécharger toutes les photos renommées (une à une)"}
          </Button>
        </TabsContent>

        <TabsContent value="carte">
          <CarteTab fixedList={fixedList} rows={rows} map={map} headers={headers} cands={cands} photos={book.photos} urlOf={urlOf} setRows={setRowsSaved}
            putPhoto={(c, f) => book.put(c, f)} putMany={book.putMany} removePhoto={book.remove}
            importList={onListFile} setMap={setMap} reading={reading} listMsg={listMsg}
            schoolName={ecole} schoolKey={schoolKey} annee={year} />
        </TabsContent>

        <TabsContent value="individuelle">
          <InscriptionTab
            cands={cands}
            manual={manual}
            setManual={setManual}
            applyAll={applyAll}
            common={common}
            setCommon={setCommon}
            ecole={ecole}
            statut={statut}
            onStatut={changeStatut}
            session={examYear(year)}
            photos={book.photos}
            setPhotos={book.setPhotos}
            urlOf={urlOf}
            schoolKey={schoolKey}
          />
        </TabsContent>

        <TabsContent value="fiche" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2"><Label>École</Label><Input value={ecole} onChange={e => setEcole(e.target.value)} /></div>
            <div className="space-y-1"><Label>Délivrée le</Label><Input value={dateFiche} onChange={e => setDateFiche(e.target.value)} /></div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={scolariteComplete} onChange={e => setScolariteComplete(e.target.checked)} />
            <span>Remplir aussi l'école maternelle (1ère et 2ème année) avec l'école, le matricule et les dates. <span className="text-muted-foreground">(Du CI au CM1, ces cases sont toujours remplies automatiquement.)</span></span>
          </label>
          <p className="text-sm text-muted-foreground">
            Du CI au CM1, la plateforme écrit l'école, le matricule, les dates et une moyenne de passage automatique (sur 10, entre 5,20 et 8,50). Si votre liste contient une colonne de moyennes (ex. « Moyenne CE2 »), cette valeur est utilisée à la place.
            {rows.length > 0 && moyDetectees.length > 0 && <> Colonnes détectées : <strong>{moyDetectees.join(", ")}</strong>.</>}
          </p>

          <details className="text-sm">
            <summary className="cursor-pointer">Dates des classes (modifiables)</summary>
            <table className="mt-2 text-sm">
              <tbody>
                {niveaux.map((nv, i) => (
                  <tr key={nv.k}>
                    <td className="pr-3">{nv.k}</td>
                    <td className="pr-2 py-0.5"><Input className="h-8 w-32" value={nv.du} onChange={e => setNiveaux(a => a.map((x, j) => j === i ? { ...x, du: e.target.value } : x))} /></td>
                    <td className="py-0.5"><Input className="h-8 w-32" value={nv.au} onChange={e => setNiveaux(a => a.map((x, j) => j === i ? { ...x, au: e.target.value } : x))} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={usePhoto} onChange={e => setUsePhoto(e.target.checked)} />Ajouter la photo des apprenants (reprise automatique)</label>
          {usePhoto && <p className="text-sm text-muted-foreground">Les photos sont reprises automatiquement de la mémoire de l'école ({book.matched}/{n} retrouvées). Pour en ajouter, utilisez l'onglet « 1. Photos ».</p>}

          {cands.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Renseignements à compléter avant de tirer les fiches</h3>
              <p className="text-xs text-muted-foreground">Remplis automatiquement : école, nom et prénoms, date et lieu de naissance, matricule et dates. Les informations ci-dessous ne figurent pas dans la liste : saisissez-les ici (conservées sur cet appareil).</p>
              {cands.map(c => {
                const m = withDefaults(manual[c.key]);
                const miss = missingFiche(m);
                const set = (patch: Partial<Manual>) => setManual(c.key, patch);
                return (
                  <details key={c.key} className="rounded-md border bg-card">
                    <summary className="flex items-center gap-3 px-3 py-2 cursor-pointer">
                      <span className="font-medium flex-1">{c.nom} {c.prenoms}</span>
                      {miss.length === 0 ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-4 w-4" />Complet</span> : <span className="text-xs text-amber-700">{miss.length} à remplir</span>}
                    </summary>
                    <div className="border-t p-3 grid gap-3 sm:grid-cols-2">
                      {([
                        ["piece", "Nature de la pièce d'état civil (numéro, date, lieu)"],
                        ["pere", "Nom et prénoms du père ou tuteur"],
                        ["profPere", "Profession, domicile du père ou tuteur"],
                        ["mere", "Nom et prénoms de la mère"],
                        ["profMere", "Profession, domicile de la mère"],
                        ["tuteur", "Personne s'occupant de l'enfant"],
                      ] as [keyof Manual, string][]).map(([k, label]) => (
                        <div key={k} className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{label}</Label>
                          <Input className="h-9" value={m[k] as string} onChange={e => set({ [k]: e.target.value } as Partial<Manual>)} />
                        </div>
                      ))}
                      <details className="sm:col-span-2 text-sm">
                        <summary className="cursor-pointer text-muted-foreground">Moyennes des classes passées (remplacent l'attribution automatique)</summary>
                        <div className="mt-2 grid grid-cols-4 gap-2">
                          {niveaux.slice(0, CM2_INDEX).map((nv, k) => (
                            <div key={nv.k} className="space-y-1">
                              <Label className="text-xs text-muted-foreground">{nv.k}</Label>
                              <Input className="h-8" placeholder="6,50/10" value={m.moy[k]} onChange={e => set({ moy: m.moy.map((x, j) => (j === k ? e.target.value : x)) })} />
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  </details>
                );
              })}
            </div>
          )}

          {n > 0 && (
            <div className="space-y-1"><Label>Aperçu de l'apprenant</Label>
              <select className={selectClass} value={Math.min(sel, n - 1)} onChange={e => setSel(+e.target.value)}>
                {rows.map((_, i) => <option key={i} value={i}>{learner(i)?.nom}</option>)}
              </select>
            </div>
          )}

          <div ref={wrapRef} className="overflow-hidden border rounded-md"><div ref={innerRef} className="fs-root" style={{ width: 937 }} dangerouslySetInnerHTML={{ __html: apercuHtml }} /></div>

          <div className="flex flex-wrap gap-2">
            <Button disabled={!n} onClick={() => imprimer(rows.map((_, i) => i))}><Printer className="h-4 w-4 mr-2" />Imprimer / PDF : toutes les fiches</Button>
            <Button variant="outline" disabled={!n} onClick={() => imprimer([Math.min(sel, n - 1)])}>Cette fiche seulement</Button>
            <Button variant="outline" onClick={() => imprimer([null])}><FileText className="h-4 w-4 mr-2" />Fiche vierge</Button>
          </div>
          <p className="text-sm text-muted-foreground">Dans la fenêtre d'impression, choisissez « Enregistrer au format PDF », marges « Aucune », échelle 100 %.</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
