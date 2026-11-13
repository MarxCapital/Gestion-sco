/* Bibliothèque de photos des apprenants.
   Dès qu'une photo est rattachée à un apprenant (renommage, import groupé, ajout individuel), elle est gardée ici,
   dans le navigateur (IndexedDB), avec le lien nom + prénoms (et matricule). Elle est ensuite retrouvée toute seule
   pour la fiche scolaire, la fiche d'inscription et la carte, sans réimporter. Aucun serveur, aucune IA. */
import { compact } from "@/lib/cep-inscription";
import type { ListMap, ListRow } from "@/lib/cm2-tools";

export interface PhotoRec {
  id: string;        // `${scope}|${nameKey}`
  scope: string;     // identifiant de l'école (ou "local")
  nameKey: string;   // nom + prénoms, sans accents ni espaces
  mat: string;
  nom: string;
  prenoms: string;
  blob: Blob;        // JPEG normalisé
  savedAt: number;
}
export interface RosterRec { id: string; scope: string; year: string; headers: string[]; rows: ListRow[]; map: ListMap; savedAt: number }

export const nameKey = (nom: string, prenoms: string) => compact(nom + prenoms);
export const photoId = (scope: string, nk: string) => `${scope}|${nk}`;

const DB = "gestionsco-photos";
let dbp: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 2);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains("photos")) {
          const p = db.createObjectStore("photos", { keyPath: "id" });
          p.createIndex("scope", "scope");
        }
        if (!db.objectStoreNames.contains("rosters")) db.createObjectStore("rosters", { keyPath: "id" });
        if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" }).createIndex("scope", "scope");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => { dbp = null; rej(r.error); };
    });
  }
  return dbp;
}
const wrap = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function store(name: "photos" | "rosters" | "assets", mode: IDBTransactionMode) { return (await open()).transaction(name, mode).objectStore(name); }

/** Demande au navigateur de ne pas effacer ces données automatiquement (sans effet s'il refuse). */
export async function keepStorage() { try { await navigator.storage?.persist?.(); } catch { /* ignore */ } }

export const isAvailable = () => typeof indexedDB !== "undefined";

// ---------- Photos ----------
export async function allPhotos(scope: string): Promise<PhotoRec[]> {
  if (!isAvailable()) return [];
  try { return await wrap((await store("photos", "readonly")).index("scope").getAll(scope)); } catch { return []; }
}
export async function putPhoto(scope: string, who: { nom: string; prenoms: string; mat?: string }, blob: Blob): Promise<PhotoRec> {
  const nk = nameKey(who.nom, who.prenoms);
  const rec: PhotoRec = { id: photoId(scope, nk), scope, nameKey: nk, mat: who.mat ?? "", nom: who.nom, prenoms: who.prenoms, blob, savedAt: Date.now() };
  await wrap((await store("photos", "readwrite")).put(rec));
  keepStorage();
  return rec;
}
export async function deletePhoto(scope: string, nk: string) { await wrap((await store("photos", "readwrite")).delete(photoId(scope, nk))); }
export async function clearPhotos(scope: string) { for (const r of await allPhotos(scope)) await deletePhoto(scope, r.nameKey); }

/** Retrouve la photo d'un apprenant : d'abord par nom + prénoms, sinon par matricule. */
export function findPhoto(recs: PhotoRec[], who: { nom: string; prenoms: string; mat?: string }): PhotoRec | undefined {
  const nk = nameKey(who.nom, who.prenoms);
  const byName = nk ? recs.find(r => r.nameKey === nk) : undefined;
  if (byName) return byName;
  const mat = (who.mat ?? "").trim();
  return mat ? recs.find(r => r.mat && r.mat === mat) : undefined;
}

export function recFile(r: PhotoRec): File {
  const f = (s: string) => s.trim().replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "-");
  return new File([r.blob], `${f(r.nom)}_${f(r.prenoms)}_.jpg`, { type: "image/jpeg", lastModified: r.savedAt });
}

/** Photo -> JPEG léger (côté long 640 px max), orientation corrigée. */
export async function normalizePhoto(file: Blob, maxSide = 640): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Image illisible")); i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("Conversion impossible"))), "image/jpeg", 0.9));
  } finally { URL.revokeObjectURL(url); }
}

// ---------- Signatures et cachet (PNG transparents) ----------
export type AssetKind = "dirsig" | "stamp" | "sig"; // signature du directeur, cachet, signature d'un apprenant
export interface AssetRec { id: string; scope: string; kind: AssetKind; key: string; blob: Blob; savedAt: number }
const assetId = (scope: string, kind: AssetKind, key: string) => `${scope}|${kind}|${key}`;
export async function allAssets(scope: string): Promise<AssetRec[]> {
  if (!isAvailable()) return [];
  try { return await wrap((await store("assets", "readonly")).index("scope").getAll(scope)); } catch { return []; }
}
export async function putAsset(scope: string, kind: AssetKind, key: string, blob: Blob): Promise<AssetRec> {
  const rec: AssetRec = { id: assetId(scope, kind, key), scope, kind, key, blob, savedAt: Date.now() };
  await wrap((await store("assets", "readwrite")).put(rec));
  keepStorage();
  return rec;
}
export async function deleteAsset(scope: string, kind: AssetKind, key: string) { await wrap((await store("assets", "readwrite")).delete(assetId(scope, kind, key))); }

// ---------- Liste des apprenants (pour la retrouver sans réimporter) ----------
export async function saveRoster(scope: string, year: string, d: { headers: string[]; rows: ListRow[]; map: ListMap }) {
  if (!isAvailable()) return;
  try { await wrap((await store("rosters", "readwrite")).put({ id: `${scope}|${year}`, scope, year, ...d, savedAt: Date.now() } as RosterRec)); keepStorage(); } catch { /* ignore */ }
}
export async function loadRoster(scope: string, year: string): Promise<RosterRec | null> {
  if (!isAvailable()) return null;
  try { return (await wrap((await store("rosters", "readonly")).get(`${scope}|${year}`))) ?? null; } catch { return null; }
}
export async function clearRoster(scope: string, year: string) { try { await wrap((await store("rosters", "readwrite")).delete(`${scope}|${year}`)); } catch { /* ignore */ } }

// ---------- Sauvegarde / restauration (ZIP : photos nom_prenoms_.jpg + index) ----------
export async function exportBackup(scope: string, JSZipCtor: any): Promise<{ blob: Blob; count: number }> {
  const recs = await allPhotos(scope);
  const zip = new JSZipCtor();
  const index: { file: string; nom: string; prenoms: string; mat: string }[] = [];
  const used = new Set<string>();
  for (const r of recs) {
    let name = recFile(r).name;
    while (used.has(name)) name = name.replace(/_\.jpg$/, "_2_.jpg");
    used.add(name);
    zip.file(name, r.blob);
    index.push({ file: name, nom: r.nom, prenoms: r.prenoms, mat: r.mat });
  }
  const assets = await allAssets(scope);
  const aidx = assets.map((a, i) => { const file = `assets/${i}_${a.kind}.png`; zip.file(file, a.blob); return { file, kind: a.kind, key: a.key }; });
  zip.file("bibliotheque.json", JSON.stringify({ version: 2, photos: index, assets: aidx }));
  return { blob: (await zip.generateAsync({ type: "blob" })) as Blob, count: recs.length + assets.length };
}
export async function importBackup(scope: string, file: Blob, JSZipCtor: any): Promise<number> {
  const zip = await JSZipCtor.loadAsync(file);
  const idx = zip.file("bibliotheque.json");
  if (!idx) throw new Error("Ce fichier n'est pas une sauvegarde de photos.");
  const { photos, assets } = JSON.parse(await idx.async("string")) as { photos: { file: string; nom: string; prenoms: string; mat: string }[]; assets?: { file: string; kind: AssetKind; key: string }[] };
  let n = 0;
  for (const p of photos) {
    const f = zip.file(p.file);
    if (!f) continue;
    await putPhoto(scope, p, new Blob([await f.async("arraybuffer")], { type: "image/jpeg" }));
    n++;
  }
  for (const a of assets ?? []) {
    const f = zip.file(a.file);
    if (f) { await putAsset(scope, a.kind, a.key, new Blob([await f.async("arraybuffer")], { type: "image/png" })); n++; }
  }
  return n;
}

export async function clearAssets(scope: string) { for (const a of await allAssets(scope)) await deleteAsset(scope, a.kind, a.key); }
