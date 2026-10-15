import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  ACTIVE_SCHOOL_YEAR,
  SCHOOL_YEARS,
  getSchoolYear,
  hasChosenYear,
  isYearReadOnly,
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

  const value = useMemo<Ctx>(
    () => ({ year, years: SCHOOL_YEARS, setYear, readOnly: isYearReadOnly(year), chosen }),
    [year, setYear, chosen],
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
