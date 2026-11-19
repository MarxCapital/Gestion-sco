/* Cachet photographié sur une feuille blanche -> PNG transparent (le papier disparaît, l'encre reste en couleur).
   Méthode : estimation de la lumière sur la feuille (par blocs, lissée) puis l'encre = ce qui est plus sombre que la feuille.
   Corrige les ombres et l'éclairage inégal. Sans IA, sans serveur. */
const B = 20;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function stampPixels(src: Uint8ClampedArray, w: number, h: number): { data: Uint8ClampedArray; box: { x0: number; y0: number; x1: number; y1: number } | null } {
  const bw = Math.ceil(w / B), bh = Math.ceil(h / B);
  const bg = new Float32Array(bw * bh * 3), bgL = new Float32Array(bw * bh);
  const lumOf = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  // 1) fond par bloc : moyenne des 20 % de pixels les plus clairs
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const hist = new Uint32Array(256); let n = 0;
    const xe = Math.min(w, (bx + 1) * B), ye = Math.min(h, (by + 1) * B);
    for (let y = by * B; y < ye; y++) for (let x = bx * B; x < xe; x++) { const i = (y * w + x) * 4; hist[Math.round(lumOf(src[i], src[i + 1], src[i + 2]))]++; n++; }
    let acc = 0, T = 255; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= n * 0.2) { T = v; break; } }
    let r = 0, g = 0, b = 0, c = 0;
    for (let y = by * B; y < ye; y++) for (let x = bx * B; x < xe; x++) { const i = (y * w + x) * 4; if (Math.round(lumOf(src[i], src[i + 1], src[i + 2])) >= T) { r += src[i]; g += src[i + 1]; b += src[i + 2]; c++; } }
    const k = (by * bw + bx); bg[k * 3] = r / c; bg[k * 3 + 1] = g / c; bg[k * 3 + 2] = b / c; bgL[k] = lumOf(r / c, g / c, b / c);
  }
  // 2) blocs envahis par l'encre : on prend la couleur de papier globale
  const sorted = [...bgL].sort((a, b) => a - b);
  const paper = sorted[Math.floor(sorted.length * 0.85)] || 255;
  let pr = 0, pg = 0, pb = 0, pc = 0;
  for (let k = 0; k < bgL.length; k++) if (bgL[k] >= paper * 0.97) { pr += bg[k * 3]; pg += bg[k * 3 + 1]; pb += bg[k * 3 + 2]; pc++; }
  pr /= pc || 1; pg /= pc || 1; pb /= pc || 1;
  for (let k = 0; k < bgL.length; k++) if (bgL[k] < paper * 0.72) { bg[k * 3] = pr; bg[k * 3 + 1] = pg; bg[k * 3 + 2] = pb; }
  // 3) lissage 3×3 (deux passes)
  for (let pass = 0; pass < 2; pass++) {
    const cp = bg.slice();
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) for (let ch = 0; ch < 3; ch++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = bx + dx, y = by + dy; if (x >= 0 && y >= 0 && x < bw && y < bh) { s += cp[(y * bw + x) * 3 + ch]; c++; } }
      bg[(by * bw + bx) * 3 + ch] = s / c;
    }
  }
  // 4) pixel par pixel : alpha = « plus sombre que la feuille »
  const out = new Uint8ClampedArray(w * h * 4);
  const bgAt = (x: number, y: number, ch: number) => {
    const fx = Math.min(bw - 1, Math.max(0, x / B - 0.5)), fy = Math.min(bh - 1, Math.max(0, y / B - 0.5));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(bw - 1, x0 + 1), y1 = Math.min(bh - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const g = (xx: number, yy: number) => bg[(yy * bw + xx) * 3 + ch];
    return (g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty) + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty;
  };
  const alphaMap = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const rr = Math.min(1, src[i] / Math.max(1, bgAt(x, y, 0))), rg = Math.min(1, src[i + 1] / Math.max(1, bgAt(x, y, 1))), rb = Math.min(1, src[i + 2] / Math.max(1, bgAt(x, y, 2)));
    const ink = 1 - (0.299 * rr + 0.587 * rg + 0.114 * rb);
    const a = smooth(0.05, 0.3, ink);
    const dark = 1 - 0.25 * a; // encre un peu plus profonde
    out[i] = Math.min(255, rr * 255 * dark); out[i + 1] = Math.min(255, rg * 255 * dark); out[i + 2] = Math.min(255, rb * 255 * dark);
    out[i + 3] = Math.round(a * 255); alphaMap[y * w + x] = out[i + 3];
  }
  // 5) on ne garde que le cachet : les traces isolées (poussières, points noirs, bords de la feuille) sont effacées.
  //    Grille grossière → composantes connexes (liées à ~3 cases) → on garde la plus grosse et celles qui ont une taille comparable.
  const G = 8, gw = Math.ceil(w / G), gh = Math.ceil(h / G);
  const cnt = new Uint32Array(gw * gh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alphaMap[y * w + x] > 90) cnt[Math.floor(y / G) * gw + Math.floor(x / G)]++;
  const on = new Uint8Array(gw * gh);
  for (let k = 0; k < cnt.length; k++) if (cnt[k] >= 3) on[k] = 1;
  const R = 3, comp = new Int32Array(gw * gh).fill(-1), mass: number[] = [];
  for (let k0 = 0; k0 < on.length; k0++) {
    if (!on[k0] || comp[k0] >= 0) continue;
    const id = mass.length; mass.push(0);
    const stack = [k0]; comp[k0] = id;
    while (stack.length) {
      const k = stack.pop()!; mass[id] += cnt[k];
      const cx = k % gw, cy = (k - cx) / gw;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
        const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= gw || y >= gh) continue;
        const n = y * gw + x; if (on[n] && comp[n] < 0) { comp[n] = id; stack.push(n); }
      }
    }
  }
  const biggest = Math.max(0, ...mass);
  const keep = mass.map(m => m >= biggest * 0.12);
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, c = comp[Math.floor(y / G) * gw + Math.floor(x / G)];
    if (c < 0 || !keep[c]) { out[i * 4 + 3] = 0; continue; }
    if (out[i * 4 + 3] > 90) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  // 6) couleur : l'encre d'un cachet est d'une seule teinte. On prend la teinte moyenne des pixels bien encrés
  //    (couleur réelle sur la photo) et on la mélange à celle de chaque pixel : rendu net, vif, sans taches sombres.
  let sr = 0, sg = 0, sb = 0, sc = 0;
  for (let i = 0; i < w * h; i++) if (out[i * 4 + 3] > 200) { sr += src[i * 4]; sg += src[i * 4 + 1]; sb += src[i * 4 + 2]; sc++; }
  if (sc > 20) {
    sr = (sr / sc) * 0.95; sg = (sg / sc) * 0.7; sb = (sb / sc) * 0.78; // un peu plus profond que sur la photo (éclairée)
    const M = 0.75;
    for (let i = 0; i < w * h; i++) if (out[i * 4 + 3] > 0) {
      out[i * 4] = Math.round(out[i * 4] * (1 - M) + sr * M); out[i * 4 + 1] = Math.round(out[i * 4 + 1] * (1 - M) + sg * M); out[i * 4 + 2] = Math.round(out[i * 4 + 2] * (1 - M) + sb * M);
    }
  }
  return { data: out, box: x1 < 0 ? null : { x0, y0, x1, y1 } };
}

export async function extractStamp(file: Blob, maxSide = 1100): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Photo illisible")); i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const { data, box } = stampPixels(ctx.getImageData(0, 0, w, h).data, w, h);
    if (!box) throw new Error("Aucun cachet repéré. Photographiez le cachet bien à plat, sur une feuille blanche, avec de la lumière.");
    const pad = 6, bx0 = Math.max(0, box.x0 - pad), by0 = Math.max(0, box.y0 - pad), bx1 = Math.min(w - 1, box.x1 + pad), by1 = Math.min(h - 1, box.y1 + pad);
    const o = document.createElement("canvas"); o.width = bx1 - bx0 + 1; o.height = by1 - by0 + 1;
    const full = new ImageData(data, w, h);
    const octx = o.getContext("2d")!;
    octx.clearRect(0, 0, o.width, o.height);
    // putImageData ne mélange pas : on recopie la zone utile sur un canvas transparent
    const tmp = document.createElement("canvas"); tmp.width = w; tmp.height = h; tmp.getContext("2d")!.putImageData(full, 0, 0);
    octx.drawImage(tmp, bx0, by0, o.width, o.height, 0, 0, o.width, o.height);
    return await new Promise<Blob>((res, rej) => o.toBlob(b => (b ? res(b) : rej(new Error("Export impossible"))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}
