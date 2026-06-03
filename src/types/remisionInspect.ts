export type RemisionInspectListRow = {
  id: string;
  remision_number: string;
  fecha: string;
  hora_carga: string | null;
  volumen_fabricado: number | null;
  conductor: string | null;
  unidad: string | null;
  client_name: string | null;
  construction_site: string | null;
  recipe_code: string | null;
  order_id: string | null;
  is_production_record: boolean;
  is_cross_plant_billing: boolean;
  has_muestreo: boolean;
  muestreo_count: number;
  cancelled_reason: string | null;
};

export type RemisionInspectMuestreoSummary = {
  id: string;
  numero_muestreo: number | null;
  fecha_muestreo: string | null;
  hora_muestreo: string | null;
  revenimiento_sitio: number | null;
  masa_unitaria: number | null;
};

export type RemisionInspectSiteCheckSummary = {
  id: string;
  remision_number_manual: string | null;
  fecha_muestreo: string | null;
  hora_llegada_obra: string | null;
  test_type: string | null;
  valor_final_cm: number | null;
  created_at: string | null;
};

export type RemisionInspectDetailRemision = {
  id: string;
  remision_number: string;
  fecha: string;
  hora_carga: string | null;
  volumen_fabricado: number | null;
  conductor: string | null;
  unidad: string | null;
  plant_id: string | null;
  planta: string | null;
  order_id: string | null;
  order_number: string | null;
  client_name: string | null;
  construction_name: string | null;
  is_production_record: boolean;
  cross_plant_billing_plant_id: string | null;
  cross_plant_billing_remision_id: string | null;
  cancelled_reason: string | null;
  recipe: {
    recipe_code: string | null;
    strength_fc: number | null;
    slump: number | null;
    tma: number | null;
    age_days: number | null;
    age_hours: number | null;
  } | null;
  plants?: { code?: string | null; name?: string | null } | null;
};

export type RemisionInspectDetail = {
  remision: RemisionInspectDetailRemision;
  muestreos: RemisionInspectMuestreoSummary[];
  site_checks: RemisionInspectSiteCheckSummary[];
};

export type RemisionInspectListResult = {
  rows: RemisionInspectListRow[];
  date_from: string;
  date_to: string;
};
