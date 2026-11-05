-- Verrous "lecture seule" par année scolaire (pilotés depuis Fonctions développeur)
INSERT INTO public.app_settings (key, value, description) VALUES
  ('year_locked_2025_2026', false, 'Année 2025-2026 en lecture seule'),
  ('year_locked_2026_2027', false, 'Année 2026-2027 en lecture seule')
ON CONFLICT (key) DO NOTHING;
