import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Candidate } from "@/lib/cep-inscription";
import { allPhotos, clearPhotos, deletePhoto, findPhoto, normalizePhoto, putPhoto, recFile, type PhotoRec } from "@/lib/photo-library";

/** Photos mémorisées d'une école, rattachées aux apprenants de la liste courante (par nom + prénoms, sinon matricule). */
export function usePhotoBook(scope: string, cands: Candidate[]) {
  const [recs, setRecs] = useState<PhotoRec[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(0);
  const files = useRef(new Map<string, File>());

  const refresh = useCallback(async () => { setRecs(await allPhotos(scope)); setLoaded(true); }, [scope]);
  useEffect(() => { setLoaded(false); setRecs([]); files.current.clear(); refresh(); }, [refresh]);

  const fileOf = (r: PhotoRec) => {
    const k = r.id + "@" + r.savedAt;
    let f = files.current.get(k);
    if (!f) { f = recFile(r); files.current.set(k, f); }
    return f;
  };

  /** Photo de chaque apprenant de la liste (clé = Candidate.key). */
  const photos = useMemo(() => {
    const out: Record<string, File> = {};
    cands.forEach(c => { const r = findPhoto(recs, c); if (r) out[c.key] = fileOf(r); });
    return out;
  }, [recs, cands]); // eslint-disable-line react-hooks/exhaustive-deps
  const photosRef = useRef(photos); photosRef.current = photos;
  const candsRef = useRef(cands); candsRef.current = cands;

  const upsert = (rec: PhotoRec) => setRecs(a => [...a.filter(x => x.id !== rec.id), rec]);

  /** Mémorise une photo pour un apprenant (normalisée en JPEG). */
  const put = useCallback(async (c: Candidate, file: Blob) => {
    setBusy(n => n + 1);
    try { upsert(await putPhoto(scope, c, await normalizePhoto(file))); }
    finally { setBusy(n => n - 1); }
  }, [scope]);

  const putMany = useCallback(async (pairs: { cand: Candidate; file: Blob }[]) => {
    let ok = 0, ko = 0;
    for (const p of pairs) { try { await put(p.cand, p.file); ok++; } catch { ko++; } }
    return { ok, ko };
  }, [put]);

  const remove = useCallback(async (c: Candidate) => {
    const r = findPhoto(recs, c);
    if (!r) return;
    await deletePhoto(scope, r.nameKey);
    setRecs(a => a.filter(x => x.id !== r.id));
  }, [scope, recs]);

  const clear = useCallback(async () => { await clearPhotos(scope); setRecs([]); }, [scope]);

  /** Adaptateur pour les composants qui gèrent un Record<clé, File> : tout changement est mémorisé. */
  const setPhotos = useCallback((up: (p: Record<string, File>) => Record<string, File>) => {
    const prev = photosRef.current, next = up(prev);
    const byKey = new Map(candsRef.current.map(c => [c.key, c] as const));
    Object.keys(next).forEach(k => { const c = byKey.get(k); if (c && next[k] !== prev[k]) put(c, next[k]).catch(() => {}); });
    Object.keys(prev).forEach(k => { const c = byKey.get(k); if (c && !(k in next)) remove(c).catch(() => {}); });
  }, [put, remove]);

  return { photos, setPhotos, put, putMany, remove, clear, refresh, loaded, busy: busy > 0, total: recs.length, matched: Object.keys(photos).length };
}
