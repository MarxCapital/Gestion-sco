import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppSettingKey =
  | "maintenance_mode"
  | "maintenance_mode_independent"
  | "centers_can_edit_candidates"
  | "admin_can_edit_candidates"
  | "centers_can_mark_absent"
  | "centers_can_edit_notes"
  | "csbante_can_edit_candidates"
  | "public_results_enabled"
  | "candidate_import_enabled"
  | "allow_concurrent_center_sessions";

export type AppTextSettingKey =
  | "maintenance_message"
  | "maintenance_contact_email"
  | "maintenance_contact_phone";

export interface AppSettingRow {
  key: string;
  value: boolean;
  text_value: string | null;
  description: string | null;
  updated_at: string;
}

export type AppSettings = Record<AppSettingKey, boolean>;
export type AppTextSettings = Record<AppTextSettingKey, string>;

const DEFAULTS: AppSettings = {
  maintenance_mode: false,
  maintenance_mode_independent: false,
  centers_can_edit_candidates: true,
  admin_can_edit_candidates: true,
  centers_can_mark_absent: true,
  centers_can_edit_notes: true,
  csbante_can_edit_candidates: true,
  public_results_enabled: true,
  candidate_import_enabled: true,
  allow_concurrent_center_sessions: false,
};

const TEXT_DEFAULTS: AppTextSettings = {
  maintenance_message:
    "GestionSco est temporairement indisponible pour maintenance. Merci de revenir dans quelques instants.",
  maintenance_contact_email: "",
  maintenance_contact_phone: "",
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [textSettings, setTextSettings] = useState<AppTextSettings>(TEXT_DEFAULTS);
  const [rows, setRows] = useState<AppSettingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await (supabase.from as any)("app_settings").select("*");
    if (data) {
      const nextBool = { ...DEFAULTS };
      const nextText = { ...TEXT_DEFAULTS };
      (data as AppSettingRow[]).forEach((r) => {
        if (r.key in nextBool) {
          nextBool[r.key as AppSettingKey] = r.value;
        }
        if (r.key in nextText && r.text_value != null) {
          nextText[r.key as AppTextSettingKey] = r.text_value;
        }
      });
      setSettings(nextBool);
      setTextSettings(nextText);
      setRows(data as AppSettingRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = (supabase as any)
      .channel(`app_settings_changes_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => load()
      )
      .subscribe();
    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [load]);

  const updateSetting = async (key: AppSettingKey, value: boolean) => {
    const { error } = await (supabase.from as any)("app_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (!error) {
      setSettings((s) => ({ ...s, [key]: value }));
    }
    return !error;
  };

  const updateTextSetting = async (key: AppTextSettingKey, value: string) => {
    const { error } = await (supabase.from as any)("app_settings")
      .update({ text_value: value, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (!error) {
      setTextSettings((s) => ({ ...s, [key]: value }));
    }
    return !error;
  };

  return { settings, textSettings, rows, loading, updateSetting, updateTextSetting, reload: load };
};
