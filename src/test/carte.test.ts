import { describe, it, expect } from "vitest";
import { applyDesignToTemplate, CARD_DESIGNS } from "@/lib/carte/designs";
import { createBeninTemplate } from "@/lib/carte/template";
import { renderCardSideToHTML, replacePlaceholders } from "@/lib/carte/render";
import { findPhoto, nameKey, type PhotoRec } from "@/lib/photo-library";

const st = { id: "1", lastName: "AGBO & <X>", firstName: "Jean Marie", gender: "M", class: "CM2", studentId: "12", dateOfBirth: "01/02/2015", placeOfBirth: "Bantè" };

describe("carte scolaire", () => {
  it("les 8 modèles gardent exactement les mêmes positions", () => {
    const base = createBeninTemplate("x");
    const pos = (t: any) => t.front.elements.filter((e: any) => !e._isDesignGradient).map((e: any) => [e.type, e.x, e.y, e.width, e.height].join());
    CARD_DESIGNS.forEach(d => expect(pos(applyDesignToTemplate(base, d))).toEqual(pos(base)));
    expect(CARD_DESIGNS.length).toBe(8);
  });
  it("remplace les champs et protège le HTML", () => {
    const t = createBeninTemplate("x");
    const html = renderCardSideToHTML(t.front, st, { name: "EPP A", directorName: "K", directorPhone: "1" }, "2026-2027");
    expect(html).toContain("AGBO &amp; &lt;X&gt;");
    expect(html).toContain("01/02/2015 à Bantè");
    expect(html).toContain("CARTE D'IDENTITÉ SCOLAIRE 2026-2027");
    expect(html).toContain("Ministère des Enseignements Maternel et Primaire");
    expect(html.includes("{{")).toBe(false);
  });
  it("accorde le verso au féminin", () => {
    expect(replacePlaceholders("Je soussigné(e) {{NOM_DIRECTEUR}}, Directeur/Directrice", st, { name: "E", directorName: "Awa", directorPhone: "", directorGender: "F" })).toBe("Je soussignée Awa, Directrice");
  });
});

describe("mémoire des photos", () => {
  const rec = (nom: string, prenoms: string, mat = ""): PhotoRec => ({ id: "s|" + nameKey(nom, prenoms), scope: "s", nameKey: nameKey(nom, prenoms), mat, nom, prenoms, blob: new Blob([]), savedAt: 1 });
  it("retrouve par nom + prénoms (accents, casse, espaces) puis par matricule", () => {
    const recs = [rec("ADJOVI", "Élodie Rose", "A1"), rec("BIO", "Paul")];
    expect(findPhoto(recs, { nom: "adjovi", prenoms: "ELODIE  rose" })?.nom).toBe("ADJOVI");
    expect(findPhoto(recs, { nom: "AUTRE", prenoms: "Nom", mat: "A1" })?.nom).toBe("ADJOVI");
    expect(findPhoto(recs, { nom: "ZED", prenoms: "Q" })).toBe(undefined);
  });
});

import { decorate } from "@/lib/carte/overlays";
import { toLogical } from "@/lib/carte/signature";

describe("signatures et cachet", () => {
  it("ajoute signature élève, cachet, signature et nom du directeur sans toucher au modèle", () => {
    const base = createBeninTemplate("x");
    const n0 = base.back.elements.length;
    const t = decorate(base, { ...st, signature: "data:image/png;base64,AA" }, { name: "E", directorName: "Koffi ADJOVI", directorPhone: "1" }, { directorSignature: "data:image/png;base64,BB", stamp: "data:image/png;base64,CC" });
    expect(base.back.elements.length).toBe(n0);
    expect(t.back.elements.length).toBe(n0 + 3);
    expect(t.front.elements.length).toBe(base.front.elements.length + 1);
    const nom: any = t.back.elements.find(e => e.id === "nom-directeur");
    expect(nom.fontWeight).toBe("bold");
  });
  it("retrouve le point touché quand le rectangle est tourné de 90°", () => {
    const r = { left: 0, top: 20, right: 300, width: 300, height: 600 }; // rectangle tourné : 300 de large, 600 de haut à l'écran
    const p = toLogical(150, 320, r, true);
    expect([Math.round(p.x), Math.round(p.y)]).toEqual([300, 150]);
  });
});
