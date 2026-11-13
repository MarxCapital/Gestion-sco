-- Élèves : date et lieu de naissance (extraits en même temps que le matricule, le nom, les prénoms et le sexe)
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_naissance text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS lieu_naissance text;
