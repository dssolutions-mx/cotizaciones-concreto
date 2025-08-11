-- Add timezone context and precise alert timestamps

BEGIN;

-- 1) Add event timezone columns to capture intended local timezone context
ALTER TABLE public.muestreos
  ADD COLUMN IF NOT EXISTS event_timezone text;

ALTER TABLE public.muestras
  ADD COLUMN IF NOT EXISTS event_timezone text;

ALTER TABLE public.ensayos
  ADD COLUMN IF NOT EXISTS event_timezone text;

-- 2) Alerts: add precise timestamp for notifications and timezone
ALTER TABLE public.alertas_ensayos
  ADD COLUMN IF NOT EXISTS fecha_alerta_ts timestamptz,
  ADD COLUMN IF NOT EXISTS event_timezone text;

-- Backfill alert timestamp at 09:00 local on the alert date (approximate)
UPDATE public.alertas_ensayos
SET fecha_alerta_ts = (fecha_alerta::timestamptz + time '09:00')
WHERE fecha_alerta IS NOT NULL AND fecha_alerta_ts IS NULL;

COMMIT;


