import { describe, it, expect } from "vitest";
import { ficheHtml, getLearner, detectMoyenneColumns, guessMap, NIVEAUX_DEFAUT, nomFichier } from "@/lib/cm2-tools";

const headers = ["Matricule", "Nom", "Prénoms", "Date de naissance", "Lieu de naissance", "Sexe", "Moyenne CE2", "Moy. CM1", "Moyenne CM2"];
const row = { Matricule: "20123456", Nom: "agbodji", "Prénoms": "Marie Élodie", "Date de naissance": 41000, "Lieu de naissance": "Bantè", Sexe: "F", "Moyenne CE2": "13,5", "Moy. CM1": "abc", "Moyenne CM2": "15" } as any;
const base = { ecole: "EPP Test", date: "07/10/2026", scolariteComplete: false, niveaux: NIVEAUX_DEFAUT };

describe("outils CM2", () => {
  const m = guessMap(headers);
  const mc = detectMoyenneColumns(headers);
  it("reconnaît les colonnes et les moyennes réelles (jamais celle de CM2)", () => {
    expect(m.nom).toBe("Nom");
    expect(mc[5]).toBe("Moyenne CE2");
    expect(mc[7]).toBeNull();
  });
  it("n'invente aucune note ni appréciation", () => {
    const s = getLearner(row, m, mc)!;
    expect(s.moyennes[5]).toBe("13.50/20");
    expect(s.moyennes[6]).toBeNull();
    const h = ficheHtml(s, base, "");
    expect(h).toContain("13.50/20");
    expect(h).not.toMatch(/Admis|Passable|Très bien|Assez-bien/);
    expect(h.match(/20123456/g)).toHaveLength(1);
  });
  it("remplit les classes passées seulement si la scolarité complète est attestée", () => {
    const s = getLearner(row, m, mc)!;
    expect(ficheHtml(s, { ...base, scolariteComplete: true }, "").match(/20123456/g)).toHaveLength(8);
  });
  it("nomme les photos matricule_nom_prénoms.jpg", () => {
    expect(nomFichier(row, m)).toBe("20123456_agbodji_Marie-Élodie.jpg");
  });
});
