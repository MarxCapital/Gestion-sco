// ---------------------------------------------------------------------------
// Gestion des années scolaires (registres)
// ---------------------------------------------------------------------------

export const SCHOOL_YEARS = ["2026-2027", "2025-2026"] as const;
export type SchoolYear = (typeof SCHOOL_YEARS)[number];

/** Seule année ouverte en écriture. Les autres sont archivées (lecture seule). */
export const ACTIVE_SCHOOL_YEAR: SchoolYear = "2026-2027";

const STORAGE_KEY = "gestionsco.school_year";
const CHOSEN_KEY = "gestionsco.school_year_chosen";

function readStored(): SchoolYear {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (SCHOOL_YEARS as readonly string[]).includes(v)) return v as SchoolYear;
  } catch { /* ignore */ }
  return ACTIVE_SCHOOL_YEAR;
}

let current: SchoolYear = readStored();

export function getSchoolYear(): SchoolYear {
  return current;
}

export function persistSchoolYear(year: SchoolYear) {
  current = year;
  try {
    localStorage.setItem(STORAGE_KEY, year);
    localStorage.setItem(CHOSEN_KEY, "1");
  } catch { /* ignore */ }
}

export function hasChosenYear(): boolean {
  try { return localStorage.getItem(CHOSEN_KEY) === "1"; } catch { return false; }
}

export function isYearReadOnly(year: SchoolYear = current): boolean {
  return year !== ACTIVE_SCHOOL_YEAR;
}

/** Année d'examen affichée sur les documents : "2026-2027" -> "2027". */
export function examYear(year: SchoolYear = current): string {
  return year.split("-")[1];
}

/** Ajoute le filtre d'année scolaire à une requête Supabase. */
export function withYear(query: any, year: SchoolYear = current) {
  return query.eq("school_year", year);
}

/** Calendrier scolaire (rentrée / fin des cours) par année. */
export const SCHOOL_CALENDAR: Record<SchoolYear, { start: string; end: string }> = {
  "2025-2026": { start: "2025-09-15", end: "2026-07-31" },
  "2026-2027": { start: "2026-09-14", end: "2027-07-31" },
};

export function isWithinCalendar(dateISO: string, year: SchoolYear = current): boolean {
  const c = SCHOOL_CALENDAR[year];
  return dateISO >= c.start && dateISO <= c.end;
}
