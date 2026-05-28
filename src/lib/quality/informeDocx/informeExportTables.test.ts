import assert from 'node:assert/strict';
import {
  buildCompressionExportTable,
  buildFreshExportTable,
  FRESH_HEADERS_WITH_LECTURA,
} from './informeExportTables';
import type { InformeSnapshot } from '@/types/informe-ensayo';

function minimalSnapshot(overrides: Partial<InformeSnapshot> = {}): InformeSnapshot {
  return {
    documento: {
      codigo: 'DC-LC-7.8-01',
      revision: '00',
      numero: null,
      issued_at: null,
      replaces_numero: null,
    },
    laboratorio: {
      razon_social: 'DC Concretos',
      nombre: 'Lab',
      direccion: null,
      telefono: null,
      email: null,
      acreditacion_ema: null,
      pie_pagina: null,
    },
    cliente: { nombre: 'Cliente', contacto: null, direccion: null, telefono: null, email: null },
    obra: {
      order_number: null,
      construction_site: null,
      elemento: null,
      designacion_ehe: null,
    },
    muestreo: {
      fecha_muestreo: '2026-05-01',
      hora_muestreo: null,
      ubicacion: null,
      fecha_recepcion_lab: null,
      remision_number: null,
      lote_id: 'L-1',
      volumen_lote: null,
      muestreado_por: 'LABORATORIO',
      plan_muestreo: 'Plan',
      temperatura_ambiente: null,
      humedad_relativa_obra: null,
      condiciones_climaticas: null,
    },
    resultados_fresco: [],
    resultados_compresion: [],
    compresion_resumen: {
      promedio_kg_cm2: null,
      resistencia_especificada: null,
      incertidumbre_u: null,
      metodo: null,
    },
    condiciones_ensayo: {
      temperatura_lab: null,
      humedad_relativa_lab: null,
      capping_type: null,
      capping_norma: null,
      equipos: [],
    },
    declaraciones: {
      muestreado_por_cliente: false,
      regla_decision: 'Regla',
      texto_legal: [],
    },
    opinion_tecnica: null,
    uncertainty: [],
    firmas: [],
    ...overrides,
  };
}

// multi-lectura fresco
{
  const snapshot = minimalSnapshot({
    resultados_fresco: [
      {
        ensayo: 'Revenimiento',
        metodo: 'NMX',
        resultado: '23.8 cm',
        especificado: '—',
        conformidad: 'N/A',
        lectura: 'Ensayo 1',
        uncertainty: {
          measurand_codigo: 'REV',
          measurand_nombre: 'Rev',
          metodo_norma: null,
          u_expandida: 0.5,
          k_factor: 2,
          nu_eff: null,
          unidad: 'cm',
          valid_from: '2026-01-01',
          valid_until: null,
          study_id: 's1',
          documento_codigo: 'DOC',
          u_relativa_pct: null,
          display: 'U = 0.5 cm',
        },
      },
      {
        ensayo: 'Revenimiento',
        metodo: 'NMX',
        resultado: '23.8 cm',
        especificado: '—',
        conformidad: 'N/A',
        lectura: 'Ensayo 2',
      },
    ],
  });

  const fresh = buildFreshExportTable(snapshot);
  assert.deepEqual(fresh.headers, FRESH_HEADERS_WITH_LECTURA);
  assert.equal(fresh.rows.length, 2);
  assert.equal(fresh.rows[0][1], 'Ensayo 1');
  assert.ok(fresh.rows[0][2].includes('U = 0.5 cm'));
}

// compression rows
{
  const snapshot = minimalSnapshot({
    resultados_compresion: [
      {
        identificacion: 'C1',
        tipo: 'CILINDRO',
        fecha_elaboracion: '2026-05-01',
        fecha_ensayo: '2026-05-08',
        edad_dias: 7,
        diametro_cm: '15 cm',
        carga_kn: 120,
        fc_mpa: null,
        fc_kg_cm2: 250,
        conformidad: 'C',
      },
    ],
  });

  const comp = buildCompressionExportTable(snapshot);
  assert.equal(comp.rows.length, 1);
  assert.deepEqual(comp.rows[0], ['C1', '7 d', '120', '250', 'C']);
}

console.log('informeExportTables.test.ts: ok');
