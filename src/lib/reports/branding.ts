/**
 * Canonical DC Concretos document branding for finance hub reports.
 *
 * This is the single source of truth consumed by:
 *  - React-PDF templates (DeliveryReceiptPDF, QuotePDF, ConcreteEvidence, ...)
 *  - ExcelJS builders (deliveryReceiptExcel, ...)
 *  - On-screen preview components (mapped to Tailwind inline styles)
 *
 * Keep palette aligned with policy_template.js (Word) and procurement UI
 * (stone + navy + green accents). Contact info can be overridden per plant
 * via the optional `overrides` argument on `getDocumentContact()`.
 */

export const DC_DOCUMENT_THEME = {
  // Brand
  navy: '#1B365D',
  navyDark: '#142848',
  green: '#00A64F',
  greenDark: '#007A3A',
  white: '#FFFFFF',

  // Text
  textPrimary: '#1C1917', // stone-900
  textSecondary: '#44403C', // stone-700
  textMuted: '#78716C', // stone-500

  // Borders
  borderStrong: '#292524', // stone-800
  borderMedium: '#D6D3D1', // stone-300
  borderLight: '#E7E5E4', // stone-200
  borderCell: '#D6D3D1',

  // Surfaces
  surfacePage: '#FFFFFF',
  surfacePanel: '#FAFAF9', // stone-50
  surfaceSubtle: '#F5F5F4', // stone-100
  surfaceTotals: '#F1F3F4',
  surfaceHeader: '#1B365D',
  surfaceHeaderText: '#FFFFFF',

  // Data tables
  rowAlternate: '#FAFAF9',
  groupHeaderTint: '#E8F3EA',
  /** Subtle blue tint for pumping/auxiliary-service rows in the Remisiones sheet. */
  pumpingRowTint: '#EEF5FB',
  footerRule: '#78716C',
} as const
export type DCDocumentTheme = typeof DC_DOCUMENT_THEME

/**
 * Default contact block for DC Concretos documents. Override per-plant or per-
 * business-unit by passing `overrides` to `getDocumentContact()`.
 *
 * NOTE: audit flagged the previous values as stale. Update here, not in each
 * PDF/Excel template.
 */
export const DC_DOCUMENT_CONTACT = {
  companyLine: 'DC CONCRETOS, S.A. DE C.V.',
  addressLine: 'Carr. Silao-San Felipe km 4.1, CP 36110',
  phone: '477-129-2394',
  email: 'ventas@dcconcretos.com.mx',
  web: 'www.dcconcretos.com.mx',
} as const
export type DCDocumentContact = typeof DC_DOCUMENT_CONTACT

/** Merge a partial override (e.g. per-plant) onto the default contact block. */
export function getDocumentContact(
  overrides?: Partial<DCDocumentContact>,
): DCDocumentContact {
  return { ...DC_DOCUMENT_CONTACT, ...(overrides || {}) }
}

/** Number formats for ExcelJS and for matching display in preview tables. */
export const DC_NUMBER_FORMATS = {
  currency: '"$"#,##0.00',
  currencyNoSign: '#,##0.00',
  volume: '0.00" m³"',
  integer: '#,##0',
  percent: '0.00%',
  date: 'dd/mm/yyyy',
} as const

/**
 * Typography presets used by the PDF templates. Kept as plain numbers so they
 * can be passed to react-pdf StyleSheet without adapter code.
 */
export const DC_DOCUMENT_TYPOGRAPHY = {
  fontFamilyBody: 'Helvetica',
  fontFamilyMono: 'Courier',
  sizeH1: 16,
  sizeH2: 12,
  sizeBody: 9,
  sizeTable: 8,
  sizeFooter: 7,
  lineHeight: 1.35,
} as const
