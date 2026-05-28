import {
  AlignmentType,
  BorderStyle,
  type IBorderOptions,
  type IParagraphOptions,
  type ITableCellOptions,
  type ITableRowOptions,
  WidthType,
} from 'docx';

export const DOCX_FONT = 'Calibri';
export const DOCX_NAVY = '1B365D';
export const DOCX_GREEN = '069E2D';
export const DOCX_STONE = '57534E';
export const DOCX_AMBER_BG = 'FEF3C7';
export const DOCX_AMBER_TEXT = '92400E';
export const DOCX_HEADER_BG = 'EBF0F8';
export const DOCX_BORDER = 'E7E5E4';

export const DOCX_PAGE_WIDTH_DXA = 11906;
export const DOCX_PAGE_MARGIN_DXA = 1440;

const cellBorder: IBorderOptions = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: DOCX_BORDER,
};

export const DOCX_TABLE_BORDERS = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
  insideHorizontal: cellBorder,
  insideVertical: cellBorder,
};

export const DOCX_SPACING_SECTION = { before: 240, after: 120 };
export const DOCX_SPACING_BODY = { before: 60, after: 60 };
export const DOCX_SPACING_TIGHT = { before: 40, after: 40 };

export function docxTableWidthPct(pct: number): ITableCellOptions['width'] {
  return { size: pct, type: WidthType.PERCENTAGE };
}

export function docxHeaderRowProps(): ITableRowOptions {
  return {
    tableHeader: true,
  };
}

export function docxCenteredParagraph(extra?: IParagraphOptions): IParagraphOptions {
  return {
    alignment: AlignmentType.CENTER,
    ...extra,
  };
}
