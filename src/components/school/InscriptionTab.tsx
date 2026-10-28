import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Download, FileText, Loader2, Sparkles, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPTY_MANUAL, buildInscriptionPdf, fichierInscription, matchPhotos, missingCandidate, missingCommon,
  nomComplet, photoToJpeg, PHOTO_BOX, withDefaults,
  type Candidate, type Common, type Manual, type YesNo,
} from "@/lib/cep-inscription";
import { STATUS_LABEL, type SchoolStatus } from "@/lib/school-status";
import { BANTE_ARRONDISSEMENTS, dateEnLettres } from "@/lib/ceg-bante";
import { downloadFiles, saveBlob, uniqueNames } from "@/lib/download-many";
import { expandPhotos } from "@/lib/photo-import";
import CegPicker from "./CegPicker";

const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm max-w-full";
const STEPS = ["École et examen", "Les élèves", "Générer"];
const carteInfoKey = (s: string) => `gestionsco.carte.info.${s}`;

interface Props {
  cands: Candidate[];
  manual: Record<string, Manual>;
  setManual: (key: string, patch: Partial<Manual>) => void;
  /** Applique les valeurs à tous les apprenants, sans écraser ce qui est déjà rempli. */
  applyAll: (patch: Partial<Manual>) => void;
  common: Common;
  setCommon: (patch: Partial<Common>) => void;
  ecole: string;
  statut: SchoolStatus | null;
  onStatut: (s: SchoolStatus) => void;
  session: string;
  photos: Record<string, File>;
  setPhotos: (updater: (p: Record<string, File>) => Record<string, File>) => void;
  urlOf: (f: File) => string;
  schoolKey: string;
}

let templateCache: Uint8Array | null = null;
async function getTemplate(): Promise<Uint8Array> {
  if (!templateCache) {
    const r = await fetch(`${import.meta.env.BASE_URL}fiche_inscription_cep.pdf`);
    if (!r.ok) throw new Error("Modèle de fiche introuvable (public/fiche_inscription_cep.pdf).");
    templateCache = new Uint8Array(await r.arrayBuffer());
  }
  return templateCache;
}

const hash = (s: string) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); };

const T = ({ label, value, onChange, placeholder, className, readOnly }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string; readOnly?: boolean }) => (
  <div className={`space-y-1 ${className ?? ""}`}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input className="h-9" value={value} placeholder={placeholder} readOnly={readOnly} onChange={e => onChange(e.target.value)} />
  </div>
);

const YesNoSelect = ({ label, value, onChange }: { label: string; value: YesNo; onChange: (v: YesNo) => void }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <select className={selectClass + " w-full"} value={value} onChange={e => onChange(e.target.value as YesNo)}>
      <option value="">— à choisir —</option>
      <option value="oui">OUI</option>
      <option value="non">NON</option>
    </select>
  </div>
);

export default function InscriptionTab({ cands, manual, setManual, applyAll, common, setCommon, ecole, statut, onStatut, session, photos, setPhotos, urlOf, schoolKey }: Props) {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const go = (n: number) => { setStep(n); setReached(r => Math.max(r, n)); window.scrollTo?.({ top: 0, behavior: "smooth" }); };
  const [busy, setBusy] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [bulk, setBulk] = useState<{ ceg: [string, string, string]; residence: string; dispAge: YesNo; dispSport: YesNo }>({ ceg: ["", "", ""], residence: "", dispAge: "", dispSport: "" });
  const [result, setResult] = useState<null | { files: { key: string; name: string; bytes: Uint8Array }[]; sig: string; date: string }>(null);
  const one = useRef<HTMLInputElement>(null);
  const oneFor = useRef<string>("");

  // Ce que la plateforme sait déjà : nom du directeur et contact (étape « Carte scolaire »), commune et circonscription.
  useEffect(() => {
    try {
      const info = JSON.parse(localStorage.getItem(carteInfoKey(schoolKey)) || "{}");
      const patch: Partial<Common> = {};
      if (!common.directeur.trim() && info.directeur) patch.directeur = String(info.directeur);
      if (!common.directeurTel.trim() && info.tel) patch.directeurTel = String(info.tel);
      if (Object.keys(patch).length) setCommon(patch);
    } catch { /* ignore */ }
  }, [schoolKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const man = (k: string) => manual[k] ?? withDefaults(EMPTY_MANUAL);
  const commonMissing = useMemo(() => missingCommon(common, statut, ecole), [common, statut, ecole]);
  const status = useMemo(() => cands.map(c => ({ c, miss: missingCandidate(c, man(c.key)) })), [cands, manual]); // eslint-disable-line react-hooks/exhaustive-deps
  const complete = status.filter(s => s.miss.length === 0);
  const ready = commonMissing.length === 0 ? complete : [];
  const today = dateEnLettres(new Date());

  const sig = hash(JSON.stringify([common, ecole, statut, session, cands.map(c => [c.key, c.nom, c.prenoms, c.sexe, c.naissance, man(c.key), photos[c.key] ? urlOf(photos[c.key]) : ""])]));
  const stale = !!result && result.sig !== sig;

  const importBulk = async (picked: File[]) => {
    if (!picked.length) return;
    setBusy("photos");
    try {
      const files = await expandPhotos(picked);
      const res = matchPhotos(files.map(f => f.name), cands);
      setPhotos(p => { const next = { ...p }; res.matched.forEach((idx, key) => { next[key] = files[idx]; }); return next; });
      const sans = cands.filter(c => !res.matched.has(c.key) && !photos[c.key]);
      const parts = [`${res.matched.size} photo(s) rattachée(s) sur ${cands.length} apprenants.`];
      if (res.unmatchedFiles.length) parts.push(`Non reconnus : ${res.unmatchedFiles.slice(0, 10).map(i => files[i].name).join(", ")}.`);
      if (res.ambiguousFiles.length) parts.push(`En double : ${res.ambiguousFiles.slice(0, 10).map(i => files[i].name).join(", ")}.`);
      if (sans.length) parts.push(`${sans.length} élève(s) sans photo (facultatif).`);
      setPhotoMsg({ ok: !res.unmatchedFiles.length && !res.ambiguousFiles.length, text: parts.join(" ") });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Photos illisibles"); }
    finally { setBusy(null); }
  };

  const buildFor = async (list: { c: Candidate }[]) => {
    const tpl = await getTemplate();
    const items = [];
    for (const { c } of list) {
      const f = photos[c.key];
      items.push({ cand: c, man: man(c.key), photo: f ? await photoToJpeg(f, PHOTO_BOX.w / PHOTO_BOX.h) : null });
    }
    return buildInscriptionPdf(tpl, items, common, ecole, statut, session);
  };

  const generate = async () => {
    if (!ready.length) return;
    setBusy("0"); setResult(null);
    try {
      const files: { key: string; name: string; bytes: Uint8Array }[] = [];
      for (let i = 0; i < ready.length; i++) {
        setBusy(`Fiche ${i + 1}/${ready.length}…`);
        files.push({ key: ready[i].c.key, name: fichierInscription(ready[i].c), bytes: await buildFor([ready[i]]) });
      }
      setResult({ files: uniqueNames(files), sig, date: today });
      toast.success(`${files.length} fiche(s) d'inscription générée(s).`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de la création des PDF"); }
    finally { setBusy(null); }
  };
  const pdf = (b: Uint8Array) => new Blob([b as BlobPart], { type: "application/pdf" });
  const dlAll = async () => {
    if (!result) return;
    setBusy("dl");
    try {
      await downloadFiles(result.files.map(f => ({ name: f.name, get: () => pdf(f.bytes) })), (d, t) => setBusy(`Téléchargement ${d}/${t}…`));
      toast.success(`${result.files.length} fiche(s) enregistrée(s) une à une sur votre appareil.`);
    } finally { setBusy(null); }
  };
  const dlMerged = async () => {
    setBusy("merged");
    try { saveBlob(pdf(await buildFor(ready)), "fiches_inscription_CEP.pdf"); } catch (e) { toast.error(e instanceof Error ? e.message : "Échec"); } finally { setBusy(null); }
  };

  if (!cands.length) {
    return (
      <div className="py-10 text-center text-muted-foreground space-y-2">
        <FileText className="h-8 w-8 mx-auto" />
        <p>Aucun apprenant dans la liste : importez-la en haut de la page (compte École : ajoutez-la dans l'onglet « Élèves »). La fiche est remplie à partir de cette liste.</p>
      </div>
    );
  }

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

  // ---------- fenêtre « Compléter » d'un élève ----------
  const ed = editing !== null ? status[editing] : null;
  const edModal = ed && (() => {
    const { c, miss } = ed; const m = man(c.key); const set = (patch: Partial<Manual>) => setManual(c.key, patch); const photo = photos[c.key];
    const idx = editing as number;
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEditing(null)}>
        <div className="bg-background rounded-t-xl sm:rounded-lg p-4 sm:p-5 w-full max-w-2xl max-h-[94vh] overflow-auto space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            {photo ? <img src={urlOf(photo)} alt="" className="h-16 w-14 rounded object-cover" /> : <UserRound className="h-16 w-14 p-3 rounded bg-muted text-muted-foreground" />}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">{nomComplet(c)}</h4>
              <p className="text-xs text-muted-foreground">Élève {idx + 1} sur {status.length} · {c.sexe === "M" ? "Masculin" : c.sexe === "F" ? "Féminin" : "sexe à préciser"} · {c.naissance || "naissance non renseignée"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { oneFor.current = c.key; one.current?.click(); }}>{photo ? "Changer la photo" : "Ajouter la photo"}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Déjà rempli automatiquement : nom, prénoms, sexe, date et lieu de naissance (depuis la liste de la classe). Complétez le reste :</p>
          {miss.length > 0 && <p className="text-xs text-amber-700">À remplir : {miss.join(", ")}.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {!c.sexe && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Sexe</Label>
                <select className={selectClass + " w-full"} value={m.sexe} onChange={e => set({ sexe: e.target.value as Manual["sexe"] })}>
                  <option value="">— à choisir —</option><option value="M">Masculin</option><option value="F">Féminin</option>
                </select>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Établissements choisis (3, par ordre de préférence)</Label>
            <CegPicker value={[m.etab1, m.etab2, m.etab3]} onChange={v => set({ etab1: v[0], etab2: v[1], etab3: v[2] })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <T label="Résidence des parents" value={m.residence} onChange={v => set({ residence: v })} className="sm:col-span-3" />
            <YesNoSelect label="Dispense d'âge" value={m.dispAge} onChange={v => set({ dispAge: v })} />
            <YesNoSelect label="Dispense de sport" value={m.dispSport} onChange={v => set({ dispSport: v })} />
            <div className="hidden sm:block" />
            <T label="Nom et prénoms du parent" value={m.parentNom} onChange={v => set({ parentNom: v })} className="sm:col-span-2" />
            <T label="Degré de parenté" value={m.parentLien} onChange={v => set({ parentLien: v })} placeholder="Père, Mère, Tuteur…" />
            <T label="Contact du parent" value={m.parentTel} onChange={v => set({ parentTel: v })} />
            <T label="2ᵉ contact (facultatif)" value={m.parentTel2} onChange={v => set({ parentTel2: v })} />
          </div>
          <p className="text-xs text-muted-foreground">Les signatures (parent, candidat, directeur) restent vides : elles se font à la main sur la fiche imprimée.</p>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
            <Button variant="outline" disabled={idx === 0} onClick={() => setEditing(idx - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Précédent</Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>Fermer</Button>
            {idx < status.length - 1 ? <Button onClick={() => setEditing(idx + 1)}>Élève suivant<ArrowRight className="h-4 w-4 ml-1" /></Button> : <Button onClick={() => setEditing(null)}>Terminer</Button>}
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div className="space-y-5">
      <input ref={one} type="file" accept="image/*" className="hidden" onChange={e => {
        const f = e.target.files?.[0];
        if (f && oneFor.current) { const k = oneFor.current; setPhotos(p => ({ ...p, [k]: f })); }
        e.target.value = "";
      }} />
      {stepper}

      {/* ---------------- ÉTAPE 1 : école et examen ---------------- */}
      {step === 0 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold">Étape 1 — L'école et l'examen</h3>
            <p className="text-sm text-muted-foreground">Ces renseignements sont les mêmes sur toutes les fiches. Ce que la plateforme connaît déjà est rempli automatiquement (nom de l'école, statut, session, nom et contact du directeur s'ils ont été saisis dans la carte scolaire).</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <T label="Nom de l'école (automatique)" value={ecole} onChange={() => {}} readOnly className="sm:col-span-2" />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Statut de l'école</Label>
              <select className={selectClass + " w-full"} value={statut ?? ""} onChange={e => e.target.value && onStatut(e.target.value as SchoolStatus)}>
                <option value="">— à choisir —</option>
                <option value="publique">{STATUS_LABEL.publique}</option>
                <option value="privee">{STATUS_LABEL.privee}</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Option (la mention non choisie est rayée)</Label>
              <select className={selectClass + " w-full"} value={common.option} onChange={e => setCommon({ option: e.target.value as Common["option"] })}>
                <option value="">— à choisir —</option>
                <option value="CEP-VA">CEP-VA</option>
                <option value="CEP + EB">CEP + EB</option>
              </select>
            </div>
            <T label="Session (automatique)" value={session} onChange={() => {}} readOnly />
            <T label="Centre d'examen" value={common.centreExamen} onChange={v => setCommon({ centreExamen: v })} />
            <T label="Commune" value={common.commune} onChange={v => setCommon({ commune: v })} />
            <T label="Circonscription scolaire" value={common.circonscription} onChange={v => setCommon({ circonscription: v })} />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Arrondissement (devant la date : « Pira, le … »)</Label>
              <select className={selectClass + " w-full"} value={BANTE_ARRONDISSEMENTS.includes(common.faitA) ? common.faitA : ""} onChange={e => setCommon({ faitA: e.target.value })}>
                <option value="">— à choisir —</option>
                {BANTE_ARRONDISSEMENTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <T label="Nom et prénoms du directeur" value={common.directeur} onChange={v => setCommon({ directeur: v })} className="sm:col-span-3" />
            <T label="Contact du directeur" value={common.directeurTel} onChange={v => setCommon({ directeurTel: v })} />
            <T label="2ᵉ contact (facultatif)" value={common.directeurTel2} onChange={v => setCommon({ directeurTel2: v })} />
          </div>
          <p className="text-xs text-muted-foreground">Date écrite sur les fiches : <b>{common.faitA ? `${common.faitA}, ` : ""}le {today}</b> (le jour où vous générez les fiches, écrit en toutes lettres). Les signatures du parent, du candidat et du directeur restent vides, pour être faites à la main.</p>
          {commonMissing.length > 0 && <p className="text-sm text-destructive">À compléter : {commonMissing.join(", ")}.</p>}
          {nav({ label: "Suivant", onClick: () => go(1), disabled: commonMissing.length > 0 })}
        </section>
      )}

      {/* ---------------- ÉTAPE 2 : les élèves ---------------- */}
      {step === 1 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold">Étape 2 — Les élèves ({complete.length}/{cands.length} fiches complètes)</h3>
            <p className="text-sm text-muted-foreground">Nom, prénoms, sexe, date et lieu de naissance sont déjà remplis. Touchez « Compléter » pour renseigner les trois collèges choisis, la résidence, les dispenses et le parent.</p>
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">Gagner du temps : mêmes choix pour plusieurs élèves (facultatif)</summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">Remplissez ici, puis appliquez à tous. Les champs déjà remplis d'un élève ne sont pas écrasés.</p>
              <CegPicker value={bulk.ceg} onChange={v => setBulk(b => ({ ...b, ceg: v }))} />
              <div className="grid gap-3 sm:grid-cols-3">
                <T label="Résidence des parents" value={bulk.residence} onChange={v => setBulk(b => ({ ...b, residence: v }))} />
                <YesNoSelect label="Dispense d'âge" value={bulk.dispAge} onChange={v => setBulk(b => ({ ...b, dispAge: v }))} />
                <YesNoSelect label="Dispense de sport" value={bulk.dispSport} onChange={v => setBulk(b => ({ ...b, dispSport: v }))} />
              </div>
              <Button variant="outline" onClick={() => {
                const patch: Partial<Manual> = {};
                if (bulk.ceg[0]) patch.etab1 = bulk.ceg[0]; if (bulk.ceg[1]) patch.etab2 = bulk.ceg[1]; if (bulk.ceg[2]) patch.etab3 = bulk.ceg[2];
                if (bulk.residence) patch.residence = bulk.residence; if (bulk.dispAge) patch.dispAge = bulk.dispAge; if (bulk.dispSport) patch.dispSport = bulk.dispSport;
                applyAll(patch); toast.success("Valeurs appliquées aux champs vides de tous les élèves.");
              }}>Appliquer à tous les élèves</Button>
            </div>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer rounded-md border bg-background px-3 py-1.5 hover:bg-muted">
              {busy === "photos" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Ajouter des photos (jpg ou zip)
              <input type="file" multiple accept="image/*,.zip,application/zip" className="hidden" disabled={busy !== null} onChange={e => { importBulk([...(e.target.files ?? [])]); e.target.value = ""; }} />
            </label>
            <span className="text-xs text-muted-foreground">Photos nommées <code>NOM_Prénoms.jpg</code>, rattachées automatiquement. Les photos déjà importées s'affichent ci-dessous.</span>
          </div>
          {photoMsg && <p role="status" className={`text-sm ${photoMsg.ok ? "text-green-700" : "text-amber-700"}`}>{photoMsg.text}</p>}

          <ul className="divide-y rounded-md border">
            {status.map(({ c, miss }, i) => {
              const photo = photos[c.key];
              return (
                <li key={c.key} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                  {photo ? <img src={urlOf(photo)} alt="" className="h-12 w-10 rounded object-cover" /> : <UserRound className="h-12 w-10 p-2 rounded bg-muted text-muted-foreground" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{nomComplet(c)}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.naissance || "naissance non renseignée"}</p>
                  </div>
                  {miss.length === 0
                    ? <span className="hidden sm:inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-4 w-4" />Complet</span>
                    : <span className="hidden sm:inline text-xs text-amber-700">{miss.length} à remplir</span>}
                  <Button size="sm" variant={miss.length === 0 ? "outline" : "default"} onClick={() => setEditing(i)}>{miss.length === 0 ? "Modifier" : "Compléter"}</Button>
                </li>
              );
            })}
          </ul>
          {nav({ label: "Continuer", onClick: () => { if (complete.length < cands.length && !window.confirm(`${cands.length - complete.length} fiche(s) sont incomplètes : elles ne seront pas générées. Continuer ?`)) return; go(2); }, disabled: complete.length === 0 })}
        </section>
      )}

      {/* ---------------- ÉTAPE 3 : générer ---------------- */}
      {step === 2 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold">Étape 3 — Générer les fiches d'inscription</h3>
            <p className="text-sm text-muted-foreground">{ready.length} fiche(s) prête(s){complete.length < cands.length ? `, ${cands.length - complete.length} incomplète(s) ignorée(s)` : ""}. La date écrite sera <b>{common.faitA ? `${common.faitA}, ` : ""}le {today}</b>.</p>
          </div>
          <Button size="lg" disabled={!ready.length || busy !== null} onClick={generate}>
            {busy && busy !== "dl" && busy !== "merged" && busy !== "photos" ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Sparkles className="h-5 w-5 mr-2" />}
            {busy && /^Fiche/.test(busy) ? busy : result ? "Générer à nouveau" : "Générer les fiches d'inscription"}
          </Button>
          {stale && <p className="text-sm text-amber-700">Des informations ont changé depuis la génération : régénérez les fiches avant de télécharger.</p>}
          {result && (
            <div className="space-y-3 rounded-md border border-green-600/40 bg-green-50 dark:bg-green-950/20 p-3">
              <p className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center gap-2"><Check className="h-4 w-4" />{result.files.length} fiche(s) générée(s) le {result.date}</p>
              <div className="flex flex-wrap gap-2">
                <Button disabled={stale || busy !== null} onClick={dlAll}>{busy && /^Téléchargement/.test(busy) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}{busy && /^Téléchargement/.test(busy) ? busy : `Télécharger tout (${result.files.length} PDF, un à un)`}</Button>
                <Button variant="outline" disabled={stale || busy !== null} onClick={dlMerged}>{busy === "merged" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}Un seul PDF avec toutes les fiches</Button>
              </div>
              <ul className="divide-y rounded-md border bg-background">
                {result.files.map((f, i) => {
                  const c = cands.find(x => x.key === f.key);
                  return (
                    <li key={f.key + i} className="flex items-center gap-3 px-3 py-2">
                      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-sm">{c ? nomComplet(c) : f.name}</span>
                      <Button size="sm" variant="outline" disabled={stale} onClick={() => saveBlob(pdf(f.bytes), f.name)}><Download className="h-4 w-4 mr-1" />Télécharger</Button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">« Télécharger tout » enregistre les fiches une à une sur l'appareil, sans ZIP. Si le navigateur demande d'autoriser les téléchargements multiples, acceptez.</p>
            </div>
          )}
          {nav()}
        </section>
      )}
      {edModal}
    </div>
  );
}
