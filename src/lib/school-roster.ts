/* Compte École : la liste de la classe (onglet « Élèves ») sert directement aux cartes, fiches et photos.
   La base ne contient ni date ni lieu de naissance : ils se complètent dans l'assistant et restent sur l'appareil. */
import type { ListMap, ListRow } from "@/lib/cm2-tools";
import type { RosterRec } from "@/lib/photo-library";
import { nameKey } from "@/lib/photo-library";

export interface DbStudent { id: string; matricule: string | null; nom: string; prenoms: string | null; sexe: string | null; date_naissance?: string | null; lieu_naissance?: string | null }

export const ROSTER_HEADERS = ["Matricule", "Nom", "Prénoms", "Sexe", "Date de naissance", "Lieu de naissance"];
export const ROSTER_MAP: ListMap = { mat: "Matricule", nom: "Nom", pre: "Prénoms", sex: "Sexe", nai: "Date de naissance", lie: "Lieu de naissance" };

const snapOf = (s: DbStudent) => [s.matricule ?? "", s.nom, s.prenoms ?? "", s.sexe ?? ""].join("|");

/**
 * Construit la liste de l'assistant à partir des élèves de la base.
 * - les corrections locales (nom, sexe… ) sont gardées tant que l'élève n'a pas changé dans la base ;
 * - date et lieu de naissance (et colonnes supplémentaires d'une ancienne liste importée) sont repris de la copie locale.
 */
export function mergeDbRoster(db: DbStudent[], local: Pick<RosterRec, "headers" | "rows" | "map"> | null): { headers: string[]; rows: ListRow[]; map: ListMap } {
  const lm = local?.map;
  const extras = local ? local.headers.filter(h => !ROSTER_HEADERS.includes(h) && !Object.values(lm ?? {}).includes(h)) : [];
  const byId = new Map<string, ListRow>(); const byName = new Map<string, ListRow>();
  (local?.rows ?? []).forEach(r => {
    if (r._id) byId.set(String(r._id), r);
    if (lm) { const k = nameKey(String(r[lm.nom] ?? ""), String(r[lm.pre] ?? "")); if (k && !byName.has(k)) byName.set(k, r); }
  });
  const rows = db.map(s => {
    const snap = snapOf(s);
    const same = byId.get(s.id);
    const loc = same ?? byName.get(nameKey(s.nom, s.prenoms ?? ""));
    const row: ListRow = { Matricule: s.matricule ?? "", Nom: s.nom, Prénoms: s.prenoms ?? "", Sexe: s.sexe ?? "", "Date de naissance": s.date_naissance ?? "", "Lieu de naissance": s.lieu_naissance ?? "" };
    if (loc && lm) {
      // date et lieu enregistrés dans « Élèves » d'abord ; à défaut, ceux complétés sur cet appareil
      if (!row["Date de naissance"]) row["Date de naissance"] = String(loc[lm.nai] ?? "");
      if (!row["Lieu de naissance"]) row["Lieu de naissance"] = lm.lie && lm.lie !== lm.nai ? String(loc[lm.lie] ?? "") : "";
      if (same && same._snap === snap) { row.Matricule = String(loc[lm.mat] ?? row.Matricule); row.Nom = String(loc[lm.nom] ?? row.Nom); row["Prénoms"] = String(loc[lm.pre] ?? row["Prénoms"]); row.Sexe = String(loc[lm.sex] ?? row.Sexe); }
      extras.forEach(h => { row[h] = loc[h] ?? ""; });
    } else extras.forEach(h => { row[h] = ""; });
    row._id = s.id; row._snap = snap;
    return row;
  });
  return { headers: [...ROSTER_HEADERS, ...extras], rows, map: { ...ROSTER_MAP } };
}
