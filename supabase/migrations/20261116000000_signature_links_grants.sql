-- Corrige « permission denied for function sig_link_upsert » : redonne le droit d'exécuter les fonctions de signature.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sig_link_upsert(text, text, jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_pull(text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_revoke(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sig_link_get(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sig_submit(text, text, text) TO anon, authenticated;
GRANT ALL ON TABLE public.signature_links TO service_role;
NOTIFY pgrst, 'reload schema';
