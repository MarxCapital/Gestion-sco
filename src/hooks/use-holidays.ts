import { useEffect, useState } from "react";
import { sdb } from "@/lib/school-db";

/** Jours fériés (béninois) sous forme d'ensemble de dates ISO. */
export function useHolidays() {
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    sdb("holidays").select("holiday_date,label").then(({ data }: any) => {
      if (!active || !data) return;
      setHolidays(new Set(data.map((h: any) => h.holiday_date)));
      const map: Record<string, string> = {};
      data.forEach((h: any) => { map[h.holiday_date] = h.label; });
      setLabels(map);
    });
    return () => { active = false; };
  }, []);

  return { holidays, holidayLabels: labels };
}
