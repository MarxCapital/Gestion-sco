import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Lightbulb } from "lucide-react";
import TricolorBar from "@/components/portal/TricolorBar";

/** Palette des pastilles : chaque rubrique garde sa couleur pour être reconnue d'un coup d'œil. */
const TONES = {
  blue: "from-[hsl(214_64%_34%)] to-[hsl(210_80%_55%)]",
  green: "from-emerald-600 to-green-400",
  amber: "from-amber-500 to-yellow-300",
  violet: "from-violet-600 to-fuchsia-400",
  rose: "from-rose-600 to-orange-400",
  teal: "from-teal-600 to-cyan-400",
  indigo: "from-indigo-600 to-sky-400",
} as const;
export type Tone = keyof typeof TONES;

export interface HomeTile { value: string; label: string; description: string; icon: LucideIcon; tone: Tone; badge?: string }
export interface HomeGroup { title: string; tiles: HomeTile[] }
export interface HomeStat { icon: LucideIcon; value: string | number; label: string; tone: Tone }

interface Props {
  name: string;
  subtitle: string;
  stats?: HomeStat[];
  groups: HomeGroup[];
  onSelect: (value: string) => void;
  tip?: string;
  children?: ReactNode;
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir"; };

export default function DashboardHome({ name, subtitle, stats, groups, onSelect, tip, children }: Props) {
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  let n = 0;
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      {/* En-tête d'accueil */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(212_83%_22%)] via-primary to-[hsl(205_75%_48%)] p-5 text-primary-foreground shadow-lg sm:p-8 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" aria-hidden="true" />
        <p className="text-xs font-medium capitalize text-primary-foreground/75">{date}</p>
        <h1 className="mt-1 font-heading text-2xl font-bold sm:text-4xl">{greeting()}, {name} <span aria-hidden="true">👋</span></h1>
        <TricolorBar className="my-3" />
        <p className="max-w-xl text-sm text-primary-foreground/85">{subtitle}</p>
      </section>

      {/* Chiffres clés */}
      {stats && stats.length > 0 && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} style={{ animationDelay: `${i * 70}ms` }}
              className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-soft animate-in fade-in zoom-in-95 duration-500 fill-mode-both">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow ${TONES[s.tone]}`}><s.icon className="h-5 w-5" /></div>
              <div className="min-w-0">
                <p className="font-heading text-2xl font-bold leading-none text-foreground">{s.value}</p>
                <p className="mt-1 truncate text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {children}

      {/* Rubriques */}
      {groups.map(g => (
        <section key={g.title} className="space-y-3">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold uppercase tracking-widest text-primary">
            <span className="h-4 w-1 rounded-full bg-primary" />{g.title}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.tiles.map(t => (
              <button key={t.value} type="button" onClick={() => onSelect(t.value)} style={{ animationDelay: `${(n++) * 60}ms` }}
                className="group relative flex items-start gap-4 overflow-hidden rounded-xl border bg-card p-4 text-left shadow-soft transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">
                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-80 ${TONES[t.tone]}`} aria-hidden="true" />
                <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md transition group-hover:scale-110 group-hover:rotate-3 ${TONES[t.tone]}`}><t.icon className="h-7 w-7" /></div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-heading font-semibold text-foreground">{t.label}
                    {t.badge && <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground">{t.badge}</span>}
                  </p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t.description}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </section>
      ))}

      {tip && (
        <section className="flex items-start gap-3 rounded-xl border border-[hsl(48_96%_70%)] bg-pastel-yellow p-4 text-sm text-warning-foreground">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" /><p><b>Astuce.</b> {tip}</p>
        </section>
      )}
    </div>
  );
}

/** Construit les groupes de vignettes à partir des sections du menu (sans l'entrée « Accueil »). */
export function groupsFromSections(
  sections: { label: string; items: { value: string; label: string; icon: LucideIcon }[] }[],
  info: Record<string, { d: string; tone: Tone }>,
): HomeGroup[] {
  return sections.filter(sec => sec.label !== "Accueil").map(sec => ({
    title: sec.label,
    tiles: sec.items.map(i => ({ value: i.value, label: i.label, icon: i.icon, description: info[i.value]?.d ?? "", tone: info[i.value]?.tone ?? "blue" })),
  }));
}
