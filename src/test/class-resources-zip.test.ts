import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractPdfsFromZip, titleFromFileName, uploadResourcesFromZip } from "@/lib/class-resources";

describe("ZIP de fiches", () => {
  it("extrait les PDF, ignore le reste et gère les doublons", async () => {
    const z = new JSZip();
    z.file("Fiche 1_Maths.pdf", "%PDF-1.4 a");
    z.file("sous-dossier/Fiche 2.PDF", "%PDF-1.4 b");
    z.file("autre/Fiche 2.pdf", "%PDF-1.4 c");
    z.file("__MACOSX/._Fiche 1_Maths.pdf", "x");
    z.file("notes.txt", "x");
    const zip = new File([await z.generateAsync({ type: "uint8array" })], "classe.zip");
    const r = await extractPdfsFromZip(zip, JSZip);
    expect(r.files.map(f => f.name)).toEqual(["Fiche 1_Maths.pdf", "Fiche 2 (2).pdf", "Fiche 2.PDF"]);
    expect(r.ignored).toEqual(["notes.txt"]);
    expect(titleFromFileName("dossier/Fiche_1__Maths-CM2.pdf")).toBe("Fiche_1__Maths-CM2");
  });
});
