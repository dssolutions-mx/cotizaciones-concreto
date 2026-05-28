import type { SupabaseClient } from '@supabase/supabase-js'

/** Normalize RFC strings from system_settings (plain, JSON string, or { rfc } object). */
export function parseCompanyRfcSetting(raw: unknown): string | null {
  if (raw == null) return null

  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    if (obj.rfc != null) return normalizeRfc(String(obj.rfc))
    if (obj.value != null) return parseCompanyRfcSetting(obj.value)
    return null
  }

  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null

  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      return parseCompanyRfcSetting(JSON.parse(s))
    } catch {
      /* fall through */
    }
  }

  if (s.startsWith('"') && s.endsWith('"')) {
    try {
      const unquoted = JSON.parse(s)
      if (typeof unquoted === 'string') return normalizeRfc(unquoted)
    } catch {
      /* fall through */
    }
  }

  return normalizeRfc(s)
}

export function normalizeRfc(rfc: string): string | null {
  const cleaned = rfc.replace(/[\s\uFEFF\u200B]/g, '').toUpperCase()
  return cleaned.length > 0 ? cleaned : null
}

export type ReceptorMatch = 'ok' | 'mismatch' | 'skipped'

export function compareReceptorRfc(
  cfdiReceptorRfc: string,
  companyRfc: string | null,
): { receptor_match: ReceptorMatch; company_rfc: string | null } {
  if (!companyRfc) {
    return { receptor_match: 'skipped', company_rfc: null }
  }
  const receptor = normalizeRfc(cfdiReceptorRfc)
  if (!receptor) {
    return { receptor_match: 'skipped', company_rfc: companyRfc }
  }
  return {
    receptor_match: receptor === companyRfc ? 'ok' : 'mismatch',
    company_rfc: companyRfc,
  }
}

export async function fetchCompanyRfc(supabase: SupabaseClient): Promise<string | null> {
  const { data: setting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'company_rfc')
    .maybeSingle()
  return parseCompanyRfcSetting(setting?.value)
}
