-- Lote de ENSAYOS P2

INSERT INTO public.ensayos (
  muestra_id, fecha_ensayo, fecha_ensayo_ts, carga_kg,
  plant_id, event_timezone, created_at, updated_at
)
SELECT 
  mu.id as muestra_id,
  datos.fecha_ensayo::date,
  datos.fecha_ensayo_ts::timestamptz,
  datos.carga_kg::numeric,
  datos.plant_id::uuid,
  datos.event_timezone,
  now() as created_at,
  now() as updated_at
FROM (
  VALUES
    ('8134', 'M1', '2025-08-12', '2025-08-12 08:00:00', 2300.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8134', 'M2', '2025-08-12', '2025-08-12 08:00:00', 3328.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8171', 'M1', '2025-08-15', '2025-08-15 08:00:00', 62019.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8171', 'M2', '2025-08-15', '2025-08-15 08:00:00', 67698.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8179', 'M1', '2025-08-16', '2025-08-16 08:00:00', 2186.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8200', 'M1', '2025-08-16', '2025-08-16 08:00:00', 27783.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8200', 'M2', '2025-08-16', '2025-08-16 08:00:00', 34552.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8234', 'M1', '2025-08-19', '2025-08-19 08:00:00', 2425.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8263', 'M1', '2025-08-20', '2025-08-20 08:00:00', 36591.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8295', 'M1', '2025-08-20', '2025-08-20 08:00:00', 50273.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8308', 'M1', '2025-08-20', '2025-08-20 08:00:00', 63146.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8308', 'M2', '2025-08-20', '2025-08-20 08:00:00', 74928.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8318', 'M1', '2025-07-26', '2025-07-26 08:00:00', 99442.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8318', 'M2', '2025-07-26', '2025-07-26 08:00:00', 102340.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8263', 'M1', '2025-08-20', '2025-08-20 08:00:00', 33516.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8263', 'M2', '2025-08-20', '2025-08-20 08:00:00', 38871.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8295', 'M1', '2025-08-20', '2025-08-20 08:00:00', 45776.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8295', 'M2', '2025-08-20', '2025-08-20 08:00:00', 50273.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8308', 'M1', '2025-08-20', '2025-08-20 08:00:00', 74928.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8345', 'M1', '2025-08-21', '2025-08-21 08:00:00', 2514.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8366', 'M1', '2025-08-22', '2025-08-22 08:00:00', 2865.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8416', 'M1', '2025-08-23', '2025-08-23 08:00:00', 2985.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8418', 'M1', '2025-08-23', '2025-08-23 08:00:00', 2985.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8470', 'M1', '2025-07-29', '2025-07-29 08:00:00', 80985.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8470', 'M2', '2025-07-29', '2025-07-29 08:00:00', 80985.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8488', 'M1', '2025-08-26', '2025-08-26 08:00:00', 31370.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8531', 'M1', '2025-08-29', '2025-08-29 08:00:00', 65629.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8548', 'M1', '2025-08-29', '2025-08-29 08:00:00', 38925.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8552', 'M1', '2025-08-05', '2025-08-05 08:00:00', 48150.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8566', 'M1', '2025-08-31', '2025-08-31 08:00:00', 32222.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8610', 'M1', '2025-08-08', '2025-08-08 08:00:00', 117653.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8610', 'M2', '2025-08-08', '2025-08-08 08:00:00', 110000.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8691', 'M1', '2025-08-08', '2025-08-08 08:00:00', 30627.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8695', 'M1', '2025-08-08', '2025-08-08 08:00:00', 38974.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City')
) AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2'
JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;
