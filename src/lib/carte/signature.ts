/* Signature manuscrite (bleu) : points mémorisés en coordonnées logiques 600×300, export PNG transparent recadré. */
export const SIG_W = 600;
export const SIG_H = 300;
export const SIG_COLOR = "#0b3bd9";
export const SIG_LINE = 3.4;
export type Pt = { x: number; y: number };
export type Stroke = Pt[];
interface RectLike { left: number; top: number; right: number; width: number; height: number }

/** Position du doigt -> coordonnées logiques. `rot` : le rectangle est tourné de 90° (sens horaire) sur l'écran. */
export function toLogical(cx: number, cy: number, r: RectLike, rot: boolean): Pt {
  if (!rot) return { x: ((cx - r.left) / r.width) * SIG_W, y: ((cy - r.top) / r.height) * SIG_H };
  return { x: ((cy - r.top) / r.height) * SIG_W, y: ((r.right - cx) / r.width) * SIG_H };
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number, color = SIG_COLOR, line = SIG_LINE) {
  ctx.strokeStyle = color; ctx.fillStyle = color;
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = line * scale;
  for (const s of strokes) {
    if (!s.length) continue;
    if (s.length < 3) {
      ctx.beginPath(); ctx.arc(s[0].x * scale, s[0].y * scale, (line * scale) / 2, 0, Math.PI * 2); ctx.fill();
      if (s.length === 2) { ctx.beginPath(); ctx.moveTo(s[0].x * scale, s[0].y * scale); ctx.lineTo(s[1].x * scale, s[1].y * scale); ctx.stroke(); }
      continue;
    }
    ctx.beginPath(); ctx.moveTo(s[0].x * scale, s[0].y * scale);
    for (let i = 1; i < s.length - 1; i++) {
      const mx = (s[i].x + s[i + 1].x) / 2, my = (s[i].y + s[i + 1].y) / 2;
      ctx.quadraticCurveTo(s[i].x * scale, s[i].y * scale, mx * scale, my * scale);
    }
    const l = s[s.length - 1]; ctx.lineTo(l.x * scale, l.y * scale); ctx.stroke();
  }
}

export const hasInk = (strokes: Stroke[]) => strokes.some(s => s.length > 0);

/** PNG transparent, tracé bleu, recadré sur la signature (marge incluse). */
export function strokesToBlob(strokes: Stroke[], out = 3): Promise<Blob | null> {
  if (!hasInk(strokes)) return Promise.resolve(null);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  strokes.forEach(s => s.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }));
  const pad = SIG_LINE * 3 + 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(SIG_W, x1 + pad); y1 = Math.min(SIG_H, y1 + pad);
  // Sur la carte la signature est réduite : on épaissit le trait pour qu'il reste bien visible une fois imprimé (≈ 2 px de carte).
  const fit = Math.min(112 / Math.max(1, x1 - x0), 38 / Math.max(1, y1 - y0), 1);
  const line = Math.max(SIG_LINE, 2.2 / fit);
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.ceil((x1 - x0) * out)); c.height = Math.max(2, Math.ceil((y1 - y0) * out));
  const ctx = c.getContext("2d")!;
  ctx.translate(-x0 * out, -y0 * out);
  drawStrokes(ctx, strokes, out, SIG_COLOR, line);
  return new Promise(res => c.toBlob(b => res(b), "image/png"));
}
