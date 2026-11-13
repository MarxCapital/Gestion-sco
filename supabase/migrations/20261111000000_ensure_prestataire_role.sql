-- Garantit que tous les types de compte existent (à exécuter seul dans l'éditeur SQL de Supabase).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'independent';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'school';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'prestataire';
