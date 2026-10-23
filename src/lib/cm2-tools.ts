// Outils du compte école CM2 : lecture de la liste, nom des photos, fiche scolaire.
// Tout se passe dans le navigateur : aucune donnée d'élève n'est envoyée sur un serveur.

export type ListRow = Record<string, string>;
export interface ListMap { mat: string; nom: string; pre: string; nai: string; lie: string; sex: string }
export interface Learner { mat: string; nom: string; nai: string; moyennes: (string | null)[] }
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
export async function getXLSX() { await loadScript(LIBS.xlsx); return w().XLSX; }
export async function getJSZip() { await loadScript(LIBS.jszip); return w().JSZip; }
async function getPdfjs() {
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
  const lignes: string[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const items = (await (await pdf.getPage(p)).getTextContent()).items.filter((i: any) => i.str.trim() !== "");
    const groupes: { y: number; items: any[] }[] = [];
    items.forEach((it: any) => {
      const y = it.transform[5];
      let g = groupes.find((g) => Math.abs(g.y - y) < 3);
      if (!g) { g = { y, items: [] }; groupes.push(g); }
      g.items.push(it);
    });
    groupes.sort((a, b) => b.y - a.y).forEach((g) => {
      g.items.sort((a, b) => a.transform[4] - b.transform[4]);
      const cells: string[] = [];
      let fin: number | null = null;
      g.items.forEach((it) => {
        const x = it.transform[4];
        if (fin !== null && x - fin <= 6) {
          const d = cells[cells.length - 1];
          cells[cells.length - 1] = d + (d.endsWith(" ") || it.str.startsWith(" ") ? "" : " ") + it.str;
        } else cells.push(it.str);
        fin = x + it.width;
      });
      lignes.push(cells.map((c) => c.trim()));
    });
  }
  const freq: Record<number, number> = {};
  lignes.forEach((l) => (freq[l.length] = (freq[l.length] || 0) + 1));
  const n = +Object.keys(freq).sort((a, b) => freq[+b] - freq[+a])[0];
  const ent = lignes.find((l) => l.length === n)!;
  return lignes.filter((l) => l.length === n && (l === ent || l.join("|") !== ent.join("|")));
}

export async function readListFile(file: File): Promise<{ headers: string[]; rows: ListRow[] }> {
  let data: any[][];
  if (/\.pdf$/i.test(file.name)) data = await lirePdf(file);
  else {
    const XLSX = await getXLSX();
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  }
  const hi = data.findIndex((r) => r.filter((c) => String(c).trim() !== "").length >= 2);
  if (hi < 0) throw new Error("vide");
  const headers = data[hi].map((h, i) => String(h).trim() || "Colonne " + (i + 1));
  const rows = data
    .slice(hi + 1)
    .filter((r) => r.some((c) => String(c).trim() !== ""))
    .map((r) => {
      const o: ListRow = {};
      headers.forEach((h, i) => (o[h] = r[i] ?? ""));
      return o;
    });
  return { headers, rows };
}

export function guessMap(headers: string[]): ListMap {
  const g = (re: RegExp, fb?: number) => headers.find((x) => re.test(x.toLowerCase())) ?? (fb !== undefined ? headers[fb] : "") ?? "";
  return {
    mat: g(/matricule|mle|^mat/, 0),
    nom: g(/^nom|^name/, 1),
    pre: g(/pr[ée]nom/, 2),
    nai: g(/naiss|^date/),
    lie: g(/lieu/),
    sex: g(/sexe|genre/),
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
function versJpg(file: File): Promise<Blob> {
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

function bloc(s: Learner | null, i: number, o: FicheOptions): string {
  let ec = "", mle = "", du = "", au = "", note = "";
  if (s) {
    const courant = i === CM2_INDEX;
    const rempli = courant || (o.scolariteComplete && i < CM2_INDEX);
    if (rempli) { ec = o.ecole; mle = s.mat; du = o.niveaux[i].du; au = o.niveaux[i].au; }
    // La moyenne n'est écrite que si elle vient de la liste fournie (jamais inventée).
    if (!courant && s.moyennes[i]) note = s.moyennes[i]!;
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
   <div class="col l"><table class="ex">
     <tr><td colspan="5" class="bar" style="height:22px">EXAMENS SCOLAIRES DIVERS</td></tr>
     <tr class="h"><td></td><td><b>C.E.P</b></td><td><b>C.E.T</b></td><td><b>C.F.R</b></td><td><b>Autres Examens</b></td></tr>
     <tr class="a"><td><b>SESSION</b></td><td></td><td></td><td></td><td></td></tr>
     <tr class="b"><td><b>RÉSULTATS</b></td><td></td><td></td><td></td><td></td></tr>
     <tr><td><b>Signature du Directeur</b></td><td></td><td></td><td></td><td></td></tr>
   </table></div>
   <div class="col r">
     ${photoUrl ? `<div class="ph"><img src="${esc(photoUrl)}" alt=""></div>` : ""}
     <div style="text-align:center;font-weight:700;margin-bottom:6px">RÉPUBLIQUE DU BÉNIN</div>
     <div style="font-weight:700;font-size:9px;margin-bottom:8px">MINISTÈRE DES ENSEIGNEMENTS<br>MATERNEL ET PRIMAIRE</div>
     <div class="bar" style="width:60%;margin-left:auto;margin-bottom:8px;margin-top:${photoUrl ? 24 : 0}px">FICHE SCOLAIRE</div>
     ${ln("Délivrée le", v(s ? o.date : "", "w"))}
     ${ln("par", v(s ? o.ecole : ""))}
     ${ln("Nom et prénoms (1)", v(s ? s.nom : ""))}
     ${ln("Date et lieu de Naissance", v(s ? s.nai : ""))}
     ${ln("Nature de la Pièce d'État Civil (2)", v(""))}
     ${ln("Nom et Prénoms du Père ou Tuteur", v(""))}
     ${ln("Profession, domicile du Père ou Tuteur", v(""))}
     ${ln("Nom, Prénoms de la Mère", v(""))}
     ${ln("Profession, domicile de la Mère", v(""))}
     ${ln("Personne s'occupant de l'Enfant (4)", v(""))}
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
