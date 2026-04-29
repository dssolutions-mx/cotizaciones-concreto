'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { setStoredPortalClientId } from '@/lib/client-portal/portalClientIdUrl';

/**
 * When the portal is opened with `?client_id=<uuid>`, persist it for subsequent API calls.
 * Must render under `<Suspense>` because `useSearchParams` can suspend.
 */
export function ClientPortalClientIdHydrator() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const cid = searchParams.get('client_id')?.trim();
    if (cid) setStoredPortalClientId(cid);
  }, [searchParams]);

  return null;
}
