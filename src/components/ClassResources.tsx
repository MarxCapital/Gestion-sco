import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, Eye, FileText, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PdfViewer from "@/components/PdfViewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RESOURCE_CLASSES, normalizeResourceClass, validateResourceFile, type ResourceKind } from "@/lib/class-resource-rules";
import { deleteClassResource, fetchResourcePdf, listClassResources, uploadClassResource, uploadResourcesFromZip, type ClassResource, type ZipUploadReport } from "@/lib/class-resources";

type Props = { mode: "admin" } | { mode: "school"; kind: ResourceKind; profileClass: string | null | undefined; onProfile: () => void };

export default function ClassResources(props: Props) {
  const isAdmin = props.mode === "admin";
  const schoolClass = props.mode === "school" ? normalizeResourceClass(props.profileClass) : null;
  const schoolKind = props.mode === "school" ? props.kind : undefined;
  const [rows, setRows] = useState<ClassResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [className, setClassName] = useState("");
  const [kind, setKind] = useState<ResourceKind>("guide");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [zipMode, setZipMode] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [report, setReport] = useState<ZipUploadReport | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ blob: Blob; title: string; resource: ClassResource } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const accessKey = `${props.mode}:${schoolClass}:${schoolKind}`;
  const currentAccess = useRef(accessKey);
  currentAccess.current = accessKey;

  useEffect(() => {
    let cancelled = false;
    setRows([]);
    setPreview(null);
    setLoadError(false);
    if (!isAdmin && !schoolClass) { setLoading(false); return; }
    setLoading(true);
    listClassResources(schoolKind, schoolClass ?? undefined)
      .then(data => { if (!cancelled) setRows(data); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isAdmin, schoolClass, schoolKind, revision]);


  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedClass = normalizeResourceClass(className);
    if (!selectedClass || !file) { toast.error(zipMode ? "Choisissez une classe et un ZIP." : "Choisissez une classe et un PDF."); return; }
    setSending(true);
    try {
      if (zipMode) {
        setReport(null);
        const r = await uploadResourcesFromZip({ className: selectedClass, kind, zip: file }, (d, t) => setProgress(`Envoi ${d}/${t}…`));
        setReport(r);
        setFile(null);
        if (fileInput.current) fileInput.current.value = "";
        setRevision(value => value + 1);
        if (r.sent.length) toast.success(`${r.sent.length} document(s) envoyé(s) aux enseignants de ${selectedClass}.`);
        else toast.warning("Aucun nouveau document envoyé.");
        return;
      }
      await uploadClassResource({ className: selectedClass, kind, title, file });
      setTitle(""); setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setRevision(value => value + 1);
      toast.success("Document envoyé aux enseignants de la classe concernée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L’envoi a échoué. Vérifiez votre connexion et réessayez.");
    } finally { setSending(false); setProgress(null); }
  };

  const remove = async (resource: ClassResource) => {
    if (!window.confirm(`Supprimer « ${resource.title} » (${resource.class_name}) ? Les enseignants ne la verront plus.`)) return;
    setBusy(resource.id);
    try {
      await deleteClassResource(resource);
      setRows(list => list.filter(r => r.id !== resource.id));
      toast.success("Document supprimé.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "La suppression a échoué."); }
    finally { setBusy(null); }
  };

  const openPdf = async (resource: ClassResource, download: boolean) => {
    const requestAccess = accessKey;
    setBusy(resource.id);
    try {
      const blob = await fetchResourcePdf(resource);
      if (currentAccess.current !== requestAccess) return;
      if (download) {
        const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${resource.title.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")}.pdf`;
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else setPreview({ blob, title: resource.title, resource });
    } catch { toast.error("Impossible d’ouvrir ce PDF. Vérifiez votre connexion et votre classe."); }
    finally { setBusy(null); }
  };

  if (props.mode === "school" && !schoolClass) return (
    <div className="py-8 text-center space-y-3">
      <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="text-muted-foreground">Renseignez votre classe dans votre profil pour retrouver vos documents.</p>
      <Button variant="outline" onClick={props.onProfile}>Mon profil</Button>
    </div>
  );

  return (
    <div className="space-y-8">
      {isAdmin && <section className="border-b pb-6">
        <h2 className="text-lg font-semibold mb-4">Envoyer un guide ou une fiche</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="resource-class">Classe</Label>
              <Select value={className} onValueChange={setClassName} disabled={sending}><SelectTrigger id="resource-class"><SelectValue placeholder="Choisir une classe" /></SelectTrigger><SelectContent>{RESOURCE_CLASSES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label htmlFor="resource-kind">Type de document</Label>
              <Select value={kind} onValueChange={value => setKind(value as ResourceKind)} disabled={sending}><SelectTrigger id="resource-kind"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="guide">Guide</SelectItem><SelectItem value="fiche">Fiche</SelectItem></SelectContent></Select>
            </div>
            <div className="sm:col-span-2 flex gap-2 text-sm">
              <Button type="button" size="sm" variant={zipMode ? "outline" : "default"} disabled={sending} onClick={() => { setZipMode(false); setFile(null); setReport(null); if (fileInput.current) fileInput.current.value = ""; }}>Un seul PDF</Button>
              <Button type="button" size="sm" variant={zipMode ? "default" : "outline"} disabled={sending} onClick={() => { setZipMode(true); setFile(null); setReport(null); if (fileInput.current) fileInput.current.value = ""; }}>Un ZIP (plusieurs fiches)</Button>
            </div>
            {!zipMode && <div className="space-y-2"><Label htmlFor="resource-title">Nom du guide ou de la fiche</Label><Input id="resource-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={200} required disabled={sending} /></div>}
            <div className="space-y-2"><Label htmlFor="resource-file">{zipMode ? "Fichier ZIP contenant les PDF" : "Fichier PDF (100 Mo maximum)"}</Label><Input key={zipMode ? "zip" : "pdf"} ref={fileInput} id="resource-file" type="file" accept={zipMode ? ".zip,application/zip,application/x-zip-compressed" : "application/pdf,.pdf"} required disabled={sending} onChange={event => {
              const selected = event.target.files?.[0];
              if (!selected) { setFile(null); return; }
              if (zipMode) {
                if (!/\.zip$/i.test(selected.name)) { toast.error("Choisissez un fichier ZIP."); event.target.value = ""; setFile(null); return; }
                setFile(selected); return;
              }
              const error = validateResourceFile(selected);
              if (error) { toast.error(error); event.target.value = ""; setFile(null); return; }
              setFile(selected);
            }} /></div>
          </div>
          {zipMode && <p className="text-xs text-muted-foreground">Chaque PDF du ZIP devient un document de la classe choisie (le titre est exactement le nom du fichier, sans « .pdf »). Les documents déjà envoyés avec le même nom sont ignorés.</p>}
          <Button type="submit" disabled={sending || !className || (!zipMode && !title.trim()) || !file}>{sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}{sending ? (progress ?? "Envoi en cours…") : zipMode ? "Décompresser et envoyer" : "Envoyer"}</Button>
          {report && <div role="status" className="rounded-md border p-3 text-sm space-y-1">
            <p className="text-green-700">{report.sent.length} document(s) envoyé(s).</p>
            {report.skipped.length > 0 && <p className="text-muted-foreground">{report.skipped.length} déjà présent(s), ignoré(s) : {report.skipped.join(", ")}.</p>}
            {report.ignored.length > 0 && <p className="text-muted-foreground">Fichiers non PDF ignorés : {report.ignored.join(", ")}.</p>}
            {report.failed.length > 0 && <p className="text-destructive">Échecs : {report.failed.map(f => `${f.name} (${f.reason})`).join(" ; ")}.</p>}
          </div>}
        </form>
      </section>}

      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">{isAdmin ? "Documents envoyés" : `${schoolKind === "guide" ? "Guides" : "Fiches"} · ${schoolClass}`}</h2>
          <Button variant="outline" size="icon" title="Actualiser les documents" aria-label="Actualiser les documents" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>
        {loading ? <div role="status" className="flex items-center gap-2 py-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des documents…</div>
          : loadError ? <p role="alert" className="py-6 text-destructive">Impossible de charger les documents. Réessayez avec le bouton d’actualisation.</p>
          : rows.length === 0 ? <div className="py-10 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-3" /><p>{isAdmin ? "Aucun document envoyé." : `Aucun${schoolKind === "guide" ? " guide disponible" : "e fiche disponible"} pour votre classe.`}</p></div>
          : <>{rows.length > 8 && <Input className="mb-3 max-w-xs" placeholder="Rechercher un document…" value={filter} onChange={event => setFilter(event.target.value)} />}<ul className="divide-y border-y">{rows.filter(r => r.title.toLowerCase().includes(filter.trim().toLowerCase())).map(resource => <li key={resource.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4">
            <div className="flex items-start gap-3 min-w-0"><FileText className="h-5 w-5 mt-1 shrink-0 text-primary" /><div className="min-w-0"><h3 className="font-medium break-words">{resource.title}</h3><p className="text-sm text-muted-foreground">{resource.class_name} · {resource.kind === "guide" ? "Guide" : "Fiche"} · {(resource.file_size / (1024 * 1024)).toFixed(1)} Mo · {new Date(resource.created_at).toLocaleDateString("fr-FR")}</p></div></div>
            <div className="flex flex-wrap gap-2 shrink-0"><Button variant="outline" size="sm" disabled={busy !== null} onClick={() => openPdf(resource, false)}><Eye className="h-4 w-4 mr-2" />Consulter</Button><Button variant="outline" size="sm" disabled={busy !== null} onClick={() => openPdf(resource, true)}>{busy === resource.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}Télécharger</Button>{isAdmin && <Button variant="outline" size="sm" className="text-destructive" disabled={busy !== null} onClick={() => remove(resource)}><Trash2 className="h-4 w-4 mr-2" />Supprimer</Button>}</div>
          </li>)}</ul></>}
      </section>
      <Dialog open={preview !== null} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="max-w-5xl w-[calc(100%-2rem)]"><DialogHeader><DialogTitle className="break-words pr-6">{preview?.title}</DialogTitle></DialogHeader>{preview && <><PdfViewer blob={preview.blob} /><Button variant="outline" onClick={() => openPdf(preview.resource, true)}><Download className="h-4 w-4 mr-2" />Télécharger</Button></>}</DialogContent></Dialog>
    </div>
  );
}