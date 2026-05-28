import assert from 'node:assert/strict';
import { Packer } from 'docx';
import { buildInformeDocxDocument } from './buildInformeDocx';
import type { InformeSnapshot } from '@/types/informe-ensayo';

function minimalObraSnapshot(): InformeSnapshot {
  return {
    contexto: 'obra',
    documento: {
      codigo: 'DC-LC-7.8-01',
      revision: '00',
      numero: 'INF-001',
      issued_at: null,
      replaces_numero: null,
    },
    laboratorio: {
      razon_social: 'DC Concretos S.A. de C.V.',
      nombre: 'Laboratorio de Control',
      direccion: 'Dir',
      telefono: '123',
      email: 'lab@test.com',
      acreditacion_ema: 'EMA-123',
      pie_pagina: null,
    },
    cliente: {
      nombre: 'Cliente Test',
      contacto: 'Contacto',
      direccion: null,
      telefono: null,
      email: null,
    },
    obra: {
      order_number: 'P-1',
      construction_site: 'Obra Norte',
      elemento: 'Loseta',
      designacion_ehe: null,
    },
    muestreo: {
      fecha_muestreo: '2026-05-01',
      hora_muestreo: '10:00',
      ubicacion: 'Planta',
      fecha_recepcion_lab: '2026-05-01',
      remision_number: 'R-100',
      lote_id: 'L-100-M1',
      volumen_lote: 5,
      muestreado_por: 'LABORATORIO',
      plan_muestreo: 'NMX-C-161',
      temperatura_ambiente: 28,
      humedad_relativa_obra: 50,
      condiciones_climaticas: 'Soleado',
    },
    resultados_fresco: [
      {
        ensayo: 'Revenimiento',
        metodo: 'NMX',
        resultado: '12 cm',
        especificado: '10±2',
        conformidad: 'C',
      },
    ],
    resultados_compresion: [
      {
        identificacion: 'C1',
        tipo: 'CILINDRO',
        fecha_elaboracion: '2026-05-01',
        fecha_ensayo: '2026-05-08',
        edad_dias: 7,
        diametro_cm: '15',
        carga_kn: 100,
        fc_mpa: null,
        fc_kg_cm2: 200,
        conformidad: 'C',
      },
    ],
    compresion_resumen: {
      promedio_kg_cm2: 200,
      resistencia_especificada: 250,
      incertidumbre_u: null,
      metodo: 'NMX-C-155',
    },
    condiciones_ensayo: {
      temperatura_lab: 23,
      humedad_relativa_lab: 60,
      capping_type: null,
      capping_norma: null,
      equipos: [],
    },
    declaraciones: {
      muestreado_por_cliente: false,
      regla_decision: 'Conforme a POC-17',
      texto_legal: ['Resultados referidos a la muestra ensayada.'],
    },
    opinion_tecnica: null,
    uncertainty: [],
    firmas: [],
  };
}

function minimalLabSnapshot(): InformeSnapshot {
  const base = minimalObraSnapshot();
  return {
    ...base,
    contexto: 'laboratorio_interno',
    estudio_laboratorio: {
      lote_number: 'LAB-P001',
      study_name: 'Ensayo aptitud',
      protocol_type: 'APTITUD',
      protocol_label: 'Aptitud',
      recipe_code: 'R-01',
      volumen_m3: 0.5,
      designacion_ehe: null,
      hypothesis_notes: 'Hipótesis',
      edad_especificada: '28 d',
    },
    cliente: { ...base.cliente, nombre: 'Estudio interno — I+D' },
  };
}

async function smokeBuild(snapshot: InformeSnapshot, label: string) {
  const doc = await buildInformeDocxDocument(snapshot);
  const buffer = await Packer.toBuffer(doc);
  assert.ok(buffer.byteLength > 1000, `${label}: buffer too small`);
}

void (async () => {
  await smokeBuild(minimalObraSnapshot(), 'obra');
  await smokeBuild(minimalLabSnapshot(), 'lab');
  console.log('buildInformeDocx.test.ts: ok');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
