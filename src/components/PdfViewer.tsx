import { useEffect, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPdfjs } from "@/lib/cm2-tools";

/** Une page : dessinée seulement quand elle approche de l'écran (économise la mémoire sur les gros PDF). */
function PageCanvas({ doc, num, width }: { doc: any; num: number; width: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(num <= 2);
  const [ratio, setRatio] = useState(1.414);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || width <= 0) return;
    let task: any, cancelled = false;
    (async () => {
      try {
        const page = await doc.getPage(num);
        const base = page.getViewport({ scale: 1 });
        if (cancelled) return;
        setRatio(base.height / base.width);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: (width / base.width) * dpr });
        const c = canvas.current;
        if (!c) return;
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        task = page.render({ canvasContext: c.getContext("2d")!, canvas: c, viewport: vp });
        await task.promise;
      } catch (e) { if ((e as any)?.name !== "RenderingCancelledException") console.warn("PDF", e); }
    })();
    return () => { cancelled = true; try { task?.cancel(); } catch { /* ignore */ } };
  }, [visible, width, doc, num]);

  return (
    <div ref={box} className="mx-auto bg-white shadow-sm" style={{ width, height: width * ratio }}>
      {visible && <canvas ref={canvas} style={{ width: "100%", height: "100%", display: "block" }} />}
    </div>
  );
}

/** Lecteur PDF intégré : affiche toutes les pages dans la plateforme, sans téléchargement. */
export default function PdfViewer({ blob }: { blob: Blob }) {
  const host = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<any>(null);
  const [error, setError] = useState(false);
  const [baseWidth, setBaseWidth] = useState(0);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false, loaded: any;
    setDoc(null); setError(false);
    (async () => {
      try {
        const pdfjs = await getPdfjs();
        loaded = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (!cancelled) setDoc(loaded);
      } catch { if (!cancelled) setError(true); }
    })();
    return () => { cancelled = true; try { loaded?.destroy(); } catch { /* ignore */ } };
  }, [blob]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => setBaseWidth(Math.max(200, el.clientWidth - 16));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const width = Math.round(baseWidth * zoom);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{doc ? `${doc.numPages} page(s)` : ""}</span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Réduire" onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}><Minus className="h-4 w-4" /></Button>
          <span className="w-12 text-center">{Math.round(zoom * 100)} %</span>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Agrandir" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
      <div ref={host} className="h-[65vh] overflow-auto rounded-sm border bg-muted p-2 space-y-3">
        {error ? <p role="alert" className="p-6 text-center text-destructive">Impossible d’afficher ce PDF. Vérifiez votre connexion internet puis réessayez.</p>
          : !doc ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Ouverture du document…</div>
          : Array.from({ length: doc.numPages }, (_, i) => <PageCanvas key={i} doc={doc} num={i + 1} width={width} />)}
      </div>
    </div>
  );
}
