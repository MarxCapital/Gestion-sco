import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Réglages « Fonctions développeur » : remplissage automatique des documents. Tout est activé par défaut. */
export type AutofillKey = "autofill_fiche_scolaire" | "autofill_fiche_inscription" | "autofill_carte_scolaire";
export type AutofillSettings = Record<AutofillKey, boolean>;

export const AUTOFILL_KEYS: AutofillKey[] = ["autofill_fiche_scolaire", "autofill_fiche_inscription", "autofill_carte_scolaire"];
export const AUTOFILL_DEFAULTS: AutofillSettings = { autofill_fiche_scolaire: true, autofill_fiche_inscription: true, autofill_carte_scolaire: true };

const CACHE = "gestionsco.autofill.settings";

export function readCachedAutofill(): AutofillSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE) || "{}");
    const out = { ...AUTOFILL_DEFAULTS };
    AUTOFILL_KEYS.forEach(k => { if (typeof raw[k] === "boolean") out[k] = raw[k]; });
    return out;
  } catch { return { ...AUTOFILL_DEFAULTS }; }
}

/** Lit les réglages (réseau si possible, sinon dernière valeur connue sur l'appareil). */
export function useAutofillSettings() {
  const [settings, setSettings] = useState<AutofillSettings>(() => readCachedAutofill());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const { data, error } = await (supabase.from as any)("app_settings").select("key,value").in("key", AUTOFILL_KEYS);
      if (!error && Array.isArray(data)) {
        const next = { ...AUTOFILL_DEFAULTS };
        (data as { key: AutofillKey; value: boolean }[]).forEach(r => { if (r.key in next) next[r.key] = !!r.value; });
        setSettings(next);
        try { localStorage.setItem(CACHE, JSON.stringify(next)); } catch { /* ignore */ }
      }
    } catch { /* hors ligne : on garde la valeur en cache */ }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  /** Réservé à l'administrateur (les règles de la base refusent les autres). */
  const setAutofill = async (key: AutofillKey, value: boolean) => {
    const { error } = await (supabase.from as any)("app_settings").upsert(
      { key, value, description: DESCRIPTIONS[key], updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) return false;
    setSettings(s => {
      const next = { ...s, [key]: value };
      try { localStorage.setItem(CACHE, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    return true;
  };

  return { settings, loading, setAutofill, reload };
}

export const DESCRIPTIONS: Record<AutofillKey, string> = {
  autofill_fiche_scolaire: "Fiche scolaire : remplissage automatique des classes CI à CM1 (école, matricule, dates)",
  autofill_fiche_inscription: "Fiche d'inscription : préremplissage depuis les données déjà connues (directeur, contact)",
  autofill_carte_scolaire: "Carte scolaire : préremplissage depuis les données déjà connues (directeur, contact)",
};
