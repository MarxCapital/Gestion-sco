/* Lecture intelligente d'une liste d'apprenants (PDF avec texte, Excel, CSV).
   Le système lit d'abord ce qui est écrit EN HAUT de chaque colonne, puis vérifie le contenu des colonnes
   (un « numéro d'ordre » 1, 2, 3… n'est jamais pris pour un matricule). Fonctions pures : testables sans navigateur. */
import type { ListMap, ListRow } from "./cm2-tools";

export const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim();

export type Role = "ordre" | "mat" | "nom" | "pre" | "full" | "sex" | "nai" | "lie" | "nailie";

/** Que désigne le titre d'une colonne ? (null = on ne sait pas) */
export function classifyHeader(label: string): Role | null {
  const h = norm(label);
  if (!h || h.length > 60) return null;
  if (/inscr|admission|entree|sortie|classe|ecole|provenance/.test(h)) return null;
  if (/matricule|\bmle\b|\bmat\b|\bmatr\b|identifiant|educmaster|code (eleve|apprenant)/.test(h)) return "mat";
  if (/date.*lieu|lieu.*date|ne\(?e?\)?.*lieu|date et lieu/.test(h)) return "nailie";
  if (/lieu/.test(h)) return "lie";
  if (/naiss|^ne\(?e?\)? ?le|^ne\(?e?\)?$|^date( de)?$|^date\b/.test(h)) return "nai";
  if (/sexe|genre|^s$|^m ?\/ ?f$/.test(h)) return "sex";
  if (/nom.*prenom|nom complet|nom & ?pre|^(eleve|apprenant|enfant)s?$|^nom et/.test(h)) return "full";
  if (/prenom/.test(h)) return "pre";
  if (/^noms?( de famille)?(\s*\(s\))?$|^nom\b/.test(h)) return "nom";
  if (/ordre|^n ?°?$|^no\.?$|^num(ero)?\.?$|^n ?°|^#$|^rang$|numero|^n ?o ?$/.test(h)) return "ordre";
  return null;
}

const DATE_RE = /^\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{2,4}$/;
const dateish = (v: string) => DATE_RE.test(v.trim()) || /^\d{1,2}\s+\w+\s+\d{4}$/.test(norm(v));
const isDataCell = (v: string) => /^\d+$/.test(v.trim()) || dateish(v);
const rolesOf = (cells: string[]) => new Set(cells.map(classifyHeader).filter(Boolean) as Role[]);

// ---------- Grille (Excel / CSV / PDF déjà aligné) → tableau ----------
export interface Table { headers: string[]; rows: ListRow[] }

export function parseGrid(grid: unknown[][]): Table | null {
  const g = grid.map(r => r.map(c => String(c ?? "").trim()));
  let hi = -1, best = 1;
  for (let i = 0; i < Math.min(60, g.length); i++) {
    const rs = rolesOf(g[i]);
    const score = rs.size + (rs.has("nom") || rs.has("full") ? 1 : 0);
    if (rs.size >= 2 && score > best) { best = score; hi = i; }
  }
  if (hi < 0) hi = g.findIndex(r => r.filter(Boolean).length >= 2);
  if (hi < 0) return null;
  const head = [...g[hi]];
  let next = hi + 1;
  // titre sur deux lignes (« Date de » / « naissance », « N° » / « d'ordre »)
  for (let k = 0; k < 2 && next < g.length; k++) {
    const row = g[next]; const filled = row.filter(Boolean);
    if (!filled.length || filled.some(isDataCell) || rolesOf(row).size === 0) break;
    row.forEach((c, j) => { if (c) head[j] = ((head[j] ?? "") + " " + c).trim(); });
    next++;
  }
  const seen = new Map<string, number>();
  const headers = head.map((h, j) => {
    let name = h || `Colonne ${j + 1}`;
    const n = (seen.get(name) ?? 0) + 1; seen.set(name, n);
    return n > 1 ? `${name} (${n})` : name;
  });
  const rows: ListRow[] = [];
  for (const r of g.slice(next)) {
    if (r.filter(Boolean).length < 2) continue;
    if (rolesOf(r).size >= 3 && !r.some(isDataCell)) continue; // titre répété en haut d'une page
    const o: ListRow = {}; headers.forEach((h, j) => { o[h] = r[j] ?? ""; }); rows.push(o);
  }
  return rows.length ? { headers, rows } : null;
}

// ---------- PDF : fragments de texte positionnés → grille ----------
export interface PdfItem { str: string; x: number; y: number; w: number }
interface Line { y: number; items: PdfItem[] }

function toLines(items: PdfItem[]): Line[] {
  const out: Line[] = [];
  items.filter(i => i.str.trim() !== "").sort((a, b) => b.y - a.y).forEach(it => {
    const l = out.find(l => Math.abs(l.y - it.y) < 3);
    if (l) l.items.push(it); else out.push({ y: it.y, items: [it] });
  });
  out.forEach(l => l.items.sort((a, b) => a.x - b.x));
  return out.sort((a, b) => b.y - a.y);
}
const lineRoles = (l: Line) => rolesOf(l.items.map(i => i.str));
const lineHasData = (l: Line) => l.items.some(i => isDataCell(i.str));
const GAP = 4;       // espace vide minimal entre deux colonnes (points)
const BAND = 17;     // écart maximal entre deux lignes d'un même titre

/** Trouve la bande des titres d'une page : [début, fin[ en indices de lignes, ou null. */
function headerBand(lines: Line[]): [number, number] | null {
  let j = -1, best = 2;
  lines.forEach((l, i) => { const n = lineRoles(l).size; if (n > best || (n === best && j < 0 && n >= 3)) { best = n; j = i; } });
  if (j < 0) return null;
  let a = j, b = j + 1;
  while (b < lines.length && lines[b - 1].y - lines[b].y < BAND && !lineHasData(lines[b]) && lineRoles(lines[b]).size >= 1) b++;
  while (a > 0 && lines[a - 1].y - lines[a].y < BAND && !lineHasData(lines[a - 1]) && lineRoles(lines[a - 1]).size >= 1) a--;
  return [a, b];
}

export function pdfPagesToGrid(pages: PdfItem[][]): string[][] | null {
  let header: PdfItem[] | null = null;
  const data: Line[] = [];
  for (const items of pages) {
    const lines = toLines(items);
    const band = headerBand(lines);
    if (band) {
      if (!header) header = lines.slice(band[0], band[1]).flatMap(l => l.items.map(i => ({ ...i })));
      data.push(...lines.slice(band[1]));
    } else if (header) data.push(...lines);
  }
  if (!header || !data.length) return null;

  // colonnes = zones verticales occupées par le texte des lignes d'élèves
  const iv = data.flatMap(l => l.items.map(i => [i.x, i.x + Math.max(i.w, 1)] as [number, number])).sort((a, b) => a[0] - b[0]);
  const segs: [number, number][] = [];
  iv.forEach(([s, e]) => { const last = segs[segs.length - 1]; if (last && s <= last[1] + GAP) last[1] = Math.max(last[1], e); else segs.push([s, e]); });
  const segOf = (cx: number) => {
    let k = segs.findIndex(([s, e]) => cx >= s - 1 && cx <= e + 1);
    if (k >= 0) return k;
    let d = Infinity; segs.forEach(([s, e], i) => { const dd = Math.min(Math.abs(cx - s), Math.abs(cx - e)); if (dd < d) { d = dd; k = i; } });
    return d <= 70 ? k : -1;
  };
  const labels: PdfItem[][] = segs.map(() => []);
  header.forEach(it => { const k = segOf(it.x + it.w / 2); if (k >= 0) labels[k].push(it); });
  const names = labels.map(f => f.sort((a, b) => (Math.abs(a.y - b.y) < 3 ? a.x - b.x : b.y - a.y)).map(i => i.str.trim()).join(" ").replace(/\s+/g, " ").trim());

  const rows: string[][] = [];
  data.forEach(l => {
    const cells: PdfItem[][] = segs.map(() => []);
    l.items.forEach(it => { const k = segOf(it.x + it.w / 2); if (k >= 0) cells[k].push(it); });
    const row = cells.map(c => c.reduce((s, it, i) => s + (i && it.x - (c[i - 1].x + c[i - 1].w) > 1 ? " " : "") + it.str.trim(), "").trim());
    if (row.filter(Boolean).length >= 2) rows.push(row);
  });
  // colonnes sans titre ni contenu : retirées
  const keep = names.map((n, i) => !!n || rows.some(r => r[i]));
  return [names.filter((_, i) => keep[i]), ...rows.map(r => r.filter((_, i) => keep[i]))];
}

// ---------- Choix des colonnes : titre d'abord, contenu ensuite ----------
const SEQ_RE = /^\d{1,4}$/;
export function isSequence(vals: string[]): boolean {
  const v = vals.filter(Boolean); if (v.length < 3 || !v.every(x => SEQ_RE.test(x))) return false;
  const n = v.map(Number); let ok = 0;
  for (let i = 1; i < n.length; i++) if (n[i] === n[i - 1] + 1) ok++;
  return ok >= 0.6 * (n.length - 1) || Math.max(...n) <= n.length + 3;
}
const looksId = (vals: string[]) => { const v = vals.filter(Boolean); return v.length >= 2 && v.filter(x => /^[A-Za-z0-9][A-Za-z0-9\-\/ ]{4,}$/.test(x) && /\d/.test(x) && !dateish(x)).length >= 0.7 * v.length; };
const SEX_RE = /^(m|f|g|h|masculin|feminin|garcon|fille|homme|femme)$/;
const sexRatio = (vals: string[]) => { const v = vals.filter(Boolean); return v.length ? v.filter(x => SEX_RE.test(norm(x))).length / v.length : 0; };
const dateRatio = (vals: string[]) => { const v = vals.filter(Boolean); return v.length ? v.filter(x => dateish(x) || /^\d{5}$/.test(x)).length / v.length : 0; };
const alphaRatio = (vals: string[]) => { const v = vals.filter(Boolean); return v.length ? v.filter(x => /^[A-Za-zÀ-ÿ'’\- .]+$/.test(x)).length / v.length : 0; };

const isUpperToken = (t: string) => /^[A-ZÀ-ÖØ-Þ'’\-]+$/.test(t);
export function splitFullName(s: string): { nom: string; pre: string } {
  const t = s.trim().split(/\s+/).filter(Boolean); if (!t.length) return { nom: "", pre: "" };
  let k = 0; while (k < t.length && isUpperToken(t[k])) k++;
  if (k === 0 || k === t.length) k = 1;
  return { nom: t.slice(0, k).join(" "), pre: t.slice(k).join(" ") };
}
export function splitDateLieu(s: string): { nai: string; lie: string } {
  const m = s.trim().match(/^(\d{1,2}\s*[\/.\-]\s*\d{1,2}\s*[\/.\-]\s*\d{2,4}|\d{4})\s*(?:(?:à|a|au|at)(?=\s)|,|-|–)?\s*(.*)$/i);
  return m ? { nai: m[1].replace(/\s+/g, ""), lie: m[2].trim() } : { nai: "", lie: s.trim() };
}

/** Détermine la colonne de chaque information. Ajoute des colonnes « Nom », « Prénoms »… si le fichier regroupe plusieurs informations. */
export function detectColumns(table: Table): { headers: string[]; rows: ListRow[]; map: ListMap; notes: string[] } {
  const headers = [...table.headers]; const rows = table.rows.map(r => ({ ...r })); const notes: string[] = [];
  const col = (h: string) => rows.map(r => String(r[h] ?? "").trim());
  const roles = headers.map(classifyHeader);
  const pick = (r: Role) => headers[roles.indexOf(r)] ?? "";
  let mat = pick("mat"), ordre = pick("ordre"), nom = pick("nom"), pre = pick("pre"), full = pick("full"), sex = pick("sex"), nai = pick("nai"), lie = pick("lie"), nl = pick("nailie");
  const used = () => new Set([mat, ordre, nom, pre, full, sex, nai, lie, nl].filter(Boolean));
  const free = () => headers.filter(h => !used().has(h));

  // Matricule : jamais un numéro d'ordre (1, 2, 3…)
  if (mat && isSequence(col(mat))) { notes.push(`La colonne « ${mat} » contient 1, 2, 3… : c'est un numéro d'ordre, pas un matricule.`); if (!ordre) ordre = mat; mat = ""; }
  if (!mat) { const c = free().find(h => /^colonne \d+$/i.test(h) && !isSequence(col(h)) && looksId(col(h))); if (c) mat = c; }
  if (!mat && ordre && !isSequence(col(ordre)) && looksId(col(ordre))) { mat = ordre; ordre = ""; }

  // Sexe
  if (sex && sexRatio(col(sex)) < 0.7) sex = "";
  if (!sex) { const c = free().find(h => { const v = col(h).filter(Boolean); return v.length >= 3 && sexRatio(v) >= 0.95 && new Set(v.map(norm)).size <= 4; }); if (c) sex = c; }

  // Date de naissance
  if (nai && dateRatio(col(nai)) < 0.3 && dateRatio(col(nai)) < 1 && !nl) { const c = free().find(h => dateRatio(col(h)) >= 0.7); if (c) nai = c; }
  if (!nai && !nl) { const c = free().find(h => dateRatio(col(h)) >= 0.7); if (c) nai = c; }

  // Nom / prénoms
  if (!nom && !full) {
    const alpha = free().filter(h => alphaRatio(col(h)) >= 0.8 && h !== lie && h !== sex);
    if (alpha[0]) nom = alpha[0];
    if (!pre && alpha[1]) pre = alpha[1];
  }
  const uniq = (base: string) => { let n = base; for (let i = 2; headers.includes(n); i++) n = `${base} (${i})`; return n; };
  if (!nom && full) {
    const cn = uniq("Nom"), cp = uniq("Prénoms"); headers.push(cn, cp);
    rows.forEach(r => { const s = splitFullName(String(r[full] ?? "")); r[cn] = s.nom; r[cp] = s.pre; });
    nom = cn; pre = pre || cp; notes.push(`« ${full} » a été séparé en nom et prénoms.`);
  }
  if (!nai && !lie && nl) {
    const cn = uniq("Date de naissance"), cl = uniq("Lieu de naissance"); headers.push(cn, cl);
    rows.forEach(r => { const s = splitDateLieu(String(r[nl] ?? "")); r[cn] = s.nai; r[cl] = s.lie; });
    nai = cn; lie = cl; notes.push(`« ${nl} » a été séparé en date et lieu de naissance.`);
  } else if (nl && !nai) { nai = nl; } else if (nl && !lie) { lie = nl; }
  // une seule colonne « date » qui contient aussi le lieu (« 12/03/2015 à Bantè »)
  if (nai && !lie && nai in (rows[0] ?? {})) {
    const v = col(nai).filter(Boolean);
    if (v.length && v.filter(x => splitDateLieu(x).nai && splitDateLieu(x).lie).length >= 0.5 * v.length) {
      const cn = uniq("Date de naissance"), cl = uniq("Lieu de naissance"); headers.push(cn, cl);
      rows.forEach(r => { const s = splitDateLieu(String(r[nai] ?? "")); r[cn] = s.nai || String(r[nai] ?? ""); r[cl] = s.lie; });
      nai = cn; lie = cl; notes.push("La date de naissance contenait aussi le lieu : les deux ont été séparés.");
    }
  }

  return { headers, rows, map: { mat, nom, pre, nai, lie, sex }, notes };
}

export interface ListStudent { matricule: string; nom: string; prenoms: string; sexe: string; naissance: string; lieu: string }
const sexOf = (v: string) => { const n = norm(v); return /^(f|feminin|fille|femme)$/.test(n) ? "F" : /^(m|g|h|masculin|garcon|homme)$/.test(n) ? "M" : ""; };

/** Apprenants prêts à être enregistrés (compte École) à partir d'une table et de ses colonnes. */
export function tableToStudents(headers: string[], rows: ListRow[], map: ListMap, fmtDate: (v: unknown) => string): ListStudent[] {
  void headers;
  return rows.map(r => ({
    matricule: map.mat ? String(r[map.mat] ?? "").trim() : "",
    nom: String(r[map.nom] ?? "").trim().toUpperCase(),
    prenoms: String(r[map.pre] ?? "").trim(),
    sexe: map.sex ? sexOf(String(r[map.sex] ?? "")) : "",
    naissance: map.nai ? fmtDate(r[map.nai]) : "",
    lieu: map.lie && map.lie !== map.nai ? String(r[map.lie] ?? "").trim() : "",
  })).filter(s => s.nom);
}
