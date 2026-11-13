import { useCallback, useEffect, useRef, useState } from "react";
import { allAssets, deleteAsset, nameKey, putAsset, type AssetKind, type AssetRec } from "@/lib/photo-library";

/** Signature du directeur, cachet et signatures des apprenants d'une école (mémorisés sur l'appareil). */
export function useCarteAssets(scope: string) {
  const [recs, setRecs] = useState<AssetRec[]>([]);
  const urls = useRef(new Map<string, string>());
  useEffect(() => { let on = true; setRecs([]); allAssets(scope).then(r => { if (on) setRecs(r); }); return () => { on = false; }; }, [scope]);
  useEffect(() => () => { urls.current.forEach(u => URL.revokeObjectURL(u)); urls.current.clear(); }, []);
  const urlOf = (r?: AssetRec) => {
    if (!r) return undefined;
    const k = r.id + "@" + r.savedAt;
    let u = urls.current.get(k);
    if (!u) { u = URL.createObjectURL(r.blob); urls.current.set(k, u); }
    return u;
  };
  const find = (kind: AssetKind, key = "") => recs.find(r => r.kind === kind && r.key === key);
  const save = useCallback(async (kind: AssetKind, key: string, blob: Blob) => {
    const rec = await putAsset(scope, kind, key, blob);
    setRecs(a => [...a.filter(x => x.id !== rec.id), rec]);
  }, [scope]);
  const remove = useCallback(async (kind: AssetKind, key = "") => {
    await deleteAsset(scope, kind, key);
    setRecs(a => a.filter(x => !(x.kind === kind && x.key === key)));
  }, [scope]);
  return {
    directorSignature: urlOf(find("dirsig")),
    stamp: urlOf(find("stamp")),
    studentSignature: (nom: string, prenoms: string) => urlOf(find("sig", nameKey(nom, prenoms))),
    saveDirectorSignature: (b: Blob) => save("dirsig", "", b),
    saveStamp: (b: Blob) => save("stamp", "", b),
    saveStudentSignature: (nom: string, prenoms: string, b: Blob) => save("sig", nameKey(nom, prenoms), b),
    removeDirectorSignature: () => remove("dirsig"),
    removeStamp: () => remove("stamp"),
    removeStudentSignature: (nom: string, prenoms: string) => remove("sig", nameKey(nom, prenoms)),
  };
}
