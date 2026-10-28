// Outils du compte école CM2 : lecture de la liste, nom des photos, fiche scolaire.
// Tout se passe dans le navigateur : aucune donnée d'élève n'est envoyée sur un serveur.

import { classifyHeader, detectColumns, parseGrid, pdfPagesToGrid, type PdfItem } from "./list-reader";

export type ListRow = Record<string, string>;
export interface ListMap { mat: string; nom: string; pre: string; nai: string; lie: string; sex: string }
export interface FicheExtra { piece: string; pere: string; profPere: string; mere: string; profMere: string; tuteur: string }
export interface Learner { mat: string; nom: string; nai: string; moyennes: (string | null)[]; extra?: FicheExtra }
export interface Niveau { k: string; t: string; du: string; au: string }

// Classes et dates (modifiables dans l'application). L'élève de CM2 est à l'indice 7.
export const NIVEAUX_DEFAUT: Niveau[] = [
  { k: "MAT1", t: "PREMIÈRE ANNÉE", du: "07/09/2019", au: "28/06/2020" },
  { k: "MAT2", t: "DEUXIÈME ANNÉE", du: "28/09/2020", au: "01/07/2021" },
  { k: "CI", t: "COURS D'INITIATION (CI)", du: "20/09/2021", au: "01/07/2022" },
  { k: "CP", t: "COURS PRÉPARATOIRE (CP)", du: "19/09/2022", au: "30/06/2023" },
  { k: "CE1", t: "COURS ÉLÉMENTAIRE 1ère ANNÉE (CE1)", du: "18/09/2023", au: "28/06/2024" },
  { k: "CE2", t: "COURS ÉLÉMENTAIRE 2ème ANNÉE (CE2)", du: "16/09/2024", au: "27/06/2025" },
  { k: "CM1", t: "COURS MOYEN 1ère ANNÉE (CM1)", du: "15/09/2025", au: "26/06/2026" },
  { k: "CM2", t: "COURS MOYEN 2ème ANNÉE (CM2)", du: "14/09/2026", au: "25/06/2027" },
];
export const CM2_INDEX = 7;

// ---------- Bibliothèques externes (mêmes versions que l'application d'origine) ----------
const LIBS = {
  xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  jszip: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  pdfjs: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
};
const PDF_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const loading: Record<string, Promise<void>> = {};
function loadScript(src: string): Promise<void> {
  if (!loading[src]) {
    loading[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => { delete loading[src]; reject(new Error("Chargement impossible : vérifiez votre connexion internet.")); };
      document.head.appendChild(s);
    });
  }
  return loading[src];
}
const w = () => window as any;
/** Télécharge d'avance les bibliothèques externes pour qu'elles marchent sans internet (le service worker les garde). */
export async function warmLibs() {
  for (const u of [...Object.values(LIBS), PDF_WORKER]) { try { await fetch(u, { mode: "no-cors" }); } catch { /* ignore */ } }
}
export async function getXLSX() { await loadScript(LIBS.xlsx); return w().XLSX; }
export async function getJSZip() { await loadScript(LIBS.jszip); return w().JSZip; }
export async function getPdfjs() {
  await loadScript(LIBS.pdfjs);
  w().pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
  return w().pdfjsLib;
}

// ---------- Outils de texte ----------
export const clean = (s: unknown) =>
  String(s ?? "").trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");

export function fmtDate(v: unknown): string {
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 864e5));
    return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear();
  }
  return String(v ?? "").trim();
}

export function nomFichier(r: ListRow, m: ListMap): string {
  return [clean(r[m.mat]), clean(r[m.nom]), clean(r[m.pre])].filter(Boolean).join("_") + ".jpg";
}

// ---------- Moyennes réelles éventuellement présentes dans la liste ----------
// Une colonne « Moyenne CI », « Moy. CP », « Moyenne CE1 »… est reconnue automatiquement.
const NIVEAU_TOKENS: RegExp[] = [/mat\s*1|maternelle\s*1/, /mat\s*2|maternelle\s*2/, /(^|[^a-z0-9])ci([^a-z0-9]|$)/, /(^|[^a-z0-9])cp([^a-z0-9]|$)/, /ce\s*1/, /ce\s*2/, /cm\s*1/, /cm\s*2/];
export function detectMoyenneColumns(headers: string[]): (string | null)[] {
  return NIVEAU_TOKENS.map((re, idx) => {
    if (idx === CM2_INDEX) return null; // la classe en cours n'a pas encore de moyenne annuelle
    return headers.find((h) => /moy/i.test(h) && re.test(h.toLowerCase())) ?? null;
  });
}
function parseMoyenne(v: unknown): string | null {
  const n = parseFloat(String(v ?? "").replace(",", ".").replace(/\/20$/, ""));
  return Number.isFinite(n) && n >= 0 && n <= 20 ? n.toFixed(2) + "/20" : null;
}

export function getLearner(r: ListRow | undefined, m: ListMap, moyCols: (string | null)[]): Learner | null {
  if (!r) return null;
  let nai = fmtDate(r[m.nai]);
  const lie = m.lie && m.lie !== m.nai ? String(r[m.lie] ?? "").trim() : "";
  if (lie) nai += (nai ? " à " : "") + lie;
  return {
    mat: String(r[m.mat] ?? "").trim(),
    nom: (String(r[m.nom] ?? "").trim().toUpperCase() + " " + String(r[m.pre] ?? "").trim()).trim(),
    nai,
    moyennes: moyCols.map((h) => (h ? parseMoyenne(r[h]) : null)),
  };
}

// ---------- Lecture de la liste (PDF avec texte, Excel ou CSV) ----------
async function lirePdf(file: File): Promise<string[][]> {
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: PdfItem[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const items = (await (await pdf.getPage(p)).getTextContent()).items.filter((i: any) => i.str.trim() !== "");
    pages.push(items.map((i: any) => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width })));
  }
  // 1) lecture par colonnes d'après les titres ; 2) à défaut, ancienne méthode (lignes de même longueur)
  const g = pdfPagesToGrid(pages);
  if (g && g.length > 1) return g;
  return legacyPdfLines(pages);
}

function legacyPdfLines(pages: PdfItem[][]): string[][] {
  const lignes: string[][] = [];
  for (const items of pages) {
    const groupes: { y: number; items: PdfItem[] }[] = [];
    items.forEach(it => {
      let g = groupes.find(g => Math.abs(g.y - it.y) < 3);
      if (!g) { g = { y: it.y, items: [] }; groupes.push(g); }
      g.items.push(it);
    });
    groupes.sort((a, b) => b.y - a.y).forEach(g => {
      g.items.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let fin: number | null = null;
      g.items.forEach(it => {
        if (fin !== null && it.x - fin <= 6) {
          const d = cells[cells.length - 1];
          cells[cells.length - 1] = d + (d.endsWith(" ") || it.str.startsWith(" ") ? "" : " ") + it.str;
        } else cells.push(it.str);
        fin = it.x + it.w;
      });
      lignes.push(cells.map(c => c.trim()));
    });
  }
  const freq: Record<number, number> = {};
  lignes.forEach(l => (freq[l.length] = (freq[l.length] || 0) + 1));
  const n = +Object.keys(freq).sort((a, b) => freq[+b] - freq[+a])[0];
  const ent = lignes.find(l => l.length === n)!;
  return lignes.filter(l => l.length === n && (l === ent || l.join("|") !== ent.join("|")));
}

export interface ListRead { headers: string[]; rows: ListRow[]; map: ListMap; notes: string[] }

export async function readListFile(file: File): Promise<ListRead> {
  let data: any[][];
  if (/\.pdf$/i.test(file.name)) data = await lirePdf(file);
  else {
    const XLSX = await getXLSX();
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  }
  const table = parseGrid(data);
  if (!table) throw new Error("vide");
  return detectColumns(table);
}

/** Colonnes d'après les titres (et, si on fournit les lignes, d'après leur contenu). Jamais de matricule « deviné » par la position. */
export function guessMap(headers: string[], rows?: ListRow[]): ListMap {
  if (rows) return detectColumns({ headers, rows }).map;
  const roles = headers.map(classifyHeader);
  const pick = (r: string) => headers[roles.indexOf(r as any)] ?? "";
  const nom = pick("nom"), pre = pick("pre");
  return {
    mat: pick("mat"), nom: nom || (roles.some(Boolean) ? "" : headers[1] ?? ""), pre: pre || (roles.some(Boolean) ? "" : headers[2] ?? ""),
    nai: pick("nai") || pick("nailie"), lie: pick("lie"), sex: pick("sex"),
  };
}

// ---------- Photos : ordre et ZIP ----------
export type PhotoOrder = "nom" | "date" | "sel";
export function trierPhotos(arr: File[], o: PhotoOrder): File[] {
  const p = [...arr];
  if (o === "nom") p.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (o === "date") p.sort((a, b) => a.lastModified - b.lastModified);
  return p;
}
export function versJpg(file: File): Promise<Blob> {
  if (/jpe?g/i.test(file.type)) return Promise.resolve(file);
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      c.toBlob((b) => { URL.revokeObjectURL(url); b ? res(b) : rej(new Error("Conversion impossible")); }, "image/jpeg", 0.95);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("Image illisible : " + file.name)); };
    img.src = url;
  });
}
export async function zipPhotos(photos: File[], rows: ListRow[], m: ListMap, onProgress: (i: number, total: number) => void) {
  const JSZip = await getJSZip();
  const zip = new JSZip();
  const used: Record<string, number> = {};
  const total = Math.min(photos.length, rows.length);
  for (let i = 0; i < total; i++) {
    let nom = nomFichier(rows[i], m);
    if (used[nom]) { used[nom]++; nom = nom.replace(/\.jpg$/, `_${used[nom]}.jpg`); } else used[nom] = 1;
    zip.file(nom, await versJpg(photos[i]));
    onProgress(i + 1, total);
  }
  return { blob: (await zip.generateAsync({ type: "blob" })) as Blob, total };
}

// ---------- Fiche scolaire ----------
export interface FicheOptions {
  ecole: string;
  date: string;
  /** L'élève a fait toutes les classes précédentes dans cette école : remplit école, matricule et dates. */
  scolariteComplete: boolean;
  niveaux: Niveau[];
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const ln = (...p: string[]) => `<div class="ln">${p.join("")}</div>`;
const v = (x: unknown, c?: string) => `<span class="v${c ? " " + c : ""}">${esc(x)}</span>`;

/** Moyenne de passage (sur 10) attribuée automatiquement : stable pour un même élève et une même classe. */
export function moyennePassage(s: Learner, i: number): string {
  let h = 2166136261;
  for (const c of `${s.mat}|${s.nom}|${i}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  const cents = 520 + ((h >>> 0) % 331); // 5,20 à 8,50 : toujours une moyenne de passage
  return `${(cents / 100).toFixed(2).replace(".", ",")}/10`;
}
const PASSEES_AUTO = [2, 3, 4, 5, 6]; // CI, CP, CE1, CE2, CM1

function bloc(s: Learner | null, i: number, o: FicheOptions): string {
  let ec = "", mle = "", du = "", au = "", note = "";
  if (s) {
    const courant = i === CM2_INDEX;
    const auto = PASSEES_AUTO.includes(i);
    const rempli = courant || auto || (o.scolariteComplete && i < CM2_INDEX);
    if (rempli) { ec = o.ecole; mle = s.mat; du = o.niveaux[i].du; au = o.niveaux[i].au; }
    // Moyenne de la liste si elle existe, sinon moyenne de passage automatique (CI à CM1).
    if (!courant) note = s.moyennes[i] || (auto ? moyennePassage(s, i) : "");
  }
  const un = (e: string, m: string, d: string, u: string, n: string) =>
    ln("École", v(e, "s"), "N° mle", v(m, "m"), "du", v(d, "d"), "au", v(u, "d")) +
    ln("Appréciations : Ass", v(""), "Tr", v(""), "C", v("")) +
    ln("Notes", v(n, "w")) +
    ln("Observations", v(""));
  return un(ec, mle, du, au, note) + '<div style="height:6px"></div>' + un("", "", "", "", "") + "<hr>";
}

export function ficheHtml(s: Learner | null, o: FicheOptions, photoUrl: string): string {
  const G = (i: number) => `<div class="ttl">${esc(o.niveaux[i].t)}</div>` + bloc(s, i, o);
  const recto = `<div class="page">
   <div class="col l"><div class="rot"><table class="ex">
     <tr><td colspan="5" class="bar" style="height:22px">EXAMENS SCOLAIRES DIVERS</td></tr>
     <tr class="h"><td></td><td><b>C.E.P</b></td><td><b>C.E.T</b></td><td><b>C.F.R</b></td><td><b>Autres Examens</b></td></tr>
     <tr class="a"><td><b>SESSION</b></td><td></td><td></td><td></td><td></td></tr>
     <tr class="b"><td><b>RÉSULTATS</b></td><td></td><td></td><td></td><td></td></tr>
     <tr><td><b>Signature du Directeur</b></td><td></td><td></td><td></td><td></td></tr>
   </table></div></div>
   <div class="col r">
     ${photoUrl ? `<div class="ph"><img src="${esc(photoUrl)}" alt=""></div>` : ""}
     <div style="text-align:center;font-weight:700;margin-bottom:6px">RÉPUBLIQUE DU BÉNIN</div>
     <div style="font-weight:700;font-size:9px;margin-bottom:8px">MINISTÈRE DES ENSEIGNEMENTS<br>MATERNEL ET PRIMAIRE</div>
     <div class="bar" style="width:60%;margin-left:auto;margin-bottom:8px;margin-top:${photoUrl ? 24 : 0}px">FICHE SCOLAIRE</div>
     ${ln("Délivrée le", v(s ? o.date : "", "w"))}
     ${ln("par", v(s ? o.ecole : ""))}
     ${ln("Nom et prénoms (1)", v(s ? s.nom : ""))}
     ${ln("Date et lieu de Naissance", v(s ? s.nai : ""))}
     ${ln("Nature de la Pièce d'État Civil (2)", v(s?.extra?.piece ?? ""))}
     ${ln("Nom et Prénoms du Père ou Tuteur", v(s?.extra?.pere ?? ""))}
     ${ln("Profession, domicile du Père ou Tuteur", v(s?.extra?.profPere ?? ""))}
     ${ln("Nom, Prénoms de la Mère", v(s?.extra?.mere ?? ""))}
     ${ln("Profession, domicile de la Mère", v(s?.extra?.profMere ?? ""))}
     ${ln("Personne s'occupant de l'Enfant (4)", v(s?.extra?.tuteur ?? ""))}
     <hr style="margin-top:10px">
     <div class="ttl" style="font-size:12px">ÉCOLE MATERNELLE</div>
     ${G(0)}${G(1)}
     <div class="fn">(1) Nom en capitale (2) Numéro, date, lieu<br>(3) Si le père est décédé (4) Personne s'occupant de l'enfant</div>
   </div></div>`;
  const verso = `<div class="page">
   <div class="col l">${G(2)}${G(3)}${G(4)}</div>
   <div class="col r">${G(5)}${G(6)}${G(7)}
     <div class="ttl" style="margin-top:14px">OBSERVATIONS</div>
     ${ln(v(""))}${ln(v(""))}${ln(v(""))}</div></div>`;
  return recto + verso;
}

/** Ouvre la boîte d'impression (ou « Enregistrer en PDF ») avec les fiches données. */
export async function imprimerHtml(html: string): Promise<void> {
  const zone = document.createElement("div");
  zone.id = "fs-print-zone";
  zone.className = "fs-root";
  zone.innerHTML = html;
  const style = document.createElement("style");
  style.textContent =
    "@page{size:937px 812px;margin:0}@media screen{#fs-print-zone{display:none}}" +
    "@media print{body>*:not(#fs-print-zone){display:none!important}#fs-print-zone{display:block}body{background:none!important}}";
  document.head.appendChild(style);
  document.body.appendChild(zone);
  const cleanup = () => { zone.remove(); style.remove(); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup);
  await Promise.all([...zone.querySelectorAll("img")].map((im) => im.decode().catch(() => undefined)));
  window.print();
}
