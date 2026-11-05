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

import { fixedColumns, parseGrid as _pg, pdfPagesToGrid as _pp, stripLeadingEmptyColumns } from "@/lib/list-reader";
describe("fichier à 10 colonnes (par position)", () => {
  const head = ["N° d'ordre", "Matricule", "Nom", "Prénoms", "Sexe", "Nationalité", "Date de naissance", "Lieu de naissance", "NPI", "Handicap"];
  const grid = [["", ...head], ["", "1", "20211234A", "AGBODJI", "Marie", "F", "Béninoise", "01/02/2014", "Bantè", "123", ""], ["", "2", "20215678B", "KOUTON", "Jean", "M", "Béninoise", "03/04/2013", "Pira", "", ""], ["", "3", "20219999C", "DOSSOU", "Paul", "M", "Béninoise", "05/06/2013", "Agoua", "", ""]];
  it("Excel : colonnes 2,3,4,5,7,8, jamais le numéro d'ordre", () => {
    const f = fixedColumns(_pg(stripLeadingEmptyColumns(grid))!)!;
    expect(f.map).toEqual({ mat: "Matricule", nom: "Nom", pre: "Prénoms", sex: "Sexe", nai: "Date de naissance", lie: "Lieu de naissance" });
    expect(f.rows[0]["Matricule"]).toBe("20211234A");
  });
  it("PDF : NPI et Handicap vides gardent leur place", () => {
    const X = [20, 80, 160, 240, 340, 380, 450, 540, 630, 710];
    const L = (y: number, v: string[]) => v.map((str, i) => ({ str, x: X[i], y, w: str.length * 4 })).filter(i => i.str);
    const pages = [[...L(520, head), ...L(500, ["1", "20211234A", "AGBODJI", "Marie", "F", "Béninoise", "01/02/2014", "Bantè", "", ""]), ...L(480, ["2", "20215678B", "KOUTON", "Jean", "M", "Béninoise", "03/04/2013", "Pira", "", ""]), ...L(460, ["3", "20219999C", "DOSSOU", "Paul", "M", "Béninoise", "05/06/2013", "Agoua", "", ""])]];
    const g = _pp(pages, true)!;
    expect(g[0].length).toBe(10);
    const f = fixedColumns(_pg(g)!)!;
    expect(f.rows.map(r => [r[f.map.mat], r[f.map.nom], r[f.map.sex], r[f.map.nai], r[f.map.lie]])).toEqual([["20211234A", "AGBODJI", "F", "01/02/2014", "Bantè"], ["20215678B", "KOUTON", "M", "03/04/2013", "Pira"], ["20219999C", "DOSSOU", "M", "05/06/2013", "Agoua"]]);
  });
  it("PDF : texte qui passe à la ligne recollé, rien d'inventé", () => {
    const X = [20, 80, 160, 240, 340, 380, 450, 540, 630, 710];
    const L = (y: number, v: string[]) => v.map((str, i) => ({ str, x: X[i], y, w: str.length * 4 })).filter(i => i.str);
    const pages = [[...L(520, head), ...L(500, ["1", "20211234A", "AGBODJI", "Marie", "F", "Béninoise", "01/02/2014", "Savalou", "", ""]), ...L(490, ["", "", "", "", "", "", "", "Annexe", "", ""]), ...L(470, ["2", "20215678B", "KOUTON", "Jean", "M", "Béninoise", "03/04/2013", "Pira", "", ""]), ...L(430, ["", "", "", "", "", "", "", "", "", ""])]];
    const f = fixedColumns(_pg(_pp(pages, true)!)!);
    expect(f.rows.map(r => r[f.map.lie])).toEqual(["Savalou Annexe", "Pira"]);
  });
  it("moins de 10 colonnes : erreur claire, pas de devinette", () => {
    expect(() => fixedColumns(_pg([["N°", "Matricule", "Nom", "Prénoms", "Sexe"], ["1", "2021A1", "A", "B", "M"], ["2", "2021A2", "C", "D", "F"]])!)).toThrow(/10 colonnes/);
  });
  it("NPI et Handicap vides, absentes du fichier : les 8 premières colonnes suffisent", () => {
    const f = fixedColumns(_pg([head.slice(0, 8), ["1", "20211234A", "AGBODJI", "Marie", "F", "Béninoise", "01/02/2014", "Bantè"], ["2", "20215678B", "KOUTON", "Jean", "M", "Béninoise", "03/04/2013", "Pira"]])!);
    expect(f.rows.map(r => [r[f.map.mat], r[f.map.nom], r[f.map.lie]])).toEqual([["20211234A", "AGBODJI", "Bantè"], ["20215678B", "KOUTON", "Pira"]]);
  });
  it("PDF : NPI et Handicap vides et sans titre lisible", () => {
    const X = [20, 80, 160, 240, 340, 380, 450, 540];
    const L = (y: number, v: string[]) => v.map((str, i) => ({ str, x: X[i], y, w: str.length * 4 })).filter(i => i.str);
    const pages = [[...L(520, head.slice(0, 8)), ...L(500, ["1", "20211234A", "AGBODJI", "Marie", "F", "Béninoise", "01/02/2014", "Bantè"]), ...L(480, ["2", "20215678B", "KOUTON", "Jean", "M", "Béninoise", "03/04/2013", "Pira"])]];
    const f = fixedColumns(_pg(_pp(pages, true)!)!);
    expect(f.rows.map(r => r[f.map.nai])).toEqual(["01/02/2014", "03/04/2013"]);
  });
});
