/** Shared validation/path rules for remisión document uploads (API + browser). */

export const REMISION_DOC_ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'application/pdf',
  'text/csv',
] as const;

export function normalizeRemisionDocumentMime(mime: string, fileName: string): string {
  const m = (mime || '').trim().toLowerCase();
  if (REMISION_DOC_ALLOWED_MIMES.includes(m as (typeof REMISION_DOC_ALLOWED_MIMES)[number])) {
    return m;
  }
  if (m === 'application/octet-stream' || !m) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'application/pdf';
    if (ext === 'png') return 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'csv') return 'text/csv';
  }
  return m || 'application/octet-stream';
}

export function isAllowedRemisionDocumentMime(mime: string, fileName: string): boolean {
  const normalized = normalizeRemisionDocumentMime(mime, fileName);
  return (REMISION_DOC_ALLOWED_MIMES as readonly string[]).includes(normalized);
}

/** Matches server multipart naming: `{plantPath}/{documentCategory}/{remisionId}_{ts}_{rand}.{ext}` */
export function buildRemisionDocumentStoragePath(
  plantId: string | null | undefined,
  documentCategory: string,
  remisionId: string,
  originalFileName: string
): string {
  const plantPath = plantId ? String(plantId) : 'general';
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const fileExtension = originalFileName.split('.').pop() || 'pdf';
  return `${plantPath}/${documentCategory}/${remisionId}_${timestamp}_${randomString}.${fileExtension}`;
}

/** Validate client-chosen path against DB remisión (plant + category + remisión id prefix). */
export function isValidRegisteredRemisionDocumentPath(
  filePath: string,
  plantId: string | null | undefined,
  documentCategory: string,
  remisionId: string
): boolean {
  const plantPath = plantId ? String(plantId) : 'general';
  const parts = filePath.split('/').filter(Boolean);
  if (parts.length !== 3) return false;
  if (parts[0] !== plantPath) return false;
  if (parts[1] !== documentCategory) return false;
  if (!parts[2].startsWith(`${remisionId}_`)) return false;
  return true;
}
