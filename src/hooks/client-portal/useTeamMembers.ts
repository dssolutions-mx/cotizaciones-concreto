/**
 * useTeamMembers Hook
 *
 * SWR hook for fetching and managing team members data.
 * Provides automatic revalidation, caching, and error handling.
 */

'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetchTeamMembers, TeamMember } from '@/lib/client-portal/teamService';
import {
  PORTAL_CLIENT_ID_CHANGED_EVENT,
  appendPortalClientId,
} from '@/lib/client-portal/portalClientIdUrl';

export function useTeamMembers() {
  const [, bump] = useState(0);
  useEffect(() => {
    const onChange = () => bump((n) => n + 1);
    window.addEventListener(PORTAL_CLIENT_ID_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(PORTAL_CLIENT_ID_CHANGED_EVENT, onChange);
  }, []);

  const swrKey = appendPortalClientId('/api/client-portal/team');

  const {
    data,
    error,
    mutate,
    isLoading,
    isValidating,
  } = useSWR<TeamMember[]>(swrKey, fetchTeamMembers, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000, // Prevent duplicate requests within 5 seconds
  });

  return {
    teamMembers: data,
    isLoading,
    isValidating,
    isError: error,
    error: error?.message,
    refresh: mutate,
    // Helper to update local cache optimistically
    updateMember: (userId: string, updates: Partial<TeamMember>) => {
      if (!data) return;
      mutate(
        data.map((member) =>
          member.user_id === userId ? { ...member, ...updates } : member
        ),
        false // Don't revalidate immediately
      );
    },
    // Helper to remove member from cache
    removeMember: (userId: string) => {
      if (!data) return;
      mutate(
        data.filter((member) => member.user_id !== userId),
        false
      );
    },
  };
}
