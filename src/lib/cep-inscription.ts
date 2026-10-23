// Fiche d'inscription au CEP : lecture des données, contrôle des champs manquants,
// reconnaissance des photos et remplissage du PDF officiel (modèle dans /public).
// Tout se passe dans le navigateur.

import { fmtDate, type ListMap, type ListRow } from "@/lib/cm2-tools";
import type { SchoolStatus } from "@/lib/school-status";

export type YesNo = "oui" | "non" | "";

/** Renseignements saisis à la main pour chaque apprenant (inscription + fiche scolaire). */
export interface Manual {
  // Fiche d'inscription
  sexe: "M" | "F" | "";
  etab1: string; etab2: string; etab3: string;
  residence: string;
  dispAge: YesNo; dispSport: YesNo;
  parentNom: string; parentLien: string; parentTel: string; parentTel2: string;
  // Fiche scolaire
  piece: string;
  pere: string; profPere: string;
  mere: string; profMere: string;
  tuteur: string;
  /** Moyennes des classes passées (MAT1 … CM1) saisies à la main, facultatives. */
  moy: string[];
}
export const EMPTY_MANUAL: Manual = {
  sexe: "", etab1: "", etab2: "", etab3: "", residence: "", dispAge: "", dispSport: "",
  parentNom: "", parentLien: "", parentTel: "", parentTel2: "",
  piece: "", pere: "", profPere: "", mere: "", profMere: "", tuteur: "",
  moy: ["", "", "", "", "", "", "", ""],
};
export const withDefaults = (m?: Partial<Manual>): Manual => ({ ...EMPTY_MANUAL, ...m, moy: [...EMPTY_MANUAL.moy].map((_, i) => m?.moy?.[i] ?? "") });

/** Renseignements communs à toute la classe. */
export interface Common {
  option: "CEP-VA" | "CEP + EB" | "";
  centreExamen: string;
  directeur: string; directeurTel: string; directeurTel2: string;
  commune: string; circonscription: string;
  faitA: string; faitLe: string;
}
export const DEFAULT_COMMON: Common = {
  option: "", centreExamen: "", directeur: "", directeurTel: "", directeurTel2: "",
  commune: "Bantè", circonscription: "Bantè", faitA: "", faitLe: "",
};

export interface Candidate {
  key: string;
  mat: string;
  nom: string;       // en capitales
  prenoms: string;
  sexe: "M" | "F" | "";
  naissance: string; // « 12/03/2015 à Bantè »
}

// ---------- Texte ----------
export const compact = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function normSexe(v: unknown): "M" | "F" | "" {
  const s = compact(String(v ?? ""));
  if (!s) return "";
  if (/^(m|g|h|masculin|garcon|homme|male)$/.test(s)) return "M";
  if (/^(f|fille|feminin|femme|female)$/.test(s)) return "F";
  return "";
}

export function getCandidate(r: ListRow | undefined, m: ListMap): Candidate | null {
  if (!r) return null;
  const mat = String(r[m.mat] ?? "").trim();
  const nom = String(r[m.nom] ?? "").trim().toUpperCase();
  const prenoms = String(r[m.pre] ?? "").trim();
  let nai = fmtDate(m.nai ? r[m.nai] : "");
  const lie = m.lie && m.lie !== m.nai ? String(r[m.lie] ?? "").trim() : "";
  if (lie) nai += (nai ? " à " : "") + lie;
  return {
    key: mat || compact(nom + prenoms),
    mat, nom, prenoms,
    sexe: m.sex ? normSexe(r[m.sex]) : "",
    naissance: nai,
  };
}

export const nomComplet = (c: Candidate) => `${c.nom} ${c.prenoms}`.trim();

// ---------- Contrôle des champs ----------
export function missingCommon(c: Common, statut: SchoolStatus | null, ecole: string): string[] {
  const out: string[] = [];
  if (!statut) out.push("Statut de l'école (Mon profil)");
  if (!ecole.trim()) out.push("Nom de l'école");
  if (!c.option) out.push("Option (CEP-VA / CEP + EB)");
  if (!c.centreExamen.trim()) out.push("Centre d'examen");
  if (!c.directeur.trim()) out.push("Nom du directeur");
  if (!c.directeurTel.trim()) out.push("Contact du directeur");
  return out;
}

export function missingCandidate(cand: Candidate, m: Manual): string[] {
  const out: string[] = [];
  if (!(cand.sexe || m.sexe)) out.push("Sexe");
  if (!cand.naissance.trim()) out.push("Date et lieu de naissance");
  if (!m.etab1.trim() || !m.etab2.trim() || !m.etab3.trim()) out.push("Trois établissements choisis");
  if (!m.residence.trim()) out.push("Résidence des parents");
  if (!m.dispAge) out.push("Dispense d'âge");
  if (!m.dispSport) out.push("Dispense de sport");
  if (!m.parentNom.trim()) out.push("Nom du parent");
  if (!m.parentLien.trim()) out.push("Degré de parenté");
  if (!m.parentTel.trim()) out.push("Contact du parent");
  return out;
}

/** Renseignements de la fiche scolaire non remplissables automatiquement (aucun n'est bloquant). */
export function missingFiche(m: Manual): string[] {
  const out: string[] = [];
  if (!m.piece.trim()) out.push("Pièce d'état civil");
  if (!m.pere.trim()) out.push("Père ou tuteur");
  if (!m.mere.trim()) out.push("Mère");
  return out;
}

// ---------- Photos : reconnaissance par nom de fichier ----------
export interface PhotoMatch {
  /** clé d'apprenant -> index du fichier */
  matched: Map<string, number>;
  /** fichiers sans apprenant correspondant */
  unmatchedFiles: number[];
  /** fichiers qui pourraient correspondre à plusieurs apprenants */
  ambiguousFiles: number[];
}

/** Format attendu : nom_prenom(s)_.jpg (la casse, les accents, les « _ » et les espaces sont ignorés). */
export function matchPhotos(fileNames: string[], cands: Candidate[]): PhotoMatch {
  const targets = cands.map((c) => ({ key: c.key, np: compact(c.nom + c.prenoms), mnp: compact(c.mat + c.nom + c.prenoms), has: !!c.nom }));
  const matched = new Map<string, number>();
  const unmatchedFiles: number[] = [];
  const ambiguousFiles: number[] = [];
  fileNames.forEach((name, idx) => {
    const stem = compact(name.replace(/\.[^.]+$/, ""));
    if (!stem) { unmatchedFiles.push(idx); return; }
    let hits = targets.filter((t) => t.has && (t.np === stem || (t.mnp !== t.np && t.mnp === stem)));
    if (hits.length === 0) {
      // Suffixe éventuel (« _(1) », « _2 ») : on garde le plus long nom qui commence le fichier.
      const starts = targets.filter((t) => t.has && stem.startsWith(t.np));
      const best = Math.max(0, ...starts.map((t) => t.np.length));
      hits = starts.filter((t) => t.np.length === best);
    }
    if (hits.length === 1) {
      if (!matched.has(hits[0].key)) matched.set(hits[0].key, idx);
      else ambiguousFiles.push(idx);
    } else if (hits.length > 1) ambiguousFiles.push(idx);
    else unmatchedFiles.push(idx);
  });
  return { matched, unmatchedFiles, ambiguousFiles };
}

// ---------- Photo -> JPEG recadré (navigateur) ----------
export async function photoToJpeg(file: File, ratio = 1, width = 420): Promise<Uint8Array> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Image illisible : " + file.name));
      i.src = url;
    });
    const h = Math.round(width / ratio);
    const c = document.createElement("canvas");
    c.width = width; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, h);
    const k = Math.max(width / img.width, h / img.height); // recadrage « cover »
    const dw = img.width * k, dh = img.height * k;
    ctx.drawImage(img, (width - dw) / 2, (h - dh) / 2, dw, dh);
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Conversion impossible"))), "image/jpeg", 0.9));
    return new Uint8Array(await blob.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}

// ---------- PDF ----------
export interface InscriptionItem { cand: Candidate; man: Manual; photo?: Uint8Array | null }

/** Cadre photo du modèle (points PDF, origine en haut à gauche). */
export const PHOTO_BOX = { x: 446.8, y: 332.8, w: 79, h: 80.3 };
const PAGE_H = 841.8898;

export async function buildInscriptionPdf(
  template: Uint8Array,
  items: InscriptionItem[],
  common: Common,
  ecole: string,
  statut: SchoolStatus | null,
  session: string,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const [tpl] = await out.embedPdf(template, [0]);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const reg = await out.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.04, 0.09, 0.4);

  const safe = (font: typeof bold, t: string) => {
    const set = new Set(font.getCharacterSet());
    let r = "";
    for (const ch of t.replace(/\s+/g, " ")) {
      if (set.has(ch.codePointAt(0)!)) r += ch;
      else {
        const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
        r += base && set.has(base.codePointAt(0)!) ? base : "?";
      }
    }
    return r.trim();
  };

  for (const it of items) {
    const page = out.addPage([595.2756, PAGE_H]);
    page.drawPage(tpl, { x: 0, y: 0 });

    /** Écrit `text` sur une ligne pointillée : x0..x1, ligne à y (depuis le haut). */
    const put = (text: string, x0: number, x1: number, y: number, size = 9.5, font = bold) => {
      const t = safe(font, text);
      if (!t) return;
      let s = size;
      const maxW = x1 - x0 - 3;
      while (s > 5.5 && font.widthOfTextAtSize(t, s) > maxW) s -= 0.25;
      page.drawText(t, { x: x0 + 2, y: PAGE_H - y + 2.2, size: s, font, color: ink });
    };
    const tick = (x0: number, y0: number, x1: number, y1: number) => {
      const p = 2.5;
      const th = 1.6;
      page.drawLine({ start: { x: x0 + p, y: PAGE_H - y0 - p }, end: { x: x1 - p, y: PAGE_H - y1 + p }, thickness: th, color: ink });
      page.drawLine({ start: { x: x0 + p, y: PAGE_H - y1 + p }, end: { x: x1 - p, y: PAGE_H - y0 - p }, thickness: th, color: ink });
    };

    // En-tête
    if (common.option) {
      // « Rayer les mentions inutiles » : on raye l'autre option
      const [a, b] = common.option === "CEP-VA" ? [439.3, 474.7] : [403.7, 432.9];
      page.drawLine({ start: { x: a - 1, y: PAGE_H - 80.9 }, end: { x: b + 1, y: PAGE_H - 80.9 }, thickness: 1.3, color: ink });
    }
    put(session, 325.7, 525.8, 105.7);
    put(common.centreExamen, 351.9, 525.8, 118.1);

    // École de provenance
    put(common.commune, 117.7, 247.5, 152.7);
    put(common.circonscription, 371.9, 523.7, 148.3);
    put(ecole, 134.8, 523.7, 168.5);
    if (statut === "publique") tick(188.4, 178.9, 214.7, 189.3);
    if (statut === "privee") tick(404.8, 172.2, 429.3, 183.9);
    put(common.directeur, 208.4, 525.8, 203.4);
    put(common.directeurTel, 237.5, 384.4, 218.4);
    put(common.directeurTel2, 389.8, 527.1, 217.2);

    // Candidat
    const c = it.cand, m = it.man;
    put(c.nom.toUpperCase(), 78.6, 403.1, 255);
    put(c.prenoms, 103.6, 527.9, 273.3);
    const sexe = c.sexe || m.sexe;
    put(sexe === "M" ? "Masculin" : sexe === "F" ? "Féminin" : "", 81.5, 527.9, 297.4);
    put(c.naissance, 181.8, 527.1, 316.2);
    put(m.etab1, 171, 399.8, 361.9);
    put(m.etab2, 171, 399.8, 381.5);
    put(m.etab3, 171, 399.8, 401.4);
    put(m.residence, 164.7, 530, 423.5);
    if (m.dispAge === "oui") tick(173.9, 431, 199.7, 443);
    if (m.dispAge === "non") tick(366.9, 431, 391.9, 443.5);
    if (m.dispSport === "oui") tick(173.9, 447.2, 200.1, 459.7);
    if (m.dispSport === "non") tick(367.3, 447.2, 391.9, 459.7);
    put(common.faitA, 285.4, 386.5, 485.9);
    put(common.faitLe, 399.8, 527.9, 486.3);
    put([m.parentNom.trim(), m.parentLien.trim() && `(${m.parentLien.trim()})`].filter(Boolean).join(" "), 254.2, 532.1, 500.9);
    put(m.parentTel, 231.3, 374.8, 524.6);
    put(m.parentTel2, 380.2, 530, 525.0);

    if (it.photo) {
      const img = await out.embedJpg(it.photo);
      const pad = 2;
      page.drawImage(img, {
        x: PHOTO_BOX.x + pad, y: PAGE_H - PHOTO_BOX.y - PHOTO_BOX.h + pad,
        width: PHOTO_BOX.w - 2 * pad, height: PHOTO_BOX.h - 2 * pad,
      });
    }
  }
  void reg;
  return out.save();
}

export const fichierInscription = (c: Candidate) =>
  `inscription_CEP_${[c.nom, c.prenoms].map((x) => x.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-")).filter(Boolean).join("_")}.pdf`;
