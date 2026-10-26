-- Nouveau type de compte : prestataire (fiche scolaire, carte scolaire, fiche d'inscription, renommage des photos).
-- À exécuter seul dans l'éditeur SQL de Supabase.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'prestataire';
