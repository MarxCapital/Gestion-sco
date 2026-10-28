import { getJSZip } from "@/lib/cm2-tools";

export const IMG_RE = /\.(jpe?g|png|webp|jfif)$/i;

/** Déplie les ZIP en images ; les autres fichiers image sont gardés tels quels. */
export async function expandPhotos(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type === "application/zip" || f.type === "application/x-zip-compressed") {
      const JSZip = await getJSZip();
      const zip = await JSZip.loadAsync(await f.arrayBuffer());
      for (const e of Object.values(zip.files) as any[]) {
        const base = String(e.name).split("/").pop() as string;
        if (e.dir || String(e.name).startsWith("__MACOSX/") || base.startsWith(".") || !IMG_RE.test(base)) continue;
        const blob: Blob = await e.async("blob");
        out.push(new File([blob], base, { type: /png$/i.test(base) ? "image/png" : "image/jpeg" }));
      }
    } else if (IMG_RE.test(f.name) || f.type.startsWith("image/")) out.push(f);
  }
  return out;
}
