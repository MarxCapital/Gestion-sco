/* Arrondissements et collèges (CEG) de la commune de Bantè, pour la fiche d'inscription au CEP. */

export const BANTE_ARRONDISSEMENTS = ["Agoua", "Akpassi", "Atokolibé", "Bantè", "Bobè", "Gouka", "Koko", "Lougba", "Pira"];

/** Liste de départ ; chaque appareil peut ajouter ou retirer un collège (voir ci-dessous). */
export const DEFAULT_CEGS = [
  "CEG 1 Bantè", "CEG 2 Bantè", "CEG Agoua", "CEG Atokolibé", "CEG Bobè", "CEG Gouka", "CEG Koko", "CEG Lougba", "CEG Pira",
  "Collège Polytechnique d'Enseignement Général La Lumière d'Akpassi",
];

const EXTRA_KEY = "gestionsco.ceg.extra";
const HIDDEN_KEY = "gestionsco.ceg.hidden";
const read = (k: string): string[] => { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v.filter(x => typeof x === "string") : []; } catch { return []; } };
const write = (k: string, v: string[]) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const normCeg = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

export function loadCegs(): string[] {
  const hidden = new Set(read(HIDDEN_KEY).map(normCeg));
  const all = [...DEFAULT_CEGS, ...read(EXTRA_KEY)];
  const seen = new Set<string>();
  return all.filter(c => { const k = normCeg(c); if (!k || seen.has(k) || hidden.has(k)) return false; seen.add(k); return true; });
}
export function addCeg(name: string): string[] {
  const n = name.trim().replace(/\s+/g, " "); if (!n) return loadCegs();
  write(HIDDEN_KEY, read(HIDDEN_KEY).filter(h => normCeg(h) !== normCeg(n)));
  if (!loadCegs().some(c => normCeg(c) === normCeg(n))) write(EXTRA_KEY, [...read(EXTRA_KEY), n]);
  return loadCegs();
}
export function removeCeg(name: string): string[] {
  write(EXTRA_KEY, read(EXTRA_KEY).filter(c => normCeg(c) !== normCeg(name)));
  if (DEFAULT_CEGS.some(c => normCeg(c) === normCeg(name))) write(HIDDEN_KEY, [...read(HIDDEN_KEY), name]);
  return loadCegs();
}

/** Recherche tolérante (accents, majuscules, tirets). */
export const searchCegs = (list: string[], q: string) => { const n = normCeg(q); return n ? list.filter(c => normCeg(c).includes(n)) : list; };

/** « 29 octobre 2026 » (le 1er du mois s'écrit « 1er »). */
export function dateEnLettres(d = new Date()): string {
  const mois = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  return `${d.getDate() === 1 ? "1er" : d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}
