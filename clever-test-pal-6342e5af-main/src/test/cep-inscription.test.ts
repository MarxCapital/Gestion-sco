import { describe, it, expect } from "vitest";
import { getCandidate, matchPhotos, missingCandidate, missingCommon, missingFiche, normSexe, withDefaults, DEFAULT_COMMON } from "@/lib/cep-inscription";
import { ficheHtml, NIVEAUX_DEFAUT } from "@/lib/cm2-tools";

const map = { mat: "Mat", nom: "Nom", pre: "Prénoms", nai: "Naiss", lie: "Lieu", sex: "Sexe" };
const rows = [
  { Mat: "A1", Nom: "adjovi", "Prénoms": "Marie Claire", Naiss: "12/03/2015", Lieu: "Bantè", Sexe: "Féminin" },
  { Mat: "A2", Nom: "AKPO", "Prénoms": "Jean", Naiss: "03/11/2014", Lieu: "Atokolibé", Sexe: "G" },
  { Mat: "A3", Nom: "ADJOVI", "Prénoms": "Marie", Naiss: "01/01/2015", Lieu: "Bantè", Sexe: "" },
];
const cands = rows.map(r => getCandidate(r as any, map)!);

describe("fiche d'inscription CEP", () => {
  it("lit le candidat et normalise le sexe", () => {
    expect(cands[0]).toMatchObject({ nom: "ADJOVI", sexe: "F", naissance: "12/03/2015 à Bantè" });
    expect(cands[1].sexe).toBe("M");
    expect(cands[2].sexe).toBe("");
    expect(normSexe("Masculin")).toBe("M");
  });
  it("rattache les photos nom_prenoms_.jpg sans confondre ADJOVI Marie et ADJOVI Marie Claire", () => {
    const r = matchPhotos(["adjovi_marie_claire_.jpg", "ADJOVI_Marie_.JPG", "akpo-jean (1).jpeg", "inconnu.jpg"], cands);
    expect(r.matched.get("A1")).toBe(0);
    expect(r.matched.get("A3")).toBe(1);
    expect(r.matched.get("A2")).toBe(2);
    expect(r.unmatchedFiles).toEqual([3]);
  });
  it("liste ce qui reste à remplir", () => {
    expect(missingCandidate(cands[0], withDefaults())).toContain("Trois établissements choisis");
    expect(missingCandidate(cands[2], withDefaults())).toContain("Sexe");
    expect(missingCommon(DEFAULT_COMMON, null, "")).toContain("Statut de l'école (Mon profil)");
    expect(missingFiche(withDefaults())).toHaveLength(3);
  });
  it("écrit les renseignements manuels sur la fiche scolaire", () => {
    const h = ficheHtml({ mat: "A1", nom: "ADJOVI Marie", nai: "x", moyennes: [], extra: { piece: "Acte n°12", pere: "Paul", profPere: "", mere: "Rose", profMere: "", tuteur: "" } },
      { ecole: "EPP", date: "d", scolariteComplete: false, niveaux: NIVEAUX_DEFAUT }, "");
    expect(h).toContain("Acte n°12");
    expect(h).toContain("Rose");
  });
});
