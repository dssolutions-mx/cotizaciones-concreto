'use client'

import { supabase } from '@/lib/supabase/client'
import {
  INVENTORY_DOCUMENT_MAX_BYTES,
  buildInventoryDocumentStoragePath,
} from '@/lib/inventory/inventoryDocumentUploadShared'

export type InventoryDocumentParentType = 'entry' | 'adjustment'

export type UploadInventoryEntryDocumentResult = {
  id: string
  url?: string | null
  fileName: string
  fileSize: number
  mimeType: string
  documentType: string
  referenceId: string
  uploadedAt?: string
}

/**
 * Sube bytes directo a Supabase Storage y registra la fila vía JSON (sin multipart a Vercel).
 */
export async function uploadInventoryDocumentFromClient(
  file: File,
  type: InventoryDocumentParentType,
  referenceId: string
): Promise<UploadInventoryEntryDocumentResult> {
  if (file.size > INVENTORY_DOCUMENT_MAX_BYTES) {
    throw new Error('El archivo excede el tamaño máximo de 10MB')
  }

  const storagePath = buildInventoryDocumentStoragePath(type, referenceId, file.name)

  const { error: storageError } = await supabase.storage
    .from('inventory-documents')
    .upload(storagePath, file, { cacheControl: '3600', upsert: false })

  if (storageError) {
    throw new Error(
      storageError.message ||
        'No se pudo subir el archivo. Verifique permisos o intente de nuevo.'
    )
  }

  const res = await fetch('/api/inventory/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify({
      type,
      reference_id: referenceId,
      file_path: storagePath,
      original_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
    }),
  })

  let body: {
    success?: boolean
    data?: UploadInventoryEntryDocumentResult
    error?: string
  }
  try {
    body = await res.json()
  } catch {
    await supabase.storage.from('inventory-documents').remove([storagePath]).catch(() => {})
    throw new Error(`No se pudo registrar el documento (HTTP ${res.status})`)
  }

  if (!res.ok) {
    await supabase.storage.from('inventory-documents').remove([storagePath]).catch(() => {})
    throw new Error(
      typeof body.error === 'string'
        ? body.error
        : `Error al registrar el documento (HTTP ${res.status})`
    )
  }

  if (!body.data?.id) {
    await supabase.storage.from('inventory-documents').remove([storagePath]).catch(() => {})
    throw new Error('No se recibió el registro del documento')
  }

  return body.data
}

export async function uploadInventoryEntryDocumentFromClient(
  file: File,
  entryId: string
): Promise<UploadInventoryEntryDocumentResult> {
  return uploadInventoryDocumentFromClient(file, 'entry', entryId)
}
