import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPdfjs } from "@/lib/cm2-tools";

/**
 * Lecteur PDF intégré : affiche les pages directement dans la page (aucun téléchargement),
 * y compris sur téléphone où les PDF ne s'affichent pas dans un cadre. Les pages sont dessinées
 * à mesure qu'on défile, ce qui permet d'ouvrir de gros documents.
 */
export default function PdfViewer({ blob }: { blob: Blob }) {
  const box = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let dead = false;
    setState("loading"); setPages(0);
    (async () => {
      try {
        const lib = await getPdfjs();
        const pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (dead) { pdf.destroy?.(); return; }
        pdfRef.current = pdf;
        setPages(pdf.numPages);
        setState("ok");
      } catch { if (!dead) setState("error"); }
    })();
    return () => { dead = true; pdfRef.current?.destroy?.(); pdfRef.current = null; };
  }, [blob]);

  useEffect(() => {
    const root = box.current, pdf = pdfRef.current;
    if (!root || !pdf || !pages) return;
    let dead = false;
    const rendering = new Set<number>();
    const draw = async (canvas: HTMLCanvasElement) => {
      const n = +canvas.dataset.page!;
      if (canvas.dataset.done === String(zoom) || rendering.has(n)) return;
      rendering.add(n);
      try {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const width = Math.max(200, root.clientWidth - 8) * zoom;
        const scale = width / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: scale * dpr });
        if (dead) return;
        canvas.width = vp.width; canvas.height = vp.height;
        canvas.style.width = `${width}px`; canvas.style.height = `${(vp.height / dpr)}px`;
        await page.render({ canvasContext: canvas.getContext("2d")!, canvas, viewport: vp } as any).promise;
        canvas.dataset.done = String(zoom);
      } catch (e) { console.error("PDF page", n, e); }
      finally { rendering.delete(n); }
    };
    const io = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) draw(e.target as HTMLCanvasElement); }), { root, rootMargin: "800px 0px" });
    root.querySelectorAll("canvas").forEach(c => { (c as HTMLCanvasElement).dataset.done = ""; io.observe(c); });
    return () => { dead = true; io.disconnect(); };
  }, [pages, zoom]);

  if (state === "error") return <p role="alert" className="py-8 text-center text-destructive">Impossible d’afficher ce PDF.</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{state === "ok" ? `${pages} page${pages > 1 ? "s" : ""}` : "Chargement…"}</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Réduire" disabled={zoom <= 0.5} onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}><Minus className="h-4 w-4" /></Button>
          <span className="w-12 text-center">{Math.round(zoom * 100)} %</span>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Agrandir" disabled={zoom >= 3} onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
      <div ref={box} className="h-[65vh] overflow-auto rounded-sm border bg-muted p-1 space-y-2">
        {state === "loading" && <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Ouverture du document…</div>}
        {Array.from({ length: pages }, (_, i) => <canvas key={`${i}`} data-page={i + 1} className="mx-auto block bg-white shadow-sm" style={{ minHeight: 200, width: "100%" }} />)}
      </div>
    </div>
  );
}
