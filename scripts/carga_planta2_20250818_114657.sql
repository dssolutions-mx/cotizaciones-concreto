-- Script de carga masiva para Planta 2
-- Generado: 2025-08-18 11:46:57
-- Archivo fuente: archivoexcel/Registro P2 Final.csv

-- ==============================================
-- PASO 1: CREAR MUESTREOS
-- ==============================================

INSERT INTO public.muestreos (
  manual_reference, planta, fecha_muestreo, fecha_muestreo_ts, hora_muestreo,
  revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,
  sampling_type, sync_status, plant_id, event_timezone,
  created_at, updated_at
) VALUES
  ('7880', 'P2', '2025-07-07', '2025-07-07 12:40:00', '12:40:00', 23.0, 2327.21, 24.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('7881', 'P2', '2025-07-07', '2025-07-07 12:00:00', '12:00:00', 23.0, 2275.0, 34.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('7942', 'P2', '2025-07-09', '2025-07-09 00:58:59', '00:58:59', 24.0, 2324.0, 25.0, 30.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('7958', 'P2', '2025-07-09', '2025-07-09 21:27:00', '21:27:00', 23.0, 2294.0, 26.0, 30.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('7969', 'P2', '2025-07-10', '2025-07-10 02:48:00', '02:48:00', 21.0, 2302.0, 27.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('7979', 'P2', '2025-07-10', '2025-07-10 06:33:00', '06:33:00', 29.0, 2316.0, 27.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8005', 'P2', '2025-07-11', '2025-07-11 15:40:59', '15:40:59', 24.0, 2330.0, 27.0, 30.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8010', 'P2', '2025-07-11', '2025-07-11 19:36:59', '19:36:59', 72.0, 2300.0, 24.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8013', 'P2', '2025-07-11', '2025-07-11 22:32:59', '22:32:59', 21.0, 2318.0, 22.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8036', 'P2', '2025-07-13', '2025-07-13 01:12:00', '01:12:00', 22.0, 2298.0, 26.0, 26.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8094', 'P2', '2025-07-15', '2025-07-15 10:00:00', '10:00:00', 25.0, 2330.0, 31.0, 30.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8103', 'P2', '2025-07-15', '2025-07-15 12:04:59', '12:04:59', 25.0, 2324.0, 25.0, 25.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8115', 'P2', '2025-07-15', '2025-07-15 14:35:00', '14:35:00', 25.0, 2342.0, 29.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8124', 'P2', '2025-07-15', '2025-07-15 18:45:59', '18:45:59', 21.0, 2368.0, 29.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8163', 'P2', '2025-07-17', '2025-07-17 21:06:00', '21:06:00', 25.0, 2326.0, 29.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8134', 'P2', '2025-07-15', '2025-07-15 08:46:59', '08:46:59', 16.0, 2362.0, 27.0, 32.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8171', 'P2', '2025-07-18', '2025-07-18 09:44:00', '09:44:00', 22.0, 2356.0, 26.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8179', 'P2', '2025-07-19', '2025-07-19 13:30:00', '13:30:00', 15.0, 2362.0, 26.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8200', 'P2', '2025-07-19', '2025-07-19 13:30:00', '13:30:00', 21.0, 2344.0, 22.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8234', 'P2', '2025-07-22', '2025-07-22 07:32:59', '07:32:59', 14.0, 2372.0, 19.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8263', 'P2', '2025-07-23', '2025-07-23 01:16:59', '01:16:59', 24.0, 2336.0, 20.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8295', 'P2', '2025-07-23', '2025-07-23 16:00:00', '16:00:00', 60.0, 2322.0, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8308', 'P2', '2025-07-23', '2025-07-23 19:16:59', '19:16:59', 22.0, 2348.0, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8318', 'P2', '2025-07-23', '2025-07-23 22:12:00', '22:12:00', 20.0, 2330.0, 18.0, 26.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8263', 'P2', '2025-07-23', '2025-07-23 01:18:59', '01:18:59', 24.0, 2337.0, 20.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8295', 'P2', '2025-07-23', '2025-07-23 16:00:00', '16:00:00', 60.0, 2323.0, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8308', 'P2', '2025-07-23', '2025-07-23 19:16:59', '19:16:59', 22.0, 2349.0, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8345', 'P2', '2025-07-24', '2025-07-24 10:54:00', '10:54:00', 14.0, 2373.0, 24.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8366', 'P2', '2025-07-25', '2025-07-25 08:59:00', '08:59:00', 13.0, 2375.0, 23.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8416', 'P2', '2025-07-26', '2025-07-26 09:13:59', '09:13:59', 14.0, 2355.0, 24.0, 27.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8418', 'P2', '2025-07-26', '2025-07-26 09:51:59', '09:51:59', 14.0, 2359.0, 25.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8470', 'P2', '2025-07-28', '2025-07-28 17:50:00', '17:50:00', 22.0, 2347.0, 26.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8488', 'P2', '2025-07-29', '2025-07-29 13:18:59', '13:18:59', 25.0, 2361.0, 25.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8531', 'P2', '2025-08-01', '2025-08-01 18:38:00', '18:38:00', 21.0, 2343.0, 25.0, 27.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8548', 'P2', '2025-08-01', '2025-08-01 20:53:00', '20:53:00', 24.0, 2341.0, 20.0, 26.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8552', 'P2', '2025-08-02', '2025-08-02 18:38:00', '18:38:00', 21.0, 2337.0, 22.0, 26.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8566', 'P2', '2025-08-03', '2025-08-03 00:36:59', '00:36:59', 20.0, 2345.0, 20.0, 24.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8579', 'P2', '2025-08-04', '2025-08-04 15:31:59', '15:31:59', 24.0, 2347.0, 25.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8596', 'P2', '2025-08-05', '2025-08-05 00:15:59', '00:15:59', 25.0, 2351.0, 23.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8610', 'P2', '2025-08-05', '2025-08-05 11:12:00', '11:12:00', 22.0, 2328.0, 24.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8616', 'P2', '2025-08-05', '2025-08-05 12:24:00', '12:24:00', 61.0, 2342.0, 24.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8636', 'P2', '2025-08-05', '2025-08-05 16:14:59', '16:14:59', 21.0, 2348.0, 24.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8659', 'P2', '2025-08-06', '2025-08-06 16:52:59', '16:52:59', 24.0, 2342.0, 31.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8691', 'P2', '2025-08-07', '2025-08-07 16:09:00', '16:09:00', 25.0, 2342.0, 32.0, 30.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8695', 'P2', '2025-08-07', '2025-08-07 21:11:00', '21:11:00', 21.0, 2364.0, 28.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8705', 'P2', '2025-08-08', '2025-08-08 15:24:59', '15:24:59', 25.0, 2328.0, 35.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8718', 'P2', '2025-08-09', '2025-08-09 08:35:00', '08:35:00', 21.0, 2364.0, 24.0, 27.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8727', 'P2', '2025-08-11', '2025-08-11 08:37:00', '08:37:00', 25.0, 2332.0, 32.0, 28.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8739', 'P2', '2025-08-12', '2025-08-12 10:45:59', '10:45:59', 22.0, 2379.0, 32.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8769', 'P2', '2025-08-12', '2025-08-12 00:11:00', '00:11:00', 63.0, 2379.0, 27.0, 25.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8780', 'P2', '2025-08-13', '2025-08-13 14:59:00', '14:59:00', 22.0, 2353.0, 30.0, 30.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now()),
  ('8786', 'P2', '2025-08-13', '2025-08-13 19:05:00', '19:05:00', 60.0, 2369.0, 26.0, 29.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now());

-- Muestreos creados: 52

-- ==============================================
-- PASO 2: CREAR MUESTRAS
-- ==============================================

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
    ('7880', 'M1', 'CUBO', '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7880', 'M2', 'CUBO', '2025-07-21', '2025-07-21 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7880', 'M3', 'CUBO', '2025-08-04', '2025-08-04 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7880', 'M4', 'CUBO', '2025-08-04', '2025-08-04 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7881', 'M1', 'CUBO', '2025-07-21', '2025-07-21 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7881', 'M2', 'CUBO', '2025-08-04', '2025-08-04 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7881', 'M3', 'CUBO', '2025-08-04', '2025-08-04 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7942', 'M1', 'CUBO', '2025-07-16', '2025-07-16 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('7942', 'M2', 'CUBO', '2025-07-23', '2025-07-23 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('7942', 'M3', 'CUBO', '2025-08-06', '2025-08-06 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7942', 'M4', 'CUBO', '2025-08-06', '2025-08-06 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7958', 'M1', 'CUBO', '2025-07-16', '2025-07-16 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7958', 'M2', 'CUBO', '2025-07-23', '2025-07-23 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7958', 'M3', 'CUBO', '2025-08-06', '2025-08-06 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7958', 'M4', 'CUBO', '2025-08-06', '2025-08-06 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7969', 'M1', 'CUBO', '2025-07-13', '2025-07-13 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7969', 'M2', 'CUBO', '2025-07-13', '2025-07-13 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7979', 'M1', 'CUBO', '2025-07-13', '2025-07-13 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('7979', 'M2', 'CUBO', '2025-07-13', '2025-07-13 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8005', 'M1', 'CUBO', '2025-07-18', '2025-07-18 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8005', 'M2', 'CUBO', '2025-07-25', '2025-07-25 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8005', 'M3', 'CUBO', '2025-08-08', '2025-08-08 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8005', 'M4', 'CUBO', '2025-08-08', '2025-08-08 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8010', 'M1', 'CUBO', '2025-07-12', '2025-07-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8010', 'M2', 'CUBO', '2025-07-12', '2025-07-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8010', 'M3', 'CUBO', '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8010', 'M4', 'CUBO', '2025-07-14', '2025-07-14 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8013', 'M1', 'CUBO', '2025-07-12', '2025-07-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8013', 'M2', 'CUBO', '2025-07-12', '2025-07-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8013', 'M3', 'CUBO', '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8013', 'M4', 'CUBO', '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8036', 'M1', 'CUBO', '2025-08-10', '2025-08-10 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8036', 'M2', 'CUBO', '2025-08-10', '2025-08-10 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8094', 'M1', 'CUBO', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8094', 'M2', 'CUBO', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8103', 'M1', 'CUBO', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8103', 'M2', 'CUBO', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8115', 'M1', 'CUBO', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8115', 'M2', 'CUBO', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8124', 'M1', 'CUBO', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8124', 'M2', 'CUBO', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8163', 'M1', 'CUBO', '2025-08-14', '2025-08-14 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8163', 'M2', 'CUBO', '2025-08-14', '2025-08-14 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8134', 'M1', 'VIGA', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, NULL, NULL, NULL, NULL),
    ('8134', 'M2', 'VIGA', '2025-08-12', '2025-08-12 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, NULL, NULL, NULL, NULL),
    ('8171', 'M1', 'CUBO', '2025-08-15', '2025-08-15 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8171', 'M2', 'CUBO', '2025-08-15', '2025-08-15 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8179', 'M1', 'VIGA', '2025-08-16', '2025-08-16 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, NULL, NULL, NULL, NULL),
    ('8200', 'M1', 'CUBO', '2025-08-16', '2025-08-16 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8200', 'M2', 'CILINDRO', '2025-08-16', '2025-08-16 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, 10.0, NULL, NULL, NULL),
    ('8234', 'M1', 'VIGA', '2025-08-19', '2025-08-19 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, NULL, NULL, NULL, NULL),
    ('8263', 'M1', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8295', 'M1', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8308', 'M1', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8308', 'M2', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8318', 'M1', 'CUBO', '2025-07-26', '2025-07-26 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8318', 'M2', 'CUBO', '2025-07-26', '2025-07-26 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8263', 'M1', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8263', 'M2', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8295', 'M1', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8295', 'M2', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8308', 'M1', 'CUBO', '2025-08-20', '2025-08-20 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8345', 'M1', 'VIGA', '2025-08-21', '2025-08-21 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, NULL, NULL, NULL, NULL),
    ('8366', 'M1', 'VIGA', '2025-08-22', '2025-08-22 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, NULL, NULL, NULL, NULL),
    ('8416', 'M1', 'VIGA', '2025-08-23', '2025-08-23 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, NULL, NULL, NULL, NULL),
    ('8418', 'M1', 'VIGA', '2025-08-23', '2025-08-23 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', NULL, NULL, NULL, NULL, NULL),
    ('8470', 'M1', 'CUBO', '2025-07-29', '2025-07-29 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8470', 'M2', 'CUBO', '2025-07-29', '2025-07-29 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8488', 'M1', 'CUBO', '2025-08-26', '2025-08-26 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8531', 'M1', 'CUBO', '2025-08-29', '2025-08-29 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8548', 'M1', 'CUBO', '2025-08-29', '2025-08-29 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8552', 'M1', 'CUBO', '2025-08-05', '2025-08-05 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8566', 'M1', 'CUBO', '2025-08-31', '2025-08-31 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8579', 'M1', 'CUBO', '2025-09-01', '2025-09-01 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8579', 'M2', 'CUBO', '2025-09-01', '2025-09-01 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8596', 'M1', 'CUBO', '2025-09-02', '2025-09-02 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8596', 'M2', 'CUBO', '2025-09-02', '2025-09-02 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
    ('8610', 'M1', 'CUBO', '2025-08-08', '2025-08-08 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8610', 'M2', 'CUBO', '2025-08-08', '2025-08-08 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 15.0, NULL, NULL, NULL, NULL),
    ('8616', 'M1', 'CUBO', '2025-09-02', '2025-09-02 08:00:00', 'PENDIENTE', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', 10.0, NULL, NULL, NULL, NULL),
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

-- Muestras creadas: 103

-- ==============================================
-- PASO 3: CREAR ENSAYOS
-- ==============================================

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
    ('8163', 'M2', '2025-08-14', '2025-08-14 08:00:00', 48628.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City'),
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

-- Ensayos creados: 74

-- ==============================================
-- PASO 4: VERIFICACIONES
-- ==============================================

-- Verificar muestreos creados
SELECT 'Muestreos P2' as tabla, COUNT(*) as total
FROM public.muestreos 
WHERE planta = 'P2' AND DATE(created_at) = CURRENT_DATE;

-- Verificar muestras por estado
SELECT 
  'Muestras P2' as tabla,
  estado,
  COUNT(*) as total
FROM public.muestras mu
JOIN public.muestreos m ON m.id = mu.muestreo_id
WHERE m.planta = 'P2' AND DATE(mu.created_at) = CURRENT_DATE
GROUP BY estado;

-- Verificar ensayos creados
SELECT 'Ensayos P2' as tabla, COUNT(*) as total
FROM public.ensayos e
JOIN public.muestras mu ON mu.id = e.muestra_id
JOIN public.muestreos m ON m.id = mu.muestreo_id
WHERE m.planta = 'P2' AND DATE(e.created_at) = CURRENT_DATE;

-- FIN DEL SCRIPT
