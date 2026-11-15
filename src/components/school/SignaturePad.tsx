import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, RotateCw, Undo2, Eraser, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SIG_COLOR, SIG_H, SIG_W, drawStrokes, hasInk, strokesToBlob, toLogical, type Stroke } from "@/lib/carte/signature";

interface Props {
  title: string;
  hint?: string;
  saveLabel?: string;
  onSave: (png: Blob) => void | Promise<void>;
  onClose: () => void;
  onSkip?: () => void;
}

/** Rectangle blanc pour signer au doigt ou à la souris (tracé bleu). « Plein écran » + « Tourner » : le rectangle
    occupe tout l'écran du téléphone, même tenu en hauteur. */
export default function SignaturePad({ title, hint, saveLabel = "Valider la signature", onSave, onClose, onSkip }: Props) {
  const [big, setBig] = useState(false);
  const [rot, setRot] = useState(false);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [saving, setSaving] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const cur = useRef<Stroke | null>(null);
  const [box, setBox] = useState({ w: 300, h: 150 });

  useEffect(() => {
    const f = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", f); window.addEventListener("orientationchange", f);
    return () => { window.removeEventListener("resize", f); window.removeEventListener("orientationchange", f); };
  }, []);

  // Taille du rectangle : toujours 2:1, le plus grand possible dans la zone disponible
  useLayoutEffect(() => {
    const el = area.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    const k = Math.min(w / SIG_W, h / SIG_H);
    setBox({ w: Math.max(100, Math.floor(SIG_W * k)), h: Math.max(50, Math.floor(SIG_H * k)) });
  }, [big, rot, vp]);

  const redraw = (list: Stroke[]) => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const scale = (box.w * dpr) / SIG_W;
    c.width = Math.round(box.w * dpr); c.height = Math.round(box.h * dpr);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    drawStrokes(ctx, list, scale);
  };
  useLayoutEffect(() => redraw(strokes), [box, strokes]); // eslint-disable-line react-hooks/exhaustive-deps

  const pt = (e: React.PointerEvent) => toLogical(e.clientX, e.clientY, cv.current!.getBoundingClientRect(), big && rot);
  const down = (e: React.PointerEvent) => {
    e.preventDefault(); (e.target as Element).setPointerCapture?.(e.pointerId);
    cur.current = [pt(e)]; setStrokes(s => [...s, cur.current!]);
  };
  const move = (e: React.PointerEvent) => {
    if (!cur.current) return;
    e.preventDefault();
    const evs = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [];
    const rect = cv.current!.getBoundingClientRect();
    (evs.length ? evs : [e.nativeEvent as PointerEvent]).forEach(ev => cur.current!.push(toLogical(ev.clientX, ev.clientY, rect, big && rot)));
    setStrokes(s => [...s.slice(0, -1), [...cur.current!]]);
  };
  const up = () => { cur.current = null; };

  const enterBig = async () => {
    setRot(window.innerHeight > window.innerWidth); setBig(true);
    try { await document.documentElement.requestFullscreen?.(); await (screen.orientation as any)?.lock?.("landscape"); } catch { /* le bouton « Tourner » prend le relais */ }
  };
  const leaveBig = () => { setBig(false); setRot(false); try { (screen.orientation as any)?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen(); } catch { /* */ } };
  const close = () => { leaveBig(); onClose(); };

  const save = async () => {
    const png = await strokesToBlob(strokes);
    if (!png) return;
    setSaving(true);
    try { await onSave(png); leaveBig(); } finally { setSaving(false); }
  };

  const bar = (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-background border-b">
      <div className="flex-1 min-w-0"><p className="font-semibold truncate">{title}</p>{hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}</div>
      {!big ? <Button size="sm" variant="outline" onClick={enterBig}><Maximize2 className="h-4 w-4 mr-1" />Plein écran</Button>
        : <Button size="sm" variant="outline" onClick={() => setRot(r => !r)}><RotateCw className="h-4 w-4 mr-1" />Tourner</Button>}
      {big && <Button size="sm" variant="ghost" onClick={leaveBig}>Réduire</Button>}
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={close} aria-label="Fermer"><X className="h-4 w-4" /></Button>
    </div>
  );
  const pad = (
    <div ref={area} className="flex-1 min-h-0 flex items-center justify-center p-2 bg-muted/40">
      <canvas ref={cv} style={{ width: box.w, height: box.h, touchAction: "none", background: "#fff", borderRadius: 8, boxShadow: "0 0 0 2px #cbd5e1", cursor: "crosshair" }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
    </div>
  );
  const actions = (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-background border-t">
      <Button size="sm" variant="outline" disabled={!strokes.length} onClick={() => setStrokes(s => s.slice(0, -1))}><Undo2 className="h-4 w-4 mr-1" />Annuler le trait</Button>
      <Button size="sm" variant="outline" disabled={!strokes.length} onClick={() => setStrokes([])}><Eraser className="h-4 w-4 mr-1" />Effacer</Button>
      <span className="flex-1" />
      {onSkip && <Button size="sm" variant="ghost" onClick={() => { leaveBig(); onSkip(); }}>Passer</Button>}
      <Button size="sm" disabled={!hasInk(strokes) || saving} onClick={save} style={{ background: SIG_COLOR }}><Check className="h-4 w-4 mr-1" />{saveLabel}</Button>
    </div>
  );

  if (big) {
    const style: React.CSSProperties = rot
      ? { position: "fixed", top: 0, left: vp.w, width: vp.h, height: vp.w, transform: "rotate(90deg)", transformOrigin: "0 0" }
      : { position: "fixed", top: 0, left: 0, width: vp.w, height: vp.h };
    return <div className="z-[100] fixed inset-0 bg-background overflow-hidden"><div className="flex flex-col" style={style}>{bar}{pad}{actions}</div></div>;
  }
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-2 sm:p-4" onClick={close}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }} onClick={e => e.stopPropagation()}>
        {bar}
        <div style={{ height: Math.min(360, Math.max(200, Math.round((Math.min(vp.w, 672) - 32) / 2) + 30)) }} className="flex flex-col">{pad}</div>
        {actions}
      </div>
    </div>
  );
}
