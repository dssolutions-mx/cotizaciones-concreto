/**
 * Single-file limit for POST /api/remisiones/documents (evidencia por remisión: bombeo, etc.).
 * Keep in sync with client validators on forms that call this route.
 *
 * Note: Some hosts (e.g. Vercel serverless) enforce a smaller max request body; users may see 413
 * even below this cap — see `messageForRemisionDocumentUploadFailure`.
 */
export const REMISION_DOCUMENT_MAX_BYTES = 50 * 1024 * 1024;
export const REMISION_DOCUMENT_MAX_MB = 50;

export function messageForRemisionDocumentUploadFailure(status: number, apiError?: string): string {
  if (status === 413) {
    return `La petición supera el límite del servidor (413). La app acepta hasta ${REMISION_DOCUMENT_MAX_MB}MB por archivo; si persiste el error, comprima el PDF o divida los archivos.`;
  }
  return apiError?.trim() || 'Error al subir documento';
}
