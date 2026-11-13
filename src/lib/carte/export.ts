/* Export de la carte : HTML → image (PNG/JPEG) puis PDF A4 (5 élèves par page, recto + verso côte à côte).
   Sans dépendance externe : on dessine le HTML dans un SVG <foreignObject>, puis dans un canvas. */
import { PDFDocument, rgb } from "pdf-lib";
import { CARD_WIDTH_PX, CARD_HEIGHT_PX, CARD_WIDTH_MM, CARD_HEIGHT_MM } from "./types";

const dataCache = new Map<string, Promise<string>>();

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

/** Transforme une URL (asset Vite, blob:, http) en data: URL ; les data: restent telles quelles. */
export function toDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return Promise.resolve(url);
  const hit = dataCache.get(url);
  if (hit) return hit;
  const p = fetch(url).then(r => { if (!r.ok) throw new Error("image " + r.status); return r.blob(); }).then(blobToDataUrl);
  p.catch(() => dataCache.delete(url));
  dataCache.set(url, p);
  return p;
}

/** Remplace toutes les images (src="…" et url('…')) du HTML par des data: URL, indispensable dans un SVG. */
export async function inlineImages(html: string): Promise<string> {
  const urls = new Set<string>();
  html.replace(/src="([^"]+)"/g, (_m, u) => { if (!u.startsWith("data:")) urls.add(u); return ""; });
  html.replace(/url\('([^']+)'\)/g, (_m, u) => { if (!u.startsWith("data:")) urls.add(u); return ""; });
  const map = new Map<string, string>();
  await Promise.all([...urls].map(async u => { try { map.set(u, await toDataUrl(u)); } catch { map.set(u, ""); } }));
  return html
    .replace(/src="([^"]+)"/g, (m, u) => (map.has(u) ? `src="${map.get(u)}"` : m))
    .replace(/url\('([^']+)'\)/g, (m, u) => (map.has(u) ? `url('${map.get(u)}')` : m));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Rendu de la carte impossible"));
    img.src = src;
  });
}

/** Dessine un côté de carte (chaîne HTML produite par renderCardSideToHTML) dans un canvas. */
export async function htmlToCanvas(html: string, scale = 2.5): Promise<HTMLCanvasElement> {
  const inlined = await inlineImages(html);
  const doc = new DOMParser().parseFromString(`<body>${inlined}</body>`, "text/html");
  const xhtml = new XMLSerializer().serializeToString(doc.body.firstElementChild as Element);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH_PX}" height="${CARD_HEIGHT_PX}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  const c = document.createElement("canvas");
  c.width = Math.round(CARD_WIDTH_PX * scale);
  c.height = Math.round(CARD_HEIGHT_PX * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type: "image/png" | "image/jpeg" = "image/png", q = 0.93): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error("Export impossible"))), type, q));
}

export const htmlToPng = async (html: string, scale = 2.5) => canvasToBlob(await htmlToCanvas(html, scale), "image/png");

// ---- PDF A4 : 5 élèves / page, recto à gauche, verso à droite ----
const MM = 72 / 25.4;
const A4_W = 210, A4_H = 297, GAP_X = 4, GAP_Y = 3, MARGIN_TOP = 15, PER_PAGE = 5;
export const PDF_LAYOUT = { perPage: PER_PAGE, cardW: CARD_WIDTH_MM, cardH: CARD_HEIGHT_MM };

export interface PdfCard { front: Uint8Array; back: Uint8Array } // JPEG

export async function buildCardsPdf(cards: PdfCard[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const left = (A4_W - (CARD_WIDTH_MM * 2 + GAP_X)) / 2;
  for (let i = 0; i < cards.length; i += PER_PAGE) {
    const page = pdf.addPage([A4_W * MM, A4_H * MM]);
    for (let r = 0; r < Math.min(PER_PAGE, cards.length - i); r++) {
      const y = MARGIN_TOP + r * (CARD_HEIGHT_MM + GAP_Y);
      const sides: [Uint8Array, number][] = [[cards[i + r].front, left], [cards[i + r].back, left + CARD_WIDTH_MM + GAP_X]];
      for (const [bytes, x] of sides) {
        const img = await pdf.embedJpg(bytes);
        page.drawImage(img, { x: x * MM, y: (A4_H - y - CARD_HEIGHT_MM) * MM, width: CARD_WIDTH_MM * MM, height: CARD_HEIGHT_MM * MM });
        page.drawRectangle({ x: x * MM, y: (A4_H - y - CARD_HEIGHT_MM) * MM, width: CARD_WIDTH_MM * MM, height: CARD_HEIGHT_MM * MM, borderColor: rgb(0, 0, 0), borderWidth: 0.5 * MM });
      }
    }
  }
  return pdf.save();
}

export async function canvasToJpegBytes(c: HTMLCanvasElement): Promise<Uint8Array> {
  return new Uint8Array(await (await canvasToBlob(c, "image/jpeg", 0.93)).arrayBuffer());
}
