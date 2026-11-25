
-- Allow csbante to update candidates from any center
CREATE POLICY "Csbante can update all candidates"
ON public.candidates
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'csbante'::app_role))
WITH CHECK (has_role(auth.uid(), 'csbante'::app_role));

-- Allow csbante to view all user_roles (needed to list centers)
CREATE POLICY "Csbante can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'csbante'::app_role));
