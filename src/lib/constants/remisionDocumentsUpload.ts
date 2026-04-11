/**
 * Single-file limit for remisión document evidence (bombeo, etc.).
 * Browsers should upload bytes to Supabase Storage first, then POST JSON to /api/remisiones/documents
 * (see `uploadRemisionDocumentFromClient`) so large PDFs are not limited by the hosting request body.
 * Keep in sync with client validators on forms that use that helper.
 *
 * Multipart POST to the same route remains for small files / scripts; it may hit host body limits (~4.5MB on Vercel).
 */
export const REMISION_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;
export const REMISION_DOCUMENT_MAX_MB = 50;

export function messageForRemisionDocumentUploadFailure(status: number, apiError?: string): string {
  if (status === 413) {
    return `La petición supera el límite del servidor (413). La app acepta hasta ${REMISION_DOCUMENT_MAX_MB}MB por archivo; si persiste el error, comprima el PDF o divida los archivos.`;
  }
  return apiError?.trim() || 'Error al subir documento';
}
