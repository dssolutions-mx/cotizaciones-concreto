import {
  BorderStyle,
  Document,
  ImageRun,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { DC_DOCUMENT_CONTACT } from '@/lib/reports/branding';
import { isInformeLabExperiment } from '@/lib/quality/informeLabContext';
import {
  buildCompressionExportTable,
  buildFreshExportTable,
} from '@/lib/quality/informeDocx/informeExportTables';
import {
  buildMuestreoCondicionesText,
  formatInformeIssuedAt,
  formatInformeSignedAt,
  INFORME_DOCX_LEGAL,
  INFORME_FIRMA_LABELS,
} from '@/lib/quality/informeDocx/informeExportFormatters';
import {
  DOCX_AMBER_BG,
  DOCX_AMBER_TEXT,
  DOCX_BORDER,
  DOCX_FONT,
  DOCX_HEADER_BG,
  DOCX_NAVY,
  DOCX_PAGE_MARGIN_DXA,
  DOCX_SPACING_BODY,
  DOCX_SPACING_SECTION,
  DOCX_SPACING_TIGHT,
  DOCX_TABLE_BORDERS,
  docxCenteredParagraph,
  docxHeaderRowProps,
  docxTableWidthPct,
} from '@/lib/quality/informeDocx/informeDocxStyles';
import type { InformeFirmaRol, InformeSnapshot } from '@/types/informe-ensayo';

const FIRMA_SLOTS: InformeFirmaRol[] = ['elaboro', 'reviso', 'autorizo'];

async function fetchLogoImageRun(): Promise<ImageRun | null> {
  if (typeof window === 'undefined') return null;
  try {
    const origin = window.location?.origin ?? '';
    const res = await fetch(`${origin}/images/dc-concretos-logo.png`);
    if (!res.ok) return null;
    const data = await res.arrayBuffer();
    return new ImageRun({
      type: 'png',
      data,
      transformation: { width: 72, height: 36 },
    });
  } catch {
    return null;
  }
}

function textRun(
  text: string,
  opts?: { bold?: boolean; size?: number; color?: string; italics?: boolean },
): TextRun {
  return new TextRun({
    text,
    font: DOCX_FONT,
    size: opts?.size ?? 18,
    bold: opts?.bold,
    color: opts?.color,
    italics: opts?.italics,
  });
}

function paragraph(children: TextRun | TextRun[], extra?: { spacing?: typeof DOCX_SPACING_BODY }): Paragraph {
  return new Paragraph({
    spacing: extra?.spacing ?? DOCX_SPACING_BODY,
    children: Array.isArray(children) ? children : [children],
  });
}

function sectionHeading(title: string): Paragraph {
  return paragraph(textRun(title, { bold: true, size: 22, color: DOCX_NAVY }), {
    spacing: DOCX_SPACING_SECTION,
  });
}

function kvParagraph(label: string, value: string): Paragraph {
  return paragraph([textRun(`${label}: `, { bold: true }), textRun(value)], { spacing: DOCX_SPACING_TIGHT });
}

function cellParagraph(text: string, bold = false): Paragraph {
  const lines = text.split('\n');
  const children: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(new TextRun({ break: 1 }));
    children.push(textRun(line, { bold }));
  });
  return new Paragraph({ spacing: DOCX_SPACING_TIGHT, children });
}

function buildDataTable(headers: readonly string[], rows: string[][]): Table {
  const colPct = 100 / headers.length;

  const headerRow = new TableRow({
    ...docxHeaderRowProps(),
    children: headers.map(
      (h) =>
        new TableCell({
          width: docxTableWidthPct(colPct),
          shading: { fill: DOCX_HEADER_BG, type: ShadingType.CLEAR },
          children: [cellParagraph(h, true)],
        }),
    ),
  });

  const bodyRows = rows.map(
    (cells) =>
      new TableRow({
        children: cells.map(
          (cell) =>
            new TableCell({
              width: docxTableWidthPct(colPct),
              children: [cellParagraph(cell)],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: DOCX_TABLE_BORDERS,
    rows: [headerRow, ...bodyRows],
  });
}

function buildSignaturesTable(snapshot: InformeSnapshot): Table {
  const colPct = 100 / 3;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: DOCX_TABLE_BORDERS,
    rows: [
      new TableRow({
        children: FIRMA_SLOTS.map((rol) => {
          const meta = INFORME_FIRMA_LABELS[rol];
          const firma = snapshot.firmas.find((f) => f.rol === rol);
          return new TableCell({
            width: docxTableWidthPct(colPct),
            children: [
              paragraph(textRun(meta.title, { bold: true, size: 20, color: DOCX_NAVY })),
              paragraph(textRun(meta.subtitle, { size: 16, color: DOCX_NAVY, italics: true })),
              paragraph(textRun('\n\n_________________________', { size: 18 })),
              paragraph(textRun(firma?.nombre ?? '—', { bold: true })),
              ...(firma?.cedula
                ? [paragraph(textRun(`Cédula: ${firma.cedula}`, { size: 16 }))]
                : []),
              ...(firma?.signed_at
                ? [paragraph(textRun(`Fecha: ${formatInformeSignedAt(firma.signed_at)}`, { size: 16 }))]
                : []),
            ],
          });
        }),
      }),
    ],
  });
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

  const freshTable = buildFreshExportTable(snapshot);
  const compressionTable = buildCompressionExportTable(snapshot);

  const logo = await fetchLogoImageRun();
  const children: (Paragraph | Table)[] = [];

  if (logo) {
    children.push(new Paragraph({ spacing: DOCX_SPACING_BODY, children: [logo] }));
  }

  children.push(
    paragraph(textRun('INFORME DE RESULTADOS DE ENSAYO', { bold: true, size: 28, color: DOCX_NAVY })),
    paragraph(textRun(lab.razon_social)),
    paragraph(textRun(lab.nombre)),
  );
  if (lab.acreditacion_ema) {
    children.push(paragraph(textRun(`Acreditación EMA: ${lab.acreditacion_ema}`)));
  }
  children.push(
    paragraph(
      textRun(
        `NMX-EC-17025-IMNC-2018 §7.8 · ${isLab ? 'Estudio interno de laboratorio (I+D)' : 'Informe para el cliente'}`,
      ),
    ),
    paragraph(textRun(docLine, { bold: true, color: DOCX_NAVY })),
    paragraph(
      textRun(
        `NMX-EC-17025-IMNC-2018 · Informe de resultados de ensayo (§7.8)${isLab ? ' · Experimento interno' : ''}`,
        { size: 16, color: DOCX_NAVY },
      ),
    ),
  );

  if (!doc.issued_at) {
    children.push(
      new Paragraph({
        spacing: DOCX_SPACING_BODY,
        alignment: docxCenteredParagraph().alignment,
        shading: { fill: DOCX_AMBER_BG, type: ShadingType.CLEAR },
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: DOCX_BORDER },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: DOCX_BORDER },
          left: { style: BorderStyle.SINGLE, size: 4, color: DOCX_BORDER },
          right: { style: BorderStyle.SINGLE, size: 4, color: DOCX_BORDER },
        },
        children: [
          textRun(
            'BORRADOR — Documento sin emitir. No sustituye el informe oficial con folio y firmas.',
            { bold: true, color: DOCX_AMBER_TEXT },
          ),
        ],
      }),
    );
  }

  children.push(
    paragraph(
      textRun(
        `Emisión: ${formatInformeIssuedAt(doc.issued_at)}${doc.replaces_numero ? ` · Reemplaza informe ${doc.replaces_numero}` : ''}`,
        { bold: true },
      ),
    ),
  );

  if (isLab && estudio) {
    children.push(sectionHeading('§1 Estudio interno y referencia de mezcla'));
    children.push(
      kvParagraph('Estudio', estudio.study_name ?? '—'),
      kvParagraph('Lote de experimento', estudio.lote_number ?? '—'),
      kvParagraph('Protocolo', estudio.protocol_label ?? estudio.protocol_type ?? '—'),
      kvParagraph('Receta de referencia', estudio.recipe_code ?? '—'),
    );
    if (estudio.designacion_ehe) children.push(kvParagraph('Designación', estudio.designacion_ehe));
    if (estudio.volumen_m3 != null) {
      children.push(kvParagraph('Volumen elaborado', `${estudio.volumen_m3} m³`));
    }
    if (estudio.edad_especificada) {
      children.push(kvParagraph('Edad de ensayo de referencia', estudio.edad_especificada));
    }
    if (estudio.hypothesis_notes) {
      children.push(kvParagraph('Hipótesis / objetivo', estudio.hypothesis_notes));
    }
    children.push(kvParagraph('Solicitante', snapshot.cliente.nombre));
  } else {
    children.push(sectionHeading('§1 Cliente y obra'));
    children.push(
      kvParagraph('Cliente', snapshot.cliente.nombre),
      kvParagraph(
        'Obra / pedido',
        `${snapshot.obra.construction_site ?? '—'} · Pedido ${snapshot.obra.order_number ?? '—'}`,
      ),
      kvParagraph('Elemento', snapshot.obra.elemento ?? 'No especificado'),
    );
    if (snapshot.obra.designacion_ehe) {
      children.push(kvParagraph('Designación', snapshot.obra.designacion_ehe));
    }
    children.push(kvParagraph('Contacto cliente', snapshot.cliente.contacto ?? '—'));
  }

  children.push(sectionHeading(isLab ? '§2 Elaboración y recepción en laboratorio' : '§2 Muestreo y recepción'));
  children.push(
    kvParagraph(
      'Fecha / hora',
      `${snapshot.muestreo.fecha_muestreo}${snapshot.muestreo.hora_muestreo ? ` ${snapshot.muestreo.hora_muestreo}` : ''}`,
    ),
    kvParagraph(
      isLab ? 'Identificación del lote' : 'Lote / remisión',
      `${snapshot.muestreo.lote_id} · ${snapshot.muestreo.remision_number ?? '—'}`,
    ),
    kvParagraph('Recepción en laboratorio', snapshot.muestreo.fecha_recepcion_lab ?? '—'),
    kvParagraph('Muestreado por', muestreadoLabel),
    kvParagraph(
      isLab ? 'Ubicación de elaboración' : 'Ubicación',
      snapshot.muestreo.ubicacion ?? '—',
    ),
    kvParagraph(
      isLab ? 'Condiciones de elaboración' : 'Condiciones en obra',
      buildMuestreoCondicionesText({ muestreo: snapshot.muestreo, isLab }),
    ),
    kvParagraph(isLab ? 'Plan / protocolo' : 'Plan de muestreo', snapshot.muestreo.plan_muestreo),
  );

  children.push(sectionHeading('§3 Resultados — concreto fresco'));
  if (freshTable.rows.length > 0) {
    children.push(buildDataTable(freshTable.headers, freshTable.rows));
  } else if (snapshot.declaraciones.fresco_no_aplica) {
    children.push(paragraph(textRun(snapshot.declaraciones.fresco_no_aplica)));
  } else {
    children.push(paragraph(textRun('Sin ensayos de campo registrados.')));
  }

  children.push(sectionHeading('§3 Resistencia a compresión'));
  if (compressionTable.rows.length > 0) {
    children.push(paragraph(textRun(`Método de ensayo: ${metodoCompresion}`, { size: 16, color: DOCX_NAVY })));
    children.push(buildDataTable(compressionTable.headers, compressionTable.rows));
    children.push(
      kvParagraph(
        'Promedio',
        snapshot.compresion_resumen.promedio_kg_cm2 != null
          ? `${snapshot.compresion_resumen.promedio_kg_cm2} kg/cm²`
          : '—',
      ),
      kvParagraph(
        "f′c de referencia",
        snapshot.compresion_resumen.resistencia_especificada != null
          ? `${snapshot.compresion_resumen.resistencia_especificada} kg/cm²${
              estudio?.edad_especificada ? ` @ ${estudio.edad_especificada}` : ''
            }`
          : '—',
      ),
    );
    if (snapshot.compresion_resumen.incertidumbre_u) {
      children.push(
        paragraph(
          textRun(`Incertidumbre de medición U: ${snapshot.compresion_resumen.incertidumbre_u.display}`, {
            bold: true,
            color: DOCX_NAVY,
          }),
        ),
      );
    }
  } else {
    children.push(paragraph(textRun('Sin ensayos de compresión registrados.')));
  }

  const cond = snapshot.condiciones_ensayo;
  if (cond.temperatura_lab != null || cond.humedad_relativa_lab != null || cond.capping_type) {
    children.push(sectionHeading('Condiciones ambientales y preparación de probetas'));
    if (cond.temperatura_lab != null) {
      children.push(kvParagraph('Temperatura en laboratorio', `${cond.temperatura_lab} °C`));
    }
    if (cond.humedad_relativa_lab != null) {
      children.push(kvParagraph('Humedad relativa en laboratorio', `${cond.humedad_relativa_lab} %`));
    }
    if (cond.capping_type) {
      children.push(
        kvParagraph(
          'Capado',
          `${cond.capping_type}${cond.capping_norma ? ` · ${cond.capping_norma}` : ''}`,
        ),
      );
    }
  }

  if (cond.equipos.length > 0) {
    children.push(sectionHeading('Equipos utilizados'));
    for (const eq of cond.equipos) {
      children.push(
        kvParagraph(
          eq.codigo,
          `${eq.nombre}${eq.vencimiento ? ` · vig. ${eq.vencimiento}` : ''}`,
        ),
      );
    }
  }

  children.push(sectionHeading('§4 Declaraciones'));
  for (const t of snapshot.declaraciones.texto_legal) {
    children.push(paragraph(textRun(t, { size: 16 })));
  }
  for (const t of INFORME_DOCX_LEGAL) {
    children.push(paragraph(textRun(t, { size: 16 })));
  }
  children.push(kvParagraph('Regla de decisión', snapshot.declaraciones.regla_decision));
  if (snapshot.declaraciones.muestreado_por_cliente) {
    children.push(
      paragraph(
        textRun('El muestreo fue realizado por el cliente (NMX-EC-17025-IMNC-2018 §7.8.6).', {
          color: DOCX_AMBER_TEXT,
        }),
      ),
    );
  }

  if (snapshot.opinion_tecnica) {
    children.push(sectionHeading('Opinión e interpretaciones (§7.8.7)'));
    children.push(paragraph(textRun(snapshot.opinion_tecnica)));
  }

  children.push(sectionHeading('Firmas'));
  children.push(buildSignaturesTable(snapshot));

  children.push(
    paragraph(
      textRun(
        lab.pie_pagina ??
          `${lab.direccion ?? ''} · ${lab.telefono ?? ''} · ${lab.email ?? ''}`.trim(),
        { size: 14, color: DOCX_NAVY },
      ),
    ),
    paragraph(
      textRun(`${DC_DOCUMENT_CONTACT.companyLine} · ${doc.numero ?? 'BORRADOR'}`, { size: 14, color: DOCX_NAVY }),
    ),
  );

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: DOCX_PAGE_MARGIN_DXA,
              right: DOCX_PAGE_MARGIN_DXA,
              bottom: DOCX_PAGE_MARGIN_DXA,
              left: DOCX_PAGE_MARGIN_DXA,
            },
          },
        },
        children,
      },
    ],
  });
}
