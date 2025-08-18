-- Lote de MUESTRAS P2 con medidas

INSERT INTO public.muestras (
  muestreo_id, identificacion, tipo_muestra, fecha_programada_ensayo,
  fecha_programada_ensayo_ts, estado, plant_id, event_timezone,
  cube_side_cm, diameter_cm, beam_width_cm, beam_height_cm, beam_span_cm,
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
  datos.cube_side_cm::numeric,
  datos.diameter_cm::numeric,
  datos.beam_width_cm::numeric,
  datos.beam_height_cm::numeric,
  datos.beam_span_cm::numeric,
  now() as created_at,
  now() as updated_at
FROM (
  VALUES
    ('8616', 'M2', 'CUBO', '2025-09-02', '2025-09-02 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8636', 'M1', 'CUBO', '2025-09-02', '2025-09-02 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8636', 'M2', 'CUBO', '2025-09-02', '2025-09-02 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8659', 'M1', 'CUBO', '2025-08-09', '2025-08-09 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8659', 'M2', 'CUBO', '2025-08-09', '2025-08-09 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8691', 'M1', 'CUBO', '2025-08-08', '2025-08-08 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8695', 'M1', 'CUBO', '2025-08-08', '2025-08-08 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8705', 'M1', 'CUBO', '2025-09-05', '2025-09-05 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8705', 'M2', 'CUBO', '2025-09-05', '2025-09-05 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8718', 'M1', 'CUBO', '2025-09-06', '2025-09-06 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8718', 'M2', 'CUBO', '2025-09-06', '2025-09-06 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8727', 'M1', 'CUBO', '2025-09-08', '2025-09-08 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8727', 'M2', 'CUBO', '2025-09-08', '2025-09-08 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8739', 'M1', 'CUBO', '2025-09-09', '2025-09-09 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8739', 'M2', 'CUBO', '2025-09-09', '2025-09-09 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8769', 'M1', 'CUBO', '2025-08-15', '2025-08-15 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8769', 'M2', 'CUBO', '2025-08-15', '2025-08-15 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8780', 'M1', 'CUBO', '2025-09-10', '2025-09-10 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8780', 'M2', 'CUBO', '2025-09-10', '2025-09-10 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8786', 'M1', 'CUBO', '2025-08-14', '2025-08-14 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8786', 'M2', 'CUBO', '2025-08-14', '2025-08-14 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8786', 'M3', 'CUBO', '2025-08-16', '2025-08-16 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8786', 'M4', 'CUBO', '2025-08-16', '2025-08-16 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL)
) AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone, cube_side_cm, diameter_cm, beam_width_cm, beam_height_cm, beam_span_cm)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2';
