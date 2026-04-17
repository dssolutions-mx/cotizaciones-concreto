/** Max 10MB — cualquier tipo de archivo (alineado con API) */
export const INVENTORY_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024

export function inventoryDocumentExtension(originalFileName: string): string {
  const nameParts = originalFileName.split('.')
  const rawExt = nameParts.length > 1 ? nameParts.pop()?.toLowerCase() : ''
  return rawExt && /^[a-z0-9]{1,8}$/.test(rawExt) ? rawExt : 'bin'
}

/**
 * Misma convención que el servidor en POST multipart y en registro JSON.
 * `type` + `referenceId` + timestamp + fragmento UUID + extensión.
 */
export function buildInventoryDocumentStoragePath(
  type: 'entry' | 'adjustment',
  referenceId: string,
  originalFileName: string
): string {
  const fileExtension = inventoryDocumentExtension(originalFileName)
  const timestamp = Date.now()
  const uniqueId = crypto.randomUUID().split('-')[0]
  return `${type}/${referenceId}/${timestamp}_${uniqueId}.${fileExtension}`
}
