/* Branchement de la passerelle hors ligne dans l'application. */
import { Gateway, pullTable } from "./gateway";
import { IdbBackend, MemoryBackend, Mirror } from "./mirror";
import { tablesForRole } from "./prefetch";
import { SUPABASE_STORAGE_KEY, isAdminMode } from "@/lib/app-mode";

const UID_KEY = `gestionsco.offline.uid.${isAdminMode ? "adm" : "cli"}`;

/** Compte dont les données sont utilisées : session Supabase, sinon session « hors ligne » locale, sinon public. */
export function currentScope(): string {
  try {
    const raw = localStorage.getItem(SUPABASE_STORAGE_KEY);
    const uid = raw ? JSON.parse(raw)?.user?.id : null;
    if (uid) return uid;
  } catch { /* ignore */ }
  try { return localStorage.getItem(UID_KEY) || "anon"; } catch { return "anon"; }
}
export const setOfflineUid = (uid: string | null) => { try { uid ? localStorage.setItem(UID_KEY, uid) : localStorage.removeItem(UID_KEY); } catch { /* ignore */ } };
export const getOfflineUid = () => { try { return localStorage.getItem(UID_KEY); } catch { return null; } };

const mirrors = new Map<string, Mirror>();
export function mirrorFor(scope: string): Mirror {
  let m = mirrors.get(scope);
  if (!m) {
    const backend = typeof indexedDB !== "undefined" ? new IdbBackend(`gestionsco-mirror-${isAdminMode ? "adm" : "cli"}-${scope}`) : new MemoryBackend();
    m = new Mirror(backend); mirrors.set(scope, m);
  }
  return m;
}

let tokenProvider: () => Promise<string | null> = async () => null;
export const setTokenProvider = (f: () => Promise<string | null>) => { tokenProvider = f; };

export function makeGateway(url: string, apikey: string): Gateway {
  const original: typeof fetch = window.fetch.bind(window);
  const real: typeof fetch = (...a) => original(...a);
  const gw = new Gateway({
    real, restPrefix: `${url}/rest/v1/`, healthUrl: `${url}/auth/v1/health`, apikey,
    mirror: async () => mirrorFor(currentScope()), getToken: () => tokenProvider(),
  });
  if (typeof window !== "undefined") {
    // Les fonctions serveur (création de comptes, extraction PDF…) exigent internet : message clair plutôt qu'une erreur réseau.
    window.fetch = (async (input: any, init?: any) => {
      const u = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? "";
      if (u.includes("/functions/v1/") && (gw.down || !navigator.onLine)) {
        const msg = "Cette action nécessite une connexion internet.";
        return new Response(JSON.stringify({ error: msg, message: msg }), { status: 503, headers: { "content-type": "application/json" } });
      }
      return original(input, init);
    }) as typeof fetch;
    window.addEventListener("online", () => void gw.probe());
    window.addEventListener("offline", () => { gw.markDown(); });
    if (!navigator.onLine) gw.markDown();
    void gw.refreshCounts().catch(() => {});
    gw.onUp = () => { void (async () => { await gw.flush(); window.dispatchEvent(new Event("gestionsco:online")); })(); };
    gw.onSynced = (tables) => { void (async () => {
      try { const tok = await tokenProvider(); for (const t of tables) await pullTable(gw, t, tok); } catch { /* ignore */ }
      window.dispatchEvent(new Event("gestionsco:synced"));
    })(); };
  }
  return gw;
}

/** Copie sur l'appareil tout ce dont le compte a besoin pour fonctionner sans internet. */
export async function prepareOffline(gw: Gateway, role: string | null | undefined, force = false) {
  if (gw.down || gw.prep) return;
  const m = mirrorFor(currentScope());
  const last = (await m.backend.getMeta("readyAt")) as number | undefined;
  gw.readyAt = last ?? 0;
  if (!force && last && Date.now() - last < 3 * 60 * 1000) { gw.emit(); return; }
  const tables = tablesForRole(role);
  const token = await tokenProvider();
  gw.prep = { done: 0, total: tables.length }; gw.emit();
  let ok = 0;
  for (const t of tables) {
    const n = await pullTable(gw, t, token);
    if (n !== null) ok++;
    gw.prep = { done: gw.prep!.done + 1, total: tables.length }; gw.emit();
    if (gw.down) break;
  }
  gw.prep = null;
  if (!gw.down) void import("@/lib/cm2-tools").then(m => m.warmLibs()).catch(() => {});
  if (ok === tables.length || ok > 0 && !gw.down) { gw.readyAt = Date.now(); await m.backend.setMeta("readyAt", gw.readyAt); }
  gw.emit();
}
