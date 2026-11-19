import { describe, it, expect } from "vitest";
import { parseCandidatePages, type TextItem } from "../../supabase/functions/extract-candidates/parser";

// Colonnes (x) : N° 20 | Photo 50 | N° table 90 | Nom 140 | Prénoms 220 | Sexe 320 | Nationalité 350 | Date 410 | Lieu 480 | École 550
const X = [20, 50, 90, 140, 220, 320, 350, 410, 480, 550];
const header = (y: number): TextItem[] =>
  ["N°", "Photo", "N° de table", "Nom", "Prénom(s)", "Sexe", "Nationalité", "Date de naissance", "Lieu de naissance", "École de provenance"].map(
    (str, i) => ({ str, x: X[i], y })
  );
const row = (y: number, n: number, t: string, nom: string, pre: string, sx: string, ecole: string): TextItem[] =>
  [String(n), "", t, nom, pre, sx, "Béninoise", "01/01/2012", "Bantè", ecole].map((str, i) => ({ str, x: X[i], y }));

describe("extraction de candidats (sans IA)", () => {
  it("sépare nom, prénoms, sexe, école et recolle les cellules sur plusieurs lignes", () => {
    const page: TextItem[] = [
      { str: "LISTE DES CANDIDATS", x: 200, y: 560 },
      ...header(520),
      ...row(500, 1, "T001", "AGBODJI", "Marie Élodie", "F", "EPP Bantè"),
      ...row(480, 2, "T002", "KOUTON", "Jean", "M", "CEG1 Savalou - Annexe"),
      { str: "du village", x: 550, y: 472 }, // suite de la cellule école (ligne suivante)
    ];
    const { candidates } = parseCandidatePages([page]);
    expect(candidates).toEqual([
      { numero_table: "T001", nom: "AGBODJI", prenoms: "Marie Élodie", sexe: "F", ecole_provenance: "EPP Bantè" },
      { numero_table: "T002", nom: "KOUTON", prenoms: "Jean", sexe: "M", ecole_provenance: "CEG1 Savalou-Annexe du village" },
    ]);
  });

  it("gère l'en-tête répété sur plusieurs pages", () => {
    const p1 = [...header(520), ...row(500, 1, "T001", "A", "B", "M", "E1")];
    const p2 = [...header(520), ...row(500, 2, "T002", "C", "D", "F", "E2")];
    expect(parseCandidatePages([p1, p2]).candidates.map((c) => c.nom)).toEqual(["A", "C"]);
  });

  it("signale clairement un PDF qui n'a pas le bon tableau", () => {
    const { candidates, warnings } = parseCandidatePages([[{ str: "Bonjour", x: 10, y: 10 }]]);
    expect(candidates).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });
});
