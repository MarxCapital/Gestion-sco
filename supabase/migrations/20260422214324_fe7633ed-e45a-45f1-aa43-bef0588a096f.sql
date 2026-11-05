-- Table de paramètres clé/valeur booléens
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Lecture publique (pour bandeau maintenance + UI conditionnelle)
CREATE POLICY "Anyone can read settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Seul l'admin peut insérer
CREATE POLICY "Admin can insert settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seul l'admin peut modifier
CREATE POLICY "Admin can update settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seul l'admin peut supprimer
CREATE POLICY "Admin can delete settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Valeurs par défaut (toutes activées sauf maintenance)
INSERT INTO public.app_settings (key, value, description) VALUES
  ('maintenance_mode', false, 'Met la plateforme en maintenance (admin garde l''accès)'),
  ('centers_can_edit_candidates', true, 'Les centres peuvent modifier leurs apprenants'),
  ('admin_can_edit_candidates', true, 'L''admin peut modifier les apprenants'),
  ('centers_can_mark_absent', true, 'Les centres peuvent marquer les apprenants absents'),
  ('centers_can_edit_notes', true, 'Les centres peuvent saisir et modifier les notes'),
  ('csbante_can_edit_candidates', true, 'CSBanté peut modifier les apprenants'),
  ('public_results_enabled', true, 'Le portail public des résultats est accessible'),
  ('candidate_import_enabled', true, 'L''import IA des candidats est activé'),
  ('allow_concurrent_center_sessions', false, 'Autoriser plusieurs connexions simultanées par centre');