/**
 * Shared rules for bundling concrete evidence into ZIP (PDF + imágenes habituales).
 */

const ZIP_EXT = /\.(pdf|png|jpe?g|gif|webp)$/i

export function isConcreteEvidenceFileZippable(mimeType: string | null | undefined, originalName: string): boolean {
  const m = (mimeType || '').trim().toLowerCase()
  if (m === 'application/pdf' || m.startsWith('image/')) return true
  if (m === 'application/octet-stream' || m === '') {
    return ZIP_EXT.test(originalName || '')
  }
  return ZIP_EXT.test(originalName || '')
}

/** Safe single segment for ZIP paths. */
export function sanitizeZipPathSegment(s: string, fallback: string): string {
  const t = (s || '').replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 80)
  return t || fallback
}

/**
 * Unique path inside ZIP (e.g. `Pedido_123/factura.pdf`). `usedLower` tracks lowercase full paths.
 */
export function uniqueZipPath(relativePath: string, usedLower: Set<string>): string {
  let p = relativePath.replace(/[/\\?%*:|"<>]/g, '_')
  let candidate = p
  let i = 2
  const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : ''
  const file = p.includes('/') ? p.slice(p.lastIndexOf('/') + 1) : p
  const dot = file.lastIndexOf('.')
  const stem = dot >= 0 ? file.slice(0, dot) : file
  const ext = dot >= 0 ? file.slice(dot) : ''

  while (usedLower.has(candidate.toLowerCase())) {
    candidate = `${dir}${stem}_${i}${ext}`
    i += 1
  }
  usedLower.add(candidate.toLowerCase())
  return candidate
}
