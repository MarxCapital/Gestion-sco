/* Copie locale (miroir) des données de l'utilisateur + file des modifications faites hors ligne. */
import { pkOf, type Row } from "./postgrest-lite";

export interface QueueEntry { id?: number; ts: number; table: string; method: string; url: string; headers: Record<string, string>; body: string | null; ids?: string[] }
export interface FailedEntry { id?: number; ts: number; table: string; method: string; message: string; body: string | null }

export interface Backend {
  loadTable(table: string): Promise<Row[]>;
  putRows(table: string, rows: Row[]): Promise<void>;
  deleteRows(table: string, ids: string[]): Promise<void>;
  queueAdd(e: QueueEntry): Promise<number>;
  queueAll(): Promise<QueueEntry[]>;
  queueRemove(id: number): Promise<void>;
  failedAdd(e: FailedEntry): Promise<void>;
  failedAll(): Promise<FailedEntry[]>;
  failedClear(): Promise<void>;
  getMeta(k: string): Promise<any>;
  setMeta(k: string, v: any): Promise<void>;
  wipe(): Promise<void>;
}

export class MemoryBackend implements Backend {
  t = new Map<string, Map<string, Row>>(); q: QueueEntry[] = []; f: FailedEntry[] = []; m = new Map<string, any>(); n = 1;
  private tab(t: string) { let x = this.t.get(t); if (!x) this.t.set(t, (x = new Map())); return x; }
  async loadTable(t: string) { return [...this.tab(t).values()].map(r => ({ ...r })); }
  async putRows(t: string, rows: Row[]) { rows.forEach(r => this.tab(t).set(String(r[pkOf(t)]), { ...r })); }
  async deleteRows(t: string, ids: string[]) { ids.forEach(i => this.tab(t).delete(i)); }
  async queueAdd(e: QueueEntry) { const id = this.n++; this.q.push({ ...e, id }); return id; }
  async queueAll() { return this.q.map(e => ({ ...e })); }
  async queueRemove(id: number) { this.q = this.q.filter(e => e.id !== id); }
  async failedAdd(e: FailedEntry) { this.f.push({ ...e, id: this.n++ }); }
  async failedAll() { return [...this.f]; }
  async failedClear() { this.f = []; }
  async getMeta(k: string) { return this.m.get(k); }
  async setMeta(k: string, v: any) { this.m.set(k, v); }
  async wipe() { this.t.clear(); this.q = []; this.f = []; this.m.clear(); }
}

const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export class IdbBackend implements Backend {
  private db: Promise<IDBDatabase>;
  constructor(public name: string) {
    this.db = new Promise((res, rej) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        db.createObjectStore("rows", { keyPath: "k" }).createIndex("table", "table");
        db.createObjectStore("queue", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("failed", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("meta", { keyPath: "key" });
      };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  private async tx(stores: string | string[], mode: IDBTransactionMode) { return (await this.db).transaction(stores, mode); }
  async loadTable(t: string) { const tx = await this.tx("rows", "readonly"); return (await req(tx.objectStore("rows").index("table").getAll(t))).map((x: any) => x.row); }
  async putRows(t: string, rows: Row[]) { if (!rows.length) return; const tx = await this.tx("rows", "readwrite"); const s = tx.objectStore("rows"); rows.forEach(r => s.put({ k: `${t}|${r[pkOf(t)]}`, table: t, row: r })); await done(tx); }
  async deleteRows(t: string, ids: string[]) { if (!ids.length) return; const tx = await this.tx("rows", "readwrite"); const s = tx.objectStore("rows"); ids.forEach(i => s.delete(`${t}|${i}`)); await done(tx); }
  async queueAdd(e: QueueEntry) { const tx = await this.tx("queue", "readwrite"); const k = await req(tx.objectStore("queue").add({ ...e })); await done(tx); return k as number; }
  async queueAll() { const tx = await this.tx("queue", "readonly"); return (await req(tx.objectStore("queue").getAll())) as QueueEntry[]; }
  async queueRemove(id: number) { const tx = await this.tx("queue", "readwrite"); tx.objectStore("queue").delete(id); await done(tx); }
  async failedAdd(e: FailedEntry) { const tx = await this.tx("failed", "readwrite"); tx.objectStore("failed").add({ ...e }); await done(tx); }
  async failedAll() { const tx = await this.tx("failed", "readonly"); return (await req(tx.objectStore("failed").getAll())) as FailedEntry[]; }
  async failedClear() { const tx = await this.tx("failed", "readwrite"); tx.objectStore("failed").clear(); await done(tx); }
  async getMeta(k: string) { const tx = await this.tx("meta", "readonly"); return (await req(tx.objectStore("meta").get(k)))?.value; }
  async setMeta(k: string, v: any) { const tx = await this.tx("meta", "readwrite"); tx.objectStore("meta").put({ key: k, value: v }); await done(tx); }
  async wipe() { const tx = await this.tx(["rows", "queue", "failed", "meta"], "readwrite"); ["rows", "queue", "failed", "meta"].forEach(s => tx.objectStore(s).clear()); await done(tx); }
}

/** Miroir en mémoire adossé à un Backend (chaque modification est écrite sur disque). */
export class Mirror {
  private tables = new Map<string, Map<string, Row>>();
  constructor(public backend: Backend) {}

  async table(name: string): Promise<Map<string, Row>> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      (await this.backend.loadTable(name)).forEach(r => t!.set(String(r[pkOf(name)]), r));
      // une autre lecture a pu charger la table entre-temps
      this.tables.set(name, this.tables.get(name) ?? t);
      t = this.tables.get(name)!;
    }
    return t;
  }
  async rows(name: string): Promise<Row[]> { return [...(await this.table(name)).values()]; }

  async upsert(name: string, rows: Row[], merge = true): Promise<Row[]> {
    const t = await this.table(name), pk = pkOf(name), out: Row[] = [];
    for (const r of rows) {
      const id = String(r[pk]);
      const next = merge && t.has(id) ? { ...t.get(id)!, ...r } : { ...r };
      t.set(id, next); out.push(next);
    }
    await this.backend.putRows(name, out);
    return out;
  }
  async remove(name: string, ids: string[]) { const t = await this.table(name); ids.forEach(i => t.delete(i)); await this.backend.deleteRows(name, ids); }
  /** Remplace tout le contenu d'une table (sauf les lignes protégées : modifications en attente). */
  async replace(name: string, rows: Row[], keep: Set<string> = new Set()) {
    const t = await this.table(name), pk = pkOf(name), fresh = new Set(rows.map(r => String(r[pk])));
    const gone = [...t.keys()].filter(id => !fresh.has(id) && !keep.has(id));
    await this.remove(name, gone);
    await this.upsert(name, rows.filter(r => !keep.has(String(r[pk]))), false);
  }
  async wipe() { this.tables.clear(); await this.backend.wipe(); }
}
