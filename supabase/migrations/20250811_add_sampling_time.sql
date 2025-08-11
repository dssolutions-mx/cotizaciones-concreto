-- Add sampling time at muestreo creation to support hour-aware planning

BEGIN;

ALTER TABLE public.muestreos
  ADD COLUMN IF NOT EXISTS hora_muestreo time without time zone;

-- Backfill to 12:00 if null
UPDATE public.muestreos
SET hora_muestreo = time '12:00'
WHERE hora_muestreo IS NULL;

COMMIT;


