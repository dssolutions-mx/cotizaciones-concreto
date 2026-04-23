INSERT INTO public.quality_notification_queue (id, muestra_id, fecha_programada_envio, estado, intentos, plant_id)
VALUES ('6fec4f09-47ed-4572-bae0-42eda078bbc3'::uuid, '3466e9f1-0aa5-460e-b9e4-c1382497003a'::uuid, '2025-08-04'::date, 'ERROR', 3, '836cbbcf-67b2-4534-97cc-b83e71722ff7'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.quality_notification_queue (id, muestra_id, fecha_programada_envio, estado, intentos, plant_id)
VALUES ('66f9d022-53ec-402c-9803-6229a19fa0d2'::uuid, 'f354cd8e-0347-4a49-b98e-a67282c3f55a'::uuid, '2025-08-04'::date, 'ERROR', 3, '836cbbcf-67b2-4534-97cc-b83e71722ff7'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.quality_notification_queue (id, muestra_id, fecha_programada_envio, estado, intentos, plant_id)
VALUES ('62d40894-19f3-4fe7-9a53-db45845d715f'::uuid, '278fb701-eff8-42a4-9f6b-5887a00c19fe'::uuid, '2025-07-14'::date, 'ERROR', 3, '836cbbcf-67b2-4534-97cc-b83e71722ff7'::uuid)
ON CONFLICT (id) DO NOTHING;
