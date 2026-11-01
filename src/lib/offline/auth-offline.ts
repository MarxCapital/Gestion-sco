/* Connexion hors ligne : après une première connexion réussie en ligne, l'appareil retient (de façon
   chiffrée, PBKDF2) l'identifiant + mot de passe et une copie du profil, pour pouvoir rouvrir la session sans internet. */
import { isAdminMode } from "@/lib/app-mode";

const KEY = `gestionsco.offauth.${isAdminMode ? "adm" : "cli"}`;
const ACTIVE = `gestionsco.offactive.${isAdminMode ? "adm" : "cli"}`;
const ITER = 60000;

export interface OfflineSnapshot { uid: string; email: string; profile: any; role: string | null }
interface Record { salt: string; hash: string; uid: string }

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const normId = (id: string) => id.toLowerCase().replace(/\s+/g, "");

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations: ITER }, key, 256);
  return b64(new Uint8Array(bits));
}
function load(): { [id: string]: Record } { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
function save(o: { [id: string]: Record }) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* ignore */ } }

/** Mot de passe gardé en mémoire seulement (jamais écrit en clair) pour se reconnecter en silence au retour d'internet. */
let memPassword: { id: string; pw: string } | null = null;
export const getMemPassword = () => memPassword;
export const setMemPassword = (id: string, pw: string) => { memPassword = { id: normId(id), pw }; };
export const clearMemPassword = () => { memPassword = null; };

const SNAPS = `${KEY}.snaps`;
function loadSnaps(): { [uid: string]: OfflineSnapshot } { try { return JSON.parse(localStorage.getItem(SNAPS) || "{}"); } catch { return {}; } }
/** Copie du profil et du rôle (sans mot de passe généré) pour rouvrir la session sans internet. */
export function saveSnapshot(snap: OfflineSnapshot) {
  const { generated_password: _g, ...profile } = (snap.profile ?? {}) as any;
  try { const o = loadSnaps(); o[snap.uid] = { ...snap, profile: snap.profile ? profile : null }; localStorage.setItem(SNAPS, JSON.stringify(o)); } catch { /* ignore */ }
}
export function snapshotForUid(uid: string): OfflineSnapshot | null { return loadSnaps()[uid] ?? null; }

export async function rememberCredentials(identifier: string, password: string, snap: OfflineSnapshot) {
  try {
    const id = normId(identifier), o = load();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    o[id] = { salt: b64(salt), hash: await derive(password, salt), uid: snap.uid };
    save(o); saveSnapshot(snap);
  } catch { /* crypto indisponible : pas de connexion hors ligne */ }
}
export const hasOfflineAccount = (identifier: string) => !!load()[normId(identifier)];

export async function verifyCredentials(identifier: string, password: string): Promise<OfflineSnapshot | null> {
  const r = load()[normId(identifier)]; if (!r) return null;
  try { return (await derive(password, unb64(r.salt))) === r.hash ? snapshotForUid(r.uid) : null; } catch { return null; }
}

export const setActiveOffline = (uid: string | null) => { try { uid ? localStorage.setItem(ACTIVE, uid) : localStorage.removeItem(ACTIVE); } catch { /* ignore */ } };
export const getActiveOffline = (): OfflineSnapshot | null => { try { const u = localStorage.getItem(ACTIVE); return u ? snapshotForUid(u) : null; } catch { return null; } };

export function offlineUser(s: OfflineSnapshot): any {
  return { id: s.uid, aud: "authenticated", role: "authenticated", email: s.email, app_metadata: {}, user_metadata: {}, created_at: new Date(0).toISOString() };
}

/** L'erreur vient-elle d'un manque de connexion (et non d'un mauvais mot de passe) ? */
export function isNetworkError(e: any): boolean {
  const n = `${e?.name ?? ""} ${e?.message ?? ""}`;
  return /AuthRetryableFetchError|Failed to fetch|NetworkError|Load failed|network|timeout/i.test(n) || e?.status === 0 || (typeof e?.status === "number" && e.status >= 500);
}
