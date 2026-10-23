export const SUBJECTS = [
  { key: 'dictee', label: 'Dictée' },
  { key: 'expression_ecrite', label: 'Expr. écrite' },
  { key: 'lecture', label: 'Lecture' },
  { key: 'es', label: 'ES' },
  { key: 'est', label: 'EST' },
  { key: 'mathematique', label: 'Math.' },
  { key: 'ea_dessin', label: 'EA COUTURE' },
  { key: 'ea_poesie', label: 'EA Poésie' },
  { key: 'eps', label: 'EPS' },
] as const;

export type SubjectKey = typeof SUBJECTS[number]['key'];

export interface CandidateRow {
  id: string;
  numero_table: string | null;
  nom: string;
  prenoms: string | null;
  sexe: string | null;
  ecole_provenance: string | null;
  is_absent: boolean;
  center_id: string;
  sort_order?: number;
}

export interface NotesRow {
  id?: string;
  candidate_id: string;
  dictee: number | null;
  expression_ecrite: number | null;
  lecture: number | null;
  es: number | null;
  est: number | null;
  mathematique: number | null;
  ea_dessin: number | null;
  ea_poesie: number | null;
  eps: number | null;
}

export interface CandidateResult extends CandidateRow {
  notes: NotesRow | null;
  total: number | null;
  moyenne: number | null;
  rang: number | null;
  seuilAtteint: boolean;
  aLaMoyenne: boolean;
  centerName?: string;
}

export function calculateTotal(notes: NotesRow | null): number | null {
  if (!notes) return null;
  const values = SUBJECTS.map(s => (notes as any)[s.key] as number | null);
  if (values.every(v => v === null || v === undefined)) return null;
  return values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
}

export function calculateMoyenne(total: number | null): number | null {
  if (total === null) return null;
  return Math.round((total / 18) * 100) / 100;
}

export function checkSeuilReussite(notes: NotesRow | null): boolean {
  if (!notes) return false;
  return SUBJECTS.filter(s => {
    const v = (notes as any)[s.key] as number | null;
    return v !== null && v >= 10;
  }).length >= 6;
}

export function checkALaMoyenne(moyenne: number | null): boolean {
  return moyenne !== null && moyenne >= 5;
}

export function computeResults(candidates: (CandidateRow & { notes: NotesRow | null; centerName?: string })[]): CandidateResult[] {
  let results: CandidateResult[] = candidates.map(c => {
    const total = c.is_absent ? null : calculateTotal(c.notes);
    const moyenne = calculateMoyenne(total);
    return { ...c, total, moyenne, rang: null, seuilAtteint: c.is_absent ? false : checkSeuilReussite(c.notes), aLaMoyenne: checkALaMoyenne(moyenne) };
  });

  const ranked = results.filter(r => !r.is_absent && r.moyenne !== null).sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));
  let currentRank = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i > 0 && ranked[i].moyenne !== ranked[i - 1].moyenne) currentRank = i + 1;
    ranked[i].rang = currentRank;
  }
  return results.map(r => {
    const found = ranked.find(f => f.id === r.id);
    return found ? { ...r, rang: found.rang } : r;
  });
}

export function normalizeSchoolName(name: string | null): string {
  if (!name) return '';
  return name.replace(/\s*-\s*/g, '-').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function getUniqueSchools(candidates: CandidateRow[]): string[] {
  const set = new Set<string>();
  candidates.forEach(c => { if (c.ecole_provenance) set.add(normalizeSchoolName(c.ecole_provenance)); });
  return Array.from(set).sort();
}

export function matchesSchool(candidate: CandidateRow, school: string): boolean {
  return normalizeSchoolName(candidate.ecole_provenance) === normalizeSchoolName(school);
}

export function sortAlphabetically<T extends { nom: string; prenoms?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const n = a.nom.localeCompare(b.nom, 'fr');
    if (n !== 0) return n;
    return (a.prenoms ?? '').localeCompare(b.prenoms ?? '', 'fr');
  });
}

export function sortByOrder<T extends { sort_order?: number; nom: string; prenoms?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const oa = a.sort_order ?? 999999;
    const ob = b.sort_order ?? 999999;
    if (oa !== ob) return oa - ob;
    const n = a.nom.localeCompare(b.nom, 'fr');
    if (n !== 0) return n;
    return (a.prenoms ?? '').localeCompare(b.prenoms ?? '', 'fr');
  });
}
