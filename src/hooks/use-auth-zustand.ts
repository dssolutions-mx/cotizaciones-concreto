'use client';

import { useAuthStore } from '@/store/auth';
import { useShallow } from 'zustand/react/shallow';

export function useAuthSelectors() {
  return useAuthStore(useShallow((s) => ({
    user: s.user,
    profile: s.profile,
    session: s.session,
    isInitialized: s.isInitialized,
    signIn: s.signIn,
    signOut: s.signOut,
    hasRole: s.hasRole,
    isSessionExpiringSoon: s.isSessionExpiringSoon,
  })));
}


