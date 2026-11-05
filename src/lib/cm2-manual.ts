// Renseignements saisis à la main (CM2) : conservés dans le navigateur, par école et par année.
import { DEFAULT_COMMON, withDefaults, type Common, type Manual } from "@/lib/cep-inscription";

const mk = (school: string, year: string) => `gestionsco.cm2.manual.${school || "local"}.${year}`;
const ck = (school: string) => `gestionsco.cm2.common.${school || "local"}`;

export function loadManual(school: string, year: string): Record<string, Manual> {
  try {
    const raw = JSON.parse(localStorage.getItem(mk(school, year)) || "{}");
    const out: Record<string, Manual> = {};
    Object.keys(raw).forEach((k) => (out[k] = withDefaults(raw[k])));
    return out;
  } catch { return {}; }
}
export function saveManual(school: string, year: string, data: Record<string, Manual>) {
  try { localStorage.setItem(mk(school, year), JSON.stringify(data)); } catch { /* ignore */ }
}
export function loadCommon(school: string): Common {
  try { return { ...DEFAULT_COMMON, ...JSON.parse(localStorage.getItem(ck(school)) || "{}") }; } catch { return { ...DEFAULT_COMMON }; }
}
export function saveCommon(school: string, c: Common) {
  try { localStorage.setItem(ck(school), JSON.stringify(c)); } catch { /* ignore */ }
}
