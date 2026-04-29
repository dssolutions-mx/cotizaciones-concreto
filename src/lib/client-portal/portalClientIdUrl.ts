/** localStorage key for active portal client when the user has multiple memberships. */
export const PORTAL_CLIENT_ID_STORAGE_KEY = 'portal_client_id';

export const PORTAL_CLIENT_ID_CHANGED_EVENT = 'portal-client-id-changed';

export function getStoredPortalClientId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(PORTAL_CLIENT_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredPortalClientId(clientId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (clientId) localStorage.setItem(PORTAL_CLIENT_ID_STORAGE_KEY, clientId);
    else localStorage.removeItem(PORTAL_CLIENT_ID_STORAGE_KEY);
  } catch {
    // ignore quota / private mode
  }
  try {
    window.dispatchEvent(new Event(PORTAL_CLIENT_ID_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/** Appends `client_id` when a portal client is selected (multi-client). */
export function appendPortalClientId(url: string): string {
  const cid = getStoredPortalClientId();
  if (!cid) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}client_id=${encodeURIComponent(cid)}`;
}

/** Adds `client_id` to a same-origin URL when stored (e.g. `URL` built with `window.location.origin`). */
export function applyStoredPortalClientIdToUrl(url: URL): void {
  const cid = getStoredPortalClientId();
  if (cid) url.searchParams.set('client_id', cid);
}
