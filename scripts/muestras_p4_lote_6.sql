-- Carga masiva de muestras Planta 4 - Lote 6 de 6
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
    ('4700', 'M4', 'CUBO', '2025-07-03', '2025-07-03 22:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4705', 'M1', 'CUBO', '2025-07-03', '2025-07-03 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4705', 'M2', 'CUBO', '2025-07-03', '2025-07-03 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4705', 'M3', 'CUBO', '2025-07-03', '2025-07-03 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4705', 'M4', 'CUBO', '2025-07-03', '2025-07-03 22:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4860', 'M1', 'CUBO', '2025-07-15', '2025-07-15 04:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4860', 'M2', 'CUBO', '2025-07-15', '2025-07-15 04:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4866', 'M1', 'CUBO', '2025-07-14', '2025-07-14 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4866', 'M2', 'CUBO', '2025-07-14', '2025-07-14 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4866', 'M3', 'CUBO', '2025-07-14', '2025-07-14 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4866', 'M4', 'CUBO', '2025-07-14', '2025-07-14 22:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4867', 'M1', 'CUBO', '2025-07-14', '2025-07-14 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4867', 'M2', 'CUBO', '2025-07-14', '2025-07-14 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4867', 'M3', 'CUBO', '2025-07-14', '2025-07-14 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4867', 'M4', 'CUBO', '2025-07-14', '2025-07-14 22:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4898', 'M1', 'CUBO', '2025-07-16', '2025-07-16 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4898', 'M2', 'CUBO', '2025-07-16', '2025-07-16 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4898', 'M3', 'CUBO', '2025-07-16', '2025-07-16 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4898', 'M4', 'CUBO', '2025-07-16', '2025-07-16 22:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4904', 'M1', 'CUBO', '2025-07-16', '2025-07-16 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4904', 'M2', 'CUBO', '2025-07-16', '2025-07-16 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4904', 'M3', 'CUBO', '2025-07-16', '2025-07-16 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4904', 'M4', 'CUBO', '2025-07-16', '2025-07-16 22:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4915', 'M1', 'VIGA', '2025-07-24', '2025-07-24 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4915', 'M2', 'VIGA', '2025-07-31', '2025-07-31 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4915', 'M3', 'VIGA', '2025-08-14', '2025-08-14 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('4915', 'M4', 'VIGA', '2025-08-14', '2025-08-14 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5412', 'M1', 'CUBO', '2025-08-09', '2025-08-09 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5412', 'M2', 'CUBO', '2025-08-09', '2025-08-09 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5412', 'M3', 'CUBO', '2025-08-09', '2025-08-09 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5412', 'M4', 'CUBO', '2025-08-09', '2025-08-09 22:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5428', 'M1', 'CUBO', '2025-08-18', '2025-08-18 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5428', 'M2', 'CUBO', '2025-08-25', '2025-08-25 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5428', 'M3', 'CUBO', '2025-09-08', '2025-09-08 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5428', 'M4', 'CUBO', '2025-09-08', '2025-09-08 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),,
    ('5420', 'M1', 'VIGA', '2025-08-12', '2025-08-12 04:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City')
) AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4';