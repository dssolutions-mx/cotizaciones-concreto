'use client';

import { supabase } from '@/lib/supabase/client';
import {
  REMISION_DOCUMENT_MAX_BYTES,
  REMISION_DOCUMENT_MAX_MB,
  messageForRemisionDocumentUploadFailure,
} from '@/lib/constants/remisionDocumentsUpload';
import {
  buildRemisionDocumentStoragePath,
  isAllowedRemisionDocumentMime,
  normalizeRemisionDocumentMime,
} from '@/lib/remisiones/remisionDocumentUploadShared';

export type RegisterRemisionDocumentParams = {
  remisionId: string;
  plantId: string | null | undefined;
  file: File;
  documentType: 'remision_proof' | 'delivery_evidence' | 'quality_check' | 'additional';
  documentCategory: 'concrete_remision' | 'pumping_remision' | 'general';
};

/**
 * Uploads bytes directly to Supabase Storage from the browser, then registers the row via a small JSON POST.
 * Avoids Vercel/serverless ~4.5MB multipart body limits on /api/remisiones/documents.
 */
export async function uploadRemisionDocumentFromClient(
  params: RegisterRemisionDocumentParams
): Promise<{ id: string; url?: string | null }> {
  const { remisionId, plantId, file, documentType, documentCategory } = params;

  if (file.size > REMISION_DOCUMENT_MAX_BYTES) {
    throw new Error(`El archivo excede el tamaño máximo de ${REMISION_DOCUMENT_MAX_MB}MB por archivo.`);
  }

  if (!isAllowedRemisionDocumentMime(file.type, file.name)) {
    throw new Error('Tipo de archivo no permitido. Solo se permiten: JPEG, PNG, PDF, CSV');
  }

  const mime = normalizeRemisionDocumentMime(file.type, file.name);
  const storagePath = buildRemisionDocumentStoragePath(
    plantId,
    documentCategory,
    remisionId,
    file.name
  );

  const { error: storageError } = await supabase.storage
    .from('remision-documents')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (storageError) {
    throw new Error(
      storageError.message ||
        'No se pudo subir el archivo. Verifique permisos o comprima el PDF e intente de nuevo.'
    );
  }

  const res = await fetch('/api/remisiones/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      remision_id: remisionId,
      document_type: documentType,
      document_category: documentCategory,
      file_path: storagePath,
      original_name: file.name,
      file_size: file.size,
      mime_type: mime,
    }),
  });

  let body: { success?: boolean; data?: { id: string; url?: string | null }; error?: string };
  try {
    body = await res.json();
  } catch {
    await supabase.storage.from('remision-documents').remove([storagePath]).catch(() => {});
    throw new Error(messageForRemisionDocumentUploadFailure(res.status));
  }

  if (!res.ok) {
    await supabase.storage.from('remision-documents').remove([storagePath]).catch(() => {});
    throw new Error(
      messageForRemisionDocumentUploadFailure(res.status, body.error as string | undefined)
    );
  }

  if (!body.data?.id) {
    await supabase.storage.from('remision-documents').remove([storagePath]).catch(() => {});
    throw new Error('No se recibió el registro del documento');
  }

  return { id: body.data.id, url: body.data.url };
}
