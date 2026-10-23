import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getJSZip } from "@/lib/cm2-tools";
import {
  EMPTY_MANUAL, buildInscriptionPdf, fichierInscription, matchPhotos, missingCandidate, missingCommon,
  nomComplet, photoToJpeg, PHOTO_BOX, withDefaults,
  type Candidate, type Common, type Manual, type YesNo,
} from "@/lib/cep-inscription";
import { STATUS_LABEL, type SchoolStatus } from "@/lib/school-status";

const selectClass = "h-9 rounded-md border border-input bg-background px-2 text-sm max-w-full";

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

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const T = ({ label, value, onChange, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) => (
  <div className={`space-y-1 ${className ?? ""}`}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input className="h-9" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
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

export default function InscriptionTab({ cands, manual, setManual, applyAll, common, setCommon, ecole, statut, onStatut, session, photos, setPhotos, urlOf }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [bulk, setBulk] = useState({ etab1: "", etab2: "", etab3: "", residence: "", dispAge: "" as YesNo, dispSport: "" as YesNo });
  const one = useRef<HTMLInputElement>(null);
  const oneFor = useRef<string>("");

  const man = (k: string) => manual[k] ?? withDefaults(EMPTY_MANUAL);
  const commonMissing = useMemo(() => missingCommon(common, statut, ecole), [common, statut, ecole]);
  const status = useMemo(() => cands.map(c => ({ c, miss: missingCandidate(c, man(c.key)) })), [cands, manual]); // eslint-disable-line react-hooks/exhaustive-deps
  const ready = status.filter(s => s.miss.length === 0 && commonMissing.length === 0);

  const importBulk = async (files: File[]) => {
    if (!files.length) return;
    const res = matchPhotos(files.map(f => f.name), cands);
    setPhotos(p => {
      const next = { ...p };
      res.matched.forEach((idx, key) => { next[key] = files[idx]; });
      return next;
    });
    const sans = cands.filter(c => !res.matched.has(c.key) && !photos[c.key]);
    const parts = [`${res.matched.size} photo(s) rattachée(s) sur ${cands.length} apprenants.`];
    if (res.unmatchedFiles.length) parts.push(`Fichiers non reconnus : ${res.unmatchedFiles.map(i => files[i].name).join(", ")}.`);
    if (res.ambiguousFiles.length) parts.push(`Fichiers en double ou ambigus : ${res.ambiguousFiles.map(i => files[i].name).join(", ")}.`);
    if (sans.length) parts.push(`Sans photo : ${sans.map(c => nomComplet(c)).join(", ")}.`);
    setPhotoMsg({ ok: !res.unmatchedFiles.length && !res.ambiguousFiles.length && !sans.length, text: parts.join(" ") });
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

  const dlOne = async (c: Candidate) => {
    setBusy(c.key);
    try {
      const bytes = await buildFor([{ c }]);
      save(new Blob([bytes as BlobPart], { type: "application/pdf" }), fichierInscription(c));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de la création du PDF"); }
    finally { setBusy(null); }
  };
  const dlAll = async () => {
    setBusy("all");
    try {
      const bytes = await buildFor(ready);
      save(new Blob([bytes as BlobPart], { type: "application/pdf" }), "fiches_inscription_CEP.pdf");
      toast.success(`${ready.length} fiche(s) téléchargée(s) dans un seul PDF.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de la création du PDF"); }
    finally { setBusy(null); }
  };
  const dlZip = async () => {
    setBusy("zip");
    try {
      const JSZip = await getJSZip();
      const zip = new JSZip();
      const used: Record<string, number> = {};
      for (const r of ready) {
        let name = fichierInscription(r.c);
        used[name] = (used[name] ?? 0) + 1;
        if (used[name] > 1) name = name.replace(/\.pdf$/, `_${used[name]}.pdf`);
        zip.file(name, await buildFor([r]));
      }
      save((await zip.generateAsync({ type: "blob" })) as Blob, "fiches_inscription_CEP.zip");
      toast.success(`${ready.length} fiche(s) téléchargée(s) (un PDF par apprenant).`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Échec de la création du ZIP"); }
    finally { setBusy(null); }
  };

  if (!cands.length) {
    return (
      <div className="py-10 text-center text-muted-foreground space-y-2">
        <FileText className="h-8 w-8 mx-auto" />
        <p>Importez d'abord la liste des apprenants (en haut de la page) : la fiche est remplie à partir de cette liste.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input ref={one} type="file" accept="image/*" className="hidden" onChange={e => {
        const f = e.target.files?.[0];
        if (f && oneFor.current) { const k = oneFor.current; setPhotos(p => ({ ...p, [k]: f })); }
        e.target.value = "";
      }} />

      <section className="space-y-3">
        <h3 className="font-semibold">Renseignements de l'école et de l'examen</h3>
        <p className="text-xs text-muted-foreground">Remplis automatiquement : nom, prénoms, sexe, date et lieu de naissance de chaque apprenant (depuis la liste), nom de l'école, statut de l'école et session. Complétez ci-dessous ce qui est commun à toute la classe.</p>
        <div className="grid gap-3 sm:grid-cols-3">
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
          <T label={`Session (automatique)`} value={session} onChange={() => {}} className="opacity-70 pointer-events-none" />
          <T label="Centre d'examen" value={common.centreExamen} onChange={v => setCommon({ centreExamen: v })} />
          <T label="Commune" value={common.commune} onChange={v => setCommon({ commune: v })} />
          <T label="Circonscription scolaire" value={common.circonscription} onChange={v => setCommon({ circonscription: v })} />
          <T label="Nom et prénoms du directeur" value={common.directeur} onChange={v => setCommon({ directeur: v })} className="sm:col-span-3" />
          <T label="Contact du directeur" value={common.directeurTel} onChange={v => setCommon({ directeurTel: v })} />
          <T label="2ᵉ contact (facultatif)" value={common.directeurTel2} onChange={v => setCommon({ directeurTel2: v })} />
          <div />
          <T label="Fait à (facultatif)" value={common.faitA} onChange={v => setCommon({ faitA: v })} />
          <T label="Le (facultatif)" value={common.faitLe} onChange={v => setCommon({ faitLe: v })} placeholder="jj/mm/aaaa" />
        </div>
        {commonMissing.length > 0 && <p className="text-sm text-destructive">À compléter : {commonMissing.join(", ")}.</p>}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Valeurs communes à plusieurs apprenants (facultatif)</h3>
        <p className="text-xs text-muted-foreground">Gagnez du temps : remplissez ici, puis appliquez à tous. Les champs déjà remplis d'un apprenant ne sont pas écrasés.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <T label="Établissement choisi n°1" value={bulk.etab1} onChange={v => setBulk(b => ({ ...b, etab1: v }))} />
          <T label="Établissement choisi n°2" value={bulk.etab2} onChange={v => setBulk(b => ({ ...b, etab2: v }))} />
          <T label="Établissement choisi n°3" value={bulk.etab3} onChange={v => setBulk(b => ({ ...b, etab3: v }))} />
          <T label="Résidence des parents" value={bulk.residence} onChange={v => setBulk(b => ({ ...b, residence: v }))} />
          <YesNoSelect label="Dispense d'âge" value={bulk.dispAge} onChange={v => setBulk(b => ({ ...b, dispAge: v }))} />
          <YesNoSelect label="Dispense de sport" value={bulk.dispSport} onChange={v => setBulk(b => ({ ...b, dispSport: v }))} />
        </div>
        <Button variant="outline" onClick={() => {
          const patch: Partial<Manual> = {};
          (Object.keys(bulk) as (keyof typeof bulk)[]).forEach(k => { if (bulk[k]) (patch as any)[k] = bulk[k]; });
          applyAll(patch);
          toast.success("Valeurs appliquées aux champs vides de tous les apprenants.");
        }}>Appliquer à tous les apprenants</Button>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Photos</h3>
        <p className="text-sm text-muted-foreground">Importez toutes les photos d'un coup (fichiers nommés <code>nom_prénom(s)_.jpg</code>, rattachés automatiquement), ou ajoutez-les élève par élève dans la liste ci-dessous.</p>
        <Input type="file" accept="image/*" multiple className="max-w-md" onChange={e => { importBulk([...(e.target.files ?? [])]); e.target.value = ""; }} />
        {photoMsg && <p role="status" className={`text-sm ${photoMsg.ok ? "text-green-700" : "text-amber-700"}`}>{photoMsg.text}</p>}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Apprenants ({ready.length}/{cands.length} fiches prêtes)</h3>
        <div className="space-y-2">
          {status.map(({ c, miss }) => {
            const m = man(c.key);
            const set = (patch: Partial<Manual>) => setManual(c.key, patch);
            const ok = miss.length === 0 && commonMissing.length === 0;
            const photo = photos[c.key];
            return (
              <details key={c.key} className="rounded-md border bg-card">
                <summary className="flex flex-wrap items-center gap-3 px-3 py-2 cursor-pointer">
                  {photo ? <img src={urlOf(photo)} alt="" className="h-9 w-9 rounded object-cover" /> : <UserRound className="h-9 w-9 p-1.5 rounded bg-muted text-muted-foreground" />}
                  <span className="font-medium flex-1 min-w-[10rem]">{nomComplet(c)}</span>
                  {miss.length === 0
                    ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-4 w-4" />Complet</span>
                    : <span className="text-xs text-amber-700">{miss.length} à remplir</span>}
                </summary>
                <div className="border-t p-3 space-y-3">
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
                    <T label="Établissement choisi n°1" value={m.etab1} onChange={v => set({ etab1: v })} />
                    <T label="Établissement choisi n°2" value={m.etab2} onChange={v => set({ etab2: v })} />
                    <T label="Établissement choisi n°3" value={m.etab3} onChange={v => set({ etab3: v })} />
                    <T label="Résidence des parents" value={m.residence} onChange={v => set({ residence: v })} className="sm:col-span-2" />
                    <YesNoSelect label="Dispense d'âge" value={m.dispAge} onChange={v => set({ dispAge: v })} />
                    <YesNoSelect label="Dispense de sport" value={m.dispSport} onChange={v => set({ dispSport: v })} />
                    <T label="Nom et prénoms du parent" value={m.parentNom} onChange={v => set({ parentNom: v })} className="sm:col-span-2" />
                    <T label="Degré de parenté" value={m.parentLien} onChange={v => set({ parentLien: v })} placeholder="Père, Mère, Tuteur…" />
                    <T label="Contact du parent" value={m.parentTel} onChange={v => set({ parentTel: v })} />
                    <T label="2ᵉ contact (facultatif)" value={m.parentTel2} onChange={v => set({ parentTel2: v })} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => { oneFor.current = c.key; one.current?.click(); }}>{photo ? "Changer la photo" : "Ajouter la photo"}</Button>
                    {photo && <Button size="sm" variant="ghost" onClick={() => setPhotos(p => { const n = { ...p }; delete n[c.key]; return n; })}>Retirer la photo</Button>}
                    {ok && (
                      <Button size="sm" disabled={busy !== null} onClick={() => dlOne(c)}>
                        {busy === c.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}Télécharger la fiche
                      </Button>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!ready.length || busy !== null} onClick={dlAll}>
            {busy === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Télécharger les fiches prêtes (un seul PDF)
          </Button>
          <Button variant="outline" disabled={!ready.length || busy !== null} onClick={dlZip}>
            {busy === "zip" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Un PDF par apprenant (ZIP)
          </Button>
        </div>
        {ready.length < cands.length && <p className="text-xs text-muted-foreground">Le téléchargement n'est proposé que pour les fiches entièrement remplies. La photo est facultative.</p>}
      </section>
    </div>
  );
}
