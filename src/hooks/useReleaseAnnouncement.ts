'use client';

import { useState, useEffect } from 'react';
import { RELEASE_ANNOUNCEMENT_VERSION } from '@/config/releaseAnnouncement';

export function useReleaseAnnouncement() {
  const [shouldShow, setShouldShow] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadStatus = async () => {
      try {
        const response = await fetch('/api/release-announcement/status', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          if (mounted) setShouldShow(false);
          return;
        }

        const data = (await response.json()) as { pending?: boolean };
        if (mounted) {
          setShouldShow(Boolean(data.pending));
        }
      } catch {
        if (mounted) setShouldShow(false);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const markViewed = async () => {
    try {
      await fetch('/api/release-announcement/viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version: RELEASE_ANNOUNCEMENT_VERSION }),
      });
    } finally {
      // Cierra el modal incluso si falla la red para no bloquear UX.
      setShouldShow(false);
    }
  };

  return { shouldShow, isLoading, markViewed };
}
