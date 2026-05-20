-- ISO/IEC 17025 §7.8 Informe de Resultados — Phase A/B schema
-- muestreos §2 fields, ensayos §5 lab conditions, lab config, informes + firmas

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'muestreado_por_enum') THEN
    CREATE TYPE public.muestreado_por_enum AS ENUM ('LABORATORIO', 'CLIENTE');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'informe_ensayo_estado_enum') THEN
    CREATE TYPE public.informe_ensayo_estado_enum AS ENUM ('borrador', 'emitido', 'anulado');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'informe_firma_rol_enum') THEN
    CREATE TYPE public.informe_firma_rol_enum AS ENUM ('elaboro', 'reviso', 'autorizo');
  END IF;
END$$;

-- §2 muestreo fields
ALTER TABLE public.muestreos
  ADD COLUMN IF NOT EXISTS muestreado_por public.muestreado_por_enum DEFAULT 'LABORATORIO',
  ADD COLUMN IF NOT EXISTS humedad_relativa_obra numeric,
  ADD COLUMN IF NOT EXISTS condiciones_climaticas text,
  ADD COLUMN IF NOT EXISTS fecha_recepcion_lab date,
  ADD COLUMN IF NOT EXISTS ubicacion_detalle text;

UPDATE public.muestreos
SET fecha_recepcion_lab = (created_at AT TIME ZONE 'America/Mexico_City')::date
WHERE fecha_recepcion_lab IS NULL AND created_at IS NOT NULL;

-- §5 ensayo lab conditions
ALTER TABLE public.ensayos
  ADD COLUMN IF NOT EXISTS temp_laboratorio_c numeric,
  ADD COLUMN IF NOT EXISTS humedad_relativa_lab numeric,
  ADD COLUMN IF NOT EXISTS capping_type text,
  ADD COLUMN IF NOT EXISTS capping_norma text;

-- Profile cédula for signatures
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS cedula_profesional text;

-- Lab accreditation / informe header (one row per plant or global)
CREATE TABLE IF NOT EXISTS public.laboratorio_acreditacion_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id uuid REFERENCES public.plants(id) ON DELETE SET NULL,
  razon_social text NOT NULL DEFAULT 'DC Concretos S.A. de C.V.',
  nombre_laboratorio text NOT NULL DEFAULT 'Laboratorio de Control de Calidad',
  direccion text,
  telefono text,
  email text,
  acreditacion_ema_numero text,
  pie_pagina_texto text,
  regla_decision_default text DEFAULT 'POC-17 / ISO Guide 98-4',
  tolerancias_json jsonb NOT NULL DEFAULT '{"revenimiento_mm": 10}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plant_id)
);

-- Informe folio sequence per year (DCIR{YY}-{seq})
CREATE SEQUENCE IF NOT EXISTS public.informe_ensayo_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.informes_ensayo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  muestreo_id uuid NOT NULL REFERENCES public.muestreos(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  issued_at timestamptz,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  replaces_informe_id uuid REFERENCES public.informes_ensayo(id) ON DELETE SET NULL,
  estado public.informe_ensayo_estado_enum NOT NULL DEFAULT 'borrador',
  muestreado_por_cliente boolean NOT NULL DEFAULT false,
  regla_decision text,
  opinion_tecnica text,
  snapshot_json jsonb,
  pdf_storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_informes_ensayo_muestreo_id ON public.informes_ensayo(muestreo_id);
CREATE INDEX IF NOT EXISTS idx_informes_ensayo_numero ON public.informes_ensayo(numero);
CREATE UNIQUE INDEX IF NOT EXISTS idx_informes_ensayo_active_per_muestreo
  ON public.informes_ensayo(muestreo_id)
  WHERE estado IN ('borrador', 'emitido');

CREATE TABLE IF NOT EXISTS public.informe_ensayo_firmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  informe_id uuid NOT NULL REFERENCES public.informes_ensayo(id) ON DELETE CASCADE,
  rol public.informe_firma_rol_enum NOT NULL,
  signer_name text NOT NULL,
  signer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cedula_profesional text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signature_storage_path text,
  UNIQUE (informe_id, rol)
);

-- Extend muestreos_list_view with §2 fields + elemento + designacion
DROP VIEW IF EXISTS public.muestreos_list_view;

CREATE VIEW public.muestreos_list_view AS
SELECT m.id,
    m.remision_id,
    m.fecha_muestreo,
    m.numero_muestreo,
    m.planta,
    m.revenimiento_sitio,
    m.masa_unitaria,
    m.temperatura_ambiente,
    m.temperatura_concreto,
    m.created_by,
    m.created_at,
    m.updated_at,
    m.plant_id,
    m.sampling_type,
    m.manual_reference,
    m.gps_location,
    m.concrete_specs,
    m.offline_created,
    m.sync_status,
    m.sampling_notes,
    m.fecha_muestreo_ts,
    m.event_timezone,
    m.hora_muestreo,
    m.recovery_notes,
    m.contenido_aire,
    m.muestreado_por,
    m.humedad_relativa_obra,
    m.condiciones_climaticas,
    m.fecha_recepcion_lab,
    m.ubicacion_detalle,
    r.remision_number,
    r.fecha AS remision_fecha,
    r.volumen_fabricado AS remision_volumen_fabricado,
    r.is_production_record AS remision_is_production_record,
    r.cross_plant_billing_remision_id AS remision_cross_plant_billing_remision_id,
    r.designacion_ehe AS remision_designacion_ehe,
    o.id AS order_id,
    o.order_number,
    o.construction_site AS order_construction_site,
    o.elemento AS order_elemento,
    COALESCE(cs.name, NULLIF(TRIM(BOTH FROM o.construction_site::text), ''::text)::character varying) AS obra_nombre,
    c.id AS client_id,
    c.business_name AS client_business_name,
    c.client_code,
    rc.id AS recipe_id,
    rc.recipe_code,
    rc.strength_fc,
    rc.slump,
    rc.age_days,
    rc.age_hours,
    rv.notes AS recipe_notes,
    p.code AS plant_code,
    p.name AS plant_name,
    bu.id AS business_unit_id,
    bu.name AS business_unit_name,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', mu.id, 'tipo_muestra', mu.tipo_muestra, 'estado', mu.estado, 'identificacion', mu.identificacion, 'is_edad_garantia', mu.is_edad_garantia, 'fecha_programada_ensayo', mu.fecha_programada_ensayo, 'ensayos', COALESCE(( SELECT jsonb_agg(jsonb_build_object('id', e.id, 'resistencia_calculada', e.resistencia_calculada, 'resistencia_corregida', e.resistencia_corregida, 'fecha_ensayo', e.fecha_ensayo, 'fecha_ensayo_ts', e.fecha_ensayo_ts, 'porcentaje_cumplimiento', e.porcentaje_cumplimiento, 'carga_kg', e.carga_kg) ORDER BY e.fecha_ensayo_ts, e.created_at) AS jsonb_agg
                   FROM ensayos e
                  WHERE e.muestra_id = mu.id), '[]'::jsonb)) ORDER BY mu.fecha_programada_ensayo) AS jsonb_agg
           FROM muestras mu
          WHERE mu.muestreo_id = m.id), '[]'::jsonb) AS muestras_json
   FROM muestreos m
     LEFT JOIN remisiones r ON r.id = m.remision_id
     LEFT JOIN orders o ON o.id = r.order_id
     LEFT JOIN clients c ON c.id = o.client_id
     LEFT JOIN construction_sites cs ON cs.id = o.construction_site_id
     LEFT JOIN recipes rc ON rc.id = r.recipe_id
     LEFT JOIN recipe_versions rv ON rv.recipe_id = rc.id AND rv.is_current = true
     LEFT JOIN plants p ON p.id = m.plant_id
     LEFT JOIN business_units bu ON bu.id = p.business_unit_id;

ALTER TABLE public.laboratorio_acreditacion_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informes_ensayo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.informe_ensayo_firmas ENABLE ROW LEVEL SECURITY;

-- Quality team read/write (simplified; matches existing quality module pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'laboratorio_acreditacion_config' AND policyname = 'lab_config_quality_select'
  ) THEN
    CREATE POLICY lab_config_quality_select ON public.laboratorio_acreditacion_config
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'laboratorio_acreditacion_config' AND policyname = 'lab_config_quality_manage'
  ) THEN
    CREATE POLICY lab_config_quality_manage ON public.laboratorio_acreditacion_config
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'informes_ensayo' AND policyname = 'informes_ensayo_select'
  ) THEN
    CREATE POLICY informes_ensayo_select ON public.informes_ensayo
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'informes_ensayo' AND policyname = 'informes_ensayo_manage'
  ) THEN
    CREATE POLICY informes_ensayo_manage ON public.informes_ensayo
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'informe_ensayo_firmas' AND policyname = 'informe_firmas_select'
  ) THEN
    CREATE POLICY informe_firmas_select ON public.informe_ensayo_firmas
      FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'informe_ensayo_firmas' AND policyname = 'informe_firmas_manage'
  ) THEN
    CREATE POLICY informe_firmas_manage ON public.informe_ensayo_firmas
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND up.role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
        )
      );
  END IF;
END$$;
