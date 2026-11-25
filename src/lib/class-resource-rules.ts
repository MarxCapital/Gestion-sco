export const RESOURCE_CLASSES = ["CI", "CP", "CE1", "CE2", "CM1", "CM2"] as const;
export type ResourceClass = typeof RESOURCE_CLASSES[number];
export type ResourceKind = "guide" | "fiche";
export const MAX_RESOURCE_BYTES = 100 * 1024 * 1024;

export function normalizeResourceClass(value: string | null | undefined): ResourceClass | null {
  const normalized = (value ?? "").replace(/\s/g, "").toUpperCase();
  return RESOURCE_CLASSES.find(item => item === normalized) ?? null;
}

export function matchesResourceClass(profileClass: string | null | undefined, resourceClass: string): boolean {
  const normalized = normalizeResourceClass(profileClass);
  return normalized !== null && normalized === resourceClass;
}

export function validateResourceFile(file: Pick<File, "name" | "size" | "type">): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf") || (file.type && file.type !== "application/pdf")) return "Choisissez un fichier PDF.";
  if (file.size === 0) return "Le fichier est vide.";
  if (file.size > MAX_RESOURCE_BYTES) return "Le PDF ne doit pas dépasser 100 Mo.";
  return null;
}