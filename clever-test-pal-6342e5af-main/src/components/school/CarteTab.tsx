import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Camera, Download, FileText, Loader2, PenLine, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Candidate } from "@/lib/cep-inscription";
import { fmtDate, getJSZip, type ListMap, type ListRow } from "@/lib/cm2-tools";
import { applyDesignToTemplate, CARD_DESIGNS, getDesignByKey } from "@/lib/carte/designs";
import { createBeninTemplate } from "@/lib/carte/template";
import { renderCardSideToHTML } from "@/lib/carte/render";
import { buildCardsPdf, canvasToBlob, canvasToJpegBytes, htmlToCanvas, PDF_LAYOUT } from "@/lib/carte/export";
import type { SchoolInfo, Student } from "@/lib/carte/types";
import { decorate } from "@/lib/carte/overlays";
import { extractStamp } from "@/lib/carte/stamp";
import { useCarteAssets } from "@/hooks/useCarteAssets";
import SignaturePad from "./SignaturePad";

/** Carte 440×260 réduite pour tenir dans la largeur de l'écran (téléphone compris). */
function ScaledCard({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setK(Math.min(1, el.clientWidth / 440));
    f();
    const ro = new ResizeObserver(f); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="flex-1 basis-[260px] max-w-[440px] min-w-0" style={{ height: 260 * k }}>
      <div style={{ width: 440, height: 260, transform: `scale(${k})`, transformOrigin: "top left" }} className="border rounded-md shadow-sm overflow-hidden" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm max-w-full";
const infoKey = (s: string) => `gestionsco.carte.info.${s}`;

interface Props {
  rows: ListRow[]; map: ListMap; headers: string[]; cands: Candidate[];
  photos: Record<string, File>; urlOf: (f: File) => string;
  setRows: (rows: ListRow[]) => void;
  putPhoto: (c: Candidate, f: Blob) => Promise<void>;
  schoolName: string; schoolKey: string; annee: string; // ex. « 2026-2027 »
}

const slug = (s: string) => s.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");

export default function CarteTab({ rows, map, headers, cands, photos, urlOf, setRows, putPhoto, schoolName, schoolKey, annee }: Props) {
  const [info, setInfo] = useState(() => {
    const d = { gender: "" as "" | "M" | "F", directeur: "", tel: "", ecole: "", design: "classic-white" };
    try { return { ...d, ...JSON.parse(localStorage.getItem(infoKey(schoolKey)) || "{}") }; } catch { return d; }
  });
  const upd = (p: Partial<typeof info>) => setInfo(i => { const n = { ...i, ...p }; try { localStorage.setItem(infoKey(schoolKey), JSON.stringify(n)); } catch { /* */ } return n; });
  const ecole = info.ecole || schoolName;
  const [sel, setSel] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ i: number; r: ListRow } | null>(null);
  const one = useRef<HTMLInputElement>(null);
  const stampIn = useRef<HTMLInputElement>(null);
  const assets = useCarteAssets(schoolKey);
  const [pad, setPad] = useState<null | { kind: "dir" } | { kind: "eleve"; i: number; chain: boolean }>(null);
  const [stampBusy, setStampBusy] = useState(false);
  const oneFor = useRef(-1);

  const school: SchoolInfo = { name: ecole, directorName: info.directeur, directorPhone: info.tel, directorGender: info.gender === "F" ? "F" : "M" };
  const baseTpl = useMemo(() => applyDesignToTemplate(createBeninTemplate("Carte"), getDesignByKey(info.design) ?? CARD_DESIGNS[0]), [info.design]);

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
  const side = (s: Student | undefined, which: "front" | "back") => renderCardSideToHTML(decorate(baseTpl, s, school, cardAssets)[which], s, school, annee);
  const cur = students.length ? students[Math.min(sel, students.length - 1)] : undefined;
  const sans = students.filter(s => !s.photo);
  const incomplets = students.filter(s => !s.dateOfBirth || !s.placeOfBirth).length;
  const pret = !!ecole.trim() && !!info.directeur.trim();
  const nSig = students.filter(s => s.signature).length;

  const nameOf = (s: Student, v: string) => `${slug(s.studentId)}${s.studentId ? "_" : ""}${slug(s.lastName)}_${v}`;
  const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); };

  const run = async (label: string, fn: () => Promise<void>) => {
    if (!info.gender) { toast.error("Indiquez d'abord si le directeur est un homme ou une femme (étape 1), pour écrire « Directeur » ou « Directrice » au verso."); return; }
    if (!pret && !window.confirm("Le nom de l'école ou du directeur est vide : la carte portera des valeurs d'exemple. Continuer ?")) return;
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de la génération"); } finally { setBusy(null); }
  };

  const dlOne = (s: Student) => run("one", async () => {
    const JSZip = await getJSZip(); const z = new JSZip();
    z.file(nameOf(s, "recto") + ".png", await canvasToBlob(await htmlToCanvas(side(s, "front"))));
    z.file(nameOf(s, "verso") + ".png", await canvasToBlob(await htmlToCanvas(side(s, "back"))));
    save(await z.generateAsync({ type: "blob" }), `carte_${slug(s.lastName)}_${slug(s.firstName)}.zip`);
  });
  const dlZip = () => run("zip", async () => {
    const JSZip = await getJSZip(); const z = new JSZip();
    for (let i = 0; i < students.length; i++) {
      setBusy(`Image ${i + 1}/${students.length}…`);
      z.file(nameOf(students[i], "recto") + ".png", await canvasToBlob(await htmlToCanvas(side(students[i], "front"))));
      z.file(nameOf(students[i], "verso") + ".png", await canvasToBlob(await htmlToCanvas(side(students[i], "back"))));
    }
    save(await z.generateAsync({ type: "blob" }), "cartes_scolaires_png.zip");
    toast.success(`${students.length} cartes (recto + verso) téléchargées.`);
  });
  const dlPdf = () => run("pdf", async () => {
    const cards = [];
    for (let i = 0; i < students.length; i++) {
      setBusy(`Carte ${i + 1}/${students.length}…`);
      cards.push({ front: await canvasToJpegBytes(await htmlToCanvas(side(students[i], "front"))), back: await canvasToJpegBytes(await htmlToCanvas(side(students[i], "back"))) });
    }
    setBusy("Assemblage du PDF…");
    save(new Blob([await buildCardsPdf(cards)], { type: "application/pdf" }), `cartes_scolaires_${annee}.pdf`);
    toast.success(`PDF de ${Math.ceil(cards.length / PDF_LAYOUT.perPage)} page(s) prêt (${PDF_LAYOUT.perPage} élèves par page, recto et verso).`);
  });

  const saveEdit = () => {
    if (!edit) return;
    const next = [...rows];
    if (edit.i < 0) next.push(edit.r); else next[edit.i] = edit.r;
    setRows(next); setEdit(null);
  };
  const empty = (): ListRow => Object.fromEntries(headers.map(h => [h, ""]));
  const fields: [keyof ListMap, string][] = [["mat", "Matricule"], ["nom", "Nom"], ["pre", "Prénom(s)"], ["sex", "Sexe (M/F)"], ["nai", "Date de naissance"], ["lie", "Lieu de naissance"]];

  if (!rows.length) return <div className="py-10 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2" />Importez d'abord la liste des apprenants (en haut de la page) : la carte est remplie à partir de cette liste.</div>;

  const prev = (which: "front" | "back") => (
    <ScaledCard html={side(cur, which)} />
  );

  return (
    <div className="space-y-6">
      <input ref={one} type="file" accept="image/*" className="hidden" onChange={async e => {
        const f = e.target.files?.[0]; const c = cands[oneFor.current];
        if (f && c) { try { await putPhoto(c, f); toast.success("Photo mémorisée."); } catch { toast.error("Photo illisible."); } }
        e.target.value = "";
      }} />

      <section className="space-y-3">
        <h3 className="font-semibold">1. Informations de l'école</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1 sm:col-span-2"><Label className="text-xs text-muted-foreground">Nom de l'école</Label><Input value={ecole} onChange={e => upd({ ecole: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Le directeur est… *</Label>
            <select className={selectClass + " w-full" + (info.gender ? "" : " border-destructive")} value={info.gender} onChange={e => upd({ gender: e.target.value as "M" | "F" })}><option value="">— choisir —</option><option value="M">Un homme (Directeur)</option><option value="F">Une femme (Directrice)</option></select></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Nom {info.gender === "F" ? "de la directrice" : "du directeur"}</Label><Input value={info.directeur} onChange={e => upd({ directeur: e.target.value })} /></div>
          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Téléphone</Label><Input value={info.tel} onChange={e => upd({ tel: e.target.value })} placeholder="01 97 00 00 00" /></div>
        </div>
        <p className="text-xs text-muted-foreground">Primaire · classe CM2 · année {annee}. Ces informations sont gardées sur cet appareil pour la prochaine fois.</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Signature et cachet {info.gender === "F" ? "de la directrice" : "du directeur"}</h3>
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
            <p className="text-sm font-medium">Signature</p>
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
            <p className="text-xs text-muted-foreground">Tamponnez sur une feuille blanche, photographiez bien à plat avec de la lumière : le papier est effacé automatiquement.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Au verso, le nom {info.gender === "F" ? "de la directrice" : "du directeur"} s'écrit en gras sous la signature, à côté du cachet.</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">2. Modèle de carte</h3>
        <div className="flex flex-wrap gap-2">
          {CARD_DESIGNS.map(d => (
            <button key={d.key} type="button" onClick={() => upd({ design: d.key })} title={d.description}
              className={`rounded-md border px-3 py-1.5 text-sm ${info.design === d.key ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`}>
              <span className="inline-block h-3 w-3 rounded-full mr-2 align-middle border" style={{ background: d.front.cardTitleColor }} />{d.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">{prev("front")}{prev("back")}</div>
        <div className="space-y-1"><Label className="text-xs text-muted-foreground">Aperçu avec l'apprenant</Label>
          <select className={selectClass} value={Math.min(sel, students.length - 1)} onChange={e => setSel(+e.target.value)}>
            {students.map((s, i) => <option key={i} value={i}>{s.lastName} {s.firstName}</option>)}
          </select></div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold flex-1">3. Apprenants et photos ({students.length})</h3>
          <Button size="sm" variant="outline" onClick={() => setEdit({ i: -1, r: empty() })}><Plus className="h-4 w-4 mr-1" />Ajouter un apprenant</Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {students.length - sans.length}/{students.length} photos retrouvées automatiquement dans la mémoire de l'école.
          {incomplets > 0 && <> {incomplets} apprenant(s) sans date ou lieu de naissance : vérifiez les colonnes choisies en haut ou modifiez la ligne.</>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={nSig === students.length} onClick={() => { const i = students.findIndex(s => !s.signature); if (i >= 0) setPad({ kind: "eleve", i, chain: true }); }}><PenLine className="h-4 w-4 mr-1" />Faire signer les apprenants à la suite</Button>
          <span className="text-xs text-muted-foreground">{nSig}/{students.length} signatures. Passez le téléphone à chaque apprenant ; « Plein écran » agrandit le rectangle.</span>
        </div>
        <div className="max-h-80 overflow-auto border rounded-md">
          <table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-left"><th className="px-2 py-1">#</th><th className="px-2 py-1">Photo</th><th className="px-2 py-1">Nom et prénoms</th><th className="px-2 py-1">Naissance</th><th className="px-2 py-1">Signature</th><th className="px-2 py-1" /></tr></thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{i + 1}</td>
                  <td className="px-2 py-1">
                    <button type="button" title="Ajouter ou changer la photo" onClick={() => { oneFor.current = i; one.current?.click(); }}>
                      {s.photo ? <img src={s.photo} alt="" className="h-9 w-9 rounded object-cover" /> : <UserRound className="h-9 w-9 p-1.5 rounded bg-muted text-muted-foreground" />}
                    </button>
                  </td>
                  <td className="px-2 py-1">{s.lastName} {s.firstName}{!s.photo && <span className="ml-2 text-xs text-amber-700">sans photo</span>}</td>
                  <td className="px-2 py-1">{s.dateOfBirth || "—"} {s.placeOfBirth && `à ${s.placeOfBirth}`}</td>
                  <td className="px-2 py-1">
                    <button type="button" className="flex items-center gap-1 text-xs rounded border px-2 py-1 hover:bg-muted whitespace-nowrap" onClick={() => setPad({ kind: "eleve", i, chain: false })}>
                      {s.signature ? <img src={s.signature} alt="" className="h-6 w-14 object-contain bg-white rounded" /> : <PenLine className="h-4 w-4" />}{s.signature ? "Refaire" : "Signer"}
                    </button>
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEdit({ i, r: { ...rows[i] } })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(`Retirer ${s.lastName} ${s.firstName} de la liste ?`)) setRows(rows.filter((_, k) => k !== i)); }}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setEdit(null)}>
          <div className="bg-background rounded-lg p-4 sm:p-5 w-full max-w-lg max-h-[92vh] overflow-auto space-y-3" onClick={e => e.stopPropagation()}>
            <h4 className="font-semibold">{edit.i < 0 ? "Ajouter un apprenant" : "Modifier l'apprenant"}</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.filter(([k]) => map[k]).map(([k, label]) => (
                <div key={k} className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input value={String(edit.r[map[k]] ?? "")} onChange={e => setEdit(d => d && ({ ...d, r: { ...d.r, [map[k]]: k === "nom" ? e.target.value.toUpperCase() : e.target.value } }))} /></div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Si vous changez le nom ou les prénoms, la photo déjà mémorisée ne suivra pas : ajoutez-la à nouveau.</p>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEdit(null)}>Annuler</Button><Button onClick={saveEdit}>Enregistrer</Button></div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <h3 className="font-semibold">4. Générer les cartes</h3>
        {sans.length > 0 && <p className="text-sm text-amber-700">{sans.length} apprenant(s) sans photo : leur carte aura un emplacement vide. Ajoutez la photo en touchant sa vignette ci-dessus, ou importez-les toutes dans l'onglet « Photos ».</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!!busy} onClick={dlPdf}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}{busy && busy !== "pdf" && busy !== "zip" && busy !== "one" ? busy : "PDF A4 à imprimer (5 élèves par page)"}</Button>
          <Button variant="outline" disabled={!!busy} onClick={dlZip}><Download className="h-4 w-4 mr-2" />Toutes les images (ZIP)</Button>
          <Button variant="outline" disabled={!!busy || !cur} onClick={() => cur && dlOne(cur)}>Carte de l'aperçu seulement</Button>
        </div>
        <p className="text-xs text-muted-foreground">Cartes au format 88 × 52 mm, recto à gauche et verso à droite sur chaque ligne du PDF. Rien n'est envoyé sur un serveur.</p>
      </section>
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
