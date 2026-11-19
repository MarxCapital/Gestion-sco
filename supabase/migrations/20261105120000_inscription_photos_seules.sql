-- Fonctions développeur : mode « fiche d'inscription avec photos seules » (désactivé par défaut)
INSERT INTO public.app_settings (key, value, description) VALUES
  ('inscription_photos_seules', false, 'Fiche d''inscription : mode photos seules (aucune information écrite, seule la photo est ajoutée)')
ON CONFLICT (key) DO NOTHING;
