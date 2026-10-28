// ---------------------------------------------------------------------------
// Logique spécifique aux comptes "École" (classe unique gérée par l'enseignant)
// ---------------------------------------------------------------------------

import { isWithinCalendar } from '@/lib/school-year';

export const SCHOOL_SUBJECTS = [
  { key: 'dictee', label: 'Dictée', excel: 'Dictée' },
  { key: 'math', label: 'Math', excel: 'Math' },
  { key: 'expression_ecrite', label: 'Expression écrite', excel: 'Expresion écrite' },
  { key: 'comprehension', label: "Compréhension de l'écrit", excel: "Compréhension de l'écrit" },
  { key: 'est', label: 'EST', excel: 'EST' },
  { key: 'es', label: 'ES', excel: 'ES' },
  { key: 'ea_oral', label: 'EA (Oral)', excel: 'EA (Oral)' },
  { key: 'ea_couture', label: 'EA COUTURE', excel: 'EA (Déssin/Couture)' },
  { key: 'eps', label: 'EPS', excel: 'EPS' },
] as const;

export type SchoolSubjectKey = typeof SCHOOL_SUBJECTS[number]['key'];

export interface Student {
  id: string;
  school_id: string;
  matricule: string | null;
  nom: string;
  prenoms: string | null;
  sexe: string | null;
  ecole_provenance: string | null;
  date_naissance?: string | null;
  lieu_naissance?: string | null;
  sort_order: number;
}

export interface StudentNote {
  student_id: string;
  evaluation_key: string;
  subject_key: string;
  note: number | null;
}

// ---------------------------- Évaluations ----------------------------------

export const MONTHS = [
  'Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier',
  'Février', 'Mars', 'Avril', 'Mai', 'Juin',
];

export type EvaluationType = 'diagnostique' | 'mois' | 'sommative';

export function buildEvaluationKey(type: EvaluationType, detail?: string): string {
  if (type === 'diagnostique') return 'diagnostique';
  if (type === 'mois') return `mois:${detail}`;
  return `sommative:${detail}`;
}

export function evaluationLabel(key: string): string {
  if (key === 'diagnostique') return 'Évaluation diagnostique';
  if (key.startsWith('mois:')) return `Évaluation du mois de ${key.slice(5)}`;
  if (key.startsWith('sommative:')) return `Évaluation sommative ${key.slice(10)}`;
  return key;
}

/** Nom de feuille Excel (31 caractères max, sans caractères interdits). */
export function evaluationSheetName(key: string): string {
  return evaluationLabel(key).replace(/[\\/*?:[\]]/g, '-').slice(0, 31);
}

// -------------------------- Notes de perfectionnement ----------------------

/** 0 si la note est < 10, sinon 1 ou 2 (déterministe : dépend de la note). */
export function perfectionnementNote(note: number | null | undefined): number {
  if (note === null || note === undefined || Number.isNaN(note)) return 0;
  if (note < 10) return 0;
  return note >= 15 ? 2 : 1;
}

// ------------------------------- Présence -----------------------------------

export type HalfDay = 'morning' | 'afternoon';

export const HALF_DAY_LABEL: Record<HalfDay, string> = {
  morning: 'Matinée',
  afternoon: 'Soirée',
};

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Demi-journées de classe d'un jour donné :
 * - hors calendrier de l'année scolaire choisie : aucune
 * - samedi / dimanche : aucune
 * - jour férié : aucune
 * - mercredi : matinée uniquement
 * - autres jours : matinée + soirée
 */
export function halfDaysOf(dateISO: string, holidays: Set<string>): HalfDay[] {
  if (!isWithinCalendar(dateISO)) return [];
  if (holidays.has(dateISO)) return [];
  const day = parseISODate(dateISO).getDay();
  if (day === 0 || day === 6) return [];
  if (day === 3) return ['morning'];
  return ['morning', 'afternoon'];
}

export function isSchoolDay(dateISO: string, holidays: Set<string>): boolean {
  return halfDaysOf(dateISO, holidays).length > 0;
}

export function daysOfMonth(year: number, month0: number): string[] {
  const out: string[] = [];
  const d = new Date(year, month0, 1);
  while (d.getMonth() === month0) {
    out.push(toISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function countHalfDaysInMonth(year: number, month0: number, holidays: Set<string>): number {
  return daysOfMonth(year, month0).reduce((n, iso) => n + halfDaysOf(iso, holidays).length, 0);
}

export interface MonthlyAttendanceStats {
  monthLabel: string;
  halfDays: number;
  studentsCount: number;
  possiblePresences: number;
  absences: number;
  effectivePresences: number;
  presenceRate: number;
  studentsUnder5: number;
  studentsOver4: number;
  absencesOfOver4: number;
}

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function monthLabel(year: number, month0: number): string {
  return `${MONTH_NAMES[month0]} ${year}`;
}

export function computeMonthlyStats(
  year: number,
  month0: number,
  holidays: Set<string>,
  students: Student[],
  absences: { student_id: string; session_date: string }[],
): MonthlyAttendanceStats {
  const halfDays = countHalfDaysInMonth(year, month0, holidays);
  const studentsCount = students.length;
  const possiblePresences = halfDays * studentsCount;

  const perStudent = new Map<string, number>();
  students.forEach(s => perStudent.set(s.id, 0));
  let absencesTotal = 0;
  absences.forEach(a => {
    const d = parseISODate(a.session_date);
    if (d.getFullYear() !== year || d.getMonth() !== month0) return;
    if (!perStudent.has(a.student_id)) return;
    perStudent.set(a.student_id, (perStudent.get(a.student_id) ?? 0) + 1);
    absencesTotal += 1;
  });

  let studentsOver4 = 0;
  let absencesOfOver4 = 0;
  perStudent.forEach(count => {
    if (count > 4) { studentsOver4 += 1; absencesOfOver4 += count; }
  });

  const effectivePresences = possiblePresences - absencesTotal;
  return {
    monthLabel: monthLabel(year, month0),
    halfDays,
    studentsCount,
    possiblePresences,
    absences: absencesTotal,
    effectivePresences,
    presenceRate: possiblePresences > 0 ? Math.round((effectivePresences / possiblePresences) * 10000) / 100 : 0,
    studentsUnder5: studentsCount - studentsOver4,
    studentsOver4,
    absencesOfOver4,
  };
}

// ------------------------------ Résultats -----------------------------------

export interface StudentResult extends Student {
  notes: Record<string, number | null>;
  total: number | null;
  moyenne: number | null;
  rang: number | null;
}

export function computeStudentResults(students: Student[], notes: StudentNote[]): StudentResult[] {
  const byStudent = new Map<string, Record<string, number | null>>();
  notes.forEach(n => {
    const rec = byStudent.get(n.student_id) ?? {};
    rec[n.subject_key] = n.note === null || n.note === undefined ? null : Number(n.note);
    byStudent.set(n.student_id, rec);
  });

  const results: StudentResult[] = students.map(s => {
    const rec = byStudent.get(s.id) ?? {};
    const values = SCHOOL_SUBJECTS.map(sub => rec[sub.key] ?? null);
    const hasAny = values.some(v => v !== null);
    const total = hasAny ? values.reduce<number>((acc, v) => acc + (v ?? 0), 0) : null;
    const moyenne = total === null ? null : Math.round((total / SCHOOL_SUBJECTS.length) * 100) / 100;
    return { ...s, notes: rec, total, moyenne, rang: null };
  });

  const ranked = results.filter(r => r.moyenne !== null).sort((a, b) => (b.moyenne ?? 0) - (a.moyenne ?? 0));
  let rank = 1;
  ranked.forEach((r, i) => {
    if (i > 0 && r.moyenne !== ranked[i - 1].moyenne) rank = i + 1;
    r.rang = rank;
  });
  return results;
}

export function sortStudents(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const oa = a.sort_order ?? 999999;
    const ob = b.sort_order ?? 999999;
    if (oa !== ob) return oa - ob;
    const n = a.nom.localeCompare(b.nom, 'fr');
    return n !== 0 ? n : (a.prenoms ?? '').localeCompare(b.prenoms ?? '', 'fr');
  });
}
