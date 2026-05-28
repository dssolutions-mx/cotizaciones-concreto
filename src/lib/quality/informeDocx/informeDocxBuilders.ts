import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  ImageRun,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { DC_DOCUMENT_CONTACT } from '@/lib/reports/branding';
import {
  AMBER_TEXT,
  bdrs,
  CONTENT_WIDTH_DXA,
  fnt,
  GREEN,
  LGRAY,
  MUTED_TEXT,
  NAVY,
  noBdrs,
  sp,
  YELLOW,
} from '@/lib/quality/informeDocx/informeDocxTheme';

export function tr(
  text: string,
  opts?: { size?: number; bold?: boolean; color?: string; italics?: boolean; break?: number },
): TextRun {
  return new TextRun({
    text,
    ...fnt(opts?.size ?? 20, opts?.bold, opts?.color, opts?.italics),
    ...(opts?.break ? { break: opts.break } : {}),
  });
}

export function bodyP(text: string, opts?: { bold?: boolean; color?: string; size?: number }): Paragraph {
  return new Paragraph({
    spacing: sp(),
    children: [tr(text, opts)],
  });
}

export function emptyLine(): Paragraph {
  return new Paragraph({ spacing: sp(40, 40), children: [tr('')] });
}

export function hr(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: GREEN } },
    spacing: sp(80, 80),
    children: [],
  });
}

export function titleCenter(text: string, size = 36): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(180, 60),
    children: [tr(text, { size, bold: true, color: NAVY })],
  });
}

export function subtitleCenter(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: sp(0, 200),
    children: [tr(text, { size: 22, color: GREEN })],
  });
}

/** Navy bar section header (policy secHdr) */
export function secHdr(title: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [CONTENT_WIDTH_DXA],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBdrs,
            shading: { type: ShadingType.CLEAR, fill: NAVY },
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
            children: [
              new Paragraph({
                spacing: sp(0, 0),
                children: [tr(title, { size: 24, bold: true, color: 'FFFFFF' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export function mkCell(
  text: string,
  widthDxa: number,
  fill: string,
  bold = false,
  color?: string,
): TableCell {
  const lines = text.split('\n');
  const children: TextRun[] = [];
  lines.forEach((line, i) => {
    if (i > 0) children.push(new TextRun({ break: 1 }));
    children.push(tr(line, { size: 19, bold, color }));
  });

  return new TableCell({
    borders: bdrs,
    width: { size: widthDxa, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ spacing: sp(0, 0), children })],
  });
}

export function dataTable(headers: readonly string[], rows: string[][], colWidths: number[]): Table {
  const hdrRow = new TableRow({
    children: headers.map((h, i) => mkCell(h, colWidths[i] ?? 1800, NAVY, true, 'FFFFFF')),
  });
  const bodyRows = rows.map(
    (cells, rowIdx) =>
      new TableRow({
        children: cells.map((cell, colIdx) =>
          mkCell(cell, colWidths[colIdx] ?? 1800, rowIdx % 2 === 0 ? LGRAY : 'FFFFFF'),
        ),
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: colWidths,
    rows: [hdrRow, ...bodyRows],
  });
}

export function kvFieldTable(fields: { label: string; value: string }[]): Table {
  const labelW = 3200;
  const valueW = CONTENT_WIDTH_DXA - labelW;
  const rows = fields.map(
    (f, i) =>
      new TableRow({
        children: [
          mkCell(f.label, labelW, NAVY, true, 'FFFFFF'),
          mkCell(f.value, valueW, i % 2 === 0 ? LGRAY : 'FFFFFF'),
        ],
      }),
  );
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [labelW, valueW],
    rows,
  });
}

export function notaBanner(label: string, text: string): Paragraph {
  return new Paragraph({
    spacing: sp(80, 80),
    shading: { type: ShadingType.CLEAR, fill: YELLOW },
    children: [tr(`${label} `, { bold: true, color: AMBER_TEXT }), tr(text)],
  });
}

export function makeInformeHeader(
  logoData: ArrayBuffer | null,
  opts: {
    razonSocial: string;
    labNombre: string;
    acreditacion: string | null;
    docLine: string;
    contextLabel: string;
  },
): Header {
  const logoCellChildren = logoData
    ? [
        new Paragraph({
          children: [
            new ImageRun({
              type: 'png',
              data: logoData,
              transformation: { width: 128, height: 61 },
              altText: { title: 'DC Concretos', description: 'Logo', name: 'logo' },
            }),
          ],
        }),
      ]
    : [
        new Paragraph({
          children: [tr('DC', { size: 32, bold: true, color: GREEN })],
        }),
      ];

  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [2500, 6860],
        rows: [
          new TableRow({
            children: [
              new TableCell({
                borders: noBdrs,
                width: { size: 2500, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 40, bottom: 40, left: 0, right: 100 },
                children: logoCellChildren,
              }),
              new TableCell({
                borders: noBdrs,
                width: { size: 6860, type: WidthType.DXA },
                verticalAlign: VerticalAlign.CENTER,
                shading: { type: ShadingType.CLEAR, fill: NAVY },
                margins: { top: 80, bottom: 80, left: 180, right: 180 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [tr(opts.razonSocial, { size: 22, bold: true, color: 'FFFFFF' })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [tr(opts.labNombre, { size: 18, color: 'FFFFFF' })],
                  }),
                  ...(opts.acreditacion
                    ? [
                        new Paragraph({
                          alignment: AlignmentType.RIGHT,
                          children: [tr(`Acreditación EMA: ${opts.acreditacion}`, { size: 17, color: 'FFFFFF' })],
                        }),
                      ]
                    : []),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [tr(opts.docLine, { size: 17, color: 'FFFFFF' })],
                  }),
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [tr(opts.contextLabel, { size: 20, bold: true, color: GREEN })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export function makeInformeFooter(docNumero: string): Footer {
  const contact = DC_DOCUMENT_CONTACT.email
    ? `${DC_DOCUMENT_CONTACT.email} · ${DC_DOCUMENT_CONTACT.website ?? 'www.dcconcretos.com.mx'}`
    : 'rh@dcconcretos.com.mx · www.dcconcretos.com.mx';

  return new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 8, color: GREEN } },
        alignment: AlignmentType.CENTER,
        spacing: { before: 80 },
        children: [
          tr(`${contact} · ${docNumero} · Página `, { size: 18, color: MUTED_TEXT }),
          new TextRun({
            children: [PageNumber.CURRENT],
            ...fnt(18, false, MUTED_TEXT),
          }),
        ],
      }),
    ],
  });
}

export function signaturesTable(
  slots: Array<{
    title: string;
    subtitle: string;
    nombre: string;
    cedula?: string | null;
    signedAt?: string | null;
  }>,
): Table {
  const colW = Math.floor(CONTENT_WIDTH_DXA / 3);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [colW, colW, colW],
    rows: [
      new TableRow({
        children: slots.map((s) =>
          new TableCell({
            borders: bdrs,
            width: { size: colW, type: WidthType.DXA },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({ spacing: sp(0, 40), children: [tr(s.title, { size: 20, bold: true, color: NAVY })] }),
              new Paragraph({
                spacing: sp(0, 80),
                children: [tr(s.subtitle, { size: 17, italics: true, color: MUTED_TEXT })],
              }),
              new Paragraph({ spacing: sp(120, 40), children: [tr('_________________________', { size: 18 })] }),
              new Paragraph({ spacing: sp(0, 40), children: [tr(s.nombre, { bold: true })] }),
              ...(s.cedula
                ? [new Paragraph({ spacing: sp(0, 40), children: [tr(`Cédula: ${s.cedula}`, { size: 17 })] })]
                : []),
              ...(s.signedAt
                ? [new Paragraph({ spacing: sp(0, 40), children: [tr(`Fecha: ${s.signedAt}`, { size: 17 })] })]
                : []),
            ],
          }),
        ),
      }),
    ],
  });
}
