import { CalendarRange, Lock } from "lucide-react";
import { useSchoolYear } from "@/contexts/SchoolYearContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SchoolYear } from "@/lib/school-year";

interface Props {
  /** Variante claire pour les barres colorées. */
  onDark?: boolean;
}

/** Sélecteur d'année scolaire, affiché dans l'en-tête de tous les espaces. */
const YearSwitcher = ({ onDark }: Props) => {
  const { year, years, setYear, readOnly } = useSchoolYear();

  return (
    <div className="flex items-center gap-2">
      <Select value={year} onValueChange={(v) => setYear(v as SchoolYear)}>
        <SelectTrigger
          className={`h-8 w-[118px] sm:w-[150px] text-xs px-2 ${onDark ? "bg-primary-foreground/10 border-primary-foreground/30 text-primary-foreground" : ""}`}
        >
          <CalendarRange className="w-3.5 h-3.5 mr-1 shrink-0 hidden sm:block" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y} className="text-xs">
              Année {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {readOnly && (
        <span title="Lecture seule" className="inline-flex sm:hidden items-center text-amber-700"><Lock className="w-3.5 h-3.5" /></span>
      )}
      {readOnly && (
        <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">
          <Lock className="w-3 h-3" />Lecture seule
        </span>
      )}
    </div>
  );
};

export default YearSwitcher;
