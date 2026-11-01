import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SUPABASE_STORAGE_KEY } from '@/lib/app-mode';
import { makeGateway, setTokenProvider } from '@/lib/offline/runtime';

// ⚙️ Informations Supabase écrites en dur (comme dans le projet d'origine).
// Pour utiliser VOTRE propre projet Supabase, remplacez ces deux valeurs
// (Supabase > Project Settings > API : « Project URL » et clé « anon / publishable »).
// La clé anon est publique par conception : la sécurité repose sur les politiques RLS des tables.
export const SUPABASE_URL = "https://xacfojsohshvnyvqaoil.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhY2ZvanNvaHNodm55dnFhb2lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzM1NTIsImV4cCI6MjA4ODIwOTU1Mn0.bPLyuRuhaW_zXrM4b9XPMA1DMfvj8rVdA25wJ8uGlVA";

/** Passerelle hors ligne : toutes les requêtes de données passent par elle (copie locale + file d'attente). */
export const gateway = makeGateway(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: gateway.fetch },
  auth: {
    storageKey: SUPABASE_STORAGE_KEY,
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

setTokenProvider(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
