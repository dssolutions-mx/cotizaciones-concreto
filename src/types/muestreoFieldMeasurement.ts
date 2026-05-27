export type MuestreoFieldMeasurandCodigo = 'REV' | 'TEMP' | 'MU' | 'AIRE' | 'TEMP_AMB';

export type MuestreoMedicionCampo = {
  id: string;
  muestreo_id: string;
  measurand_codigo: MuestreoFieldMeasurandCodigo;
  secuencia: number;
  motivo: string | null;
  valor: number;
  unidad: string;
  notas: string | null;
  created_by: string | null;
  created_at: string;
};

export type MuestreoMedicionCampoInput = {
  measurand_codigo: MuestreoFieldMeasurandCodigo;
  secuencia: number;
  motivo?: string | null;
  valor: number;
  unidad?: string;
  notas?: string | null;
};

export type MuestreoMedicionCampoGrouped = {
  measurand_codigo: MuestreoFieldMeasurandCodigo;
  label: string;
  unidad: string;
  promedio: number | null;
  rows: MuestreoMedicionCampo[];
};
