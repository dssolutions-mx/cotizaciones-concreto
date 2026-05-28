import { Document, Paragraph, ShadingType, Table } from 'docx';
import { isInformeLabExperiment } from '@/lib/quality/informeLabContext';
import {
  buildCompressionExportTable,
  buildFreshExportTable,
  informeFreshShowsLecturaCol,
} from '@/lib/quality/informeDocx/informeExportTables';
import {
  buildMuestreoCondicionesText,
  formatInformeIssuedAt,
  formatInformeSignedAt,
  INFORME_DOCX_LEGAL,
  INFORME_FIRMA_LABELS,
} from '@/lib/quality/informeDocx/informeExportFormatters';
import {
  bodyP,
  dataTable,
  emptyLine,
  hr,
  kvFieldTable,
  makeInformeFooter,
  makeInformeHeader,
  secHdr,
  signaturesTable,
  subtitleCenter,
  titleCenter,
  tr,
} from '@/lib/quality/informeDocx/informeDocxBuilders';
import {
  AMBER_TEXT,
  CONTENT_WIDTH_DXA,
  GREEN,
  NAVY,
  PAGE,
  sp,
  YELLOW,
} from '@/lib/quality/informeDocx/informeDocxTheme';
import type { InformeFirmaRol, InformeSnapshot } from '@/types/informe-ensayo';

const FIRMA_SLOTS: InformeFirmaRol[] = ['elaboro', 'reviso', 'autorizo'];

async function fetchLogoArrayBuffer(): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined') return null;
  try {
    const origin = window.location?.origin ?? '';
    const res = await fetch(`${origin}/images/dc-concretos-logo.png`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function borradorBanner(): Paragraph {
  return new Paragraph({
    spacing: sp(120, 120),
    shading: { type: ShadingType.CLEAR, fill: YELLOW },
    children: [
      tr('BORRADOR ', { bold: true, color: AMBER_TEXT, size: 22 }),
      tr('— Documento sin emitir. No sustituye el informe oficial con folio y firmas.', {
        color: AMBER_TEXT,
        size: 20,
      }),
    ],
  });
}

/** Column widths for the §3 fresco table, in DXA (total must equal CONTENT_WIDTH_DXA = 9360). */
function freshColWidths(hasLectura: boolean): number[] {
  if (hasLectura) {
    return [2000, 1500, 2000, 2360, 1500];
  }
  return [2500, 2500, 2500, 1860];
}

/** Column widths for the §3 compresión table (5 columns, sums to 9360). */
const COMPRESSION_COL_WIDTHS = [2400, 1200, 1600, 2400, 1760];

function clienteValue(snapshot: InformeSnapshot): string {
  return snapshot.cliente.nombre;
}

export async function buildInformeDocxDocument(snapshot: InformeSnapshot): Promise<Document> {
  const doc = snapshot.documento;
  const lab = snapshot.laboratorio;
  const isLab = isInformeLabExperiment(snapshot);
  const estudio = snapshot.estudio_laboratorio;
  const muestreadoLabel =
    snapshot.muestreo.muestreado_por === 'CLIENTE' ? 'Cliente' : 'Laboratorio acreditado';
  const metodoCompresion = snapshot.compresion_resumen.metodo ?? 'NMX-C-155-ONNCCE-2017';
  const docLine = `${doc.codigo} Rev. ${doc.revision} · ${doc.numero ?? 'BORRADOR'}`;
  const contextLabel = isLab
    ? 'Estudio interno de laboratorio (I+D)'
    : 'Informe para el cliente';

  const showLecturaCol = informeFreshShowsLecturaCol(snapshot);
  const fresh = buildFreshExportTable(snapshot);
  const compression = buildCompressionExportTable(snapshot);

  const logo = await fetchLogoArrayBuffer();
  const children: (Paragraph | Table)[] = [];

  children.push(
    titleCenter('INFORME DE RESULTADOS DE ENSAYO'),
    subtitleCenter(`NMX-EC-17025-IMNC-2018 §7.8 · ${contextLabel}`),
    hr(),
  );

  if (!doc.issued_at) {
    children.push(borradorBanner(), emptyLine());
  }

  children.push(
    bodyP(
      `Emisión: ${formatInformeIssuedAt(doc.issued_at)}${
        doc.replaces_numero ? ` · Reemplaza informe ${doc.replaces_numero}` : ''
      }`,
      { bold: true, color: NAVY },
    ),
    emptyLine(),
  );

  // §1
  if (isLab && estudio) {
    children.push(secHdr('§1 Estudio interno y referencia de mezcla'));
    const fields: { label: string; value: string }[] = [
      { label: 'Estudio', value: estudio.study_name ?? '—' },
      { label: 'Lote de experimento', value: estudio.lote_number ?? '—' },
      { label: 'Protocolo', value: estudio.protocol_label ?? estudio.protocol_type ?? '—' },
      { label: 'Receta de referencia', value: estudio.recipe_code ?? '—' },
    ];
    if (estudio.designacion_ehe) fields.push({ label: 'Designación', value: estudio.designacion_ehe });
    if (estudio.volumen_m3 != null) {
      fields.push({ label: 'Volumen elaborado', value: `${estudio.volumen_m3} m³` });
    }
    if (estudio.edad_especificada) {
      fields.push({ label: 'Edad de ensayo de referencia', value: estudio.edad_especificada });
    }
    if (estudio.hypothesis_notes) {
      fields.push({ label: 'Hipótesis / objetivo', value: estudio.hypothesis_notes });
    }
    fields.push({ label: 'Solicitante', value: clienteValue(snapshot) });
    children.push(kvFieldTable(fields));
  } else {
    children.push(secHdr('§1 Cliente y obra'));
    const fields: { label: string; value: string }[] = [
      { label: 'Cliente', value: clienteValue(snapshot) },
      {
        label: 'Obra / pedido',
        value: `${snapshot.obra.construction_site ?? '—'} · Pedido ${snapshot.obra.order_number ?? '—'}`,
      },
      { label: 'Elemento', value: snapshot.obra.elemento ?? 'No especificado' },
    ];
    if (snapshot.obra.designacion_ehe) {
      fields.push({ label: 'Designación', value: snapshot.obra.designacion_ehe });
    }
    fields.push({ label: 'Contacto cliente', value: snapshot.cliente.contacto ?? '—' });
    children.push(kvFieldTable(fields));
  }
  children.push(emptyLine());

  // §2
  children.push(
    secHdr(isLab ? '§2 Elaboración y recepción en laboratorio' : '§2 Muestreo y recepción'),
  );
  children.push(
    kvFieldTable([
      {
        label: 'Fecha / hora',
        value: `${snapshot.muestreo.fecha_muestreo}${
          snapshot.muestreo.hora_muestreo ? ` ${snapshot.muestreo.hora_muestreo}` : ''
        }`,
      },
      {
        label: isLab ? 'Identificación del lote' : 'Lote / remisión',
        value: `${snapshot.muestreo.lote_id} · ${snapshot.muestreo.remision_number ?? '—'}`,
      },
      { label: 'Recepción en laboratorio', value: snapshot.muestreo.fecha_recepcion_lab ?? '—' },
      { label: 'Muestreado por', value: muestreadoLabel },
      {
        label: isLab ? 'Ubicación de elaboración' : 'Ubicación',
        value: snapshot.muestreo.ubicacion ?? '—',
      },
      {
        label: isLab ? 'Condiciones de elaboración' : 'Condiciones en obra',
        value: buildMuestreoCondicionesText({ muestreo: snapshot.muestreo, isLab }),
      },
      {
        label: isLab ? 'Plan / protocolo' : 'Plan de muestreo',
        value: snapshot.muestreo.plan_muestreo,
      },
    ]),
  );
  children.push(emptyLine());

  // §3 fresco
  children.push(secHdr('§3 Resultados — concreto fresco'));
  if (fresh.rows.length > 0) {
    children.push(dataTable(fresh.headers, fresh.rows, freshColWidths(showLecturaCol)));
  } else if (snapshot.declaraciones.fresco_no_aplica) {
    children.push(bodyP(snapshot.declaraciones.fresco_no_aplica));
  } else {
    children.push(bodyP('Sin ensayos de campo registrados.'));
  }
  children.push(emptyLine());

  // §3 compresión
  children.push(secHdr('§3 Resistencia a compresión'));
  if (compression.rows.length > 0) {
    children.push(bodyP(`Método de ensayo: ${metodoCompresion}`, { color: NAVY }));
    children.push(dataTable(compression.headers, compression.rows, COMPRESSION_COL_WIDTHS));
    children.push(emptyLine());
    const resumenFields = [
      {
        label: 'Promedio',
        value:
          snapshot.compresion_resumen.promedio_kg_cm2 != null
            ? `${snapshot.compresion_resumen.promedio_kg_cm2} kg/cm²`
            : '—',
      },
      {
        label: "f′c de referencia",
        value:
          snapshot.compresion_resumen.resistencia_especificada != null
            ? `${snapshot.compresion_resumen.resistencia_especificada} kg/cm²${
                estudio?.edad_especificada ? ` @ ${estudio.edad_especificada}` : ''
              }`
            : '—',
      },
    ];
    if (snapshot.compresion_resumen.incertidumbre_u) {
      resumenFields.push({
        label: 'Incertidumbre U',
        value: snapshot.compresion_resumen.incertidumbre_u.display,
      });
    }
    children.push(kvFieldTable(resumenFields));
  } else {
    children.push(bodyP('Sin ensayos de compresión registrados.'));
  }
  children.push(emptyLine());

  // Condiciones ambientales
  const cond = snapshot.condiciones_ensayo;
  if (cond.temperatura_lab != null || cond.humedad_relativa_lab != null || cond.capping_type) {
    children.push(secHdr('Condiciones ambientales y preparación de probetas'));
    const condFields: { label: string; value: string }[] = [];
    if (cond.temperatura_lab != null) {
      condFields.push({ label: 'Temperatura en laboratorio', value: `${cond.temperatura_lab} °C` });
    }
    if (cond.humedad_relativa_lab != null) {
      condFields.push({ label: 'Humedad relativa en laboratorio', value: `${cond.humedad_relativa_lab} %` });
    }
    if (cond.capping_type) {
      condFields.push({
        label: 'Capado',
        value: `${cond.capping_type}${cond.capping_norma ? ` · ${cond.capping_norma}` : ''}`,
      });
    }
    children.push(kvFieldTable(condFields));
    children.push(emptyLine());
  }

  // Equipos
  if (cond.equipos.length > 0) {
    children.push(secHdr('Equipos utilizados'));
    children.push(
      kvFieldTable(
        cond.equipos.map((eq) => ({
          label: eq.codigo,
          value: `${eq.nombre}${eq.vencimiento ? ` · vig. ${eq.vencimiento}` : ''}`,
        })),
      ),
    );
    children.push(emptyLine());
  }

  // §4 Declaraciones
  children.push(secHdr('§4 Declaraciones'));
  for (const t of snapshot.declaraciones.texto_legal) {
    children.push(bodyP(t, { size: 18 }));
  }
  for (const t of INFORME_DOCX_LEGAL) {
    children.push(bodyP(t, { size: 18 }));
  }
  children.push(emptyLine());
  children.push(
    kvFieldTable([{ label: 'Regla de decisión', value: snapshot.declaraciones.regla_decision }]),
  );
  if (snapshot.declaraciones.muestreado_por_cliente) {
    children.push(
      bodyP('El muestreo fue realizado por el cliente (NMX-EC-17025-IMNC-2018 §7.8.6).', {
        color: AMBER_TEXT,
      }),
    );
  }
  children.push(emptyLine());

  // Opinión
  if (snapshot.opinion_tecnica) {
    children.push(secHdr('Opinión e interpretaciones (§7.8.7)'));
    children.push(bodyP(snapshot.opinion_tecnica));
    children.push(emptyLine());
  }

  // Firmas
  children.push(secHdr('Firmas'));
  children.push(
    signaturesTable(
      FIRMA_SLOTS.map((rol) => {
        const meta = INFORME_FIRMA_LABELS[rol];
        const firma = snapshot.firmas.find((f) => f.rol === rol);
        return {
          title: meta.title,
          subtitle: meta.subtitle,
          nombre: firma?.nombre ?? '—',
          cedula: firma?.cedula ?? null,
          signedAt: firma?.signed_at ? formatInformeSignedAt(firma.signed_at) : null,
        };
      }),
    ),
  );
  children.push(emptyLine());

  // Pie de página textual (uncertainty quick reference)
  if (snapshot.uncertainty.length > 0) {
    children.push(
      bodyP(
        `Incertidumbre declarada (EMA): ${snapshot.uncertainty
          .map((u) => `${u.measurand_codigo} ${u.display}`)
          .join(' · ')}`,
        { size: 17, color: NAVY },
      ),
    );
  }
  if (lab.pie_pagina) {
    children.push(bodyP(lab.pie_pagina, { size: 17, color: GREEN }));
  }
  // Suppress unused-import warning for CONTENT_WIDTH_DXA (kept for layout reasoning)
  void CONTENT_WIDTH_DXA;

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: {
              top: PAGE.marginTop,
              right: PAGE.marginRight,
              bottom: PAGE.marginBottom,
              left: PAGE.marginLeft,
            },
          },
        },
        headers: {
          default: makeInformeHeader(logo, {
            razonSocial: lab.razon_social,
            labNombre: lab.nombre,
            acreditacion: lab.acreditacion_ema,
            docLine,
            contextLabel,
          }),
        },
        footers: { default: makeInformeFooter(doc.numero ?? 'BORRADOR') },
        children,
      },
    ],
  });
}
