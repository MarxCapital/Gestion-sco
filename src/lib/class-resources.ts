import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { fetchAllRows } from "@/lib/supabase-helpers";
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