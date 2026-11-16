import { supabase } from "@/integrations/supabase/client";

/**
 * Les tables du compte École ne figurent pas encore dans les types générés
 * de Supabase : ce petit helper évite de répéter le cast partout.
 */
export const sdb = (table: string) => (supabase.from as any)(table);
