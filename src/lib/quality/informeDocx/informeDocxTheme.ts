import { AlignmentType, BorderStyle, type IParagraphOptions } from 'docx';

/** Aligned with policy_template.js and DC_DOCUMENT_THEME */
export const GREEN = '00A64F';
export const NAVY = '1B365D';
export const LNAVY = 'EBF0F8';
export const LGRAY = 'F5F5F5';
export const YELLOW = 'FFF9E6';
export const ORANGE = 'FFF3E0';
export const AMBER_TEXT = '996600';
export const MUTED_TEXT = '666666';
export const BORDER = 'CCCCCC';

export const FONT = 'Calibri';

export const PAGE = {
  width: 12240,
  height: 15840,
  marginTop: 1440,
  marginRight: 1080,
  marginBottom: 1440,
  marginLeft: 1080,
} as const;

/** Content width used in policy tables (DXA) */
export const CONTENT_WIDTH_DXA = 9360;

export const bdr = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
export const bdrs = { top: bdr, bottom: bdr, left: bdr, right: bdr };
export const noBdr = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
export const noBdrs = { top: noBdr, bottom: noBdr, left: noBdr, right: noBdr };

export function sp(before = 60, after = 60) {
  return { before, after };
}

/** Font size in half-points (docx API), matching policy_template.js */
export function fnt(
  size = 20,
  bold = false,
  color?: string,
  italics = false,
): {
  size: number;
  bold?: boolean;
  font: string;
  color?: string;
  italics?: boolean;
} {
  return {
    size,
    bold,
    font: FONT,
    ...(color ? { color } : {}),
    ...(italics ? { italics } : {}),
  };
}

export function centered(extra?: IParagraphOptions): IParagraphOptions {
  return { alignment: AlignmentType.CENTER, ...extra };
}
