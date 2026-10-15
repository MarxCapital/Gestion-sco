-- Dossier de stockage PRIVÉ pour les guides et fiches PDF (aucune URL publique).
-- Les politiques d'accès (admin : envoi/lecture ; école : lecture de sa classe uniquement)
-- sont définies dans la migration 20261006024234.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('class-resources', 'class-resources', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = 20971520, allowed_mime_types = ARRAY['application/pdf'];
