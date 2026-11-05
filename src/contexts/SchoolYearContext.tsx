import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  ACTIVE_SCHOOL_YEAR,
  SCHOOL_YEARS,
  getSchoolYear,
  hasChosenYear,
  isYearReadOnly,
  lockSettingKey,
  setLockedYears,
  persistSchoolYear,
  type SchoolYear,
} from "@/lib/school-year";

interface Ctx {
  year: SchoolYear;
  years: readonly SchoolYear[];
  setYear: (y: SchoolYear) => void;
  readOnly: boolean;
  chosen: boolean;
}

const SchoolYearContext = createContext<Ctx | undefined>(undefined);

export const SchoolYearProvider = ({ children }: { children: ReactNode }) => {
  const [year, setYearState] = useState<SchoolYear>(getSchoolYear());
  const [chosen, setChosen] = useState<boolean>(hasChosenYear());

  const setYear = useCallback((y: SchoolYear) => {
    persistSchoolYear(y);
    setYearState(y);
    setChosen(true);
  }, []);

  const [locks, setLocks] = useState<Partial<Record<SchoolYear, boolean>>>({});

  // Verrous d'année posés par l'admin (table app_settings), mis à jour en direct.
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await (supabase.from as any)("app_settings")
          .select("key,value")
          .like("key", "year_locked_%");
        if (!data) return;
        const next: Partial<Record<SchoolYear, boolean>> = {};
        for (const y of SCHOOL_YEARS) {
          next[y] = !!(data as { key: string; value: boolean }[]).find((r) => r.key === lockSettingKey(y))?.value;
        }
        setLockedYears(next);
        setLocks(next);
      } catch { /* hors ligne : on garde l'état précédent */ }
    };
    load();
    const channel = (supabase as any)
      .channel(`year_locks_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "app_settings" }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, []);

  const value = useMemo<Ctx>(
    () => ({ year, years: SCHOOL_YEARS, setYear, readOnly: isYearReadOnly(year), chosen }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, setYear, chosen, locks],
  );

  return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
};

export const useSchoolYear = (): Ctx => {
  const ctx = useContext(SchoolYearContext);
  if (!ctx) {
    return {
      year: ACTIVE_SCHOOL_YEAR,
      years: SCHOOL_YEARS,
      setYear: () => {},
      readOnly: false,
      chosen: true,
    };
  }
  return ctx;
};
