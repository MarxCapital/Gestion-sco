/* Mini-moteur PostgREST : exécute localement les requêtes que l'application envoie à Supabase
   (filtres, tri, pagination, sélection de colonnes, jointure simple), pour fonctionner sans internet. */
export type Row = Record<string, any>;

export interface Filter { col: string; op: string; val: string; neg: boolean }
export interface OrderBy { col: string; desc: boolean; nullsFirst?: boolean }
export interface SelectItem { name: string; alias?: string; star?: boolean; embed?: SelectItem[]; inner?: boolean }
export interface Query {
  select: SelectItem[]; filters: Filter[]; ors: Filter[][]; order: OrderBy[];
  limit?: number; offset?: number; onConflict: string[]; unsupported: boolean;
}

/** Clé primaire de chaque table de l'application. */
export const PK: Record<string, string> = { app_settings: "key" };
export const pkOf = (table: string) => PK[table] ?? "id";
/** Tables dont l'identifiant est généré par la base (uuid) : on le génère aussi hors ligne. */
export const UUID_TABLES = new Set(["candidates", "notes", "user_roles", "class_resources", "students", "student_notes", "attendance_sessions", "attendance_absences", "notifications", "holidays", "active_sessions"]);
/** Colonnes remplies par défaut côté serveur. */
export const NOW_COLUMNS: Record<string, string[]> = {
  candidates: ["created_at"], notes: ["created_at", "updated_at"], students: ["created_at"], notifications: ["created_at"],
  attendance_absences: ["created_at"], attendance_sessions: ["taken_at"], student_notes: ["updated_at"], class_resources: ["created_at", "updated_at"],
};
/** Jointures (une ligne liée ou plusieurs). */
export const RELATIONS: Record<string, Record<string, { table: string; local: string; foreign: string; many: boolean }>> = {
  candidates: { notes: { table: "notes", local: "id", foreign: "candidate_id", many: false }, profiles: { table: "profiles", local: "center_id", foreign: "id", many: false } },
  notes: { candidates: { table: "candidates", local: "candidate_id", foreign: "id", many: false } },
  students: { student_notes: { table: "student_notes", local: "id", foreign: "student_id", many: true } },
  profiles: { user_roles: { table: "user_roles", local: "id", foreign: "user_id", many: true } },
  user_roles: { profiles: { table: "profiles", local: "user_id", foreign: "id", many: false } },
};

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

export function splitTop(s: string, sep = ","): string[] {
  const out: string[] = []; let depth = 0, q = false, cur = "";
  for (const ch of s) {
    if (ch === '"') q = !q;
    if (!q && ch === "(") depth++;
    if (!q && ch === ")") depth--;
    if (!q && depth === 0 && ch === sep) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur !== "") out.push(cur);
  return out;
}

export function parseSelect(s: string | null): SelectItem[] {
  const str = (s ?? "*").trim() || "*";
  return splitTop(str).map(raw => {
    const t = raw.trim();
    const m = t.match(/^(?:(\w+):)?([\w.*]+)(!\w+)?(?:\((.*)\))?$/s);
    if (!m) return { name: t };
    const [, alias, name, hint, inner] = m;
    if (inner !== undefined) return { name, alias, embed: parseSelect(inner), inner: hint === "!inner" };
    if (name === "*") return { name: "*", star: true };
    return { name, alias };
  });
}

function parseCond(txt: string): Filter | null {
  const m = txt.match(/^([\w.]+)\.(not\.)?(\w+)\.(.*)$/s);
  return m ? { col: m[1], op: m[3], val: m[4], neg: !!m[2] } : null;
}

export function parseQuery(sp: URLSearchParams): Query {
  const q: Query = { select: parseSelect(sp.get("select")), filters: [], ors: [], order: [], onConflict: [], unsupported: false };
  if (sp.get("limit") !== null) q.limit = Number(sp.get("limit"));
  if (sp.get("offset") !== null) q.offset = Number(sp.get("offset"));
  if (sp.get("on_conflict")) q.onConflict = sp.get("on_conflict")!.split(",").map(s => s.trim());
  if (sp.get("order")) q.order = splitTop(sp.get("order")!).map(p => { const [col, ...f] = p.split("."); return { col, desc: f.includes("desc"), nullsFirst: f.includes("nullsfirst") ? true : f.includes("nullslast") ? false : undefined }; });
  sp.forEach((v, k) => {
    if (RESERVED.has(k)) return;
    if (k === "or" || k === "and") {
      const inner = v.replace(/^\(/, "").replace(/\)$/, "");
      const conds = splitTop(inner).map(parseCond);
      if (conds.some(c => !c)) { q.unsupported = true; return; }
      if (k === "or") q.ors.push(conds as Filter[]); else (conds as Filter[]).forEach(c => q.filters.push(c));
      return;
    }
    if (k.includes(".")) { q.unsupported = true; return; }
    const m = v.match(/^(not\.)?(\w+)\.(.*)$/s);
    if (!m) { q.unsupported = true; return; }
    q.filters.push({ col: k, op: m[2], val: m[3], neg: !!m[1] });
  });
  return q;
}

const eq = (v: any, s: string) => {
  if (v === null || v === undefined) return s === "null";
  if (typeof v === "boolean") return String(v) === s;
  if (typeof v === "number") return Number(s) === v;
  if (typeof v === "object") return JSON.stringify(v) === s;
  return String(v) === s;
};
const cmp = (v: any, s: string) => {
  if (typeof v === "number") return v - Number(s);
  const a = String(v), b = s; return a < b ? -1 : a > b ? 1 : 0;
};
const list = (s: string) => splitTop(s.replace(/^\(/, "").replace(/\)$/, "")).map(x => x.trim().replace(/^"(.*)"$/s, "$1"));
const likeRe = (p: string, ci: boolean) => new RegExp("^" + p.replace(/[.+^${}()|[\]\\?]/g, "\\$&").replace(/[*%]/g, ".*").replace(/_/g, ".") + "$", ci ? "is" : "s");

export function matchFilter(row: Row, f: Filter): boolean {
  const v = row[f.col];
  let r: boolean;
  switch (f.op) {
    case "eq": r = eq(v, f.val); break;
    case "neq": r = !eq(v, f.val); break;
    case "gt": r = v != null && cmp(v, f.val) > 0; break;
    case "gte": r = v != null && cmp(v, f.val) >= 0; break;
    case "lt": r = v != null && cmp(v, f.val) < 0; break;
    case "lte": r = v != null && cmp(v, f.val) <= 0; break;
    case "in": r = list(f.val).some(x => eq(v, x)); break;
    case "is": r = f.val === "null" ? v == null : f.val === "true" ? v === true : f.val === "false" ? v === false : false; break;
    case "like": r = v != null && likeRe(f.val, false).test(String(v)); break;
    case "ilike": r = v != null && likeRe(f.val, true).test(String(v)); break;
    default: r = true;
  }
  return f.neg ? !r : r;
}
export const matches = (row: Row, q: Pick<Query, "filters" | "ors">) =>
  q.filters.every(f => matchFilter(row, f)) && q.ors.every(g => g.some(f => matchFilter(row, f)));

const coll = new Intl.Collator("en", { numeric: false });
export function sortRows(rows: Row[], order: OrderBy[]): Row[] {
  if (!order.length) return rows;
  return [...rows].sort((a, b) => {
    for (const o of order) {
      const x = a[o.col], y = b[o.col];
      if (x == null && y == null) continue;
      const nf = o.nullsFirst ?? o.desc;
      if (x == null) return nf ? -1 : 1;
      if (y == null) return nf ? 1 : -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : coll.compare(String(x), String(y));
      if (c) return o.desc ? -c : c;
    }
    return 0;
  });
}

export interface Ctx { tableRows: (table: string) => Row[] }

export function project(base: string, row: Row, items: SelectItem[], ctx: Ctx): Row | null {
  const out: Row = {};
  for (const it of items) {
    if (it.star) { Object.assign(out, row); continue; }
    if (it.embed) {
      const rel = RELATIONS[base]?.[it.name];
      if (!rel) { out[it.alias || it.name] = null; continue; }
      const found = ctx.tableRows(rel.table).filter(r => r[rel.foreign] === row[rel.local] && row[rel.local] != null);
      const shaped = found.map(r => project(rel.table, r, it.embed!, ctx)!);
      if (it.inner && !shaped.length) return null;
      out[it.alias || it.name] = rel.many ? shaped : shaped[0] ?? null;
      continue;
    }
    out[it.alias || it.name] = row[it.name] ?? null;
  }
  return out;
}

/** Résultat d'un SELECT : filtre, tri, pagination, projection. `total` = nombre avant pagination. */
export function runSelect(table: string, all: Row[], q: Query, ctx: Ctx): { rows: Row[]; total: number } {
  let rows = sortRows(all.filter(r => matches(r, q)), q.order);
  const shaped: Row[] = [];
  for (const r of rows) { const p = project(table, r, q.select, ctx); if (p) shaped.push(p); }
  const total = shaped.length;
  const from = q.offset ?? 0;
  const part = q.limit !== undefined ? shaped.slice(from, from + q.limit) : shaped.slice(from);
  return { rows: part, total };
}
