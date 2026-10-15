import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  NIVEAUX_DEFAUT, detectMoyenneColumns, ficheHtml, getLearner, guessMap, imprimerHtml,
  nomFichier, readListFile, trierPhotos, zipPhotos,
  type FicheOptions, type ListMap, type ListRow, type PhotoOrder,
} from "@/lib/cm2-tools";
import "./cm2-fiche.css";

const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm max-w-full";
const FIELDS: { key: keyof ListMap; label: string; optional?: boolean }[] = [
  { key: "mat", label: "Matricule" },
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

export default function Cm2Tools({ schoolName }: { schoolName?: string | null }) {
  // ----- Liste commune -----
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ListRow[]>([]);
  const [map, setMap] = useState<ListMap>({ mat: "", nom: "", pre: "", nai: "", lie: "", sex: "" });
  const [listMsg, setListMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reading, setReading] = useState(false);

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
  const [fichePhotos, setFichePhotos] = useState<File[]>([]);
  const [fichePhotoOrder, setFichePhotoOrder] = useState<PhotoOrder>("nom");
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
  const fichePhotosTriees = useMemo(() => trierPhotos(fichePhotos, fichePhotoOrder), [fichePhotos, fichePhotoOrder]);

  const options: FicheOptions = { ecole, date: dateFiche, scolariteComplete, niveaux };
  const photoUrl = (i: number | null) => {
    if (!usePhoto || i === null) return "";
    const f = fichePhotosTriees[i];
    return f ? urlOf(f) : "";
  };
  const learner = (i: number) => getLearner(rows[i], map, moyCols);
  const apercuHtml = useMemo(() => {
    const i = rows.length ? Math.min(sel, rows.length - 1) : null;
    return ficheHtml(i === null ? null : learner(i), options, photoUrl(i));
  }, [rows, map, moyCols, sel, ecole, dateFiche, scolariteComplete, niveaux, usePhoto, fichePhotosTriees]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const { headers: h, rows: r } = await readListFile(file);
      setHeaders(h); setRows(r); setMap(guessMap(h)); setSel(0);
      setListMsg({ ok: true, text: `${r.length} apprenants importés. Vérifiez les colonnes choisies.` });
    } catch {
      setListMsg({ ok: false, text: "Fichier illisible. Utilisez un PDF contenant du texte (pas une image scannée), un Excel (.xlsx) ou un CSV." });
    } finally { setReading(false); }
  };

  const n = rows.length;
  const photoMsg = (k: number) =>
    k === 0 ? null : { ok: k === n, text: `${k} photos pour ${n} apprenants${k === n ? "" : " : les nombres ne correspondent pas, le décalage touchera tous les suivants."}` };

  const telechargerZip = async () => {
    setZipping("Préparation…");
    try {
      const { blob, total } = await zipPhotos(photosTriees, rows, map, (i, t) => setZipping(`Traitement ${i}/${t}…`));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "photos_renommees.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast.success(`${total} photos renommées et téléchargées.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de la création du ZIP");
    } finally { setZipping(null); }
  };

  const imprimer = (liste: (number | null)[]) =>
    imprimerHtml(liste.map(i => ficheHtml(i === null ? null : learner(i), options, photoUrl(i))).join(""));

  const pm = photoMsg(photos.length);
  const fpm = usePhoto ? photoMsg(fichePhotos.length) : null;
  const max = Math.max(n, photosTriees.length);

  return (
    <div className="space-y-6">
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

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="photos">1. Renommer les photos</TabsTrigger>
          <TabsTrigger value="fiche">2. Fiche scolaire</TabsTrigger>
          <TabsTrigger value="individuelle">3. Fiche individuelle des candidats</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="space-y-4">
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
          <Button onClick={telechargerZip} disabled={!n || !photos.length || zipping !== null}>
            {zipping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {zipping ?? "Télécharger les photos renommées (ZIP)"}
          </Button>
        </TabsContent>

        <TabsContent value="individuelle">
          <div className="py-10 text-center text-muted-foreground space-y-2">
            <FileText className="h-8 w-8 mx-auto" />
            <h3 className="font-medium text-foreground">Fiche individuelle des candidats</h3>
            <p>À venir. Cette fonctionnalité sera ajoutée prochainement : la fiche sera remplie automatiquement avec les informations des apprenants de la liste ci-dessus.</p>
          </div>
        </TabsContent>

        <TabsContent value="fiche" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2"><Label>École</Label><Input value={ecole} onChange={e => setEcole(e.target.value)} /></div>
            <div className="space-y-1"><Label>Délivrée le</Label><Input value={dateFiche} onChange={e => setDateFiche(e.target.value)} /></div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={scolariteComplete} onChange={e => setScolariteComplete(e.target.checked)} />
            <span>Ces élèves ont fait toutes les classes précédentes dans cette école. <span className="text-muted-foreground">(Si coché, l'école, le matricule et les dates sont écrits pour chaque classe passée. À ne cocher que si c'est exact ; sinon ces cases restent vides pour être complétées à la main.)</span></span>
          </label>
          <p className="text-sm text-muted-foreground">
            Les notes des classes passées ne sont jamais inventées : elles sont écrites seulement si votre liste contient une colonne de moyennes (ex. « Moyenne CE2 »).
            {rows.length > 0 && (moyDetectees.length ? <> Colonnes détectées : <strong>{moyDetectees.join(", ")}</strong>.</> : " Aucune colonne de moyennes détectée : les notes resteront vides.")}
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

          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={usePhoto} onChange={e => setUsePhoto(e.target.checked)} />Ajouter la photo des apprenants (facultatif)</label>
          {usePhoto && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1"><Label>Photos (dans l'ordre de la liste)</Label><Input type="file" accept="image/*" multiple onChange={e => setFichePhotos([...(e.target.files ?? [])])} /></div>
              <div className="space-y-1"><Label>Ordre des photos</Label><PhotoOrderSelect value={fichePhotoOrder} onChange={setFichePhotoOrder} /></div>
            </div>
          )}
          {fpm && <p role="status" className={`text-sm ${fpm.ok ? "text-green-700" : "text-destructive"}`}>{fpm.text}</p>}

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
