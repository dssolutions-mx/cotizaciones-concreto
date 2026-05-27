import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import {
  conformidadFc,
  conformidadRevenimiento,
  kgCm2ToMpa,
  kgToKn,
  parseTolerancias,
} from '@/lib/quality/informeConformidad';
import {
  buildInformeUncertaintySnapshot,
} from '@/lib/quality/buildInformeUncertaintySnapshot';
import {
  fcMeasurandForTipo,
  requiredMeasurandsForInformeUncertainty,
} from '@/lib/quality/informeMeasurands';
import {
  formatEdadEspecificada,
  INFORME_FRESH_NA_LAB,
  INFORME_LEGAL_LAB,
  INFORME_METODO_COMPRESION,
  protocolTypeLabel,
} from '@/lib/quality/informeLabContext';
import { resolveEnsayoResistenciaReportada } from '@/lib/qualityHelpers';
import type {
  InformeFreshResultRow,
  InformeSnapshot,
  LaboratorioAcreditacionConfig,
  MuestreadoPor,
} from '@/types/informe-ensayo';

export type LaboratorioLoteInformeRow = {
  lote_number: string;
  study_name: string;
  protocol_type: string;
  hypothesis_notes?: string | null;
  volumen_m3?: number | null;
  designacion_ehe?: string | null;
  recipe_snapshot?: { strength_fc?: number | null; age_days?: number | null; age_hours?: number | null } | null;
  concrete_specs?: { valor_edad?: number | null; unidad_edad?: string | null } | null;
};

export type BuildInformeInput = {
  muestreoListRow: Record<string, unknown>;
  laboratorioLote?: LaboratorioLoteInformeRow | null;
  client?: {
    business_name?: string | null;
    contact_name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  muestras: Array<{
    id: string;
    tipo_muestra: string;
    identificacion: string;
    diameter_cm?: number | null;
    cube_side_cm?: number | null;
    is_edad_garantia?: boolean | null;
    ensayos?: Array<{
      id: string;
      fecha_ensayo: string;
      carga_kg: number;
      resistencia_calculada: number;
      resistencia_corregida?: number | null;
      factor_correccion?: number | null;
      porcentaje_cumplimiento: number;
      temp_laboratorio_c?: number | null;
      humedad_relativa_lab?: number | null;
      capping_type?: string | null;
      capping_norma?: string | null;
    }>;
  }>;
  ensayoInstrumentos?: Array<{
    nombre: string;
    codigo: string;
    fecha_vencimiento_al_momento?: string | null;
  }>;
  labConfig: LaboratorioAcreditacionConfig | null;
  numero?: string | null;
  issuedAt?: string | null;
  replacesNumero?: string | null;
  opinionTecnica?: string | null;
  firmas?: InformeSnapshot['firmas'];
  asOfDate?: string;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildLoteId(remisionNumber: string | null, numeroMuestreo: number | null): string {
  const r = remisionNumber ?? 'SIN-REM';
  const n = numeroMuestreo ?? 0;
  return `${r}-M${n}`;
}

function edadDias(fechaMuestreo: string, fechaEnsayo: string): number | null {
  try {
    return differenceInCalendarDays(parseISO(fechaEnsayo), parseISO(fechaMuestreo));
  } catch {
    return null;
  }
}

export async function buildInformeSnapshot(input: BuildInformeInput): Promise<InformeSnapshot> {
  const row = input.muestreoListRow;
  const tolerancias = parseTolerancias(input.labConfig?.tolerancias_json);
  const fechaMuestreo = str(row.fecha_muestreo) ?? '';
  const isLabExperiment =
    row.sampling_type === 'LAB_EXPERIMENT' || row.laboratorio_lote_id != null;
  const labLoteNumber = str(row.laboratorio_lote_number) ?? input.laboratorioLote?.lote_number ?? null;
  const labStudyName = str(row.laboratorio_study_name) ?? input.laboratorioLote?.study_name ?? null;
  const labProtocolType =
    str(row.laboratorio_protocol_type) ?? input.laboratorioLote?.protocol_type ?? null;
  const remisionNumber = isLabExperiment ? labLoteNumber : str(row.remision_number);
  const numeroMuestreo = num(row.numero_muestreo);
  const snapshotFc = input.laboratorioLote?.recipe_snapshot?.strength_fc;
  const strengthFc =
    num(row.strength_fc) ??
    (snapshotFc != null ? Number(snapshotFc) : null) ??
    null;
  const slump = num(row.slump);
  const muestreadoPor = (str(row.muestreado_por) as MuestreadoPor) ?? 'LABORATORIO';
  const declararIncertidumbreCampo = row.declarar_incertidumbre_campo === true;

  const asOfDate =
    input.asOfDate ??
    input.muestras
      .flatMap((m) => m.ensayos ?? [])
      .map((e) => e.fecha_ensayo)
      .sort()
      .pop() ??
    format(new Date(), 'yyyy-MM-dd');

  const required = requiredMeasurandsForInformeUncertainty({
    revenimiento_sitio: num(row.revenimiento_sitio),
    temperatura_concreto: num(row.temperatura_concreto),
    contenido_aire: num(row.contenido_aire),
    masa_unitaria: num(row.masa_unitaria),
    specimenTypes: input.muestras.map((m) => m.tipo_muestra),
    declarar_incertidumbre_campo: declararIncertidumbreCampo,
  });

  const { entries: uncertainty } = await buildInformeUncertaintySnapshot(required, asOfDate);
  const uMap = new Map(uncertainty.map((u) => [u.measurand_codigo, u]));

  const freshUncertainty = (codigo: string) =>
    declararIncertidumbreCampo ? uMap.get(codigo) : undefined;

  const freshRows: InformeFreshResultRow[] = [];

  const rev = num(row.revenimiento_sitio);
  if (rev != null) {
    freshRows.push({
      ensayo: 'Revenimiento',
      metodo: 'NMX-C-161-ONNCCE-2013',
      resultado: `${rev} mm`,
      especificado: slump != null ? `${slump} mm` : 'N/A',
      conformidad: conformidadRevenimiento(rev, slump, tolerancias),
      uncertainty: freshUncertainty('REV'),
    });
  }

  const temp = num(row.temperatura_concreto);
  if (temp != null) {
    freshRows.push({
      ensayo: 'Temperatura del concreto',
      metodo: 'NMX-C-161-ONNCCE-2013',
      resultado: `${temp} °C`,
      especificado: 'N/A',
      conformidad: 'N/A',
      uncertainty: freshUncertainty('TEMP'),
    });
  }

  const mu = num(row.masa_unitaria);
  if (mu != null) {
    freshRows.push({
      ensayo: 'Masa unitaria',
      metodo: 'NMX-C-161-ONNCCE-2013',
      resultado: `${mu} kg/m³`,
      especificado: 'N/A',
      conformidad: 'N/A',
      uncertainty: freshUncertainty('MU'),
    });
  }

  const aire = num(row.contenido_aire);
  if (aire != null) {
    freshRows.push({
      ensayo: 'Contenido de aire',
      metodo: 'NMX-C-161-ONNCCE-2013',
      resultado: `${aire} %`,
      especificado: 'N/A',
      conformidad: 'N/A',
      uncertainty: freshUncertainty('AIRE'),
    });
  }

  const compressionRows = input.muestras.flatMap((m) =>
    (m.ensayos ?? []).map((e) => {
      const fcKg = resolveEnsayoResistenciaReportada(e);
      const diam =
        m.tipo_muestra === 'CUBO' && m.cube_side_cm
          ? `${m.cube_side_cm} cm (cubo)`
          : m.diameter_cm
            ? `${m.diameter_cm} cm`
            : 'N/A';
      return {
        identificacion: m.identificacion,
        tipo: m.tipo_muestra,
        fecha_elaboracion: fechaMuestreo,
        fecha_ensayo: e.fecha_ensayo,
        edad_dias: edadDias(fechaMuestreo, e.fecha_ensayo),
        diametro_cm: diam,
        carga_kn: kgToKn(e.carga_kg),
        fc_mpa: kgCm2ToMpa(fcKg),
        fc_kg_cm2: fcKg > 0 ? fcKg : null,
        conformidad: conformidadFc(e.porcentaje_cumplimiento),
        metodo: INFORME_METODO_COMPRESION,
      };
    })
  );

  const fcValues = compressionRows.map((r) => r.fc_kg_cm2).filter((v): v is number => v != null && v > 0);
  const promedio =
    fcValues.length > 0 ? Math.round((fcValues.reduce((a, b) => a + b, 0) / fcValues.length) * 100) / 100 : null;

  const hasCubo = input.muestras.some((m) => m.tipo_muestra === 'CUBO');
  const fcU = uMap.get(hasCubo && !input.muestras.some((m) => m.tipo_muestra === 'CILINDRO') ? 'FC_CUBO' : 'FC') ??
    uMap.get('FC') ??
    uMap.get('FC_CUBO') ??
    null;

  const firstEnsayo = input.muestras.flatMap((m) => m.ensayos ?? [])[0];

  const obraNombre = isLabExperiment
    ? (labStudyName ?? 'Experimento interno de laboratorio')
    : (str(row.obra_nombre) ?? str(row.order_construction_site));

  const clienteNombre = isLabExperiment
    ? 'Estudio interno — I+D (sin cliente externo)'
    : (input.client?.business_name ?? str(row.client_business_name) ?? 'Cliente');

  const edadEspecificada = isLabExperiment
    ? formatEdadEspecificada(
        input.laboratorioLote?.recipe_snapshot?.age_days ?? num(row.age_days),
        input.laboratorioLote?.recipe_snapshot?.age_hours ?? num(row.age_hours)
      ) ??
      (input.laboratorioLote?.concrete_specs?.valor_edad != null
        ? `${input.laboratorioLote.concrete_specs.valor_edad} ${
            input.laboratorioLote.concrete_specs.unidad_edad === 'HORA' ? 'h' : 'd'
          }`
        : null)
    : formatEdadEspecificada(num(row.age_days), num(row.age_hours));

  const estudioLaboratorio = isLabExperiment
    ? {
        lote_number: labLoteNumber,
        study_name: labStudyName,
        protocol_type: labProtocolType,
        protocol_label: protocolTypeLabel(labProtocolType),
        recipe_code: str(row.recipe_code),
        volumen_m3: input.laboratorioLote?.volumen_m3 ?? null,
        designacion_ehe: input.laboratorioLote?.designacion_ehe ?? null,
        hypothesis_notes: input.laboratorioLote?.hypothesis_notes ?? null,
        edad_especificada: edadEspecificada,
      }
    : null;

  const legalBase = [
    'Los resultados se refieren únicamente a la muestra ensayada.',
    fcU?.documento_codigo
      ? `La evaluación de conformidad considera la incertidumbre de medición conforme a ${fcU.documento_codigo}.`
      : 'La evaluación de conformidad considera la incertidumbre de medición conforme a POC-17.',
  ];
  const legalTexts = isLabExperiment ? [...legalBase, ...INFORME_LEGAL_LAB] : legalBase;

  return {
    contexto: isLabExperiment ? 'laboratorio_interno' : 'obra',
    estudio_laboratorio: estudioLaboratorio,
    documento: {
      codigo: 'DC-LC-7.8-01',
      revision: '00',
      numero: input.numero ?? null,
      issued_at: input.issuedAt ?? null,
      replaces_numero: input.replacesNumero ?? null,
    },
    laboratorio: {
      razon_social: input.labConfig?.razon_social ?? 'DC Concretos S.A. de C.V.',
      nombre: input.labConfig?.nombre_laboratorio ?? 'Laboratorio de Control de Calidad',
      direccion: input.labConfig?.direccion ?? null,
      telefono: input.labConfig?.telefono ?? null,
      email: input.labConfig?.email ?? null,
      acreditacion_ema: input.labConfig?.acreditacion_ema_numero ?? null,
      pie_pagina: input.labConfig?.pie_pagina_texto ?? null,
    },
    cliente: {
      nombre: clienteNombre,
      contacto: input.client?.contact_name ?? null,
      direccion: input.client?.address ?? null,
      telefono: input.client?.phone ?? null,
      email: input.client?.email ?? null,
    },
    obra: {
      order_number: isLabExperiment ? null : str(row.order_number),
      construction_site: obraNombre,
      elemento: isLabExperiment ? (labLoteNumber ? `Lote ${labLoteNumber}` : null) : str(row.order_elemento),
      designacion_ehe: isLabExperiment ? null : str(row.remision_designacion_ehe),
    },
    muestreo: {
      fecha_muestreo: fechaMuestreo,
      hora_muestreo: str(row.hora_muestreo),
      ubicacion: str(row.ubicacion_detalle) ?? obraNombre,
      fecha_recepcion_lab: str(row.fecha_recepcion_lab),
      remision_number: isLabExperiment ? (labLoteNumber ?? 'LAB') : remisionNumber,
      lote_id: buildLoteId(isLabExperiment ? labLoteNumber : remisionNumber, numeroMuestreo),
      volumen_lote: isLabExperiment
        ? (input.laboratorioLote?.volumen_m3 ?? null)
        : num(row.remision_volumen_fabricado),
      muestreado_por: isLabExperiment ? 'LABORATORIO' : muestreadoPor,
      plan_muestreo: isLabExperiment
        ? `Protocolo interno${labProtocolType ? ` · ${protocolTypeLabel(labProtocolType) ?? labProtocolType}` : ''}`
        : 'NMX-C-161-ONNCCE-2013',
      temperatura_ambiente: num(row.temperatura_ambiente),
      humedad_relativa_obra: num(row.humedad_relativa_obra),
      condiciones_climaticas: str(row.condiciones_climaticas),
    },
    resultados_fresco: freshRows,
    resultados_compresion: compressionRows,
    compresion_resumen: {
      promedio_kg_cm2: promedio,
      resistencia_especificada: strengthFc,
      incertidumbre_u: fcU,
      metodo: compressionRows.length > 0 ? INFORME_METODO_COMPRESION : null,
    },
    condiciones_ensayo: {
      temperatura_lab: firstEnsayo?.temp_laboratorio_c ?? null,
      humedad_relativa_lab: firstEnsayo?.humedad_relativa_lab ?? null,
      capping_type: firstEnsayo?.capping_type ?? null,
      capping_norma: firstEnsayo?.capping_norma ?? null,
      equipos: (input.ensayoInstrumentos ?? []).map((i) => ({
        nombre: i.nombre,
        codigo: i.codigo,
        vencimiento: i.fecha_vencimiento_al_momento ?? null,
      })),
    },
    declaraciones: {
      muestreado_por_cliente: !isLabExperiment && muestreadoPor === 'CLIENTE',
      regla_decision: input.labConfig?.regla_decision_default ?? 'POC-17 / ISO Guide 98-4',
      texto_legal: legalTexts,
      fresco_no_aplica: isLabExperiment ? INFORME_FRESH_NA_LAB : null,
    },
    opinion_tecnica: input.opinionTecnica ?? null,
    uncertainty,
    firmas: input.firmas ?? [],
  };
}

export { fcMeasurandForTipo };
