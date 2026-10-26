/* Passerelle « hors ligne d'abord » entre l'application et Supabase (REST).
   - En ligne : la requête part normalement ; les données reçues sont copiées dans le miroir local.
   - Hors ligne (ou connexion trop mauvaise) : les lectures sont servies par le miroir ; les écritures sont
     appliquées au miroir tout de suite et mises dans une file, envoyée au serveur dès le retour d'internet. */
import { Mirror, type QueueEntry } from "./mirror";
import {
  NOW_COLUMNS, RELATIONS, UUID_TABLES, matches, parseQuery, parseSelect, pkOf, project, runSelect,
  type Query, type Row, type SelectItem,
} from "./postgrest-lite";

export interface GatewayEnv {
  real: typeof fetch;
  restPrefix: string;                       // « https://xxx.supabase.co/rest/v1/ »
  healthUrl: string;
  apikey: string;
  mirror: () => Promise<Mirror>;
  getToken: () => Promise<string | null>;
  uuid?: () => string;
  now?: () => number;
  readTimeout?: number; writeTimeout?: number;
}

export interface GatewayStatus { down: boolean; pending: number; failed: number; syncing: boolean; needsLogin: boolean; lastSync: number; prep: { done: number; total: number } | null; readyAt: number }

const JSON_H = { "content-type": "application/json; charset=utf-8" };
const GATEWAY_CODES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526]);

export class Gateway {
  down = false; syncing = false; needsLogin = false; lastSync = 0; pending = 0; failed = 0; prep: { done: number; total: number } | null = null; readyAt = 0;
  private subs = new Set<(s: GatewayStatus) => void>();
  private probeTimer: ReturnType<typeof setInterval> | null = null;
  /** Session « hors ligne » sans jeton valide : on ne parle pas au serveur, tout passe par la copie locale. */
  holdLocal = false;
  onUp: (() => void) | null = null;
  onSynced: ((tables: string[]) => void) | null = null;
  constructor(public env: GatewayEnv) {}

  // ---------- état ----------
  status(): GatewayStatus { return { down: this.down, pending: this.pending, failed: this.failed, syncing: this.syncing, needsLogin: this.needsLogin, lastSync: this.lastSync, prep: this.prep, readyAt: this.readyAt }; }
  subscribe(f: (s: GatewayStatus) => void) { this.subs.add(f); return () => { this.subs.delete(f); }; }
  emit() { const s = this.status(); this.subs.forEach(f => f(s)); }
  async refreshCounts() { const m = await this.env.mirror(); this.pending = (await m.backend.queueAll()).length; this.failed = (await m.backend.failedAll()).length; this.emit(); }
  markDown() {
    if (!this.down) { this.down = true; this.emit(); }
    if (!this.probeTimer && typeof setInterval !== "undefined") this.probeTimer = setInterval(() => void this.probe(), 10000);
  }
  private markUp() {
    if (this.probeTimer) { clearInterval(this.probeTimer); this.probeTimer = null; }
    if (this.down) { this.down = false; this.emit(); this.onUp?.(); }
  }
  /** Teste la connexion ; au retour d'internet, la file est envoyée. */
  async probe(): Promise<boolean> {
    try {
      const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 6000);
      const r = await this.env.real(this.env.healthUrl, { headers: { apikey: this.env.apikey }, signal: ac.signal, cache: "no-store" } as any);
      clearTimeout(t);
      if (r.status >= 500) throw new Error("down");
      this.markUp(); return true;
    } catch { this.markDown(); return false; }
  }

  // ---------- réseau ----------
  async net(input: string, init: RequestInit, ms: number): Promise<Response | null> {
    const ac = new AbortController(); const timer = setTimeout(() => ac.abort(), ms);
    try {
      const r = await this.env.real(input, { ...init, signal: ac.signal });
      if (GATEWAY_CODES.has(r.status)) { this.markDown(); return null; }
      this.markUp(); return r;
    } catch { this.markDown(); return null; } finally { clearTimeout(timer); }
  }

  // ---------- point d'entrée ----------
  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (!url.startsWith(this.env.restPrefix) || typeof input !== "string" && !(input instanceof URL)) return this.env.real(input as any, init);
    const rest = url.slice(this.env.restPrefix.length);
    const table = rest.split("?")[0];
    if (table.startsWith("rpc/")) return this.env.real(input as any, init);
    const method = (init?.method || "GET").toUpperCase();
    const headers = new Headers(init?.headers as HeadersInit);
    if (method === "GET" || method === "HEAD") return this.read(url, table, method, headers, init);
    return this.write(url, table, method, headers, init);
  };

  // ---------- lecture ----------
  private async read(url: string, table: string, method: string, headers: Headers, init?: RequestInit): Promise<Response> {
    if (!this.down && !this.holdLocal) {
      const res = await this.net(url, init ?? {}, this.env.readTimeout ?? 12000);
      if (res) {
        if (method === "GET" && res.ok && !(table !== "app_settings" && headers.get("authorization") === `Bearer ${this.env.apikey}`)) { try { await this.record(table, url, headers, res.clone()); } catch { /* le miroir ne doit jamais casser la lecture */ } }
        return res;
      }
    }
    return this.local(url, table, method, headers);
  }

  private async record(table: string, url: string, headers: Headers, res: Response) {
    const u = new URL(url), q = parseQuery(u.searchParams);
    const text = await res.text(); if (!text) return;
    const data = JSON.parse(text);
    const list: Row[] = Array.isArray(data) ? data : data && typeof data === "object" ? [data] : [];
    if (!list.length && !Array.isArray(data)) return;
    if (list.some(r => !r || typeof r !== "object")) return;
    const m = await this.env.mirror();
    // lignes liées (notes(*), …) : copiées dans leur propre table
    const base: Row[] = [];
    for (const r of list) {
      const b: Row = { ...r };
      for (const it of q.select) {
        if (!it.embed) continue;
        const rel = RELATIONS[table]?.[it.name]; const key = it.alias || it.name;
        const nested = b[key]; delete b[key];
        if (!rel || nested == null) continue;
        const arr = Array.isArray(nested) ? nested : [nested];
        const pk = pkOf(rel.table);
        const usable = arr.filter(x => x && typeof x === "object" && x[pk] !== undefined);
        if (usable.length) await m.upsert(rel.table, usable);
      }
      base.push(b);
    }
    const pk = pkOf(table);
    const withPk = base.filter(r => r[pk] !== undefined);
    if (!withPk.length && base.length) return; // colonnes sans identifiant : on ne sait pas les ranger
    const pend = await this.pendingIds(table);
    const full = withPk.filter(r => !pend.has(String(r[pk])));
    await m.upsert(table, full);
    // lignes supprimées côté serveur : on les retire si la requête n'est pas paginée
    const paged = q.limit !== undefined || q.offset !== undefined || headers.has("range");
    const hasInner = q.select.some(s => s.inner);
    if (!paged && !hasInner && !q.unsupported && Array.isArray(data) && q.select.some(s => s.star || s.name === pk)) {
      const got = new Set(withPk.map(r => String(r[pk])));
      const gone = (await m.rows(table)).filter(r => matches(r, q) && !got.has(String(r[pk])) && !pend.has(String(r[pk]))).map(r => String(r[pk]));
      if (gone.length) await m.remove(table, gone);
    }
  }

  async pendingIds(table: string): Promise<Set<string>> {
    const m = await this.env.mirror(); const out = new Set<string>();
    (await m.backend.queueAll()).forEach(e => { if (e.table === table) (e.ids ?? []).forEach(i => out.add(i)); });
    return out;
  }

  private async tablesFor(table: string, items: SelectItem[], acc: Map<string, Row[]>) {
    const m = await this.env.mirror();
    if (!acc.has(table)) acc.set(table, await m.rows(table));
    for (const it of items) if (it.embed) { const rel = RELATIONS[table]?.[it.name]; if (rel) await this.tablesFor(rel.table, it.embed, acc); }
  }

  private async local(url: string, table: string, method: string, headers: Headers): Promise<Response> {
    const u = new URL(url), q = parseQuery(u.searchParams);
    if (headers.has("range") && q.offset === undefined) { const mm = (headers.get("range") || "").match(/^(\d+)-(\d*)$/); if (mm) { q.offset = Number(mm[1]); if (mm[2]) q.limit = Number(mm[2]) - Number(mm[1]) + 1; } }
    const acc = new Map<string, Row[]>(); await this.tablesFor(table, q.select, acc);
    const { rows, total } = runSelect(table, acc.get(table)!, q, { tableRows: t => acc.get(t) ?? [] });
    return this.shape(rows, total, q.offset ?? 0, headers, method === "HEAD");
  }

  private shape(rows: Row[], total: number, offset: number, headers: Headers, head = false, status = 200): Response {
    const accept = headers.get("accept") || "";
    const h: Record<string, string> = { ...JSON_H };
    if (/count=/.test(headers.get("prefer") || "")) h["content-range"] = rows.length ? `${offset}-${offset + rows.length - 1}/${total}` : `*/${total}`;
    if (accept.includes("vnd.pgrst.object")) {
      if (rows.length !== 1) return new Response(JSON.stringify({ code: "PGRST116", details: `The result contains ${rows.length} rows`, hint: null, message: "JSON object requested, multiple (or no) rows returned" }), { status: 406, headers: h });
      return new Response(head ? null : JSON.stringify(rows[0]), { status, headers: h });
    }
    return new Response(head ? null : JSON.stringify(rows), { status, headers: h });
  }

  // ---------- écriture ----------
  private async write(url: string, table: string, method: string, headers: Headers, init?: RequestInit): Promise<Response> {
    const u = new URL(url), q = parseQuery(u.searchParams);
    const prefer = headers.get("prefer") || "";
    if (init?.body != null && typeof init.body !== "string") return this.env.real(url, init); // corps non JSON : on laisse passer
    let bodyText: string | null = typeof init?.body === "string" ? init.body : null;
    let json: any = bodyText ? JSON.parse(bodyText) : null;
    const upsert = /resolution=(merge|ignore)-duplicates/.test(prefer);
    // Identifiants générés ici pour que l'envoi puisse être refait sans doublon
    if (method === "POST" && !upsert && UUID_TABLES.has(table) && json) {
      const arr = Array.isArray(json) ? json : [json];
      arr.forEach(r => { if (r && r.id === undefined) r.id = this.uuid(); });
      bodyText = JSON.stringify(json);
    }
    if (!this.down && !this.holdLocal) {
      const res = await this.net(url, { ...init, body: bodyText ?? undefined }, this.env.writeTimeout ?? 20000);
      if (res) {
        if (res.ok) { try { await this.afterOnlineWrite(table, method, q, json, prefer, res.clone()); } catch { /* ignore */ } }
        return res;
      }
    }
    // ----- hors ligne : on applique au miroir et on met en file -----
    const m = await this.env.mirror();
    const { rows, body } = await this.apply(m, table, method, q, json, prefer);
    const entry: QueueEntry = {
      ts: (this.env.now ?? Date.now)(), table, method, url,
      headers: Object.fromEntries([...headers.entries()].filter(([k]) => !["authorization", "x-client-info"].includes(k))),
      body: body !== undefined ? JSON.stringify(body) : bodyText, ids: rows.map(r => String(r[pkOf(table)])),
    };
    await m.backend.queueAdd(entry);
    await this.refreshCounts();
    if (/return=representation/.test(prefer)) {
      const acc = new Map<string, Row[]>(); await this.tablesFor(table, q.select, acc);
      const shaped = rows.map(r => project(table, r, q.select, { tableRows: t => acc.get(t) ?? [] })!).filter(Boolean);
      return this.shape(shaped, shaped.length, 0, headers, false, method === "POST" ? 201 : 200);
    }
    return new Response(null, { status: method === "POST" ? 201 : 204, headers: { ...JSON_H } });
  }

  private uuid() { return this.env.uuid ? this.env.uuid() : (globalThis.crypto as any).randomUUID(); }

  /** Applique une écriture au miroir. Renvoie les lignes touchées (après modification) et le corps éventuellement complété. */
  private async apply(m: Mirror, table: string, method: string, q: Query, json: any, prefer: string): Promise<{ rows: Row[]; body?: any }> {
    const now = new Date((this.env.now ?? Date.now)()).toISOString();
    const pk = pkOf(table);
    if (method === "POST") {
      const arr: Row[] = Array.isArray(json) ? json : [json];
      const merge = /resolution=merge-duplicates/.test(prefer), ignore = /resolution=ignore-duplicates/.test(prefer);
      const conflict = q.onConflict.length ? q.onConflict : [pk];
      const existingRows = await m.rows(table);
      const out: Row[] = []; const bodyRows: Row[] = [];
      for (const r of arr) {
        const found = (merge || ignore) ? existingRows.find(e => conflict.every(c => r[c] !== undefined && String(e[c]) === String(r[c]))) : undefined;
        if (found) {
          bodyRows.push(r);
          if (merge) { const [u] = await m.upsert(table, [{ ...found, ...r, [pk]: found[pk] }]); out.push(u); }
          continue;
        }
        const row: Row = { ...r };
        if (UUID_TABLES.has(table) && row[pk] === undefined) row[pk] = this.uuid();
        (NOW_COLUMNS[table] ?? []).forEach(c => { if (row[c] === undefined) row[c] = now; });
        const bodyRow = { ...r }; if (!(merge || ignore) && UUID_TABLES.has(table) && bodyRow[pk] === undefined) bodyRow[pk] = row[pk];
        bodyRows.push(bodyRow);
        const [u] = await m.upsert(table, [row]); out.push(u); existingRows.push(u);
      }
      return { rows: out, body: Array.isArray(json) ? bodyRows : bodyRows[0] };
    }
    const target = (await m.rows(table)).filter(r => matches(r, q));
    if (method === "PATCH") {
      const patch = { ...json }; if ((NOW_COLUMNS[table] ?? []).includes("updated_at") && patch.updated_at === undefined) patch.updated_at = now;
      const out = await m.upsert(table, target.map(r => ({ ...r, ...patch })));
      return { rows: out };
    }
    if (method === "DELETE") { await m.remove(table, target.map(r => String(r[pk]))); return { rows: target }; }
    return { rows: [] };
  }

  private async afterOnlineWrite(table: string, method: string, q: Query, json: any, prefer: string, res: Response) {
    const m = await this.env.mirror();
    const text = /return=representation/.test(prefer) ? await res.text() : "";
    if (method === "DELETE") { const t = (await m.rows(table)).filter(r => matches(r, q)); await m.remove(table, t.map(r => String(r[pkOf(table)]))); return; }
    if (text) { const d = JSON.parse(text); const list = (Array.isArray(d) ? d : [d]).filter((r: any) => r && r[pkOf(table)] !== undefined); await m.upsert(table, list); return; }
    await this.apply(m, table, method, q, json, prefer);
  }

  // ---------- envoi de la file ----------
  async flush(): Promise<{ sent: number; failed: number }> {
    if (this.syncing) return { sent: 0, failed: 0 };
    const m = await this.env.mirror();
    const queue = await m.backend.queueAll();
    if (!queue.length) { await this.refreshCounts(); return { sent: 0, failed: 0 }; }
    const token = await this.env.getToken();
    if (!token) { this.needsLogin = true; this.emit(); return { sent: 0, failed: 0 }; }
    this.needsLogin = false; this.syncing = true; this.emit();
    let sent = 0, failed = 0; const touched = new Set<string>();
    try {
      for (const e of queue.sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
        const res = await this.net(e.url, { method: e.method, headers: { ...e.headers, apikey: this.env.apikey, Authorization: `Bearer ${token}` }, body: e.body ?? undefined }, this.env.writeTimeout ?? 20000);
        if (!res) break; // toujours pas de connexion : on réessaiera
        if (res.ok) { await m.backend.queueRemove(e.id!); sent++; touched.add(e.table); continue; }
        const txt = await res.text(); let code = ""; let msg = txt;
        try { const j = JSON.parse(txt); code = j.code || ""; msg = j.message || txt; } catch { /* ignore */ }
        if (res.status === 409 || code === "23505") { await m.backend.queueRemove(e.id!); sent++; touched.add(e.table); continue; } // déjà enregistré
        if (res.status === 401) { this.needsLogin = true; break; }
        await m.backend.failedAdd({ ts: e.ts, table: e.table, method: e.method, message: `${res.status} ${msg}`.slice(0, 300), body: e.body });
        await m.backend.queueRemove(e.id!); failed++; touched.add(e.table);
      }
    } finally {
      this.syncing = false;
      if (sent || failed) this.lastSync = (this.env.now ?? Date.now)();
      await this.refreshCounts();
    }
    if (sent || failed) this.onSynced?.([...touched]);
    return { sent, failed };
  }
}


/** Copie complète d'une table depuis le serveur (pour préparer le mode hors ligne). Renvoie le nombre de lignes, ou null si indisponible. */
export async function pullTable(gw: Gateway, table: string, token: string | null): Promise<number | null> {
  const env = gw.env, pk = pkOf(table), all: Row[] = [];
  for (let offset = 0; offset < 200000; offset += 1000) {
    const r = await gw.net(`${env.restPrefix}${table}?select=*&order=${pk}.asc&limit=1000&offset=${offset}`,
      { headers: { apikey: env.apikey, Authorization: `Bearer ${token ?? env.apikey}`, accept: "application/json" } }, 30000);
    if (!r) return null;
    if (!r.ok) return null; // table absente ou non autorisée pour ce compte
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  const m = await env.mirror();
  const keep = await gw.pendingIds(table);
  await m.replace(table, all, keep);
  return all.length;
}
