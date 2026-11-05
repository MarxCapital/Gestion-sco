// Extraction de candidats depuis un tableau PDF, par analyse de position (sans IA).
// Colonnes attendues : N° | Photo | N° de table | Nom | Prénom(s) | Sexe | Nationalité |
//                      Date de naissance | Lieu de naissance | École de provenance

export interface TextItem {
  str: string;
  x: number; // abscisse (gauche) du texte
  y: number; // ordonnée (PDF : 0 = bas de page)
  w?: number; // largeur éventuelle
}

export interface Candidate {
  numero_table: string | null;
  nom: string;
  prenoms: string | null;
  sexe: string | null;
  ecole_provenance: string | null;
}

export interface ParseResult {
  candidates: Candidate[];
  warnings: string[];
}

type ColKey = "order" | "table" | "nom" | "prenoms" | "sexe" | "nationalite" | "naissance" | "lieu" | "ecole";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Mots-clés d'en-tête (comparés sans accents, en minuscules)
const HEADER_RULES: { key: ColKey; test: (s: string) => boolean }[] = [
  { key: "table", test: (s) => /\btable\b/.test(s) },
  { key: "prenoms", test: (s) => /^prenom/.test(s) },
  { key: "nom", test: (s) => s === "nom" || s === "noms" },
  { key: "sexe", test: (s) => /^sexe$|^genre$/.test(s) },
  { key: "nationalite", test: (s) => /^nationalite/.test(s) },
  { key: "lieu", test: (s) => /^lieu/.test(s) },
  { key: "naissance", test: (s) => /^date/.test(s) },
  { key: "ecole", test: (s) => /^ecole|provenance/.test(s) },
];

const Y_TOL = 3;

interface Line {
  y: number;
  items: TextItem[];
}

function groupLines(items: TextItem[]): Line[] {
  const sorted = [...items].filter((i) => i.str.trim() !== "").sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= Y_TOL) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  return lines;
}

/** Découpe un fragment d'en-tête fusionné (ex. « Lieu de naissance École de provenance »)
 *  en libellés distincts, avec une estimation de leur position X. */
const LABEL_START = /(^|\s)(n°|photo|nom|pr[ée]nom|sexe|nationalit|date|lieu|[ée]cole)/gi;

function splitHeaderItem(it: TextItem): TextItem[] {
  const str = it.str;
  const starts: number[] = [0];
  let m: RegExpExecArray | null;
  LABEL_START.lastIndex = 0;
  while ((m = LABEL_START.exec(str)) !== null) {
    const idx = m.index + m[1].length;
    if (idx > 0 && !starts.includes(idx)) starts.push(idx);
  }
  starts.sort((a, b) => a - b);
  // « N° de table » : le « N° » initial et « table » forment un seul libellé
  const parts: TextItem[] = [];
  const w = it.w && it.w > 0 ? it.w : str.length * 4;
  starts.forEach((st, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : str.length;
    parts.push({ str: str.slice(st, end).trim(), x: it.x + (st / Math.max(1, str.length)) * w, y: it.y });
  });
  return parts;
}

/** Détecte la position X (gauche) de chaque colonne d'après la ligne d'en-tête. */
function detectColumns(lines: Line[]): { cols: Partial<Record<ColKey, number>>; headerBottomIdx: number } | null {
  const hasLabel = (line: Line) =>
    line.items.some((raw) => splitHeaderItem(raw).some((p) => HEADER_RULES.some((r) => r.test(norm(p.str)))));
  for (let li = 0; li < lines.length; li++) {
    if (!hasLabel(lines[li])) continue; // la 1re ligne d'en-tête est la 1re ligne qui contient un libellé
    const cols: Partial<Record<ColKey, number>> = {};
    // L'en-tête peut tenir sur 1 à 3 lignes (libellés qui passent à la ligne)
    const span = lines.slice(li, li + 3);
    for (const line of span) {
      for (const raw of line.items) {
        for (const it of splitHeaderItem(raw)) {
          const s = norm(it.str);
          for (const rule of HEADER_RULES) {
            if (cols[rule.key] === undefined && rule.test(s)) {
              cols[rule.key] = it.x;
              break;
            }
          }
        }
      }
    }
    if (cols.nom !== undefined && cols.prenoms !== undefined && Object.keys(cols).length >= 4) {
      // L'en-tête se termine à la dernière ligne (parmi span) contenant un mot-clé
      let last = li;
      span.forEach((line, k) => {
        if (k === 0) return;
        const texts = line.items.map((it) => it.str.replace(/n°/gi, ""));
        const looksLikeLabels =
          texts.every((t) => !/\d/.test(t) && t.length <= 30) &&
          line.items.some((it) => splitHeaderItem(it).some((p) => HEADER_RULES.some((r) => r.test(norm(p.str)))) || /^(de|du|d')?\s*(table|naissance)/.test(norm(it.str)));
        if (looksLikeLabels && last === li + k - 1) last = li + k;
      });
      cols.order = -1e6; // sentinelle : tout ce qui est à gauche de la 1re colonne connue
      return { cols, headerBottomIdx: last };
    }
  }
  return null;
}

function assignColumn(x: number, cols: Partial<Record<ColKey, number>>): ColKey {
  // Une colonne commence un peu avant son en-tête (tolérance = 35 % de l'écart avec la colonne précédente)
  const entries = (Object.entries(cols) as [ColKey, number][]).sort((a, b) => a[1] - b[1]);
  let current: ColKey = entries[0][0];
  for (let i = 1; i < entries.length; i++) {
    const [k, cx] = entries[i];
    const prev = entries[i - 1][1];
    const gap = prev < -1e5 ? 30 : cx - prev;
    if (x >= cx - Math.min(gap * 0.35, 12)) current = k;
  }
  return current;
}

function cleanCell(parts: string[]): string | null {
  const v = parts.join(" ").replace(/\s+/g, " ").trim();
  return v === "" ? null : v;
}

export function normalizeSchoolName(name: string | null): string | null {
  if (!name) return null;
  return name.replace(/\s*-\s*/g, "-").replace(/\s*\/\s*/g, "/").trim();
}

function normalizeSexe(v: string | null): string | null {
  if (!v) return null;
  const s = norm(v);
  if (/^m/.test(s)) return "M";
  if (/^f/.test(s)) return "F";
  return v.trim().toUpperCase();
}

export function parseCandidatePages(pages: TextItem[][]): ParseResult {
  const candidates: Candidate[] = [];
  const warnings: string[] = [];
  let lastCols: Partial<Record<ColKey, number>> | null = null;

  pages.forEach((items, pageIdx) => {
    const lines = groupLines(items);
    const det = detectColumns(lines);
    let cols = lastCols;
    let startIdx = 0;
    if (det) {
      cols = det.cols;
      lastCols = det.cols;
      startIdx = det.headerBottomIdx + 1;
    }
    if (!cols) {
      if (lines.length > 0) warnings.push(`Page ${pageIdx + 1} : en-tête du tableau introuvable, page ignorée.`);
      return;
    }

    const emptyRow = (): Record<ColKey, string[]> => ({
      order: [], table: [], nom: [], prenoms: [], sexe: [], nationalite: [], naissance: [], lieu: [], ecole: [],
    });

    const body = lines.slice(startIdx).map((line) => {
      const cells = emptyRow();
      for (const it of line.items) cells[assignColumn(it.x, cols!)].push(it.str);
      return { y: line.y, cells };
    });

    // Ancres = lignes dont la colonne « N° » contient un numéro d'ordre. Les autres lignes
    // (retours à la ligne d'une cellule, cellules centrées verticalement) sont rattachées
    // à l'ancre la plus proche, qu'elle soit au-dessus ou en dessous.
    const anchors = body
      .map((l, i) => ({ i, y: l.y, t: cleanCell(l.cells.order) }))
      .filter((a) => a.t !== null && /^\d{1,5}$/.test(a.t as string));
    if (anchors.length === 0) {
      if (body.length > 0) warnings.push(`Page ${pageIdx + 1} : aucune ligne numérotée trouvée.`);
      return;
    }
    const gaps = anchors.slice(1).map((a, k) => anchors[k].y - a.y).sort((p, q) => p - q);
    const pitch = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 20;

    const rows = anchors.map(() => emptyRow());
    body.forEach((l) => {
      let best = 0;
      let bestD = Infinity;
      anchors.forEach((a, k) => {
        const d = Math.abs(a.y - l.y);
        if (d < bestD) { bestD = d; best = k; }
      });
      if (bestD > pitch * 1.0) return; // titre / pied de page
      (Object.keys(l.cells) as ColKey[]).forEach((k) => {
        if (k !== "order") rows[best][k].push(...l.cells[k]);
      });
    });

    for (const r of rows) {
      const nom = cleanCell(r.nom);
      const prenoms = cleanCell(r.prenoms);
      if (!nom && !prenoms) continue;
      candidates.push({
        numero_table: cleanCell(r.table),
        nom: nom ?? "",
        prenoms,
        sexe: normalizeSexe(cleanCell(r.sexe)),
        ecole_provenance: normalizeSchoolName(cleanCell(r.ecole)),
      });
    }
  });

  if (candidates.length === 0) {
    warnings.push("Aucun candidat reconnu : vérifiez que le PDF contient le tableau attendu (colonnes Nom et Prénom(s)).");
  }
  candidates.forEach((c, i) => {
    if (!c.nom) warnings.push(`Ligne ${i + 1} : nom manquant.`);
    if (!c.prenoms) warnings.push(`Ligne ${i + 1} (${c.nom}) : prénoms manquants.`);
    if (c.sexe && c.sexe !== "M" && c.sexe !== "F") warnings.push(`Ligne ${i + 1} (${c.nom}) : sexe inattendu « ${c.sexe} ».`);
  });
  return { candidates, warnings };
}
