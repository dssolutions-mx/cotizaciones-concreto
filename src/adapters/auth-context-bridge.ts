'use client';

import { useAuthStore } from '@/store/auth';
import { shallow } from 'zustand/shallow';
import type { UserRole } from '@/store/auth/types';

// Bridge hook that mimics a subset of the AuthContext API using the Zustand store under the hood.
// Useful for incremental migration of components.
export function useAuthBridge() {
  // Subscribe to auth state with shallow equality to prevent infinite loops
  const { session, profile, isInitialized, error, user } = useAuthStore(
    (state) => ({
      session: state.session,
      profile: state.profile,
      isInitialized: state.isInitialized,
      error: state.error,
      user: state.user,
    }),
    shallow // Use shallow equality check to prevent new object on every render
  );
  
  // Methods don't change, so we can subscribe separately
  const signIn = useAuthStore((s) => s.signIn);
  const signOut = useAuthStore((s) => s.signOut);
  const hasRole = useAuthStore((s) => s.hasRole);
  const initialize = useAuthStore((s) => s.initialize);

  const triggerAuthCheck = async (source?: string) => {
    // For compatibility, re-run initialize which refreshes session & profile.
    await initialize();
  };

  const logout = async () => {
    // For compatibility with components that expect a logout function
    return await signOut();
  };

  const isLoading = !isInitialized;

  return {
    session,
    profile,
    error,
    isLoading,
    signIn,
    signOut,
    logout,
    hasRole: (allowed: UserRole | UserRole[]) => hasRole(allowed),
    triggerAuthCheck,
  };
}


