import { describe, it, expect } from "vitest";
import { classifyHeader, detectColumns, parseGrid, pdfPagesToGrid, splitDateLieu, splitFullName } from "@/lib/list-reader";

const run = (g: string[][]) => detectColumns(parseGrid(g)!);

describe("lecture d'une liste d'apprenants par les titres de colonnes", () => {
  it("distingue numéro d'ordre et matricule", () => {
    expect(classifyHeader("N° d'ordre")).toBe("ordre");
    expect(classifyHeader("N°")).toBe("ordre");
    expect(classifyHeader("N° Matricule")).toBe("mat");
    expect(classifyHeader("Lieu de naissance")).toBe("lie");
    expect(classifyHeader("Date de naissance")).toBe("nai");
  });
  it("prend le vrai matricule même quand le n° d'ordre est la première colonne (titre sur 2 lignes)", () => {
    const r = run([["REPUBLIQUE DU BENIN", "", "", "", "", "", ""], ["N°", "Matricule", "Nom", "Prénoms", "Sexe", "Date de", "Lieu de"], ["d'ordre", "", "", "", "", "naissance", "naissance"],
      ["1", "20123456", "KPAKPO", "Jean Pierre", "M", "12/03/2015", "Bantè"], ["2", "20123457", "DOSSOU", "Marie", "F", "05/05/2014", "Savè"], ["3", "20123458", "ALI", "Ibrahim", "M", "01/01/2014", "Dassa"]]);
    expect(r.map.mat).toBe("Matricule");
    expect(r.rows[0]["Matricule"]).toBe("20123456");
    expect(r.map.nai).toBe("Date de naissance");
    expect(r.rows[1]["Lieu de naissance"]).toBe("Savè");
  });
  it("sans colonne matricule : le numéro d'ordre n'est jamais pris pour un matricule", () => {
    const r = run([["N°", "Nom", "Prénoms", "Sexe", "Date de naissance", "Lieu de naissance"], ["1", "KPAKPO", "Jean", "M", "12/03/2015", "Bantè"], ["2", "DOSSOU", "Marie", "F", "05/05/2014", "Savè"], ["3", "ALI", "Ibra", "M", "01/01/2014", "Dassa"]]);
    expect(r.map.mat).toBe("");
  });
  it("sépare « Nom et prénoms » et « date à lieu »", () => {
    expect(splitFullName("KPAKPO Jean Pierre")).toEqual({ nom: "KPAKPO", pre: "Jean Pierre" });
    expect(splitDateLieu("12/03/2015 à Bantè")).toEqual({ nai: "12/03/2015", lie: "Bantè" });
    const r = run([["N°", "Matricule", "Nom et prénoms", "Sexe", "Né(e) le"], ["1", "20123456", "KPAKPO Jean", "M", "12/03/2015 à Bantè"], ["2", "20123457", "DOSSOU Marie", "F", "05/05/2014 à Savè"], ["3", "20123458", "ALI Ibra", "M", "01/01/2014 à Dassa"]]);
    expect(r.rows[0][r.map.nom]).toBe("KPAKPO");
    expect(r.rows[0][r.map.lie]).toBe("Bantè");
  });
  it("PDF : colonnes déduites des titres, titre sur 2 lignes, pied de page ignoré", () => {
    const hdr = [["N°", 40], ["Matricule", 80], ["Nom", 170], ["Prénoms", 290], ["Sexe", 380], ["Date de", 430], ["Lieu de", 520]] as [string, number][];
    const it = (s: string, x: number, y: number) => ({ str: s, x, y, w: s.length * 5 });
    const page: any[] = [it("LISTE DES ELEVES", 150, 800), ...hdr.map(([s, x]) => it(s, x, 760)), it("d'ordre", 40, 749), it("naissance", 430, 749), it("naissance", 520, 749)];
    [["1", "20123456", "KPAKPO", "Jean Pierre", "M", "12/03/2015", "Bantè"], ["2", "20123457", "DOSSOU", "Marie", "F", "05/05/2014", "Savè"], ["3", "20123458", "ALI", "Ibrahim", "M", "01/01/2014", "Dassa"]]
      .forEach((rw, k) => rw.forEach((c, i) => page.push(it(c, hdr[i][1], 725 - k * 18))));
    page.push(it("Page 1", 280, 30));
    const g = pdfPagesToGrid([page])!;
    expect(g.length).toBe(4);
    const r = run(g);
    expect(r.rows[0][r.map.mat]).toBe("20123456");
    expect(r.rows[0][r.map.pre]).toBe("Jean Pierre");
    expect(r.rows[2][r.map.lie]).toBe("Dassa");
  });
});
