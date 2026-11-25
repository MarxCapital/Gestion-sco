
ALTER TABLE public.candidates ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY center_id ORDER BY nom, prenoms) as rn
  FROM public.candidates
)
UPDATE public.candidates SET sort_order = ranked.rn
FROM ranked WHERE candidates.id = ranked.id;
