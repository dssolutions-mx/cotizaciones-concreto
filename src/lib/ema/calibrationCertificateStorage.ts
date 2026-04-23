import type { createServerSupabaseClient } from '@/lib/supabase/server';

export type EmaCalibrationSupabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

export const CALIBRATION_CERTIFICATES_BUCKET = 'calibration-certificates' as const;

const MAX_SANITIZED_BASENAME_LEN = 80;

/**
 * Safe segment for storage object name (no path chars, no spaces).
 * Strips .pdf; empty result becomes `certificado`.
 */
export function sanitizeCalibrationPdfBasename(fileName: string): string {
  const raw = (fileName || '').trim();
  let base = raw.replace(/\\/g, '/').split('/').pop() || '';
  base = base.replace(/\.pdf$/i, '');
  base = base
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+|\.+$/g, '')
    .replace(/^_|_$/g, '');
  if (!base) return 'certificado';
  return base.slice(0, MAX_SANITIZED_BASENAME_LEN);
}

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
 * Only object keys produced by POST .../certificados/upload are accepted for new certificates:
 * - Legacy: `{instrumentoId}/certificados/{timestamp}_{random}.pdf`
 * - Current: `{instrumentoId}/certificados/{timestamp}__{sanitizedOriginal}.pdf`
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
  const legacy = new RegExp(`^${esc}/certificados/\\d+_[a-z0-9]+\\.pdf$`, 'i');
  const withOriginalName = new RegExp(
    `^${esc}/certificados/\\d+__[a-zA-Z0-9._-]{1,${MAX_SANITIZED_BASENAME_LEN}}\\.pdf$`,
    'i',
  );
  return legacy.test(path) || withOriginalName.test(path);
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
