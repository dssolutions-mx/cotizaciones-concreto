INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('cad2c9a7-7230-44f4-acac-f1e10373ea52'::uuid, '65fbee67-0972-4bcc-9541-81b0ac716c24'::uuid, 'CUBO', 'M1', '2025-08-20'::date, 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('6b5a44a5-a418-4502-84d4-b9396c0af291'::uuid, '65fbee67-0972-4bcc-9541-81b0ac716c24'::uuid, 'CUBO', 'M1', '2025-08-20'::date, 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('596b6b16-a161-4162-9ee5-5fe888daf38a'::uuid, '75798ece-9af6-477a-a9e1-cadd45459a66'::uuid, 'VIGA', 'M1', '2025-08-21'::date, 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('4924a431-e111-451f-956b-4f37589a9627'::uuid, '1e31fd21-63ed-431c-bcdf-e3b36bfcadc5'::uuid, 'VIGA', 'M1', '2025-08-22'::date, 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('9d8d65b4-f1d8-4a35-95bd-0808b2186e7b'::uuid, 'a34b0349-b0d4-4c89-8e0b-8b68866d4c61'::uuid, 'VIGA', 'M1', '2025-08-23'::date, 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('f8df2f7d-40f9-41e5-82ed-3434dc90a80e'::uuid, 'dd9463c5-85b5-41a6-803e-20becfd3fb94'::uuid, 'CUBO', 'M2', '2025-07-14'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('5b5b945a-7fc1-4294-bed2-6d071f416296'::uuid, '0645f3bf-f80a-477c-a455-b5cf6c5bdda6'::uuid, 'CUBO', 'M2', '2025-07-13'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('81542be5-e3c8-4875-8385-2ca83e699be0'::uuid, '35b25764-cead-41d5-ac4d-4b63dcada600'::uuid, 'CUBO', 'M2', '2025-07-16'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('cc2050c1-8122-4b0e-b2eb-c67efe80d5ef'::uuid, '1dc6484f-fb9b-4619-9a7e-da74e61fc8b8'::uuid, 'CUBO', 'M2', '2025-07-16'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('b4f5d4f1-dde6-4d6c-acbd-75dfc3200ff5'::uuid, '634b7ba2-79f9-4f8e-bd1c-848eae13bb69'::uuid, 'CUBO', 'M2', '2025-07-16'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('32aafb00-97e1-41f0-934a-535c3e59c5a5'::uuid, '2931e976-4a74-470e-8e73-1fbed2379341'::uuid, 'CUBO', 'M1', '2025-07-16'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('ef27507b-e672-410d-bb3a-0605aa5b2e9d'::uuid, '2931e976-4a74-470e-8e73-1fbed2379341'::uuid, 'CUBO', 'M2', '2025-07-16'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('41c0aa2b-2dd2-4895-b302-b55b322e7a67'::uuid, 'b69d969b-d6b1-4014-903f-2a2d85792190'::uuid, 'CUBO', 'M1', '2025-07-16'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('97392a48-3a2e-4d4a-99d1-ad1c46efcf64'::uuid, 'b69d969b-d6b1-4014-903f-2a2d85792190'::uuid, 'CUBO', 'M2', '2025-07-17'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('57be6c8b-4a90-4faf-99d8-17762009dc7b'::uuid, 'f8f808c9-26f1-4978-a711-ed31fe29c1d6'::uuid, 'CUBO', 'M1', '2025-07-16'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('f31c3d9b-f2e8-448a-b118-67bbb4eb8efa'::uuid, '40534f99-8a79-4755-8ffb-3e37c31b8d07'::uuid, 'CUBO', 'M1', '2025-07-16'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('94ba7bac-68e7-4717-a564-4425123e7a24'::uuid, 'd4b8a095-b5c9-41ff-9c1d-b822e59de9e9'::uuid, 'CUBO', 'M1', '2025-07-17'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('e421f7cb-02fa-449e-b008-ee6f65483822'::uuid, '5931541b-022e-4770-a262-602a3ef26e61'::uuid, 'CUBO', 'M1', '2025-07-17'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('732c1f96-6745-43d9-a775-6351cfc57a2a'::uuid, 'e17f6b4f-b285-4119-b9e7-a202b8a4c62a'::uuid, 'CUBO', 'M1', '2025-07-17'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('99993de9-9e9d-49f8-9011-5821f5a81368'::uuid, 'fe597b55-b4c4-41ef-b634-c3d61a1521d4'::uuid, 'CUBO', 'M1', '2025-07-18'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('f311ce15-3cf2-4bf4-a854-cd3b161db859'::uuid, 'fe597b55-b4c4-41ef-b634-c3d61a1521d4'::uuid, 'CUBO', 'M2', '2025-07-18'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('beec350e-d7ac-40ac-a11d-c0af0f22aa0c'::uuid, '71ce1adb-c3ee-43c3-832d-ddf569d7de8b'::uuid, 'CUBO', 'M1', '2025-07-30'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('f1ed789e-4a74-426a-bd73-ec125eae5d16'::uuid, '71ce1adb-c3ee-43c3-832d-ddf569d7de8b'::uuid, 'CUBO', 'M2', '2025-07-30'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('54644972-d402-4faf-8c8a-1fa54ae05271'::uuid, '4bda31f8-018c-4c34-bc42-95f2c5103ddf'::uuid, 'CUBO', 'M1', '2025-07-30'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('ad07a693-cc72-4a7e-bba9-f78f16f8ad04'::uuid, '4bda31f8-018c-4c34-bc42-95f2c5103ddf'::uuid, 'CUBO', 'M2', '2025-07-31'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('e374a5b6-6634-4da7-a1c4-928fe87c745f'::uuid, 'd3cfffc4-6117-4cc9-bc59-f1ed0f53da78'::uuid, 'CUBO', 'M1', '2025-07-30'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('998df895-5d00-45a3-9f65-3fe064fb46c4'::uuid, 'd3cfffc4-6117-4cc9-bc59-f1ed0f53da78'::uuid, 'CUBO', 'M2', '2025-07-31'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('5eff6499-0962-42b2-b0fd-cde0e675374e'::uuid, '177e2262-4ca9-4e97-b425-1e6a22f8bc3a'::uuid, 'CUBO', 'M1', '2025-07-31'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('233324ca-fe5e-4c43-bffc-14c806ec29a7'::uuid, '177e2262-4ca9-4e97-b425-1e6a22f8bc3a'::uuid, 'CUBO', 'M2', '2025-08-01'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('2675de01-fe49-4a0c-9a55-82b6c43f7f5b'::uuid, '9e7e25b1-7415-40ea-8898-038070986f84'::uuid, 'CUBO', 'M1', '2025-07-30'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('9124e6f0-967f-4db2-967e-700071c5b475'::uuid, '9e7e25b1-7415-40ea-8898-038070986f84'::uuid, 'CUBO', 'M2', '2025-07-31'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('26666f9b-ab55-453c-aa02-0a59779317d6'::uuid, '18392c1a-39bd-494b-ab7f-d62432b0f287'::uuid, 'CUBO', 'M1', '2025-07-31'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('afbd60b0-91b5-4209-8d34-16a434b0a07d'::uuid, '18392c1a-39bd-494b-ab7f-d62432b0f287'::uuid, 'CUBO', 'M2', '2025-08-01'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('11954a85-e99b-4d86-a215-e24846af88a0'::uuid, '42c37b0d-d115-4e16-93ac-594956a97501'::uuid, 'CUBO', 'M1', '2025-08-01'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('73d9afbb-8c26-4221-8a19-6760a93fd598'::uuid, '42c37b0d-d115-4e16-93ac-594956a97501'::uuid, 'CUBO', 'M2', '2025-08-01'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('c728dd43-21c6-4f69-8f95-d2fd971c3ceb'::uuid, '009cba1a-0307-4de9-9032-68ab6c7af05f'::uuid, 'CUBO', 'M1', '2025-08-01'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('0f1244a1-9d2a-4933-88dc-f39d4b8809f1'::uuid, '009cba1a-0307-4de9-9032-68ab6c7af05f'::uuid, 'CUBO', 'M2', '2025-08-02'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('25acc1cd-1140-462f-91d3-d34b90926879'::uuid, 'c7001eff-0f00-4fff-902c-ecb313a71927'::uuid, 'CUBO', 'M1', '2025-08-01'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('d8d4e2f7-2887-4ac1-bfb8-cbb20984d2ad'::uuid, 'c7001eff-0f00-4fff-902c-ecb313a71927'::uuid, 'CUBO', 'M2', '2025-08-02'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('b3928435-d2cf-44bd-b333-8d44c7fde7ae'::uuid, '0832dc90-be92-4ba0-ba1d-d319171cdc87'::uuid, 'CUBO', 'M1', '2025-08-01'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.muestras (id, muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id)
VALUES ('ecfac66c-8c42-4cc5-9253-02b52cf82b32'::uuid, '0832dc90-be92-4ba0-ba1d-d319171cdc87'::uuid, 'CUBO', 'M2', '2025-08-02'::date, 'ENSAYADO', 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid)
ON CONFLICT (id) DO NOTHING;
