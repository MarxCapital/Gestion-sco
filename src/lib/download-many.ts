/* Téléchargements en masse SANS ZIP : chaque fichier est enregistré un à un sur l'appareil. */

export interface DownloadItem { name: string; get: () => Promise<Blob> | Blob }

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.style.display = "none";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Lance les téléchargements l'un après l'autre (le navigateur peut demander une fois d'autoriser les téléchargements multiples). */
export async function downloadFiles(items: DownloadItem[], onProgress?: (done: number, total: number) => void, gap = 450): Promise<number> {
  let n = 0;
  for (const it of items) {
    saveBlob(await it.get(), it.name);
    onProgress?.(++n, items.length);
    if (n < items.length) await wait(gap);
  }
  return n;
}

/** Évite deux fichiers de même nom : « nom.pdf », « nom_2.pdf »… */
export function uniqueNames<T extends { name: string }>(items: T[]): T[] {
  const used: Record<string, number> = {};
  return items.map(it => {
    const k = it.name.toLowerCase(); used[k] = (used[k] ?? 0) + 1;
    return used[k] === 1 ? it : { ...it, name: it.name.replace(/(\.[^.]+)$/, `_${used[k]}$1`) };
  });
}
