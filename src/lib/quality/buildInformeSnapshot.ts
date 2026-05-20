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
  fcMeasurandForTipo,
  requiredMeasurandsForMuestreo,
} from '@/lib/quality/buildInformeUncertaintySnapshot';
import { resolveEnsayoResistenciaReportada } from '@/lib/qualityHelpers';
import type {
  InformeFreshResultRow,
  InformeSnapshot,
  LaboratorioAcreditacionConfig,
  MuestreadoPor,
} from '@/types/informe-ensayo';

export type BuildInformeInput = {
  muestreoListRow: Record<string, unknown>;
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
  const remisionNumber = str(row.remision_number);
  const numeroMuestreo = num(row.numero_muestreo);
  const strengthFc = num(row.strength_fc);
  const slump = num(row.slump);
  const muestreadoPor = (str(row.muestreado_por) as MuestreadoPor) ?? 'LABORATORIO';

  const asOfDate =
    input.asOfDate ??
    input.muestras
      .flatMap((m) => m.ensayos ?? [])
      .map((e) => e.fecha_ensayo)
      .sort()
      .pop() ??
    format(new Date(), 'yyyy-MM-dd');

  const required = requiredMeasurandsForMuestreo({
    revenimiento_sitio: num(row.revenimiento_sitio),
    temperatura_concreto: num(row.temperatura_concreto),
    contenido_aire: num(row.contenido_aire),
    masa_unitaria: num(row.masa_unitaria),
    specimenTypes: input.muestras.map((m) => m.tipo_muestra),
  });

  const { entries: uncertainty } = await buildInformeUncertaintySnapshot(required, asOfDate);
  const uMap = new Map(uncertainty.map((u) => [u.measurand_codigo, u]));

  const freshRows: InformeFreshResultRow[] = [];

  const rev = num(row.revenimiento_sitio);
  if (rev != null) {
    freshRows.push({
      ensayo: 'Revenimiento',
      metodo: 'NMX-C-161-ONNCCE-2013',
      resultado: `${rev} mm`,
      especificado: slump != null ? `${slump} mm` : 'N/A',
      conformidad: conformidadRevenimiento(rev, slump, tolerancias),
      uncertainty: uMap.get('REV'),
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
      uncertainty: uMap.get('TEMP'),
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
      uncertainty: uMap.get('MU'),
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
      uncertainty: uMap.get('AIRE'),
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

  const obraNombre = str(row.obra_nombre) ?? str(row.order_construction_site);

  return {
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
      nombre: input.client?.business_name ?? str(row.client_business_name) ?? 'Cliente',
      contacto: input.client?.contact_name ?? null,
      direccion: input.client?.address ?? null,
      telefono: input.client?.phone ?? null,
      email: input.client?.email ?? null,
    },
    obra: {
      order_number: str(row.order_number),
      construction_site: obraNombre,
      elemento: str(row.order_elemento),
      designacion_ehe: str(row.remision_designacion_ehe),
    },
    muestreo: {
      fecha_muestreo: fechaMuestreo,
      hora_muestreo: str(row.hora_muestreo),
      ubicacion: str(row.ubicacion_detalle) ?? obraNombre,
      fecha_recepcion_lab: str(row.fecha_recepcion_lab),
      remision_number: remisionNumber,
      lote_id: buildLoteId(remisionNumber, numeroMuestreo),
      volumen_lote: num(row.remision_volumen_fabricado),
      muestreado_por: muestreadoPor,
      plan_muestreo: 'NMX-C-161-ONNCCE-2013',
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
      muestreado_por_cliente: muestreadoPor === 'CLIENTE',
      regla_decision: input.labConfig?.regla_decision_default ?? 'POC-17 / ISO Guide 98-4',
      texto_legal: [
        'Los resultados se refieren únicamente a la muestra ensayada.',
        fcU?.documento_codigo
          ? `La evaluación de conformidad considera la incertidumbre de medición conforme a ${fcU.documento_codigo}.`
          : 'La evaluación de conformidad considera la incertidumbre de medición conforme a POC-17.',
      ],
    },
    opinion_tecnica: input.opinionTecnica ?? null,
    uncertainty,
    firmas: input.firmas ?? [],
  };
}

export { fcMeasurandForTipo };
