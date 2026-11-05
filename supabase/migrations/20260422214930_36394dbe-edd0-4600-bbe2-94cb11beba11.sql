-- Ajouter une colonne pour valeurs textuelles
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS text_value text;

-- Insérer les paramètres texte de la page maintenance
INSERT INTO public.app_settings (key, value, text_value, description) VALUES
  ('maintenance_message', false, 'GestionSco est temporairement indisponible pour maintenance. Merci de revenir dans quelques instants.', 'Message affiché sur la page de maintenance'),
  ('maintenance_contact_email', false, 'support@gestionsco.app', 'Email de contact support affiché en maintenance'),
  ('maintenance_contact_phone', false, '', 'Téléphone de contact support affiché en maintenance')
ON CONFLICT (key) DO NOTHING;