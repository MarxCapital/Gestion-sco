import { describe, it, expect } from "vitest";
import { Gateway } from "@/lib/offline/gateway";
import { MemoryBackend, Mirror } from "@/lib/offline/mirror";
import { parseQuery, runSelect, type Row } from "@/lib/offline/postgrest-lite";

const BASE = "https://x.supabase.co/rest/v1/";
let seq = 0;

/** Faux serveur PostgREST (mêmes fonctions de filtre que l'app, c'est l'enveloppe réseau qui est testée). */
function makeServer(seed: Record<string, Row[]>) {
  const db: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const s = { online: true, calls: [] as string[], db, token: "T" };
  const real = (async (input: any, init: any = {}) => {
    if (!s.online) throw new TypeError("Failed to fetch");
    const url = String(input), method = (init.method || "GET").toUpperCase();
    if (url.includes("/auth/v1/health")) return new Response("{}", { status: 200 });
    s.calls.push(method + " " + url.replace(BASE, ""));
    if ((init.headers?.Authorization || init.headers?.authorization) && !String(init.headers.Authorization || init.headers.authorization).includes(s.token)) return new Response(JSON.stringify({ message: "JWT expired" }), { status: 401 });
    const u = new URL(url), table = u.pathname.split("/rest/v1/")[1], q = parseQuery(u.searchParams);
    const rows = db[table] ?? (db[table] = []);
    if (method === "GET") {
      const { rows: r } = runSelect(table, rows, q, { tableRows: t => db[t] ?? [] });
      const accept = (init.headers instanceof Headers ? init.headers.get("accept") : init.headers?.accept) || "";
      return new Response(JSON.stringify(accept.includes("vnd.pgrst.object") ? r[0] : r), { status: 200, headers: { "content-type": "application/json" } });
    }
    const body = init.body ? JSON.parse(init.body) : null;
    if (method === "POST") {
      const arr = Array.isArray(body) ? body : [body];
      for (const r of arr) { if (rows.some(x => x.id === r.id)) return new Response(JSON.stringify({ code: "23505", message: "duplicate" }), { status: 409 }); rows.push({ ...r }); }
      return new Response(null, { status: 201 });
    }
    if (method === "PATCH") { rows.forEach(r => { if (q.filters.every(f => String(r[f.col]) === f.val.replace(/^eq\./, ""))) Object.assign(r, body); }); return new Response(null, { status: 204 }); }
    if (method === "DELETE") { db[table] = rows.filter(r => !q.filters.every(f => String(r[f.col]) === f.val)); return new Response(null, { status: 204 }); }
    return new Response(null, { status: 400 });
  }) as typeof fetch;
  return { s, real };
}

function make(seed: Record<string, Row[]>) {
  const { s, real } = makeServer(seed);
  const mirror = new Mirror(new MemoryBackend());
  const gw = new Gateway({ real, restPrefix: BASE, healthUrl: "https://x.supabase.co/auth/v1/health", apikey: "k", mirror: async () => mirror, getToken: async () => s.token, uuid: () => "id-" + ++seq, readTimeout: 50, writeTimeout: 50 });
  const get = async (path: string, accept = "application/json") => { const r = await gw.fetch(BASE + path, { headers: { accept } }); return { status: r.status, body: r.status === 204 ? null : await r.json() }; };
  const post = (table: string, body: any, prefer = "return=representation") => gw.fetch(BASE + table + (prefer.includes("merge") ? "?on_conflict=candidate_id" : ""), { method: "POST", headers: { prefer, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { s, gw, mirror, get, post };
}

const seed = {
  candidates: [
    { id: "c1", nom: "ADJO", prenoms: "Paul", school_year: "2026-2027", center_id: "u1", is_absent: false },
    { id: "c2", nom: "BIO", prenoms: "Awa", school_year: "2026-2027", center_id: "u1", is_absent: false },
    { id: "c3", nom: "ZED", prenoms: "X", school_year: "2025-2026", center_id: "u1", is_absent: false },
  ],
  notes: [{ id: "n1", candidate_id: "c1", dictee: 12 }],
};

describe("hors ligne : lecture", () => {
  it("copie les données reçues puis les rend sans internet (filtres, tri, jointure, single)", async () => {
    const t = make(seed);
    const online = await t.get("candidates?select=*,notes(*)&school_year=eq.2026-2027&center_id=eq.u1&order=nom.asc");
    expect(online.body.length).toBe(2);
    t.s.online = false;
    const off = await t.get("candidates?select=*,notes(*)&school_year=eq.2026-2027&center_id=eq.u1&order=nom.asc");
    expect(off.body.map((r: any) => r.nom)).toEqual(["ADJO", "BIO"]);
    expect(off.body[0].notes.dictee).toBe(12);
    expect(off.body[1].notes).toBe(null);
    const one = await t.get("candidates?select=*&id=eq.c2", "application/vnd.pgrst.object+json");
    expect(one.body.nom).toBe("BIO");
    const none = await t.get("candidates?select=*&id=eq.zzz", "application/vnd.pgrst.object+json");
    expect(none.status).toBe(406);
    expect(t.gw.status().down).toBe(true);
  });
  it("retire les lignes supprimées côté serveur quand on est de retour en ligne", async () => {
    const t = make(seed);
    await t.get("candidates?select=*&school_year=eq.2026-2027");
    t.s.db.candidates = t.s.db.candidates.filter(r => r.id !== "c2");
    await t.get("candidates?select=*&school_year=eq.2026-2027");
    t.s.online = false;
    expect((await t.get("candidates?select=*&school_year=eq.2026-2027")).body.length).toBe(1);
  });
});

describe("hors ligne : écriture", () => {
  it("met en file, montre le résultat tout de suite, puis envoie au retour d'internet", async () => {
    const t = make(seed);
    await t.get("candidates?select=*&school_year=eq.2026-2027");
    t.s.online = false;
    const r = await t.post("candidates", { nom: "NEW", prenoms: "Z", school_year: "2026-2027", center_id: "u1" });
    expect(r.status).toBe(201);
    const created = (await r.json())[0];
    expect(typeof created.id).toBe("string");
    await t.gw.fetch(BASE + "candidates?id=eq.c1", { method: "PATCH", headers: { prefer: "return=minimal", "content-type": "application/json" }, body: JSON.stringify({ is_absent: true }) });
    await t.gw.fetch(BASE + "candidates?id=eq.c2", { method: "DELETE", headers: {} });
    const view = (await t.get("candidates?select=*&school_year=eq.2026-2027&order=nom.asc")).body;
    expect(view.map((x: any) => x.nom)).toEqual(["ADJO", "NEW"]);
    expect(view[0].is_absent).toBe(true);
    expect(t.gw.status().pending).toBe(3);
    expect(t.s.db.candidates.length).toBe(3); // le serveur n'a encore rien reçu
    t.s.online = true;
    const res = await t.gw.flush();
    expect(res.sent).toBe(3);
    expect(t.s.db.candidates.map(x => x.nom).sort()).toEqual(["ADJO", "NEW", "ZED"]);
    expect(t.s.db.candidates.find(x => x.id === "c1")!.is_absent).toBe(true);
    expect(t.s.db.candidates.find(x => x.id === created.id)).toBeTruthy();
    expect(t.gw.status().pending).toBe(0);
  });
  it("upsert hors ligne (notes par candidat) : une seule ligne, pas de doublon", async () => {
    const t = make(seed);
    await t.get("notes?select=*");
    t.s.online = false;
    await t.post("notes", { candidate_id: "c1", dictee: 15 }, "resolution=merge-duplicates");
    await t.post("notes", { candidate_id: "c2", dictee: 9 }, "resolution=merge-duplicates");
    const v = (await t.get("notes?select=*&order=candidate_id.asc")).body;
    expect(v.length).toBe(2);
    expect(v[0].dictee).toBe(15);
    expect(v[0].id).toBe("n1");
  });
  it("une écriture déjà reçue par le serveur (doublon 409) ne bloque pas la file", async () => {
    const t = make(seed);
    t.s.online = false;
    await t.post("candidates", { id: "dup", nom: "D" });
    t.s.db.candidates.push({ id: "dup", nom: "D" });
    t.s.online = true;
    const res = await t.gw.flush();
    expect(res.sent).toBe(1);
    expect(t.gw.status().failed).toBe(0);
  });
  it("garde la file si la connexion revient puis retombe, et demande de se reconnecter sans jeton", async () => {
    const t = make(seed);
    t.s.online = false;
    await t.post("candidates", { nom: "A" }); await t.post("candidates", { nom: "B" });
    const r = await t.gw.flush(); // toujours hors ligne
    expect(r.sent).toBe(0);
    expect(t.gw.status().pending).toBe(2);
    (t.gw.env as any).getToken = async () => null;
    t.s.online = true;
    await t.gw.flush();
    expect(t.gw.status().needsLogin).toBe(true);
    expect(t.gw.status().pending).toBe(2);
  });
});
