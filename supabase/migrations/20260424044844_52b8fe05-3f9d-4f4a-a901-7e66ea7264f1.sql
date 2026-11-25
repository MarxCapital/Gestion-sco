-- Réglage maintenance dédié aux indépendants
INSERT INTO public.app_settings (key, value, description)
VALUES ('maintenance_mode_independent', false, 'Met en maintenance uniquement les comptes indépendants')
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_settings
SET description = 'Met en maintenance la CS et les centres qui lui sont reliés'
WHERE key = 'maintenance_mode';

-- RLS : indépendants gèrent leurs candidats
CREATE POLICY "Independent can view own candidates"
ON public.candidates FOR SELECT TO authenticated
USING (center_id = auth.uid() AND public.has_role(auth.uid(), 'independent'));

CREATE POLICY "Independent can insert own candidates"
ON public.candidates FOR INSERT TO authenticated
WITH CHECK (center_id = auth.uid() AND public.has_role(auth.uid(), 'independent'));

CREATE POLICY "Independent can update own candidates"
ON public.candidates FOR UPDATE TO authenticated
USING (center_id = auth.uid() AND public.has_role(auth.uid(), 'independent'));

CREATE POLICY "Independent can delete own candidates"
ON public.candidates FOR DELETE TO authenticated
USING (center_id = auth.uid() AND public.has_role(auth.uid(), 'independent'));

-- RLS : indépendants gèrent leurs notes
CREATE POLICY "Independent can manage own notes"
ON public.notes FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = notes.candidate_id
      AND c.center_id = auth.uid()
      AND public.has_role(auth.uid(), 'independent')
  )
);

-- CS ne voit pas les candidats indépendants
DROP POLICY IF EXISTS "Csbante can view all candidates" ON public.candidates;
CREATE POLICY "Csbante can view non-independent candidates"
ON public.candidates FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'csbante')
  AND NOT public.has_role(center_id, 'independent')
);

DROP POLICY IF EXISTS "Csbante can update all candidates" ON public.candidates;
CREATE POLICY "Csbante can update non-independent candidates"
ON public.candidates FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'csbante')
  AND NOT public.has_role(center_id, 'independent')
)
WITH CHECK (
  public.has_role(auth.uid(), 'csbante')
  AND NOT public.has_role(center_id, 'independent')
);

-- CS ne voit pas les notes des indépendants
DROP POLICY IF EXISTS "Csbante can view all notes" ON public.notes;
CREATE POLICY "Csbante can view non-independent notes"
ON public.notes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'csbante')
  AND EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.id = notes.candidate_id
      AND NOT public.has_role(c.center_id, 'independent')
  )
);

-- CS ne voit pas les profils des indépendants
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'csbante')
    AND NOT public.has_role(id, 'independent')
  )
);

-- CS ne voit pas les rôles des indépendants
DROP POLICY IF EXISTS "Csbante can view all roles" ON public.user_roles;
CREATE POLICY "Csbante can view non-independent roles"
ON public.user_roles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'csbante')
  AND role <> 'independent'
);