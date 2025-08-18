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
    ('7880', 'M1', '2025-07-14', '2025-07-14 08:00:00', 43910.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7880', 'M2', '2025-07-21', '2025-07-21 08:00:00', 46580.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7881', 'M1', '2025-07-21', '2025-07-21 08:00:00', 46580.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7881', 'M2', '2025-08-04', '2025-08-04 08:00:00', 66515.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7881', 'M3', '2025-08-04', '2025-08-04 08:00:00', 66717.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7942', 'M1', '2025-07-16', '2025-07-16 08:00:00', 77800.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7942', 'M2', '2025-07-23', '2025-07-23 08:00:00', 48700.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7942', 'M3', '2025-08-06', '2025-08-06 08:00:00', 48750.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7942', 'M4', '2025-08-06', '2025-08-06 08:00:00', 49378.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7958', 'M1', '2025-07-16', '2025-07-16 08:00:00', 58830.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7958', 'M2', '2025-07-23', '2025-07-23 08:00:00', 49900.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7958', 'M3', '2025-08-06', '2025-08-06 08:00:00', 63117.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7958', 'M4', '2025-08-06', '2025-08-06 08:00:00', 64115.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7969', 'M1', '2025-07-13', '2025-07-13 08:00:00', 43500.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7969', 'M2', '2025-07-13', '2025-07-13 08:00:00', 43500.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7979', 'M1', '2025-07-13', '2025-07-13 08:00:00', 40710.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('7979', 'M2', '2025-07-13', '2025-07-13 08:00:00', 43500.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8005', 'M1', '2025-07-18', '2025-07-18 08:00:00', 80100.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8005', 'M2', '2025-07-25', '2025-07-25 08:00:00', 98150.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8005', 'M3', '2025-08-08', '2025-08-08 08:00:00', 99151.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8005', 'M4', '2025-08-08', '2025-08-08 08:00:00', 62112.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8010', 'M1', '2025-07-12', '2025-07-12 08:00:00', 64760.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8010', 'M2', '2025-07-12', '2025-07-12 08:00:00', 64760.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8010', 'M3', '2025-07-14', '2025-07-14 08:00:00', 68610.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8013', 'M1', '2025-07-12', '2025-07-12 08:00:00', 33100.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8013', 'M2', '2025-07-12', '2025-07-12 08:00:00', 68600.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8013', 'M3', '2025-07-14', '2025-07-14 08:00:00', 41210.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8013', 'M4', '2025-07-14', '2025-07-14 08:00:00', 90000.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8036', 'M1', '2025-08-10', '2025-08-10 08:00:00', 69990.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8036', 'M2', '2025-08-10', '2025-08-10 08:00:00', 69990.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8094', 'M1', '2025-08-12', '2025-08-12 08:00:00', 102133.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8094', 'M2', '2025-08-12', '2025-08-12 08:00:00', 102133.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8103', 'M1', '2025-08-12', '2025-08-12 08:00:00', 94507.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8103', 'M2', '2025-08-12', '2025-08-12 08:00:00', 94507.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8115', 'M1', '2025-08-12', '2025-08-12 08:00:00', 119943.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8115', 'M2', '2025-08-12', '2025-08-12 08:00:00', 119943.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8124', 'M1', '2025-08-12', '2025-08-12 08:00:00', 45424.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8124', 'M2', '2025-08-12', '2025-08-12 08:00:00', 458733.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8163', 'M1', '2025-08-14', '2025-08-14 08:00:00', 29940.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
    ('8163', 'M2', '2025-08-14', '2025-08-14 08:00:00', 48628.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City')
) AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2'
JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;
