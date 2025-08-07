'use client';

import { useAuthStore } from '@/store/auth';
import type { UserRole } from '@/store/auth/types';

// Bridge hook that mimics a subset of the AuthContext API using the Zustand store under the hood.
// Useful for incremental migration of components.
export function useAuthBridge() {
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const hasRole = useAuthStore((s) => s.hasRole);
  const initialize = useAuthStore((s) => s.initialize);

  const triggerAuthCheck = async (source?: string) => {
    // For compatibility, re-run initialize which refreshes session & profile.
    await initialize();
  };

  const isLoading = !isInitialized;

  return {
    session,
    profile,
    isLoading,
    signIn,
    signOut,
    hasRole: (allowed: UserRole | UserRole[]) => hasRole(allowed),
    triggerAuthCheck,
  };
}


