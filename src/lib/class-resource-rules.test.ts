import { describe, expect, it } from "vitest";
import { matchesResourceClass, normalizeResourceClass, validateResourceFile } from "./class-resource-rules";

describe("Ressources de la classe du profil", () => {
  it("donne les ressources CE1 au profil CE1", () => {
    expect(matchesResourceClass("CE1", "CE1")).toBe(true);
  });
  it("refuse les ressources CE2 au profil CE1", () => {
    expect(matchesResourceClass("CE1", "CE2")).toBe(false);
  });
  it("refuse les ressources CP au profil CE1", () => {
    expect(matchesResourceClass("CE1", "CP")).toBe(false);
  });
  it("ne donne aucun document aux profils sans classe", () => {
    expect(matchesResourceClass(null, "CE1")).toBe(false);
  });
  it("préserve les classes existantes écrites avec espaces ou minuscules", () => {
    expect(normalizeResourceClass(" ce 1 ")).toBe("CE1");
  });
  it("refuse de deviner une classe non reconnue", () => {
    expect(normalizeResourceClass("CE1/CE2")).toBe(null);
  });
});

describe("Fichiers pédagogiques PDF", () => {
  it("refuse un autre type de fichier", () => {
    expect(validateResourceFile({ name: "fiche.docx", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1024 })).not.toBeNull();
  });
  it("accepte un PDF", () => {
    expect(validateResourceFile({ name: "guide.pdf", type: "application/pdf", size: 1024 })).toBeNull();
  });
});