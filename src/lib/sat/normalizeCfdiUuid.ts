/** Canonical CFDI UUID storage (lowercase, trimmed). */
export function normalizeCfdiUuid(uuid: string | null | undefined): string | null {
  if (uuid == null) return null
  const s = String(uuid).trim().toLowerCase()
  return s.length > 0 ? s : null
}

export function cfdiUuidsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeCfdiUuid(a)
  const nb = normalizeCfdiUuid(b)
  if (!na || !nb) return false
  return na === nb
}
