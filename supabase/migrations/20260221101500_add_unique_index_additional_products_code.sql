-- Hardening: enforce unique business code for additional products.
-- This migration is defensive: it normalizes empty codes and resolves duplicates
-- before creating the unique index.

UPDATE public.additional_products
SET code = 'ADDL-' || LEFT(id::text, 8)
WHERE code IS NULL OR btrim(code) = '';

WITH ranked AS (
  SELECT
    id,
    code,
    ROW_NUMBER() OVER (
      PARTITION BY code
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.additional_products
)
UPDATE public.additional_products ap
SET code = ap.code || '-DUP-' || ranked.rn::text
FROM ranked
WHERE ap.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_additional_products_code_unique
  ON public.additional_products(code);

