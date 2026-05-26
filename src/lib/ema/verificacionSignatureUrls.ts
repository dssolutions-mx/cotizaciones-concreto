import type { SupabaseClient } from '@supabase/supabase-js'

const SIGNATURE_BUCKETS = ['quality', 'ema-verificaciones', 'evidencia-ensayos'] as const

/**
 * Resolve storage paths to short-lived signed URLs for embedding in react-pdf.
 */
export async function signedUrlsForVerificacionSignatures(
  admin: SupabaseClient,
  storagePaths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(storagePaths.filter((p) => p?.trim()))]

  await Promise.all(
    unique.map(async (path) => {
      const normalized = path.replace(/^\/+/, '')
      for (const bucket of SIGNATURE_BUCKETS) {
        const candidates = [normalized, normalized.replace(/^quality\//, '')]
        for (const objectPath of candidates) {
          const { data, error } = await admin.storage.from(bucket).createSignedUrl(objectPath, 3600)
          if (!error && data?.signedUrl) {
            out.set(path, data.signedUrl)
            return
          }
        }
      }
    }),
  )

  return out
}
