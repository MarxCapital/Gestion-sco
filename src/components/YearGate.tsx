import type { ReactNode } from "react";
import { CalendarRange, Lock, PenLine } from "lucide-react";
import { useSchoolYear } from "@/contexts/SchoolYearContext";
import { useAuth } from "@/contexts/AuthContext";
import { ACTIVE_SCHOOL_YEAR, type SchoolYear } from "@/lib/school-year";

/**
 * Demande de choisir l'année scolaire à la première ouverture d'une session,
 * puis remonte les enfants avec une clé liée à l'année (rechargement propre
 * de toutes les données quand l'utilisateur change d'année).
 */
const YearGate = ({ children }: { children: ReactNode }) => {
  const { year, years, setYear, chosen } = useSchoolYear();
  const { user, loading } = useAuth();

  if (!loading && user && !chosen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold">Choisissez l'année scolaire</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Le registre {ACTIVE_SCHOOL_YEAR} est ouvert. Les années précédentes restent consultables
            et téléchargeables, mais ne peuvent plus être modifiées.
          </p>
          <div className="space-y-2">
            {years.map((y: SchoolYear) => (
              <button
                key={y}
                type="button"
                onClick={() => setYear(y)}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:border-primary hover:bg-accent"
              >
                {y === ACTIVE_SCHOOL_YEAR
                  ? <PenLine className="w-4 h-4 text-primary" />
                  : <Lock className="w-4 h-4 text-muted-foreground" />}
                <span className="flex-1">
                  <span className="block font-medium">Année {y}</span>
                  <span className="block text-xs text-muted-foreground">
                    {y === ACTIVE_SCHOOL_YEAR ? "Saisie et modifications autorisées" : "Consultation et téléchargement uniquement"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <div key={year} className="contents">{children}</div>;
};

export default YearGate;
