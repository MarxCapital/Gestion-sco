CREATE OR REPLACE FUNCTION public.normalize_resource_class(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT upper(regexp_replace(coalesce(value, ''), '[[:space:]]', '', 'g')) $$;

CREATE TABLE public.class_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 class_name text NOT NULL,
 kind text NOT NULL,
 title text NOT NULL,
 file_path text NOT NULL UNIQUE,
 original_name text NOT NULL,
 file_size bigint NOT NULL,
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.class_resources TO authenticated;
GRANT ALL ON public.class_resources TO service_role;
ALTER TABLE public.class_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read class resources" ON public.class_resources FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins publish class resources" ON public.class_resources FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());
CREATE POLICY "Schools read their class resources" ON public.class_resources FOR SELECT TO authenticated USING (
 public.has_role(auth.uid(), 'school') AND EXISTS (
 SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND public.normalize_resource_class(p.class_name) = class_resources.class_name
 ));
CREATE INDEX class_resources_class_kind_idx ON public.class_resources(class_name, kind, created_at);

CREATE OR REPLACE FUNCTION public.validate_class_resource()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.class_name NOT IN ('CI','CP','CE1','CE2','CM1','CM2') THEN RAISE EXCEPTION 'Classe non reconnue'; END IF;
 IF NEW.kind NOT IN ('guide','fiche') THEN RAISE EXCEPTION 'Type de document non reconnu'; END IF;
 IF length(trim(NEW.title)) = 0 OR length(NEW.title) > 200 THEN RAISE EXCEPTION 'Titre invalide'; END IF;
 IF NEW.file_size <= 0 OR NEW.file_size > 20971520 THEN RAISE EXCEPTION 'PDF limité à 20 Mo'; END IF;
 IF NEW.file_path <> NEW.class_name || '/' || NEW.kind || '/' || NEW.id::text || '.pdf' THEN RAISE EXCEPTION 'Chemin PDF invalide'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'class-resources' AND o.name = NEW.file_path AND o.metadata->>'mimetype' = 'application/pdf') THEN RAISE EXCEPTION 'PDF introuvable'; END IF;
 NEW.title := trim(NEW.title);
 NEW.updated_at := now();
 RETURN NEW;
END $$;
CREATE TRIGGER validate_class_resource BEFORE INSERT OR UPDATE ON public.class_resources FOR EACH ROW EXECUTE FUNCTION public.validate_class_resource();

CREATE POLICY "Admins upload class PDFs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 bucket_id = 'class-resources' AND public.has_role(auth.uid(), 'admin') AND lower(storage.extension(name)) = 'pdf' AND metadata->>'mimetype' = 'application/pdf'
);
CREATE POLICY "Admins read class PDFs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'class-resources' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins clean failed class uploads" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'class-resources' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Schools read matching class PDFs" ON storage.objects FOR SELECT TO authenticated USING (
 bucket_id = 'class-resources' AND public.has_role(auth.uid(), 'school') AND EXISTS (
 SELECT 1 FROM public.class_resources r JOIN public.profiles p ON p.id = auth.uid()
 WHERE r.file_path = storage.objects.name AND r.class_name = public.normalize_resource_class(p.class_name)
 ));