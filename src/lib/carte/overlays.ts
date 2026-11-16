/* Ajoute à la carte maître : signature de l'apprenant (recto), signature + nom + cachet du directeur (verso).
   Le modèle maître n'est pas modifié ; les positions utilisent les espaces libres près de « Signature » et de la case du verso. */
import type { CardElement, CardSide, CardTemplate, ImageElement, SchoolInfo, Student, TextElement } from "./types";

export interface CardAssets { directorSignature?: string; stamp?: string }

const img = (id: string, src: string, x: number, y: number, width: number, height: number, z: number): ImageElement =>
  ({ id, type: "image", x, y, width, height, zIndex: z, locked: true, visible: true, src, objectFit: "contain", opacity: 1, borderRadius: 0 });

export function nameFontSize(name: string) { return name.length <= 22 ? 13 : name.length <= 30 ? 11 : 9; }

export function decorate(tpl: CardTemplate, student: Student | undefined, school: SchoolInfo, assets: CardAssets): CardTemplate {
  const front: CardElement[] = [...tpl.front.elements];
  const back: CardElement[] = [...tpl.back.elements];
  // Recto : sous le mot « Signature » (x 320-420, y 194-218)
  if (student?.signature) front.push(img("sig-eleve", student.signature, 318, 215, 108, 42, 40));
  // Verso : cachet à gauche de la case, signature dans la case, nom en gras dessous
  if (assets.stamp) back.push(img("cachet", assets.stamp, 196, 184, 92, 70, 40));
  if (assets.directorSignature) back.push(img("sig-directeur", assets.directorSignature, 288, 186, 118, 38, 41));
  const nom = (school.directorName || "").trim();
  if (nom) {
    const t: TextElement = {
      id: "nom-directeur", type: "text", x: 262, y: 225, width: 164, height: 22, zIndex: 42, locked: true, visible: true,
      content: "{{NOM_DIRECTEUR}}", fontSize: nameFontSize(nom), fontFamily: "sans-serif", fontWeight: "bold", color: "#000000",
      textAlign: "center", isPlaceholder: true,
    };
    back.push(t);
  }
  const side = (s: CardSide, elements: CardElement[]): CardSide => ({ ...s, elements });
  return { ...tpl, front: side(tpl.front, front), back: side(tpl.back, back) };
}
