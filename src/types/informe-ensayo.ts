import type { MeasurandCodigo } from '@/types/ema-uncertainty';

export type InformeEstado = 'borrador' | 'emitido' | 'anulado';
export type InformeFirmaRol = 'elaboro' | 'reviso' | 'autorizo';
export type MuestreadoPor = 'LABORATORIO' | 'CLIENTE';

export type InformeUncertaintyEntry = {
  measurand_codigo: MeasurandCodigo;
  measurand_nombre: string;
  metodo_norma: string | null;
  u_expandida: number;
  k_factor: number;
  nu_eff: number | null;
  unidad: string;
  valid_from: string;
  valid_until: string | null;
  study_id: string;
  documento_codigo: string | null;
  u_relativa_pct: number | null;
  display: string;
};

export type InformeFreshResultRow = {
  ensayo: string;
  metodo: string;
  resultado: string;
  especificado: string;
  conformidad: 'C' | 'NC' | 'N/A';
  uncertainty?: InformeUncertaintyEntry;
};

export type InformeCompressionRow = {
  identificacion: string;
  tipo: string;
  fecha_elaboracion: string;
  fecha_ensayo: string;
  edad_dias: number | null;
  diametro_cm: string;
  carga_kn: number | null;
  fc_mpa: number | null;
  fc_kg_cm2: number | null;
  conformidad: 'C' | 'NC' | 'N/A';
};

export type InformeSnapshot = {
  documento: {
    codigo: 'DC-LC-7.8-01';
    revision: '00';
    numero: string | null;
    issued_at: string | null;
    replaces_numero: string | null;
  };
  laboratorio: {
    razon_social: string;
    nombre: string;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
    acreditacion_ema: string | null;
    pie_pagina: string | null;
  };
  cliente: {
    nombre: string;
    contacto: string | null;
    direccion: string | null;
    telefono: string | null;
    email: string | null;
  };
  obra: {
    order_number: string | null;
    construction_site: string | null;
    elemento: string | null;
    designacion_ehe: string | null;
  };
  muestreo: {
    fecha_muestreo: string;
    hora_muestreo: string | null;
    ubicacion: string | null;
    fecha_recepcion_lab: string | null;
    remision_number: string | null;
    lote_id: string;
    volumen_lote: number | null;
    muestreado_por: MuestreadoPor;
    plan_muestreo: string;
    temperatura_ambiente: number | null;
    humedad_relativa_obra: number | null;
    condiciones_climaticas: string | null;
  };
  resultados_fresco: InformeFreshResultRow[];
  resultados_compresion: InformeCompressionRow[];
  compresion_resumen: {
    promedio_kg_cm2: number | null;
    resistencia_especificada: number | null;
    incertidumbre_u: InformeUncertaintyEntry | null;
  };
  condiciones_ensayo: {
    temperatura_lab: number | null;
    humedad_relativa_lab: number | null;
    capping_type: string | null;
    capping_norma: string | null;
    equipos: Array<{ nombre: string; codigo: string; vencimiento: string | null }>;
  };
  declaraciones: {
    muestreado_por_cliente: boolean;
    regla_decision: string;
    texto_legal: string[];
  };
  opinion_tecnica: string | null;
  uncertainty: InformeUncertaintyEntry[];
  firmas: Array<{
    rol: InformeFirmaRol;
    nombre: string;
    cedula: string | null;
    signed_at: string | null;
  }>;
};

export type InformeChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  href?: string;
  severity: 'blocker' | 'warning';
};

export type LaboratorioAcreditacionConfig = {
  id: string;
  plant_id: string | null;
  razon_social: string;
  nombre_laboratorio: string;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  acreditacion_ema_numero: string | null;
  pie_pagina_texto: string | null;
  regla_decision_default: string | null;
  tolerancias_json: Record<string, unknown>;
};
