-- 1) L'administrateur peut supprimer un guide / une fiche
GRANT DELETE ON public.class_resources TO authenticated;
DROP POLICY IF EXISTS "Admins delete class resources" ON public.class_resources;
CREATE POLICY "Admins delete class resources" ON public.class_resources
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2) PDF jusqu'à 100 Mo (dossier de stockage + contrôle à l'insertion)
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'class-resources';

CREATE OR REPLACE FUNCTION public.validate_class_resource()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.class_name NOT IN ('CI','CP','CE1','CE2','CM1','CM2') THEN RAISE EXCEPTION 'Classe non reconnue'; END IF;
 IF NEW.kind NOT IN ('guide','fiche') THEN RAISE EXCEPTION 'Type de document non reconnu'; END IF;
 IF length(trim(NEW.title)) = 0 OR length(NEW.title) > 200 THEN RAISE EXCEPTION 'Titre invalide'; END IF;
 IF NEW.file_size <= 0 OR NEW.file_size > 104857600 THEN RAISE EXCEPTION 'PDF limité à 100 Mo'; END IF;
 IF NEW.file_path <> NEW.class_name || '/' || NEW.kind || '/' || NEW.id::text || '.pdf' THEN RAISE EXCEPTION 'Chemin PDF invalide'; END IF;
 IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'class-resources' AND o.name = NEW.file_path AND o.metadata->>'mimetype' = 'application/pdf') THEN RAISE EXCEPTION 'PDF introuvable'; END IF;
 NEW.title := trim(NEW.title);
 NEW.updated_at := now();
 RETURN NEW;
END $$;
