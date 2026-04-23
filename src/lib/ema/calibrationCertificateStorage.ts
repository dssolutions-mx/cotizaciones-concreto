import type { createServerSupabaseClient } from '@/lib/supabase/server';

export type EmaCalibrationSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export const CALIBRATION_CERTIFICATES_BUCKET = 'calibration-certificates' as const;

/** Normalize user input to the object key inside the bucket (no bucket prefix, no leading slash). */
export function normalizeCalibrationArchivoPath(raw: string): string {
  let s = raw.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  const prefix = `${CALIBRATION_CERTIFICATES_BUCKET}/`;
  if (s.toLowerCase().startsWith(prefix.toLowerCase())) {
    s = s.slice(prefix.length).replace(/^\/+/, '');
  }
  return s;
}

export function isSafeCalibrationStoragePath(path: string): boolean {
  if (!path || path.includes('..')) return false;
  if (path.startsWith('/')) return false;
  return true;
}

/**
 * Only object keys produced by POST .../certificados/upload are accepted for new certificates
 * ({instrumentoId}/certificados/{timestamp}_{random}.pdf). Blocks manual / Dashboard-pasted paths.
 */
export function isAppGeneratedCalibrationCertificatePath(
  instrumentoId: string,
  rawOrNormalizedPath: string,
): boolean {
  const path = normalizeCalibrationArchivoPath(rawOrNormalizedPath);
  if (!path || !isSafeCalibrationStoragePath(path)) return false;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(instrumentoId.trim())) return false;
  const esc = instrumentoId.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${esc}/certificados/\\d+_[a-z0-9]+\\.pdf$`, 'i');
  return re.test(path);
}

/** True if an object with this key exists in the calibration certificates bucket (HEAD via Storage API). */
export async function calibrationCertificateObjectExists(
  supabase: EmaCalibrationSupabase,
  rawOrNormalizedPath: string,
): Promise<boolean> {
  const path = normalizeCalibrationArchivoPath(rawOrNormalizedPath);
  if (!path || !isSafeCalibrationStoragePath(path)) return false;
  const { data, error } = await supabase.storage.from(CALIBRATION_CERTIFICATES_BUCKET).exists(path);
  if (error) return false;
  return Boolean(data);
}

export async function createCalibrationCertificateSignedUrl(
  supabase: EmaCalibrationSupabase,
  rawOrNormalizedPath: string,
  expiresInSeconds: number,
): Promise<string | null> {
  const path = normalizeCalibrationArchivoPath(rawOrNormalizedPath);
  if (!path || !isSafeCalibrationStoragePath(path)) return null;
  const { data, error } = await supabase.storage
    .from(CALIBRATION_CERTIFICATES_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
