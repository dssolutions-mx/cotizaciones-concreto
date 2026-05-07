/** Categories exposed on the client portal order detail API (includes legacy `general` uploads). */
export const PORTAL_VISIBLE_REMISION_DOCUMENT_CATEGORIES = [
  'concrete_remision',
  'pumping_remision',
  'general',
] as const;

export type PortalVisibleRemisionDocumentCategory =
  (typeof PORTAL_VISIBLE_REMISION_DOCUMENT_CATEGORIES)[number];

/** PostgREST `.or()` filter: known categories OR uncategorized rows. */
export const PORTAL_REMISION_DOCUMENTS_OR_FILTER = [
  ...PORTAL_VISIBLE_REMISION_DOCUMENT_CATEGORIES.map((c) => `document_category.eq.${c}`),
  'document_category.is.null',
].join(',');

export function labelPortalRemisionDocumentCategory(category: string | null): string {
  switch (category) {
    case 'concrete_remision':
      return 'Remisión de concreto';
    case 'pumping_remision':
      return 'Remisión de bombeo';
    case 'general':
      return 'Documento general';
    default:
      return 'Documento';
  }
}
