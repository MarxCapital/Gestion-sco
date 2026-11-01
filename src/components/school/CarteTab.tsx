import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Download, FileText, Loader2, PenLine, Plus, Sparkles, Trash2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { matchPhotos, type Candidate } from "@/lib/cep-inscription";
import { loadCommon } from "@/lib/cm2-manual";
import { downloadFiles } from "@/lib/download-many";
import { fmtDate, type ListMap, type ListRow } from "@/lib/cm2-tools";
import { applyDesignToTemplate, CARD_DESIGNS, getDesignByKey } from "@/lib/carte/designs";
import { createBeninTemplate } from "@/lib/carte/template";
import { renderCardSideToHTML } from "@/lib/carte/render";
import { buildCardsPdf, canvasToBlob, canvasToJpegBytes, htmlToCanvas, PDF_LAYOUT } from "@/lib/carte/export";
import type { SchoolInfo, Student } from "@/lib/carte/types";
import { decorate } from "@/lib/carte/overlays";
import { extractStamp } from "@/lib/carte/stamp";
import { useCarteAssets } from "@/hooks/useCarteAssets";
import SignaturePad from "./SignaturePad";
import { expandPhotos } from "@/lib/photo-import";

/** Carte 440×260 réduite pour tenir dans la largeur de l'écran (téléphone compris). */
function ScaledCard({ html, basis = 260 }: { html: string; basis?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setK(Math.min(1, el.clientWidth / 440) || 1);
    f();
    const ro = new ResizeObserver(f); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="flex-1 min-w-0 max-w-[440px]" style={{ flexBasis: basis, height: 260 * k }}>
      <div style={{ width: 440, height: 260, transform: `scale(${k})`, transformOrigin: "top left" }} className="border rounded-md shadow-sm overflow-hidden" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm max-w-full";
const infoKey = (s: string) => `gestionsco.carte.info.${s}`;
const FIELDS: { key: keyof ListMap; label: string; optional?: boolean }[] = [
  { key: "mat", label: "Matricule", optional: true }, { key: "nom", label: "Nom" }, { key: "pre", label: "Prénom(s)" },
  { key: "nai", label: "Date de naissance", optional: true }, { key: "lie", label: "Lieu de naissance", optional: true }, { key: "sex", label: "Sexe", optional: true },
];
const STEPS = ["Directeur", "Apprenants", "Photos", "Signatures", "Modèle", "Générer"];

interface Props {
  fixedList?: boolean; // compte École : la liste vient de l'onglet « Élèves »
  rows: ListRow[]; map: ListMap; headers: string[]; cands: Candidate[];
  photos: Record<string, File>; urlOf: (f: File) => string;
  setRows: (rows: ListRow[]) => void;
  putPhoto: (c: Candidate, f: Blob) => Promise<void>;
  putMany: (pairs: { cand: Candidate; file: Blob }[]) => Promise<{ ok: number; ko: number }>;
  removePhoto: (c: Candidate) => Promise<void>;
  importList: (f: File | undefined) => Promise<void>;
  setMap: (m: ListMap) => void;
  reading: boolean; listMsg: { ok: boolean; text: string } | null;
  schoolName: string; schoolKey: string; annee: string; // ex. « 2026-2027 »
}

const slug = (s: string) => s.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };

export default function CarteTab({ fixedList, rows, map, headers, cands, photos, urlOf, setRows, putPhoto, putMany, removePhoto, importList, setMap, reading, listMsg, schoolName, schoolKey, annee }: Props) {
  const [info, setInfo] = useState(() => {
    const d = { gender: "" as "" | "M" | "F", directeur: "", tel: "", ecole: "", design: "classic-white" };
    try {
      const known = loadCommon(schoolKey);
      return { ...d, directeur: known.directeur || "", tel: known.directeurTel || "", ...JSON.parse(localStorage.getItem(infoKey(schoolKey)) || "{}") };
    } catch { return d; }
  });
  const upd = (p: Partial<typeof info>) => setInfo(i => { const n = { ...i, ...p }; try { localStorage.setItem(infoKey(schoolKey), JSON.stringify(n)); } catch { /* */ } return n; });
  const ecole = info.ecole || schoolName;
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const go = (n: number) => { setStep(n); setReached(r => Math.max(r, n)); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoReport, setPhotoReport] = useState<{ ok: number; unknown: string[]; ambiguous: string[] } | null>(null);
  const [adding, setAdding] = useState<ListRow | null>(null);
  const one = useRef<HTMLInputElement>(null);
  const stampIn = useRef<HTMLInputElement>(null);
  const assets = useCarteAssets(schoolKey);
  const [pad, setPad] = useState<null | { kind: "dir" } | { kind: "eleve"; i: number; chain: boolean }>(null);
  const [stampBusy, setStampBusy] = useState(false);
  const oneFor = useRef(-1);
  const [result, setResult] = useState<null | { pdf: Blob; pngs: { name: string; blob: Blob }[]; count: number; sig: string }>(null);

  const school: SchoolInfo = { name: ecole, directorName: info.directeur, directorPhone: info.tel, directorGender: info.gender === "F" ? "F" : "M" };
  const design = getDesignByKey(info.design) ?? CARD_DESIGNS[0];
  const tplOf = (d: typeof design) => applyDesignToTemplate(createBeninTemplate("Carte"), d);
  const baseTpl = useMemo(() => tplOf(design), [design.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const students: Student[] = rows.map((r, i) => {
    const c = cands[i];
    const f = c ? photos[c.key] : undefined;
    return {
      id: String(i), lastName: String(r[map.nom] ?? "").trim().toUpperCase(), firstName: String(r[map.pre] ?? "").trim(),
      gender: c?.sexe || "", class: "CM2", studentId: String(r[map.mat] ?? "").trim(),
      dateOfBirth: map.nai ? fmtDate(r[map.nai]) : "", placeOfBirth: map.lie && map.lie !== map.nai ? String(r[map.lie] ?? "").trim() : "",
      photo: f ? urlOf(f) : undefined, signature: assets.studentSignature(String(r[map.nom] ?? "").trim().toUpperCase(), String(r[map.pre] ?? "").trim()), schoolYear: annee,
    };
  });
  const cardAssets = { directorSignature: assets.directorSignature, stamp: assets.stamp };
  const sideWith = (tpl: ReturnType<typeof tplOf>, s: Student | undefined, which: "front" | "back") => renderCardSideToHTML(decorate(tpl, s, school, cardAssets)[which], s, school, annee);
  const side = (s: Student | undefined, which: "front" | "back") => sideWith(baseTpl, s, which);
  const cur = students.length ? students[Math.min(sel, students.length - 1)] : undefined;
  const sans = students.filter(s => !s.photo);
  const incomplets = students.filter(s => !s.dateOfBirth || !s.placeOfBirth).length;
  const pret = !!ecole.trim() && !!info.directeur.trim();
  const nSig = students.filter(s => s.signature).length;

  // Empreinte de tout ce qui apparaît sur les cartes : si elle change, les cartes générées ne sont plus à jour.
  const sig = hash(JSON.stringify([students.map(s => [s.lastName, s.firstName, s.gender, s.dateOfBirth, s.placeOfBirth, s.studentId, !!s.photo && s.photo, s.signature ? s.signature.length : 0]), info, annee, assets.directorSignature?.length ?? 0, assets.stamp?.length ?? 0]));
  const stale = !!result && result.sig !== sig;

  const nameOf = (s: Student, v: string) => `${slug(s.studentId)}${s.studentId ? "_" : ""}${slug(s.lastName)}_${v}`;
  const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };

  // ---------- Étape 1 : liste ----------
  const setCell = (i: number, col: string, v: string) => { if (!col) return; const next = rows.map((r, k) => (k === i ? { ...r, [col]: v } : r)); setRows(next); };
  const empty = (): ListRow => Object.fromEntries(headers.map(h => [h, ""]));
  const canStep1 = rows.length > 0 && !!map.nom && !!map.pre;

  // ---------- Étape 2 : photos ----------
  const importPhotos = async (picked: File[]) => {
    if (!picked.length) return;
    setPhotoBusy(true); setPhotoReport(null);
    try {
      const files = await expandPhotos(picked);
      if (!files.length) { toast.error("Aucune image (jpg, png) trouvée dans ces fichiers."); return; }
      const res = matchPhotos(files.map(f => f.name), cands);
      const pairs = [...res.matched].map(([key, idx]) => ({ cand: cands.find(c => c.key === key)!, file: files[idx] }));
      const { ok } = await putMany(pairs);
      setPhotoReport({ ok, unknown: res.unmatchedFiles.map(i => files[i].name), ambiguous: res.ambiguousFiles.map(i => files[i].name) });
      toast.success(`${ok} photo(s) distribuée(s) aux apprenants.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Photos illisibles"); }
    finally { setPhotoBusy(false); }
  };

  // ---------- Étape 4 : génération ----------
  const preflight = () => {
    if (!info.gender) { toast.error("Indiquez si le directeur est un homme ou une femme, pour écrire « Directeur » ou « Directrice » au verso."); return false; }
    if (!pret && !window.confirm("Le nom de l'école ou du directeur est vide : la carte portera des valeurs d'exemple. Continuer ?")) return false;
    return true;
  };
  const generate = async () => {
    if (!preflight()) return;
    setBusy("0"); setResult(null);
    try {
      const pngs: { name: string; blob: Blob }[] = [];
      const cards: { front: Uint8Array; back: Uint8Array }[] = [];
      for (let i = 0; i < students.length; i++) {
        setBusy(`Carte ${i + 1}/${students.length}…`);
        const fc = await htmlToCanvas(side(students[i], "front")), bc = await htmlToCanvas(side(students[i], "back"));
        pngs.push({ name: nameOf(students[i], "recto") + ".png", blob: await canvasToBlob(fc) });
        pngs.push({ name: nameOf(students[i], "verso") + ".png", blob: await canvasToBlob(bc) });
        cards.push({ front: await canvasToJpegBytes(fc), back: await canvasToJpegBytes(bc) });
      }
      setBusy("Assemblage…");
      const pdf = new Blob([await buildCardsPdf(cards)], { type: "application/pdf" });
      setResult({ pdf, pngs, count: students.length, sig });
      toast.success(`${students.length} cartes générées.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de la génération"); }
    finally { setBusy(null); }
  };
  const dlOne = async (s: Student) => {
    if (!preflight()) return;
    setBusy("one");
    try {
      save(await canvasToBlob(await htmlToCanvas(side(s, "front"))), nameOf(s, "recto") + ".png");
      await new Promise(r => setTimeout(r, 450));
      save(await canvasToBlob(await htmlToCanvas(side(s, "back"))), nameOf(s, "verso") + ".png");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec"); } finally { setBusy(null); }
  };

  const stepper = (
    <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {STEPS.map((t, i) => {
        const done = i < step, active = i === step, can = i <= reached;
        return (
          <li key={t} className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button type="button" disabled={!can} onClick={() => go(i)} className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs sm:text-sm ${active ? "bg-primary text-primary-foreground border-primary" : done ? "bg-primary/10 border-primary/40" : "text-muted-foreground"} ${can ? "" : "opacity-60"}`}>
              <span className={`h-5 w-5 rounded-full grid place-items-center text-[11px] ${active ? "bg-primary-foreground text-primary" : "bg-muted text-foreground"}`}>{done ? <Check className="h-3 w-3" /> : i + 1}</span>{t}
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-3 sm:w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );

  const nav = (next?: { label: string; onClick: () => void; disabled?: boolean }) => (
    <div className="flex items-center justify-between gap-2 pt-2 border-t">
      {step > 0 ? <Button variant="outline" onClick={() => go(step - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button> : <span />}
      {next && <Button onClick={next.onClick} disabled={next.disabled}>{next.label}<ArrowRight className="h-4 w-4 ml-1" /></Button>}
    </div>
  );

  return (
    <div className="space-y-5">
      <input ref={one} type="file" accept="image/*" className="hidden" onChange={async e => {
        const f = e.target.files?.[0]; const c = cands[oneFor.current];
        if (f && c) { try { await putPhoto(c, f); toast.success("Photo remplacée."); } catch { toast.error("Photo illisible."); } }
        e.target.value = "";
      }} />
      {stepper}

      {/* ---------------- ÉTAPE 1 ---------------- */}
      {step === 1 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold">Étape 2 — Les apprenants</h3>
            {fixedList
              ? <p className="text-sm text-muted-foreground">La liste de votre classe est reprise automatiquement de l'onglet « Élèves ». Vérifiez les informations et complétez la date et le lieu de naissance directement dans le tableau (ils sont gardés sur cet appareil). Pour ajouter ou retirer un élève, passez par l'onglet « Élèves ».</p>
              : <p className="text-sm text-muted-foreground">Importez la liste (PDF avec texte, Excel ou CSV). Les informations s'affichent ci-dessous : vérifiez-les et corrigez directement dans le tableau. Elle reste sur votre appareil, rien n'est envoyé sur un serveur.</p>}
          </div>
          {!fixedList && <Input type="file" accept=".pdf,.xlsx,.xls,.csv" disabled={reading} onChange={e => { importList(e.target.files?.[0]); e.target.value = ""; }} className="max-w-md" />}
          {reading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Lecture du fichier…</p>}
          {listMsg && <p role="status" className={`text-sm ${listMsg.ok ? "text-green-700" : "text-destructive"}`}>{listMsg.text}</p>}

          {!fixedList && headers.length > 0 && (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Colonnes du fichier (à modifier seulement si une information est mal placée)</summary>
              <div className="grid gap-3 sm:grid-cols-3 mt-3">
                {FIELDS.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{f.label}{f.optional ? " (facultatif)" : ""}</Label>
                    <select className={selectClass + " w-full"} value={map[f.key]} onChange={e => setMap({ ...map, [f.key]: e.target.value })}>
                      {f.optional && <option value="">— aucune —</option>}
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </details>
          )}

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{rows.length} apprenant(s)</span>
                {incomplets > 0 && <span className="text-xs text-amber-700">{incomplets} sans date ou lieu de naissance — à compléter ci-dessous</span>}
                {!fixedList && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAdding(empty())}><Plus className="h-4 w-4 mr-1" />Ajouter un apprenant</Button>}
              </div>
              <div className="max-h-[28rem] overflow-auto border rounded-md">
                <table className="w-full text-sm min-w-[820px]">
                  <thead className="sticky top-0 bg-card"><tr className="text-left">
                    <th className="px-2 py-1">#</th><th className="px-2 py-1">Nom</th><th className="px-2 py-1">Prénom(s)</th><th className="px-2 py-1 w-20">Sexe</th>
                    <th className="px-2 py-1">Date de naissance</th><th className="px-2 py-1">Lieu de naissance</th><th className="px-2 py-1 w-16">Classe</th><th className="px-1 py-1" />
                  </tr></thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const s = students[i];
                      const cell = "h-8 px-2 text-sm w-full";
                      return (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                          <td className="px-1 py-1"><Input className={cell} value={String(r[map.nom] ?? "")} onChange={e => setCell(i, map.nom, e.target.value.toUpperCase())} /></td>
                          <td className="px-1 py-1"><Input className={cell} value={String(r[map.pre] ?? "")} onChange={e => setCell(i, map.pre, e.target.value)} /></td>
                          <td className="px-1 py-1">{map.sex
                            ? <select className={selectClass + " w-full h-8"} value={/^f/i.test(String(r[map.sex] ?? "").trim()) ? "F" : /^(m|g)/i.test(String(r[map.sex] ?? "").trim()) ? "M" : ""} onChange={e => setCell(i, map.sex, e.target.value)}><option value="">—</option><option value="M">M</option><option value="F">F</option></select>
                            : <span className="px-2 text-muted-foreground">{s.gender || "—"}</span>}</td>
                          <td className="px-1 py-1">{map.nai ? <Input className={cell + (s.dateOfBirth ? "" : " border-amber-500")} value={String(r[map.nai] ?? "")} placeholder="jj/mm/aaaa" onChange={e => setCell(i, map.nai, e.target.value)} /> : <span className="px-2 text-muted-foreground">—</span>}</td>
                          <td className="px-1 py-1">{map.lie && map.lie !== map.nai ? <Input className={cell + (s.placeOfBirth ? "" : " border-amber-500")} value={String(r[map.lie] ?? "")} onChange={e => setCell(i, map.lie, e.target.value)} /> : <span className="px-2 text-muted-foreground">{map.lie === map.nai ? "dans la date" : "—"}</span>}</td>
                          <td className="px-2 py-1"><span className="text-xs rounded bg-muted px-1.5 py-0.5">CM2</span></td>
                          <td className="px-1 py-1">{!fixedList && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Retirer de la liste" onClick={() => { if (window.confirm(`Retirer ${s.lastName} ${s.firstName} de la liste ?`)) setRows(rows.filter((_, k) => k !== i)); }}><Trash2 className="h-4 w-4" /></Button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Si vous changez un nom ou un prénom, la photo déjà mémorisée ne suivra pas : ajoutez-la à nouveau à l'étape 3. Les cases en orange sont vides.</p>
            </>
          )}
          {rows.length === 0 && !reading && <div className="py-8 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2" />{fixedList ? "Aucun apprenant : ajoutez d'abord la liste de votre classe dans l'onglet « Élèves »." : "Importez la liste des apprenants pour commencer."}</div>}
          {nav({ label: "Suivant", onClick: () => go(2), disabled: !canStep1 })}
        </section>
      )}

      {/* ---------------- ÉTAPE 1 : directeur ---------------- */}
      {step === 0 && (
        <section className="space-y-5">
          <div>
            <h3 className="font-semibold">Étape 1 — Le directeur, son cachet et sa signature</h3>
            <p className="text-sm text-muted-foreground">Ces informations s'écrivent au verso de chaque carte. Elles sont gardées sur cet appareil pour la prochaine fois.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2"><Label className="text-xs text-muted-foreground">Nom de l'école</Label><Input value={ecole} onChange={e => upd({ ecole: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Le directeur est… *</Label>
              <select className={selectClass + " w-full" + (info.gender ? "" : " border-destructive")} value={info.gender} onChange={e => upd({ gender: e.target.value as "M" | "F" })}><option value="">— choisir —</option><option value="M">Un homme (Directeur)</option><option value="F">Une femme (Directrice)</option></select></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Nom {info.gender === "F" ? "de la directrice" : "du directeur"}</Label><Input value={info.directeur} onChange={e => upd({ directeur: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Téléphone</Label><Input value={info.tel} onChange={e => upd({ tel: e.target.value })} placeholder="01 97 00 00 00" /></div>
          </div>

          <input ref={stampIn} type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            setStampBusy(true);
            try { await assets.saveStamp(await extractStamp(f)); toast.success("Cachet enregistré : le papier blanc a été retiré."); }
            catch (err) { toast.error(err instanceof Error ? err.message : "Cachet illisible"); }
            finally { setStampBusy(false); }
          }} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Signature {info.gender === "F" ? "de la directrice" : "du directeur"}</p>
              <div className="h-20 rounded bg-white border flex items-center justify-center overflow-hidden">{assets.directorSignature ? <img src={assets.directorSignature} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground">Pas encore signée</span>}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setPad({ kind: "dir" })}><PenLine className="h-4 w-4 mr-1" />{assets.directorSignature ? "Signer à nouveau" : "Signer électroniquement"}</Button>
                {assets.directorSignature && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => assets.removeDirectorSignature()}>Retirer</Button>}
              </div>
            </div>
            <div className="rounded-md border p-3 space-y-2">
              <p className="text-sm font-medium">Cachet</p>
              <div className="h-20 rounded border flex items-center justify-center overflow-hidden" style={{ backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%)", backgroundSize: "14px 14px" }}>{assets.stamp ? <img src={assets.stamp} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-muted-foreground bg-white/80 px-1 rounded">Pas encore de cachet</span>}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={stampBusy} onClick={() => stampIn.current?.click()}>{stampBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}Photographier le cachet</Button>
                {assets.stamp && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => assets.removeStamp()}>Retirer</Button>}
              </div>
              <p className="text-xs text-muted-foreground">Tamponnez sur une feuille blanche, photographiez à plat avec de la lumière : le papier est effacé automatiquement.</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">Au verso, le nom {info.gender === "F" ? "de la directrice" : "du directeur"} s'écrit en gras sous la signature, à côté du cachet.</p>
          {nav({ label: "Suivant", onClick: () => { if (!info.gender) { toast.error("Indiquez si le directeur est un homme ou une femme."); return; } go(1); } })}
        </section>
      )}

      {/* ---------------- ÉTAPE 2 ---------------- */}
      {step === 2 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold">Étape 3 — Les photos</h3>
            <p className="text-sm text-muted-foreground">Ajoutez les photos en <b>jpg</b> (plusieurs à la fois) ou dans un seul fichier <b>ZIP</b>. Chaque photo doit porter le nom de l'apprenant (ex. <code>KPAKPO_Jean.jpg</code>) : la plateforme les distribue toute seule.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border bg-background px-3 py-2 hover:bg-muted">
            {photoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Ajouter des photos (jpg ou zip)
            <input type="file" multiple accept="image/*,.zip,application/zip" className="hidden" disabled={photoBusy} onChange={e => { importPhotos([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </label>
          {photoReport && (
            <div className="text-sm space-y-1">
              <p className="text-green-700">{photoReport.ok} photo(s) rattachée(s).</p>
              {photoReport.unknown.length > 0 && <p className="text-amber-700">Nom non reconnu ({photoReport.unknown.length}) : {photoReport.unknown.slice(0, 12).join(", ")}{photoReport.unknown.length > 12 ? "…" : ""}. Touchez la vignette de l'apprenant pour lui donner la bonne photo.</p>}
              {photoReport.ambiguous.length > 0 && <p className="text-amber-700">Plusieurs photos pour le même apprenant ({photoReport.ambiguous.length}) : {photoReport.ambiguous.slice(0, 12).join(", ")}.</p>}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{students.length - sans.length}/{students.length} apprenants ont leur photo.{sans.length > 0 && <span className="text-amber-700"> {sans.length} sans photo.</span>}</p>
          <div className="max-h-[28rem] overflow-auto border rounded-md">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="sticky top-0 bg-card"><tr className="text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Photo</th><th className="px-2 py-1">Apprenant</th><th /></tr></thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-1">
                      <button type="button" title="Changer la photo" onClick={() => { oneFor.current = i; one.current?.click(); }}>
                        {s.photo ? <img src={s.photo} alt="" className="h-14 w-11 rounded object-cover" /> : <UserRound className="h-14 w-11 p-2 rounded bg-muted text-muted-foreground" />}
                      </button>
                    </td>
                    <td className="px-2 py-1">{s.lastName} {s.firstName}{!s.photo && <span className="ml-2 text-xs text-amber-700">sans photo</span>}</td>
                    <td className="px-2 py-1 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => { oneFor.current = i; one.current?.click(); }}><Camera className="h-4 w-4 mr-1" />{s.photo ? "Changer" : "Ajouter"}</Button>
                      {s.photo && cands[i] && <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Retirer la photo" onClick={() => removePhoto(cands[i])}><Trash2 className="h-4 w-4" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nav({ label: "Continuer", onClick: () => { if (sans.length && !window.confirm(`${sans.length} apprenant(s) n'ont pas de photo : leur carte aura un emplacement vide. Continuer quand même ?`)) return; go(3); } })}
        </section>
      )}

      {/* ---------------- ÉTAPE 4 : signatures des apprenants ---------------- */}
      {step === 3 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold">Étape 4 — La signature des apprenants</h3>
            <p className="text-sm text-muted-foreground">Passez le téléphone à chaque apprenant : il signe dans le rectangle (le mode « Plein écran » l'agrandit). Cette étape est facultative.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={nSig === students.length} onClick={() => { const i = students.findIndex(s => !s.signature); if (i >= 0) setPad({ kind: "eleve", i, chain: true }); }}><PenLine className="h-4 w-4 mr-1" />Faire signer les apprenants à la suite</Button>
            <span className="text-xs text-muted-foreground">{nSig}/{students.length} signatures</span>
          </div>
          <div className="max-h-[28rem] overflow-auto border rounded-md">
            <table className="w-full text-sm min-w-[420px]">
              <thead className="sticky top-0 bg-card"><tr className="text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Photo</th><th className="px-2 py-1">Apprenant</th><th className="px-2 py-1">Signature</th></tr></thead>
              <tbody>
                {students.map((s, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-1">{s.photo ? <img src={s.photo} alt="" className="h-10 w-8 rounded object-cover" /> : <UserRound className="h-10 w-8 p-1.5 rounded bg-muted text-muted-foreground" />}</td>
                    <td className="px-2 py-1">{s.lastName} {s.firstName}</td>
                    <td className="px-2 py-1">
                      <button type="button" className="flex items-center gap-1 text-xs rounded border px-2 py-1 hover:bg-muted whitespace-nowrap" onClick={() => setPad({ kind: "eleve", i, chain: false })}>
                        {s.signature ? <img src={s.signature} alt="" className="h-6 w-14 object-contain bg-white rounded" /> : <PenLine className="h-4 w-4" />}{s.signature ? "Refaire" : "Signer"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nav({ label: "Suivant", onClick: () => { if (nSig < students.length && !window.confirm(`${students.length - nSig} apprenant(s) n'ont pas signé : leur carte aura un emplacement de signature vide. Continuer ?`)) return; go(4); } })}
        </section>
      )}

      {/* ---------------- ÉTAPE 3 ---------------- */}
      {step === 4 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold">Étape 5 — Le modèle de carte</h3>
            <p className="text-sm text-muted-foreground">Touchez le modèle qui vous plaît. L'aperçu utilise un apprenant de votre liste.</p>
          </div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Aperçu avec</Label>
            <select className={selectClass} value={Math.min(sel, students.length - 1)} onChange={e => setSel(+e.target.value)}>
              {students.map((s, i) => <option key={i} value={i}>{s.lastName} {s.firstName}</option>)}
            </select></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CARD_DESIGNS.map(d => {
              const tpl = tplOf(d); const on = info.design === d.key;
              return (
                <button key={d.key} type="button" onClick={() => upd({ design: d.key })} className={`text-left rounded-lg border-2 p-2 space-y-2 transition ${on ? "border-primary bg-primary/5" : "border-transparent bg-muted/30 hover:bg-muted"}`}>
                  <div className="flex"><ScaledCard html={sideWith(tpl, cur, "front")} basis={200} /></div>
                  <div className="flex items-center gap-2 text-sm"><span className="h-3 w-3 rounded-full border" style={{ background: d.front.cardTitleColor }} /><span className={on ? "font-semibold" : ""}>{d.name}</span>{on && <Check className="h-4 w-4 text-primary ml-auto" />}</div>
                </button>
              );
            })}
          </div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Verso du modèle choisi ({design.name})</Label><div className="flex flex-wrap gap-3"><ScaledCard html={side(cur, "back")} /></div></div>
          {nav({ label: "Suivant", onClick: () => go(5) })}
        </section>
      )}

      {/* ---------------- ÉTAPE 4 ---------------- */}
      {step === 5 && (
        <section className="space-y-5">
          <div>
            <h3 className="font-semibold">Étape 6 — Générer les cartes</h3>
            <p className="text-sm text-muted-foreground">Dernières informations pour le verso, puis appuyez sur « Générer ».</p>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
            <p><b>{students.length}</b> cartes · classe CM2 · modèle « {design.name} » · année {annee}</p>
            {sans.length > 0 && <p className="text-amber-700">{sans.length} apprenant(s) sans photo (retour à l'étape 3 pour les ajouter).</p>}
            {incomplets > 0 && <p className="text-amber-700">{incomplets} apprenant(s) sans date ou lieu de naissance (étape 2).</p>}
          </div>

          <div className="space-y-3">
            <Button size="lg" disabled={!!busy || !students.length} onClick={generate}>
              {busy && busy !== "one" ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Sparkles className="h-5 w-5 mr-2" />}{busy && busy !== "one" && busy !== "0" ? busy : result ? "Générer à nouveau" : "Générer les cartes"}
            </Button>
            {stale && <p className="text-sm text-amber-700">Des informations ont changé depuis la génération : régénérez les cartes avant de télécharger.</p>}
            {result && (
              <div className="rounded-md border border-green-600/40 bg-green-50 dark:bg-green-950/20 p-3 space-y-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2"><Check className="h-4 w-4" />{result.count} cartes prêtes à télécharger{stale ? " (anciennes informations)" : ""}</p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={stale} onClick={() => save(result.pdf, `cartes_scolaires_${annee}.pdf`)}><FileText className="h-4 w-4 mr-2" />PDF à imprimer ({PDF_LAYOUT.perPage} élèves par page)</Button>
                  <Button variant="outline" disabled={stale} onClick={async () => { setBusy("png"); try { await downloadFiles(result.pngs.map(f => ({ name: f.name, get: () => f.blob })), (d, n) => setBusy(`Téléchargement ${d}/${n}…`)); } finally { setBusy(null); } }}><Download className="h-4 w-4 mr-2" />Toutes les images PNG (une à une)</Button>
                  <Button variant="outline" disabled={!!busy || !cur} onClick={() => cur && dlOne(cur)}>Une seule carte : {cur ? `${cur.lastName} ${cur.firstName}` : ""}</Button>
                </div>
                <p className="text-xs text-muted-foreground">Cartes de 88 × 52 mm, recto à gauche et verso à droite sur chaque ligne du PDF. Les fichiers restent sur votre appareil.</p>
              </div>
            )}
            {!result && <p className="text-xs text-muted-foreground">La génération prend quelques secondes par dizaine de cartes. Les téléchargements apparaissent ensuite ici.</p>}
          </div>
          {nav()}
        </section>
      )}

      {adding && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAdding(null)}>
          <div className="bg-background rounded-lg p-4 sm:p-5 w-full max-w-lg max-h-[92vh] overflow-auto space-y-3" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold">Ajouter un apprenant</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.filter(f => map[f.key]).map(f => (
                <div key={f.key} className="space-y-1"><Label className="text-xs text-muted-foreground">{f.label}</Label>
                  <Input value={String(adding[map[f.key]] ?? "")} onChange={e => setAdding(d => d && ({ ...d, [map[f.key]]: f.key === "nom" ? e.target.value.toUpperCase() : e.target.value }))} /></div>
              ))}
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setAdding(null)}>Annuler</Button><Button onClick={() => { setRows([...rows, adding]); setAdding(null); }}>Ajouter</Button></div>
          </div>
        </div>
      )}

      {pad && (() => {
        if (pad.kind === "dir") {
          return <SignaturePad title={`Signature ${info.gender === "F" ? "de la directrice" : "du directeur"}`} hint={info.directeur || undefined}
            onSave={async b => { await assets.saveDirectorSignature(b); setPad(null); toast.success("Signature enregistrée."); }} onClose={() => setPad(null)} />;
        }
        const s = students[pad.i];
        if (!s) return null;
        const next = () => { const j = students.findIndex((x, k) => k > pad.i && !x.signature); if (pad.chain && j >= 0) setPad({ kind: "eleve", i: j, chain: true }); else setPad(null); };
        return <SignaturePad key={pad.i} title={`${s.lastName} ${s.firstName}`} hint={pad.chain ? `Apprenant ${pad.i + 1} sur ${students.length}` : "Signature de l'apprenant"}
          saveLabel={pad.chain ? "Valider et suivant" : "Valider la signature"} onSkip={pad.chain ? next : undefined}
          onSave={async b => { await assets.saveStudentSignature(s.lastName, s.firstName, b); next(); }} onClose={() => setPad(null)} />;
      })()}
    </div>
  );
}
