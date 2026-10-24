import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabase-helpers";
import { getJSZip } from "@/lib/cm2-tools";
import { matchesResourceClass, validateResourceFile, type ResourceClass, type ResourceKind } from "./class-resource-rules";

export type ClassResource = Database["public"]["Tables"]["class_resources"]["Row"];
const BUCKET = "class-resources";

export async function listClassResources(kind?: ResourceKind, className?: ResourceClass): Promise<ClassResource[]> {
  const filters = [];
  if (kind) filters.push({ column: "kind", value: kind });
  if (className) filters.push({ column: "class_name", value: className });
  const { data, error } = await fetchAllRows("class_resources", "*", filters);
  if (error) throw error;
  return (data as ClassResource[])
    .filter(row => !className || matchesResourceClass(className, row.class_name))
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
}

export async function uploadClassResource(input: { className: ResourceClass; kind: ResourceKind; title: string; file: File }): Promise<void> {
  const validation = validateResourceFile(input.file);
  if (validation) throw new Error(validation);
  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("Renseignez un nom de document (200 caractères maximum).");
  const header = new TextDecoder().decode(await input.file.slice(0, 5).arrayBuffer());
  if (header !== "%PDF-") throw new Error("Ce fichier n’est pas un PDF valide.");
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Reconnectez-vous pour envoyer un document.");
  const id = crypto.randomUUID();
  const filePath = `${input.className}/${input.kind}/${id}.pdf`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, input.file, { contentType: "application/pdf", upsert: false });
  if (uploadError) throw uploadError;
  const { error: insertError } = await supabase.from("class_resources").insert({
    id, class_name: input.className, kind: input.kind, title, file_path: filePath,
    original_name: input.file.name, file_size: input.file.size, created_by: user.id,
  });
  if (insertError) {
    await supabase.storage.from(BUCKET).remove([filePath]);
    throw insertError;
  }
}

// Authenticated download rechecks Storage access on each action; never expose a public URL.
export async function fetchResourcePdf(resource: ClassResource): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET).download(resource.file_path);
  if (error) throw error;
  return data;
}

// ---------- Envoi d'un ZIP : décompression automatique, un document par PDF ----------
/** Le titre est exactement le nom du fichier dans le ZIP, sans l'extension .pdf (aucune transformation). */
export const titleFromFileName = (name: string) =>
  name.replace(/^.*[\\/]/, "").replace(/\.pdf$/i, "").trim().slice(0, 200);

/** Lit un ZIP et renvoie ses PDF (sous-dossiers acceptés, fichiers cachés/Mac ignorés). */
export async function extractPdfsFromZip(zipFile: File, JSZipClass?: any): Promise<{ files: File[]; ignored: string[] }> {
  const JSZip = JSZipClass ?? (await getJSZip());
  let zip: any;
  try { zip = await JSZip.loadAsync(await zipFile.arrayBuffer()); }
  catch { throw new Error("Ce fichier n’est pas un ZIP valide."); }
  const files: File[] = [];
  const ignored: string[] = [];
  const used = new Set<string>();
  for (const entry of Object.values(zip.files) as any[]) {
    if (entry.dir) continue;
    const base = String(entry.name).split("/").pop() as string;
    if (String(entry.name).startsWith("__MACOSX/") || base.startsWith(".") || base.startsWith("~$")) continue;
    if (!/\.pdf$/i.test(base)) { ignored.push(entry.name); continue; }
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = base.replace(/\.pdf$/i, ` (${n}).pdf`);
    used.add(name.toLowerCase());
    const blob: Blob = await entry.async("blob");
    files.push(new File([blob], name, { type: "application/pdf" }));
  }
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { files, ignored };
}

export interface ZipUploadReport { sent: string[]; skipped: string[]; failed: { name: string; reason: string }[]; ignored: string[] }

/** Liste les PDF d'un ZIP sans les décompresser (chaque fichier est lu seulement au moment de son envoi). */
async function listZipPdfs(zipFile: File, JSZipClass?: any) {
  const JSZip = JSZipClass ?? (await getJSZip());
  let zip: any;
  try { zip = await JSZip.loadAsync(await zipFile.arrayBuffer()); }
  catch { throw new Error("Ce fichier n’est pas un ZIP valide."); }
  const pdfs: { name: string; read: () => Promise<File> }[] = [];
  const ignored: string[] = [];
  const used = new Set<string>();
  for (const entry of Object.values(zip.files) as any[]) {
    if (entry.dir) continue;
    const base = String(entry.name).split("/").pop() as string;
    if (String(entry.name).startsWith("__MACOSX/") || base.startsWith(".") || base.startsWith("~$")) continue;
    if (!/\.pdf$/i.test(base)) { ignored.push(entry.name); continue; }
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = base.replace(/\.pdf$/i, ` (${n}).pdf`);
    used.add(name.toLowerCase());
    const finalName = name;
    pdfs.push({ name: finalName, read: async () => new File([await entry.async("blob")], finalName, { type: "application/pdf" }) });
  }
  pdfs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return { pdfs, ignored };
}

/** Taille de ZIP et nombre de fiches : aucune limite côté application (seuls les 100 Mo par PDF s'appliquent). */
const PARALLEL_UPLOADS = 4;

/**
 * Envoie chaque PDF du ZIP comme un document de la classe, 4 à la fois, avec une nouvelle tentative en cas d'échec.
 * Les titres déjà présents sont ignorés (envoi rejouable).
 */
export async function uploadResourcesFromZip(
  input: { className: ResourceClass; kind: ResourceKind; zip: File },
  onProgress?: (done: number, total: number) => void,
  JSZipClass?: any,
): Promise<ZipUploadReport> {
  const { pdfs, ignored } = await listZipPdfs(input.zip, JSZipClass);
  if (pdfs.length === 0) throw new Error("Aucun PDF trouvé dans ce ZIP.");
  const existing = new Set((await listClassResources(input.kind, input.className)).map(r => r.title.trim().toLowerCase()));
  const report: ZipUploadReport = { sent: [], skipped: [], failed: [], ignored };
  let done = 0, next = 0;
  const worker = async () => {
    while (next < pdfs.length) {
      const item = pdfs[next++];
      const title = titleFromFileName(item.name);
      const key = title.toLowerCase();
      try {
        if (existing.has(key)) report.skipped.push(item.name);
        else {
          existing.add(key); // réserve le titre pour éviter les doublons entre envois simultanés
          const file = await item.read();
          try { await uploadClassResource({ className: input.className, kind: input.kind, title, file }); }
          catch { await uploadClassResource({ className: input.className, kind: input.kind, title, file }); }
          report.sent.push(item.name);
        }
      } catch (e) {
        existing.delete(key);
        report.failed.push({ name: item.name, reason: e instanceof Error ? e.message : "échec de l’envoi" });
      }
      onProgress?.(++done, pdfs.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, pdfs.length) }, worker));
  report.sent.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return report;
}

/** Supprime un document : d'abord la ligne (vérifie le droit admin), puis le fichier PDF. */
export async function deleteClassResource(resource: ClassResource): Promise<void> {
  const { data, error } = await supabase.from("class_resources").delete().eq("id", resource.id).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Suppression refusée : exécutez la migration SQL « class_resources_delete_100mb » dans Supabase.");
  await supabase.storage.from(BUCKET).remove([resource.file_path]);
}
