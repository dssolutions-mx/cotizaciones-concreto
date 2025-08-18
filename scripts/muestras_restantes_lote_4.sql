-- Muestras P4 Corregidas - Lote directo 4
INSERT INTO public.muestras (
  muestreo_id, identificacion, tipo_muestra, fecha_programada_ensayo,
  fecha_programada_ensayo_ts, estado, plant_id, event_timezone,
  created_at, updated_at
)
SELECT 
  m.id as muestreo_id,
  datos.identificacion,
  datos.tipo_muestra,
  datos.fecha_programada_ensayo::date,
  datos.fecha_programada_ensayo_ts::timestamptz,
  datos.estado,
  datos.plant_id::uuid,
  datos.event_timezone,
  now() as created_at,
  now() as updated_at
FROM (
  VALUES
    ('5428', 'M4', 'CUBO', '2025-09-08', '2025-09-08 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5420', 'M1', 'VIGA', '2025-08-12', '2025-08-12 11:50:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City')
) AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4';