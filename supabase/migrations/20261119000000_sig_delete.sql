-- Suppression d'une signature reçue par lien (le directeur pourra alors refaire signer l'apprenant) + droits.
CREATE OR REPLACE FUNCTION public.sig_delete(p_token text, p_key text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.signature_links%ROWTYPE; n integer;
BEGIN
  SELECT * INTO l FROM public.signature_links WHERE token = p_token AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  IF NOT FOUND THEN RAISE EXCEPTION 'Lien introuvable'; END IF;
  DELETE FROM public.signature_submissions x WHERE x.link_id = l.id AND (p_key IS NULL OR x.student_key = p_key);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.sig_delete(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sig_delete(text, text) TO authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sig_link_upsert(text, text, jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_pull(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_revoke(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_link_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sig_submit(text, text, text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
