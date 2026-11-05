import { describe, it, expect } from "vitest";
import { mergeDbRoster, ROSTER_MAP } from "@/lib/school-roster";

const db = [{ id: "a", matricule: "M1", nom: "KPAKPO", prenoms: "Jean", sexe: "M" }, { id: "b", matricule: null, nom: "DOSSOU", prenoms: "Marie", sexe: "F" }];

describe("liste de la classe → assistant carte", () => {
  it("construit la liste sans import et sans date de naissance", () => {
    const r = mergeDbRoster(db, null);
    expect(r.rows.length).toBe(2);
    expect(r.rows[0].Nom).toBe("KPAKPO");
    expect(r.rows[0]["Date de naissance"]).toBe("");
    expect(r.map).toEqual(ROSTER_MAP);
  });
  it("garde dates, lieux et corrections locales tant que la base ne change pas", () => {
    const first = mergeDbRoster(db, null);
    first.rows[0]["Date de naissance"] = "12/03/2015"; first.rows[0]["Lieu de naissance"] = "Bantè"; first.rows[0].Nom = "KPAKPO-X";
    const again = mergeDbRoster(db, first);
    expect(again.rows[0]["Date de naissance"]).toBe("12/03/2015");
    expect(again.rows[0].Nom).toBe("KPAKPO-X");
  });
  it("la base l'emporte si l'élève a été modifié dans l'onglet Élèves, la date locale reste", () => {
    const first = mergeDbRoster(db, null);
    first.rows[0]["Date de naissance"] = "12/03/2015"; first.rows[0].Nom = "LOCAL";
    const changed = [{ ...db[0], nom: "KPAKPO2" }, db[1]];
    const again = mergeDbRoster(changed, first);
    expect(again.rows[0].Nom).toBe("KPAKPO2");
    expect(again.rows[0]["Date de naissance"]).toBe("12/03/2015");
  });
  it("reprend une ancienne liste importée (colonnes différentes) par le nom, avec ses colonnes en plus", () => {
    const legacy = { headers: ["N°", "Nom", "Prénom", "Né le", "Lieu", "Moy. CE1"], map: { mat: "N°", nom: "Nom", pre: "Prénom", nai: "Né le", lie: "Lieu", sex: "" }, rows: [{ "N°": "1", Nom: "kpakpo", Prénom: "jean", "Né le": "01/01/2015", Lieu: "Savè", "Moy. CE1": "12" }] };
    const r = mergeDbRoster(db, legacy as any);
    expect(r.rows[0]["Date de naissance"]).toBe("01/01/2015");
    expect(r.rows[0]["Lieu de naissance"]).toBe("Savè");
    expect(r.rows[0]["Moy. CE1"]).toBe("12");
    expect(r.headers).toContain("Moy. CE1");
    expect(r.rows[1]["Date de naissance"]).toBe("");
  });
  it("un nouvel élève apparaît, un élève supprimé disparaît", () => {
    const first = mergeDbRoster(db, null);
    const again = mergeDbRoster([db[1], { id: "c", matricule: "M3", nom: "ALI", prenoms: "Ibra", sexe: "M" }], first);
    expect(again.rows.map(r => r.Nom)).toEqual(["DOSSOU", "ALI"]);
  });
});

describe("date et lieu de naissance enregistrés dans « Élèves »", () => {
  it("la base les fournit, sans rien ressaisir", () => {
    const r = mergeDbRoster([{ id: "a", matricule: "M1", nom: "KPAKPO", prenoms: "Jean", sexe: "M", date_naissance: "12/03/2015", lieu_naissance: "Bantè" }], null);
    expect(r.rows[0]["Date de naissance"]).toBe("12/03/2015");
    expect(r.rows[0]["Lieu de naissance"]).toBe("Bantè");
  });
});
