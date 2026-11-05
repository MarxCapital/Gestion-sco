import { supabase } from "@/integrations/supabase/client";
import { getSchoolYear } from "@/lib/school-year";

/** Tables dont les données sont rattachées à une année scolaire. */
const YEAR_TABLES = ["candidates", "students", "student_notes", "attendance_absences", "attendance_sessions"];

/**
 * Fetch all rows from a table, paginating past Supabase's 1000-row default limit.
 */
export async function fetchAllRows(
  table: string,
  select: string,
  filters?: { column: string; value: string }[]
): Promise<{ data: any[]; error: any }> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = (supabase.from as any)(table).select(select);
    if (YEAR_TABLES.includes(table)) query = query.eq("school_year", getSchoolYear());
    if (filters) {
      for (const f of filters) {
        query = query.eq(f.column, f.value);
      }
    }
    query = query.range(from, from + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) return { data: [], error };
    allData = allData.concat(data || []);
    hasMore = (data?.length || 0) === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return { data: allData, error: null };
}
