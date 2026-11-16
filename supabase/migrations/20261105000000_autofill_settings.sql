-- Fonctions développeur : activer / désactiver le remplissage automatique des fiches et de la carte scolaire
INSERT INTO public.app_settings (key, value, description) VALUES
  ('autofill_fiche_scolaire', true, 'Fiche scolaire : remplissage automatique des classes CI à CM1'),
  ('autofill_fiche_inscription', true, 'Fiche d''inscription : préremplissage depuis les données connues'),
  ('autofill_carte_scolaire', true, 'Carte scolaire : préremplissage depuis les données connues')
ON CONFLICT (key) DO NOTHING;
