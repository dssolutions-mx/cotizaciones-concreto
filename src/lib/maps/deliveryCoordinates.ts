/**
 * Shared helpers for delivery pin / Google Maps paste flows (internal + client portal).
 */

export const validateCoordinates = (lat: string, lng: string): { isValid: boolean; error: string } => {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (!lat.trim() || !lng.trim()) {
    return { isValid: false, error: 'Ambas coordenadas son requeridas' };
  }

  if (isNaN(latNum) || isNaN(lngNum)) {
    return { isValid: false, error: 'Las coordenadas deben ser números válidos' };
  }

  if (latNum < -90 || latNum > 90) {
    return { isValid: false, error: 'La latitud debe estar entre -90 y 90 grados' };
  }

  if (lngNum < -180 || lngNum > 180) {
    return { isValid: false, error: 'La longitud debe estar entre -180 y 180 grados' };
  }

  return { isValid: true, error: '' };
};

export const generateGoogleMapsUrl = (lat: string, lng: string): string => {
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

/** Short links that need Edge Function expansion (browser CORS cannot follow redirects). */
export const MAPS_SHORT_LINK_HOST_PATTERN = /^https?:\/\/(maps\.app\.goo\.gl|g\.co|goo\.gl)\//i;

/**
 * Extracts coordinates from Google Maps URL shapes or raw "lat,lng".
 * Returns null for unresolved short links (use maps-url-parser Edge Function).
 */
export function parseGoogleMapsCoordinates(input: string): { lat: string; lng: string } | null {
  if (!input) return null;
  const trimmed = input.trim();

  const plainMatch = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (plainMatch) {
    return { lat: plainMatch[1], lng: plainMatch[2] };
  }

  let url: URL | null = null;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const href = url.href;

  const atMatch = href.match(/@\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { lat: atMatch[1], lng: atMatch[2] };
  }

  const bangMatch = href.match(/!3d\s*(-?\d+(?:\.\d+)?)!4d\s*(-?\d+(?:\.\d+)?)/);
  if (bangMatch) {
    return { lat: bangMatch[1], lng: bangMatch[2] };
  }

  const paramsToCheck = ['q', 'query', 'll', 'center', 'daddr', 'saddr'];
  for (const key of paramsToCheck) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const val = decodeURIComponent(value);
    const m = val.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (m) {
      return { lat: m[1], lng: m[2] };
    }
  }

  const loose = href.match(/(-?\d+(?:\.\d+)?)%2C(-?\d+(?:\.\d+)?)/i) || href.match(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (loose) {
    const lat = parseFloat(loose[1]);
    const lng = parseFloat(loose[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: String(lat), lng: String(lng) };
  }

  return null;
}
