'use client';

import { useAuthStore } from '@/store/auth';
import type { UserRole } from '@/store/auth/types';

// Bridge hook that mimics a subset of the AuthContext API using the Zustand store under the hood.
// Useful for incremental migration of components.
export function useAuthBridge() {
  // Subscribe to the entire auth state to ensure we get all updates
  const authState = useAuthStore((state) => ({
    session: state.session,
    profile: state.profile,
    isInitialized: state.isInitialized,
    error: state.error,
    user: state.user,
  }));
  
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

  const isLoading = !authState.isInitialized;

  return {
    session: authState.session,
    profile: authState.profile,
    error: authState.error,
    isLoading,
    signIn,
    signOut,
    logout,
    hasRole: (allowed: UserRole | UserRole[]) => hasRole(allowed),
    triggerAuthCheck,
  };
}


