-- Statut de l'école (publique / privée), utilisé pour remplir la fiche d'inscription CEP.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS school_status text
  CHECK (school_status IS NULL OR school_status IN ('publique', 'privee'));
