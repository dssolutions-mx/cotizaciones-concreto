-- SCRIPT P4 CON DIMENSIONES ESPECÍFICAS CORRECTAS
-- Generado: 2025-08-17 21:54:09
-- SOLUCIÓN: cube_side_cm para distinguir 10x10 vs 15x15
-- CAMPOS: cube_side_cm, beam_width_cm, beam_height_cm, beam_span_cm

-- ==========================================
-- PASO 1: CREAR MUESTREOS
-- ==========================================

INSERT INTO public.muestreos (
  manual_reference, planta, fecha_muestreo, fecha_muestreo_ts, hora_muestreo,
  revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,
  sampling_type, sync_status, plant_id, event_timezone,
  created_at, updated_at
) VALUES
  ('4250', 'P4', '2025-02-02', '2025-02-02 01:52:00', '01:52:00', 21.0, 2402.32125, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4119', 'P4', '2025-05-19', '2025-05-19 14:00:00', '14:00:00', 82.0, 2402.32125, 20.0, 29.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4125', 'P4', '2025-05-22', '2025-05-22 19:50:00', '19:50:00', 83.0, 2402.32125, 19.0, 29.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4130', 'P4', '2025-05-24', '2025-05-24 21:15:00', '21:15:00', 83.0, 2402.32125, 19.0, 28.8, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4140', 'P4', '2025-05-25', '2025-05-25 16:35:00', '16:35:00', 21.0, 2382.42625, 20.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4158', 'P4', '2025-05-26', '2025-05-26 17:08:00', '17:08:00', 22.0, 2382.42625, 20.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4178', 'P4', '2025-05-28', '2025-05-28 19:30:00', '19:30:00', 22.0, 2422.21625, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4175', 'P4', '2025-05-28', '2025-05-28 17:15:00', '17:15:00', 81.0, 2422.21625, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4182', 'P4', '2025-05-29', '2025-05-29 17:20:00', '17:20:00', 21.0, 2422.21625, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4189', 'P4', '2025-05-30', '2025-05-30 09:11:00', '09:11:00', 22.0, 2402.32125, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4200', 'P4', '2025-05-30', '2025-05-30 18:21:00', '18:21:00', 21.0, 2422.21625, 21.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4201', 'P4', '2025-05-31', '2025-05-31 10:32:00', '10:32:00', 22.0, 2402.32125, 21.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4211', 'P4', '2025-05-31', '2025-05-31 15:04:00', '15:04:00', 70.0, 2442.11125, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4212', 'P4', '2025-05-31', '2025-05-31 15:33:00', '15:33:00', 22.0, 2402.32125, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4228', 'P4', '2025-05-31', '2025-05-31 21:35:00', '21:35:00', 25.0, 2442.11125, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4207', 'P4', '2025-05-31', '2025-05-31 13:10:00', '13:10:00', 83.0, 2402.32125, 21.0, 29.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4239', 'P4', '2025-06-02', '2025-06-02 16:35:00', '16:35:00', 22.0, 2402.32125, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4268', 'P4', '2025-06-03', '2025-06-03 21:05:00', '21:05:00', 82.0, 2422.21625, 19.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4272', 'P4', '2025-06-04', '2025-06-04 11:40:00', '11:40:00', 22.0, 2422.21625, 20.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4284', 'P4', '2025-06-04', '2025-06-04 17:39:00', '17:39:00', 75.0, 2442.11125, 20.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4302', 'P4', '2025-06-05', '2025-06-05 17:24:00', '17:24:00', 22.0, 2402.32125, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4307', 'P4', '2025-06-05', '2025-06-05 21:30:00', '21:30:00', 82.0, 2422.21625, 21.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4332', 'P4', '2025-06-06', '2025-06-06 23:58:00', '23:58:00', 22.0, 2422.21625, 19.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4321', 'P4', '2025-06-06', '2025-06-06 18:40:00', '18:40:00', 83.0, 2402.32125, 20.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4339', 'P4', '2025-06-07', '2025-06-07 09:17:00', '09:17:00', 22.0, 2442.11125, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4339', 'P4', '2025-06-07', '2025-06-07 09:17:00', '09:17:00', 75.0, 2442.11125, 20.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4343', 'P4', '2025-06-09', '2025-06-09 19:30:00', '19:30:00', 82.0, 2402.32125, 21.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4366', 'P4', '2025-06-10', '2025-06-10 16:58:00', '16:58:00', 25.0, 2422.21625, 21.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4368', 'P4', '2025-06-10', '2025-06-10 19:00:00', '19:00:00', 84.0, 2422.21625, 19.0, 30.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4387', 'P4', '2025-06-12', '2025-06-12 18:30:00', '18:30:00', 83.0, 2402.32125, 21.0, 30.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4396', 'P4', '2025-06-12', '2025-06-12 20:00:00', '20:00:00', 83.0, 2402.32125, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4401', 'P4', '2025-06-13', '2025-06-13 22:53:00', '22:53:00', 22.0, 2442.11125, 20.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4411', 'P4', '2025-06-16', '2025-06-16 04:31:00', '04:31:00', 25.0, 2422.21625, 20.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4450', 'P4', '2025-06-16', '2025-06-16 17:23:00', '17:23:00', 22.0, 2422.21625, 21.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4452', 'P4', '2025-06-17', '2025-06-17 06:42:00', '06:42:00', 21.0, 2442.11125, 20.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4420', 'P4', '2025-06-17', '2025-06-17 09:24:00', '09:24:00', 72.0, 2422.21625, 20.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4474', 'P4', '2025-06-17', '2025-06-17 23:50:00', '23:50:00', 22.0, 2422.21625, 19.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4457', 'P4', '2025-06-17', '2025-06-17 13:15:00', '13:15:00', 81.0, 2402.32125, 21.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4461', 'P4', '2025-06-17', '2025-06-17 19:10:00', '19:10:00', 71.0, 2402.32125, 18.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4469', 'P4', '2025-06-17', '2025-06-17 22:00:00', '22:00:00', 22.0, 2422.21625, 18.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4476', 'P4', '2025-06-18', '2025-06-18 11:06:00', '11:06:00', 22.0, 2402.32125, 19.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4481', 'P4', '2025-06-18', '2025-06-18 13:30:00', '13:30:00', 82.0, 2382.42625, 21.0, 29.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4496', 'P4', '2025-06-18', '2025-06-18 20:15:00', '20:15:00', 73.0, 2422.21625, 18.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4509', 'P4', '2025-06-19', '2025-06-19 18:00:00', '18:00:00', 82.0, 2402.32125, 20.0, 30.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4511', 'P4', '2025-06-19', '2025-06-19 19:35:00', '19:35:00', 83.0, 2402.32125, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4502', 'P4', '2025-06-19', '2025-06-19 11:40:00', '11:40:00', 25.0, 2422.21625, 19.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4522', 'P4', '2025-06-19', '2025-06-19 00:15:00', '00:15:00', 22.0, 2382.42625, 18.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4551', 'P4', '2025-06-20', '2025-06-20 02:00:00', '02:00:00', 83.0, 2382.42625, 18.0, 30.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4566', 'P4', '2025-06-23', '2025-06-23 16:30:00', '16:30:00', 22.0, 2422.21625, 21.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4571', 'P4', '2025-06-23', '2025-06-23 22:30:00', '22:30:00', 83.0, 2402.32125, 19.0, 30.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4576', 'P4', '2025-06-24', '2025-06-24 22:30:00', '22:30:00', 83.0, 2422.21625, 19.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4581', 'P4', '2025-06-24', '2025-06-24 00:00:00', '00:00:00', 84.0, 2422.21625, 19.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4595', 'P4', '2025-06-25', '2025-06-25 14:22:00', '14:22:00', 25.0, 2442.11125, 21.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4605', 'P4', '2025-06-25', '2025-06-25 21:00:00', '21:00:00', 83.0, 2402.32125, 19.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4628', 'P4', '2025-06-26', '2025-06-26 20:50:00', '20:50:00', 85.0, 2382.42625, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4633', 'P4', '2025-06-26', '2025-06-26 22:30:00', '22:30:00', 83.0, 2422.21625, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4658', 'P4', '2025-06-30', '2025-06-30 19:30:00', '19:30:00', 81.0, 2402.32125, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4663', 'P4', '2025-06-30', '2025-06-30 21:00:00', '21:00:00', 81.0, 2402.32125, 20.0, 30.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4669', 'P4', '2025-07-01', '2025-07-01 18:00:00', '18:00:00', 80.0, 2414.25825, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4669', 'P4', '2025-07-01', '2025-07-01 20:45:00', '20:45:00', 82.0, 2402.32125, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4683', 'P4', '2025-07-02', '2025-07-02 14:30:00', '14:30:00', 82.0, 2402.32125, 19.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4690', 'P4', '2025-07-02', '2025-07-02 19:45:00', '19:45:00', 82.0, 2402.32125, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4710', 'P4', '2025-07-03', '2025-07-03 23:48:00', '23:48:00', 21.0, 2422.21625, 18.0, 28.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4700', 'P4', '2025-07-03', '2025-07-03 19:00:00', '19:00:00', 82.0, 2382.42625, 18.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4705', 'P4', '2025-07-03', '2025-07-03 21:15:00', '21:15:00', 81.0, 2422.21625, 18.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4860', 'P4', '2025-07-14', '2025-07-14 13:15:00', '13:15:00', 22.0, 2418.23725, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4866', 'P4', '2025-07-14', '2025-07-14 17:00:00', '17:00:00', 83.0, 2414.25825, 20.0, 31.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4867', 'P4', '2025-07-14', '2025-07-14 18:00:00', '18:00:00', 82.0, 2422.21625, 20.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4898', 'P4', '2025-07-16', '2025-07-16 21:02:00', '21:02:00', 81.0, 2412.26875, 19.0, 30.1, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4904', 'P4', '2025-07-16', '2025-07-16 22:49:00', '22:49:00', 82.0, 2382.42625, 20.0, 30.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('4915', 'P4', '2025-07-17', '2025-07-17 08:23:00', '08:23:00', 15.0, 2485.88025, 20.0, 26.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('5412', 'P4', '2025-08-09', '2025-08-09 21:10:00', '21:10:00', 81.0, 2412.26875, 19.0, 31.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('5428', 'P4', '2025-08-11', '2025-08-11 10:24:00', '10:24:00', 21.0, 2382.42625, 20.0, 29.0, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now()),
  ('5420', 'P4', '2025-08-11', '2025-08-11 07:50:00', '07:50:00', 14.0, 2485.88025, 18.0, 28.5, 'REMISION_LINKED', 'SYNCED', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City', now(), now());

-- Muestreos creados: 74

-- ==========================================
-- PASO 2: CREAR MUESTRAS CON DIMENSIONES ESPECÍFICAS
-- ==========================================

INSERT INTO public.muestras (
  muestreo_id, identificacion, tipo_muestra, 
  cube_side_cm, beam_width_cm, beam_height_cm, beam_span_cm,
  fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, 
  plant_id, event_timezone, created_at, updated_at
)
SELECT 
  m.id as muestreo_id,
  datos.identificacion,
  datos.tipo_muestra,
  datos.cube_side_cm,
  datos.beam_width_cm,
  datos.beam_height_cm,
  datos.beam_span_cm,
  datos.fecha_programada_ensayo::date,
  datos.fecha_programada_ensayo_ts::timestamptz,
  datos.estado,
  datos.plant_id::uuid,
  datos.event_timezone,
  now() as created_at,
  now() as updated_at
FROM (
  VALUES
    ('4250', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-02-09', '2025-02-09 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4250', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-02-16', '2025-02-16 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4250', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-03-02', '2025-03-02 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4250', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-03-02', '2025-03-02 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4119', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-05-20', '2025-05-20 04:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4119', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-05-20', '2025-05-20 04:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4119', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-05-20', '2025-05-20 12:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4119', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-05-20', '2025-05-20 14:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4125', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-05-23', '2025-05-23 09:50:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4125', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-05-23', '2025-05-23 13:50:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4125', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-05-23', '2025-05-23 15:50:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4125', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-05-23', '2025-05-23 19:50:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4130', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-05-25', '2025-05-25 13:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4130', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-05-25', '2025-05-25 17:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4130', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-05-25', '2025-05-25 21:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4130', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-05-25', '2025-05-25 21:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4140', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-01', '2025-06-01 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4140', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-08', '2025-06-08 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4140', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-22', '2025-06-22 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4140', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-22', '2025-06-22 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4158', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-02', '2025-06-02 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4158', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-09', '2025-06-09 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4158', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-23', '2025-06-23 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4158', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-23', '2025-06-23 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4178', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-04', '2025-06-04 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4178', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-11', '2025-06-11 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4178', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-25', '2025-06-25 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4178', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-25', '2025-06-25 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4175', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-05-29', '2025-05-29 09:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4175', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-05-29', '2025-05-29 11:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4175', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-05-29', '2025-05-29 13:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4175', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-05-29', '2025-05-29 13:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4182', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-05', '2025-06-05 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4182', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-12', '2025-06-12 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4182', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4182', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4189', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-06', '2025-06-06 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4189', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-13', '2025-06-13 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4189', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4189', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4200', 'M1', 'CUBO', 15, NULL, NULL, NULL, '2025-06-06', '2025-06-06 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 15x15 cm
    ('4200', 'M2', 'CUBO', 15, NULL, NULL, NULL, '2025-06-13', '2025-06-13 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 15x15 cm
    ('4200', 'M3', 'CUBO', 15, NULL, NULL, NULL, '2025-06-27', '2025-06-27 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 15x15 cm
    ('4200', 'M4', 'CUBO', 15, NULL, NULL, NULL, '2025-06-27', '2025-06-27 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 15x15 cm
    ('4201', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4201', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-14', '2025-06-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4201', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-28', '2025-06-28 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4201', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-28', '2025-06-28 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4211', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4211', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-14', '2025-06-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4211', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-28', '2025-06-28 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4211', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-28', '2025-06-28 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4212', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4212', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-14', '2025-06-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4212', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-28', '2025-06-28 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4212', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-28', '2025-06-28 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4228', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4228', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-14', '2025-06-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4228', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-28', '2025-06-28 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4228', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-28', '2025-06-28 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4207', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-01', '2025-06-01 03:10:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4207', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-01', '2025-06-01 07:10:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4207', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-01', '2025-06-01 09:10:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4207', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-01', '2025-06-01 13:10:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4239', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-09', '2025-06-09 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4239', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-16', '2025-06-16 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4239', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-30', '2025-06-30 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4239', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-30', '2025-06-30 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4268', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-04', '2025-06-04 12:05:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4268', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-04', '2025-06-04 13:05:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4268', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-04', '2025-06-04 21:05:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4268', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-04', '2025-06-04 21:05:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4272', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-05', '2025-06-05 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4272', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-05', '2025-06-05 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4272', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4272', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4284', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-11', '2025-06-11 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4284', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-18', '2025-06-18 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4284', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4284', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4302', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-12', '2025-06-12 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4302', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-19', '2025-06-19 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4302', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4302', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4307', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-06', '2025-06-06 12:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4307', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-06', '2025-06-06 13:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4307', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-06', '2025-06-06 15:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4307', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-06', '2025-06-06 17:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4332', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4332', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4332', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-09', '2025-06-09 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4332', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-09', '2025-06-09 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4321', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 08:40:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4321', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 12:40:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4321', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 14:40:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4321', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-07', '2025-06-07 18:40:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4339', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-08', '2025-06-08 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4339', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-08', '2025-06-08 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4339', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-10', '2025-06-10 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4339', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-10', '2025-06-10 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4339', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-08', '2025-06-08 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4339', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-08', '2025-06-08 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4339', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-10', '2025-06-10 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4339', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-10', '2025-06-10 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4343', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-10', '2025-06-10 09:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4343', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-10', '2025-06-10 11:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4343', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-10', '2025-06-10 13:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4343', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-10', '2025-06-10 15:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4366', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-17', '2025-06-17 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4366', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4366', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-08', '2025-07-08 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4366', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-08', '2025-07-08 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4368', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-11', '2025-06-11 11:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4368', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-11', '2025-06-11 13:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4368', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-11', '2025-06-11 15:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4368', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-11', '2025-06-11 15:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4387', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-13', '2025-06-13 10:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4387', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-13', '2025-06-13 12:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4396', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-13', '2025-06-13 14:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4396', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-13', '2025-06-13 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4396', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-13', '2025-06-13 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4396', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-13', '2025-06-13 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4401', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-14', '2025-06-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4401', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-14', '2025-06-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4401', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-16', '2025-06-16 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4401', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-16', '2025-06-16 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4411', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-23', '2025-06-23 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4411', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-30', '2025-06-30 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4411', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4411', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4450', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-23', '2025-06-23 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4450', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-30', '2025-06-30 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4450', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4450', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4452', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4452', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4452', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4452', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4420', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4420', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4420', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4420', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4474', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4474', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4474', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4474', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4457', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-18', '2025-06-18 09:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4457', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-18', '2025-06-18 11:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4457', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-18', '2025-06-18 13:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4461', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4461', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4461', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4461', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4469', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4469', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4469', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4469', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4476', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-25', '2025-06-25 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4476', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4476', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-16', '2025-07-16 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4476', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-16', '2025-07-16 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4481', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-19', '2025-06-19 07:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4481', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-19', '2025-06-19 09:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4496', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-21', '2025-06-21 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4496', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-21', '2025-06-21 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4496', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-21', '2025-06-21 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4496', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-21', '2025-06-21 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4509', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 12:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4509', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 14:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4509', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4509', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4511', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 13:35:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4511', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 15:35:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4511', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 19:35:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4511', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 19:35:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4502', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4502', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4502', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4502', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4522', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-22', '2025-06-22 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4522', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-22', '2025-06-22 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4522', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-22', '2025-06-22 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4522', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-22', '2025-06-22 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4551', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4551', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4551', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4551', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-20', '2025-06-20 22:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4566', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4566', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4566', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4566', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4571', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 12:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4571', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 14:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4571', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 16:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4571', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 18:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4576', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-25', '2025-06-25 12:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4576', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-25', '2025-06-25 16:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4576', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-25', '2025-06-25 18:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4576', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-25', '2025-06-25 20:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4581', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 14:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4581', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4581', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 18:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4581', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-24', '2025-06-24 20:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4595', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4595', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-09', '2025-07-09 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4595', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-23', '2025-07-23 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4595', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-23', '2025-07-23 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4605', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 11:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4605', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 13:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4605', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 15:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4605', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-26', '2025-06-26 19:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4628', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 13:50:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4628', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 15:50:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4628', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 17:50:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4628', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 19:50:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4633', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 14:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4633', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 16:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4633', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 18:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4633', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-06-27', '2025-06-27 20:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4658', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 13:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4658', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 15:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4658', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 17:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4658', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 19:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4663', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 15:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4663', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 17:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4663', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 19:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4663', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-01', '2025-07-01 21:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4669', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4669', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 10:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4669', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 12:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4669', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 14:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4669', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 10:45:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4669', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 12:45:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4669', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 14:45:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4669', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-02', '2025-07-02 16:45:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4683', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 06:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4683', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 08:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4683', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 10:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4683', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 12:30:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4690', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 11:45:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4690', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 13:45:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4690', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 15:45:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4690', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-03', '2025-07-03 17:45:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4710', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4710', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-05', '2025-07-05 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4710', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-06', '2025-07-06 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4710', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-06', '2025-07-06 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4700', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 11:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4700', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 13:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4700', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 15:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4700', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 17:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4705', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 13:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4705', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 15:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4705', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 17:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4705', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-04', '2025-07-04 19:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4860', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 17:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4860', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 17:15:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4866', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 09:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4866', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 11:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4866', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 13:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4866', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 15:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4867', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 10:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4867', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 12:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4867', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 14:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4867', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-15', '2025-07-15 16:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4898', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 13:02:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4898', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 15:02:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4898', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 17:02:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4898', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 19:02:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4904', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 14:49:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4904', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 16:49:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4904', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 18:49:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4904', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-07-17', '2025-07-17 20:49:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('4915', 'M1', 'VIGA', NULL, 15, 15, 60, '2025-07-24', '2025-07-24 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- VIGA 15x15x60 cm
    ('4915', 'M2', 'VIGA', NULL, 15, 15, 60, '2025-07-31', '2025-07-31 08:00:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- VIGA 15x15x60 cm
    ('4915', 'M3', 'VIGA', NULL, 15, 15, 60, '2025-08-14', '2025-08-14 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- VIGA 15x15x60 cm
    ('4915', 'M4', 'VIGA', NULL, 15, 15, 60, '2025-08-14', '2025-08-14 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- VIGA 15x15x60 cm
    ('5412', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-08-10', '2025-08-10 13:10:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('5412', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-08-10', '2025-08-10 15:10:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('5412', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-08-10', '2025-08-10 17:10:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('5412', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-08-10', '2025-08-10 19:10:00', 'ENSAYADO', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('5428', 'M1', 'CUBO', 10, NULL, NULL, NULL, '2025-08-18', '2025-08-18 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('5428', 'M2', 'CUBO', 10, NULL, NULL, NULL, '2025-08-25', '2025-08-25 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('5428', 'M3', 'CUBO', 10, NULL, NULL, NULL, '2025-09-08', '2025-09-08 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('5428', 'M4', 'CUBO', 10, NULL, NULL, NULL, '2025-09-08', '2025-09-08 08:00:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),  -- CUBO 10x10 cm
    ('5420', 'M1', 'VIGA', NULL, 15, 15, 60, '2025-08-12', '2025-08-12 11:50:00', 'PENDIENTE', '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City')  -- VIGA 15x15x60 cm
) AS datos(remision, identificacion, tipo_muestra, cube_side_cm, beam_width_cm, beam_height_cm, beam_span_cm, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4';

-- Muestras creadas: 286

-- ==========================================
-- PASO 3: CREAR ENSAYOS
-- ==========================================

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
    ('4250', 'M1', '2025-02-09', '2025-02-09 08:00:00', 30560.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4250', 'M2', '2025-02-16', '2025-02-16 08:00:00', 32780.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4250', 'M3', '2025-03-02', '2025-03-02 08:00:00', 40310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4250', 'M4', '2025-03-02', '2025-03-02 08:00:00', 38330.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4119', 'M1', '2025-05-20', '2025-05-20 04:00:00', 38810.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4119', 'M2', '2025-05-20', '2025-05-20 04:00:00', 38810.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4119', 'M3', '2025-05-20', '2025-05-20 12:00:00', 58720.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4119', 'M4', '2025-05-20', '2025-05-20 14:00:00', 61520.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4125', 'M1', '2025-05-23', '2025-05-23 09:50:00', 40320.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4125', 'M2', '2025-05-23', '2025-05-23 13:50:00', 45853.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4125', 'M3', '2025-05-23', '2025-05-23 15:50:00', 49325.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4125', 'M4', '2025-05-23', '2025-05-23 19:50:00', 57990.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4130', 'M1', '2025-05-25', '2025-05-25 13:15:00', 43730.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4130', 'M2', '2025-05-25', '2025-05-25 17:15:00', 49720.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4130', 'M3', '2025-05-25', '2025-05-25 21:15:00', 54820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4130', 'M4', '2025-05-25', '2025-05-25 21:15:00', 56916.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4140', 'M1', '2025-06-01', '2025-06-01 08:00:00', 36690.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4140', 'M2', '2025-06-08', '2025-06-08 08:00:00', 43150.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4140', 'M3', '2025-06-22', '2025-06-22 08:00:00', 40460.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4140', 'M4', '2025-06-22', '2025-06-22 08:00:00', 45230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4158', 'M1', '2025-06-02', '2025-06-02 08:00:00', 38530.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4158', 'M2', '2025-06-09', '2025-06-09 08:00:00', 36400.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4158', 'M3', '2025-06-23', '2025-06-23 08:00:00', 42050.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4158', 'M4', '2025-06-23', '2025-06-23 08:00:00', 44510.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4178', 'M1', '2025-06-04', '2025-06-04 08:00:00', 59310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4178', 'M2', '2025-06-11', '2025-06-11 08:00:00', 54290.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4178', 'M3', '2025-06-25', '2025-06-25 08:00:00', 75130.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4178', 'M4', '2025-06-25', '2025-06-25 08:00:00', 73820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4175', 'M1', '2025-05-29', '2025-05-29 09:15:00', 45720.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4175', 'M2', '2025-05-29', '2025-05-29 11:15:00', 51310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4175', 'M3', '2025-05-29', '2025-05-29 13:15:00', 59212.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4175', 'M4', '2025-05-29', '2025-05-29 13:15:00', 61710.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4182', 'M1', '2025-06-05', '2025-06-05 08:00:00', 33800.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4182', 'M2', '2025-06-12', '2025-06-12 08:00:00', 52850.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4182', 'M3', '2025-06-26', '2025-06-26 08:00:00', 78450.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4182', 'M4', '2025-06-26', '2025-06-26 08:00:00', 77110.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4189', 'M1', '2025-06-06', '2025-06-06 08:00:00', 31830.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4189', 'M2', '2025-06-13', '2025-06-13 08:00:00', 38480.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4189', 'M3', '2025-06-27', '2025-06-27 08:00:00', 76820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4189', 'M4', '2025-06-27', '2025-06-27 08:00:00', 75120.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4200', 'M1', '2025-06-06', '2025-06-06 08:00:00', 48090.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4200', 'M2', '2025-06-13', '2025-06-13 08:00:00', 50310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4200', 'M3', '2025-06-27', '2025-06-27 08:00:00', 68240.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4200', 'M4', '2025-06-27', '2025-06-27 08:00:00', 65480.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4201', 'M1', '2025-06-07', '2025-06-07 08:00:00', 30040.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4201', 'M2', '2025-06-14', '2025-06-14 08:00:00', 53340.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4201', 'M3', '2025-06-28', '2025-06-28 08:00:00', 80130.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4201', 'M4', '2025-06-28', '2025-06-28 08:00:00', 75400.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4211', 'M1', '2025-06-07', '2025-06-07 08:00:00', 51930.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4211', 'M2', '2025-06-14', '2025-06-14 08:00:00', 53620.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4211', 'M3', '2025-06-28', '2025-06-28 08:00:00', 81310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4211', 'M4', '2025-06-28', '2025-06-28 08:00:00', 76450.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4212', 'M1', '2025-06-07', '2025-06-07 08:00:00', 67600.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4212', 'M2', '2025-06-14', '2025-06-14 08:00:00', 62350.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4212', 'M3', '2025-06-28', '2025-06-28 08:00:00', 79650.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4212', 'M4', '2025-06-28', '2025-06-28 08:00:00', 82540.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4228', 'M1', '2025-06-07', '2025-06-07 08:00:00', 39150.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4228', 'M2', '2025-06-14', '2025-06-14 08:00:00', 59410.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4228', 'M3', '2025-06-28', '2025-06-28 08:00:00', 78540.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4228', 'M4', '2025-06-28', '2025-06-28 08:00:00', 74960.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4207', 'M1', '2025-06-01', '2025-06-01 03:10:00', 37820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4207', 'M2', '2025-06-01', '2025-06-01 07:10:00', 44110.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4207', 'M3', '2025-06-01', '2025-06-01 09:10:00', 53888.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4207', 'M4', '2025-06-01', '2025-06-01 13:10:00', 58851.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4239', 'M1', '2025-06-09', '2025-06-09 08:00:00', 33990.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4239', 'M2', '2025-06-16', '2025-06-16 08:00:00', 38310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4239', 'M3', '2025-06-30', '2025-06-30 08:00:00', 40450.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4239', 'M4', '2025-06-30', '2025-06-30 08:00:00', 42810.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4268', 'M1', '2025-06-04', '2025-06-04 12:05:00', 33437.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4268', 'M2', '2025-06-04', '2025-06-04 13:05:00', 33180.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4268', 'M3', '2025-06-04', '2025-06-04 21:05:00', 61078.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4268', 'M4', '2025-06-04', '2025-06-04 21:05:00', 60820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4272', 'M1', '2025-06-05', '2025-06-05 08:00:00', 35158.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4272', 'M2', '2025-06-05', '2025-06-05 08:00:00', 33251.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4272', 'M3', '2025-06-07', '2025-06-07 08:00:00', 39596.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4272', 'M4', '2025-06-07', '2025-06-07 08:00:00', 37422.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4284', 'M1', '2025-06-11', '2025-06-11 08:00:00', 53730.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4284', 'M2', '2025-06-18', '2025-06-18 08:00:00', 61460.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4284', 'M3', '2025-07-02', '2025-07-02 08:00:00', 62220.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4284', 'M4', '2025-07-02', '2025-07-02 08:00:00', 60410.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4302', 'M1', '2025-06-12', '2025-06-12 08:00:00', 24300.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4302', 'M2', '2025-06-19', '2025-06-19 08:00:00', 31300.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4302', 'M3', '2025-07-03', '2025-07-03 08:00:00', 40710.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4302', 'M4', '2025-07-03', '2025-07-03 08:00:00', 41300.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4307', 'M1', '2025-06-06', '2025-06-06 12:30:00', 49848.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4307', 'M2', '2025-06-06', '2025-06-06 13:30:00', 51474.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4307', 'M3', '2025-06-06', '2025-06-06 15:30:00', 55993.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4307', 'M4', '2025-06-06', '2025-06-06 17:30:00', 60230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4332', 'M1', '2025-06-07', '2025-06-07 08:00:00', 29076.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4332', 'M2', '2025-06-07', '2025-06-07 08:00:00', 31980.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4332', 'M3', '2025-06-09', '2025-06-09 08:00:00', 31926.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4332', 'M4', '2025-06-09', '2025-06-09 08:00:00', 32971.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4321', 'M1', '2025-06-07', '2025-06-07 08:40:00', 48501.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4321', 'M2', '2025-06-07', '2025-06-07 12:40:00', 46728.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4321', 'M3', '2025-06-07', '2025-06-07 14:40:00', 53821.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4321', 'M4', '2025-06-07', '2025-06-07 18:40:00', 59890.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4339', 'M1', '2025-06-08', '2025-06-08 08:00:00', 51290.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4339', 'M2', '2025-06-08', '2025-06-08 08:00:00', 63820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4339', 'M3', '2025-06-10', '2025-06-10 08:00:00', 69120.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4339', 'M4', '2025-06-10', '2025-06-10 08:00:00', 71230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4339', 'M1', '2025-06-08', '2025-06-08 08:00:00', 51290.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4339', 'M2', '2025-06-08', '2025-06-08 08:00:00', 63820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4339', 'M3', '2025-06-10', '2025-06-10 08:00:00', 69120.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4339', 'M4', '2025-06-10', '2025-06-10 08:00:00', 71230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4343', 'M1', '2025-06-10', '2025-06-10 09:30:00', 46962.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4343', 'M2', '2025-06-10', '2025-06-10 11:30:00', 51173.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4343', 'M3', '2025-06-10', '2025-06-10 13:30:00', 55721.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4343', 'M4', '2025-06-10', '2025-06-10 15:30:00', 59345.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4366', 'M1', '2025-06-17', '2025-06-17 08:00:00', 53070.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4366', 'M2', '2025-06-24', '2025-06-24 08:00:00', 72410.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4366', 'M3', '2025-07-08', '2025-07-08 08:00:00', 36250.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4366', 'M4', '2025-07-08', '2025-07-08 08:00:00', 30120.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4368', 'M1', '2025-06-11', '2025-06-11 11:00:00', 43352.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4368', 'M2', '2025-06-11', '2025-06-11 13:00:00', 46419.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4368', 'M3', '2025-06-11', '2025-06-11 15:00:00', 50481.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4368', 'M4', '2025-06-11', '2025-06-11 15:00:00', 59927.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4387', 'M1', '2025-06-13', '2025-06-13 10:30:00', 53031.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4387', 'M2', '2025-06-13', '2025-06-13 12:30:00', 55280.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4396', 'M1', '2025-06-13', '2025-06-13 14:00:00', 52395.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4396', 'M2', '2025-06-13', '2025-06-13 16:00:00', 53159.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4396', 'M3', '2025-06-13', '2025-06-13 18:00:00', 57220.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4396', 'M4', '2025-06-13', '2025-06-13 20:00:00', 60310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4401', 'M1', '2025-06-14', '2025-06-14 08:00:00', 34890.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4401', 'M2', '2025-06-14', '2025-06-14 08:00:00', 36120.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4401', 'M3', '2025-06-16', '2025-06-16 08:00:00', 33900.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4401', 'M4', '2025-06-16', '2025-06-16 08:00:00', 37420.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4411', 'M1', '2025-06-23', '2025-06-23 08:00:00', 42210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4411', 'M2', '2025-06-30', '2025-06-30 08:00:00', 48340.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4411', 'M3', '2025-07-14', '2025-07-14 08:00:00', 50800.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4411', 'M4', '2025-07-14', '2025-07-14 08:00:00', 55740.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4450', 'M1', '2025-06-23', '2025-06-23 08:00:00', 29750.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4450', 'M2', '2025-06-30', '2025-06-30 08:00:00', 53620.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4450', 'M3', '2025-07-14', '2025-07-14 08:00:00', 58220.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4450', 'M4', '2025-07-14', '2025-07-14 08:00:00', 61310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4452', 'M1', '2025-06-24', '2025-06-24 08:00:00', 58630.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4452', 'M2', '2025-07-01', '2025-07-01 08:00:00', 63380.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4452', 'M3', '2025-07-15', '2025-07-15 08:00:00', 65210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4452', 'M4', '2025-07-15', '2025-07-15 08:00:00', 60170.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4420', 'M1', '2025-06-24', '2025-06-24 08:00:00', 34455.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4420', 'M2', '2025-07-01', '2025-07-01 08:00:00', 39395.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4420', 'M3', '2025-07-15', '2025-07-15 08:00:00', 40210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4420', 'M4', '2025-07-15', '2025-07-15 08:00:00', 52210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4474', 'M1', '2025-06-24', '2025-06-24 08:00:00', 34450.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4474', 'M2', '2025-07-01', '2025-07-01 08:00:00', 39390.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4474', 'M3', '2025-07-15', '2025-07-15 08:00:00', 48770.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4474', 'M4', '2025-07-15', '2025-07-15 08:00:00', 52210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4457', 'M1', '2025-06-18', '2025-06-18 09:15:00', 58307.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4457', 'M2', '2025-06-18', '2025-06-18 11:15:00', 62425.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4457', 'M3', '2025-06-18', '2025-06-18 13:15:00', 66089.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4461', 'M1', '2025-06-20', '2025-06-20 08:00:00', 71500.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4461', 'M2', '2025-06-20', '2025-06-20 08:00:00', 66000.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4461', 'M3', '2025-06-20', '2025-06-20 08:00:00', 62220.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4461', 'M4', '2025-06-20', '2025-06-20 08:00:00', 64510.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4469', 'M1', '2025-06-20', '2025-06-20 08:00:00', 34510.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4469', 'M2', '2025-06-20', '2025-06-20 08:00:00', 34650.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4469', 'M3', '2025-06-20', '2025-06-20 08:00:00', 37160.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4469', 'M4', '2025-06-20', '2025-06-20 08:00:00', 35980.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4476', 'M1', '2025-06-25', '2025-06-25 08:00:00', 36200.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4476', 'M2', '2025-07-02', '2025-07-02 08:00:00', 43600.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4476', 'M3', '2025-07-16', '2025-07-16 08:00:00', 49220.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4476', 'M4', '2025-07-16', '2025-07-16 08:00:00', 51550.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4481', 'M1', '2025-06-19', '2025-06-19 07:30:00', 61321.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4481', 'M2', '2025-06-19', '2025-06-19 09:30:00', 65289.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4496', 'M1', '2025-06-21', '2025-06-21 08:00:00', 67220.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4496', 'M2', '2025-06-21', '2025-06-21 08:00:00', 66230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4496', 'M3', '2025-06-21', '2025-06-21 08:00:00', 69120.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4496', 'M4', '2025-06-21', '2025-06-21 08:00:00', 66690.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4509', 'M1', '2025-06-20', '2025-06-20 12:00:00', 56450.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4509', 'M2', '2025-06-20', '2025-06-20 14:00:00', 59220.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4509', 'M3', '2025-06-20', '2025-06-20 16:00:00', 62310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4509', 'M4', '2025-06-20', '2025-06-20 18:00:00', 65110.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4511', 'M1', '2025-06-20', '2025-06-20 13:35:00', 55800.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4511', 'M2', '2025-06-20', '2025-06-20 15:35:00', 57620.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4511', 'M3', '2025-06-20', '2025-06-20 19:35:00', 59270.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4511', 'M4', '2025-06-20', '2025-06-20 19:35:00', 62810.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4502', 'M1', '2025-06-26', '2025-06-26 08:00:00', 45900.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4502', 'M2', '2025-07-03', '2025-07-03 08:00:00', 47300.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4502', 'M3', '2025-07-17', '2025-07-17 08:00:00', 55210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4502', 'M4', '2025-07-17', '2025-07-17 08:00:00', 53590.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4522', 'M1', '2025-06-22', '2025-06-22 08:00:00', 32280.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4522', 'M2', '2025-06-22', '2025-06-22 08:00:00', 35680.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4522', 'M3', '2025-06-22', '2025-06-22 08:00:00', 34250.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4522', 'M4', '2025-06-22', '2025-06-22 08:00:00', 33190.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4551', 'M1', '2025-06-20', '2025-06-20 16:00:00', 43870.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4551', 'M2', '2025-06-20', '2025-06-20 18:00:00', 47190.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4551', 'M3', '2025-06-20', '2025-06-20 20:00:00', 51250.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4551', 'M4', '2025-06-20', '2025-06-20 22:00:00', 56580.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4566', 'M1', '2025-06-24', '2025-06-24 08:00:00', 20090.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4566', 'M2', '2025-06-24', '2025-06-24 08:00:00', 35880.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4566', 'M3', '2025-06-26', '2025-06-26 08:00:00', 40150.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4566', 'M4', '2025-06-26', '2025-06-26 08:00:00', 37610.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4571', 'M1', '2025-06-24', '2025-06-24 12:30:00', 47100.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4571', 'M2', '2025-06-24', '2025-06-24 14:30:00', 52190.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4571', 'M3', '2025-06-24', '2025-06-24 16:30:00', 54390.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4571', 'M4', '2025-06-24', '2025-06-24 18:30:00', 59160.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4576', 'M1', '2025-06-25', '2025-06-25 12:30:00', 38210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4576', 'M2', '2025-06-25', '2025-06-25 16:30:00', 52460.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4576', 'M3', '2025-06-25', '2025-06-25 18:30:00', 60150.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4576', 'M4', '2025-06-25', '2025-06-25 20:30:00', 61130.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4581', 'M1', '2025-06-24', '2025-06-24 14:00:00', 45200.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4581', 'M2', '2025-06-24', '2025-06-24 16:00:00', 50270.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4581', 'M3', '2025-06-24', '2025-06-24 18:00:00', 54230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4581', 'M4', '2025-06-24', '2025-06-24 20:00:00', 59550.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4595', 'M1', '2025-07-02', '2025-07-02 08:00:00', 25350.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4595', 'M2', '2025-07-09', '2025-07-09 08:00:00', 33200.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4595', 'M3', '2025-07-23', '2025-07-23 08:00:00', 41100.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4595', 'M4', '2025-07-23', '2025-07-23 08:00:00', 40890.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4605', 'M1', '2025-06-26', '2025-06-26 11:00:00', 44880.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4605', 'M2', '2025-06-26', '2025-06-26 13:00:00', 53630.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4605', 'M3', '2025-06-26', '2025-06-26 15:00:00', 59310.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4605', 'M4', '2025-06-26', '2025-06-26 19:00:00', 60350.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4628', 'M1', '2025-06-27', '2025-06-27 13:50:00', 56020.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4628', 'M2', '2025-06-27', '2025-06-27 15:50:00', 59820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4628', 'M3', '2025-06-27', '2025-06-27 17:50:00', 61230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4628', 'M4', '2025-06-27', '2025-06-27 19:50:00', 64540.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4633', 'M1', '2025-06-27', '2025-06-27 14:30:00', 53600.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4633', 'M2', '2025-06-27', '2025-06-27 16:30:00', 55580.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4633', 'M3', '2025-06-27', '2025-06-27 18:30:00', 59380.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4633', 'M4', '2025-06-27', '2025-06-27 20:30:00', 62910.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4658', 'M1', '2025-07-01', '2025-07-01 13:30:00', 52820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4658', 'M2', '2025-07-01', '2025-07-01 15:30:00', 55100.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4658', 'M3', '2025-07-01', '2025-07-01 17:30:00', 57690.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4658', 'M4', '2025-07-01', '2025-07-01 19:30:00', 59210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4663', 'M1', '2025-07-01', '2025-07-01 15:00:00', 51320.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4663', 'M2', '2025-07-01', '2025-07-01 17:00:00', 54610.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4663', 'M3', '2025-07-01', '2025-07-01 19:00:00', 60870.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4663', 'M4', '2025-07-01', '2025-07-01 21:00:00', 62120.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4669', 'M1', '2025-07-02', '2025-07-02 08:00:00', 49230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4669', 'M2', '2025-07-02', '2025-07-02 10:00:00', 50860.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4669', 'M3', '2025-07-02', '2025-07-02 12:00:00', 59230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4669', 'M4', '2025-07-02', '2025-07-02 14:00:00', 62250.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4669', 'M1', '2025-07-02', '2025-07-02 10:45:00', 49230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4669', 'M2', '2025-07-02', '2025-07-02 12:45:00', 50860.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4669', 'M3', '2025-07-02', '2025-07-02 14:45:00', 59230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4669', 'M4', '2025-07-02', '2025-07-02 16:45:00', 62250.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4683', 'M1', '2025-07-03', '2025-07-03 06:30:00', 49550.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4683', 'M2', '2025-07-03', '2025-07-03 08:30:00', 53920.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4683', 'M3', '2025-07-03', '2025-07-03 10:30:00', 58320.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4683', 'M4', '2025-07-03', '2025-07-03 12:30:00', 62210.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4690', 'M1', '2025-07-03', '2025-07-03 11:45:00', 51270.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4690', 'M2', '2025-07-03', '2025-07-03 13:45:00', 54820.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4690', 'M3', '2025-07-03', '2025-07-03 15:45:00', 58110.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4690', 'M4', '2025-07-03', '2025-07-03 17:45:00', 62840.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4710', 'M1', '2025-07-04', '2025-07-04 08:00:00', 25220.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4710', 'M2', '2025-07-05', '2025-07-05 08:00:00', 35218.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4710', 'M3', '2025-07-06', '2025-07-06 08:00:00', 39960.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4710', 'M4', '2025-07-06', '2025-07-06 08:00:00', 37420.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4700', 'M1', '2025-07-04', '2025-07-04 11:00:00', 51280.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4700', 'M2', '2025-07-04', '2025-07-04 13:00:00', 54630.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4700', 'M3', '2025-07-04', '2025-07-04 15:00:00', 57920.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4700', 'M4', '2025-07-04', '2025-07-04 17:00:00', 61120.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4705', 'M1', '2025-07-04', '2025-07-04 13:15:00', 52680.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4705', 'M2', '2025-07-04', '2025-07-04 15:15:00', 56480.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4705', 'M3', '2025-07-04', '2025-07-04 17:15:00', 61260.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4705', 'M4', '2025-07-04', '2025-07-04 19:15:00', 62570.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4860', 'M1', '2025-07-15', '2025-07-15 17:15:00', 20150.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4860', 'M2', '2025-07-15', '2025-07-15 17:15:00', 20155.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4866', 'M1', '2025-07-15', '2025-07-15 09:00:00', 50320.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4866', 'M2', '2025-07-15', '2025-07-15 11:00:00', 55740.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4866', 'M3', '2025-07-15', '2025-07-15 13:00:00', 59750.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4866', 'M4', '2025-07-15', '2025-07-15 15:00:00', 60290.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4867', 'M1', '2025-07-15', '2025-07-15 10:00:00', 44440.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4867', 'M2', '2025-07-15', '2025-07-15 12:00:00', 50780.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4867', 'M3', '2025-07-15', '2025-07-15 14:00:00', 56970.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4867', 'M4', '2025-07-15', '2025-07-15 16:00:00', 59130.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4898', 'M1', '2025-07-17', '2025-07-17 13:02:00', 48520.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4898', 'M2', '2025-07-17', '2025-07-17 15:02:00', 52610.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4898', 'M3', '2025-07-17', '2025-07-17 17:02:00', 56940.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4898', 'M4', '2025-07-17', '2025-07-17 19:02:00', 59870.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4904', 'M1', '2025-07-17', '2025-07-17 14:49:00', 45650.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4904', 'M2', '2025-07-17', '2025-07-17 16:49:00', 51010.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4904', 'M3', '2025-07-17', '2025-07-17 18:49:00', 59760.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4904', 'M4', '2025-07-17', '2025-07-17 20:49:00', 62140.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4915', 'M1', '2025-07-24', '2025-07-24 08:00:00', 3095.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('4915', 'M2', '2025-07-31', '2025-07-31 08:00:00', 3596.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('5412', 'M1', '2025-08-10', '2025-08-10 13:10:00', 58930.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('5412', 'M2', '2025-08-10', '2025-08-10 15:10:00', 59100.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('5412', 'M3', '2025-08-10', '2025-08-10 17:10:00', 60230.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City'),
    ('5412', 'M4', '2025-08-10', '2025-08-10 19:10:00', 62340.0, '78fba7b9-645a-4006-96e7-e6c4d5a9d10e', 'America/Mexico_City')
) AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4'
JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;

-- Ensayos creados: 279

-- ==========================================
-- PASO 4: VERIFICACIONES CON DIMENSIONES
-- ==========================================

-- Verificar tipos con dimensiones específicas
SELECT 
  'Muestras P4 por dimensión' as tabla,
  tipo_muestra,
  cube_side_cm,
  CASE 
    WHEN tipo_muestra = 'CUBO' AND cube_side_cm = 10 THEN 'CUBO 10x10'
    WHEN tipo_muestra = 'CUBO' AND cube_side_cm = 15 THEN 'CUBO 15x15'
    WHEN tipo_muestra = 'VIGA' THEN 'VIGA'
    ELSE 'OTRO'
  END as tipo_detallado,
  COUNT(*) as total
FROM public.muestras mu 
JOIN public.muestreos m ON m.id = mu.muestreo_id
WHERE m.planta = 'P4' AND DATE(mu.created_at) = CURRENT_DATE 
GROUP BY tipo_muestra, cube_side_cm
ORDER BY tipo_muestra, cube_side_cm;

-- FIN SCRIPT CON DIMENSIONES ESPECÍFICAS
