-- Signature à distance des apprenants : le prestataire envoie un lien au directeur ;
-- le directeur fait signer chaque apprenant sur son téléphone ; les signatures reviennent sur la carte du prestataire.
-- À exécuter dans l'éditeur SQL de Supabase (après la migration « prestataire_role »).

CREATE TABLE IF NOT EXISTS public.signature_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  owner uuid NOT NULL,
  scope text NOT NULL,
  school_name text NOT NULL DEFAULT '',
  students jsonb NOT NULL DEFAULT '[]'::jsonb,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS public.signature_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.signature_links(id) ON DELETE CASCADE,
  student_key text NOT NULL,
  png text NOT NULL,
  imported boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, student_key)
);

ALTER TABLE public.signature_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signature_submissions ENABLE ROW LEVEL SECURITY;

-- Aucun accès direct pour le public : tout passe par les fonctions ci-dessous.
DROP POLICY IF EXISTS "links owner read" ON public.signature_links;
CREATE POLICY "links owner read" ON public.signature_links FOR SELECT TO authenticated
  USING (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "subs owner read" ON public.signature_submissions;
CREATE POLICY "subs owner read" ON public.signature_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.signature_links l WHERE l.id = link_id AND (l.owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- 1) Le prestataire crée (ou met à jour) le lien d'une école. Réutilise le lien actif existant.
CREATE OR REPLACE FUNCTION public.sig_link_upsert(p_scope text, p_school text, p_students jsonb, p_days int DEFAULT 21)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tok text; v_days int := LEAST(GREATEST(COALESCE(p_days, 21), 1), 90);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;
  IF NOT (public.has_role(auth.uid(), 'prestataire') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Réservé aux comptes prestataire';
  END IF;
  IF jsonb_typeof(p_students) <> 'array' OR jsonb_array_length(p_students) > 2000 THEN
    RAISE EXCEPTION 'Liste d''apprenants invalide';
  END IF;
  SELECT token INTO v_tok FROM public.signature_links
    WHERE owner = auth.uid() AND scope = p_scope AND NOT revoked AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;
  IF v_tok IS NULL THEN
    v_tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    INSERT INTO public.signature_links (token, owner, scope, school_name, students, expires_at)
    VALUES (v_tok, auth.uid(), p_scope, left(COALESCE(p_school, ''), 200), p_students, now() + make_interval(days => v_days));
  ELSE
    UPDATE public.signature_links SET school_name = left(COALESCE(p_school, ''), 200), students = p_students,
      expires_at = GREATEST(expires_at, now() + make_interval(days => v_days)) WHERE token = v_tok;
  END IF;
  RETURN v_tok;
END $$;

-- 2) Le directeur (sans compte) ouvre le lien : nom de l'école, apprenants, et qui a déjà signé.
CREATE OR REPLACE FUNCTION public.sig_link_get(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.signature_links%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.signature_links WHERE token = p_token AND NOT revoked AND expires_at > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'school', l.school_name,
    'expires_at', l.expires_at,
    'students', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'k', s->>'k', 'nom', s->>'nom', 'pre', s->>'pre',
        'signed', EXISTS (SELECT 1 FROM public.signature_submissions x WHERE x.link_id = l.id AND x.student_key = s->>'k')
      ) ORDER BY ord)
      FROM jsonb_array_elements(l.students) WITH ORDINALITY AS t(s, ord)
    ), '[]'::jsonb)
  );
END $$;

-- 3) Une signature envoyée (image PNG en base64). Remplace la précédente de cet apprenant.
CREATE OR REPLACE FUNCTION public.sig_submit(p_token text, p_key text, p_png text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.signature_links%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.signature_links WHERE token = p_token AND NOT revoked AND expires_at > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Lien expiré ou invalide'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(l.students) s WHERE s->>'k' = p_key) THEN
    RAISE EXCEPTION 'Apprenant inconnu';
  END IF;
  IF p_png IS NULL OR left(p_png, 22) <> 'data:image/png;base64,' OR length(p_png) > 400000 THEN
    RAISE EXCEPTION 'Signature invalide';
  END IF;
  INSERT INTO public.signature_submissions (link_id, student_key, png) VALUES (l.id, p_key, p_png)
  ON CONFLICT (link_id, student_key) DO UPDATE SET png = EXCLUDED.png, imported = false, created_at = now();
  RETURN true;
END $$;

-- 4) Le prestataire récupère les signatures reçues (non encore importées).
CREATE OR REPLACE FUNCTION public.sig_pull(p_token text, p_all boolean DEFAULT false)
RETURNS TABLE (student_key text, png text, created_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.signature_links%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.signature_links WHERE token = p_token AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  IF NOT FOUND THEN RAISE EXCEPTION 'Lien introuvable'; END IF;
  RETURN QUERY
    WITH upd AS (
      UPDATE public.signature_submissions x SET imported = true WHERE x.link_id = l.id AND (p_all OR NOT x.imported)
      RETURNING x.student_key, x.png, x.created_at
    ) SELECT upd.student_key, upd.png, upd.created_at FROM upd;
END $$;

-- 5) Nombre de signatures reçues (sans les télécharger) et état du lien.
CREATE OR REPLACE FUNCTION public.sig_status(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.signature_links%ROWTYPE;
BEGIN
  SELECT * INTO l FROM public.signature_links WHERE token = p_token AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'active', (NOT l.revoked AND l.expires_at > now()), 'expires_at', l.expires_at,
    'received', (SELECT count(*) FROM public.signature_submissions x WHERE x.link_id = l.id),
    'pending', (SELECT count(*) FROM public.signature_submissions x WHERE x.link_id = l.id AND NOT x.imported));
END $$;

-- 6) Désactiver le lien.
CREATE OR REPLACE FUNCTION public.sig_revoke(p_token text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.signature_links SET revoked = true WHERE token = p_token AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.sig_link_upsert(text, text, jsonb, int), public.sig_pull(text, boolean), public.sig_status(text), public.sig_revoke(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sig_link_upsert(text, text, jsonb, int), public.sig_pull(text, boolean), public.sig_status(text), public.sig_revoke(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_link_get(text), public.sig_submit(text, text, text) TO anon, authenticated;
