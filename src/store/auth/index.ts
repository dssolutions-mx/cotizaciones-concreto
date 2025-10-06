'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';

import type { AuthStoreState } from './types';
import { createAuthSlice } from './slices/auth-slice';
import { createSessionSlice } from './slices/session-slice';
import { createCacheSlice } from './slices/cache-slice';
import { createMetricsSlice } from './slices/metrics-slice';
import { createOfflineSlice } from './slices/offline-slice';
// import { withCrossTabSync } from './middleware/cross-tab-sync'; // Disabled to fix infinite loop

const partialize = (state: AuthStoreState) => ({
  // safe-to-persist fields only
  user: state.user ? { id: state.user.id, email: state.user.email } : null,
  profile: state.profile,
  cacheHits: state.cacheHits,
  cacheMisses: state.cacheMisses,
  lastAuthCheck: state.lastAuthCheck,
  authCheckSource: state.authCheckSource,
  failedOperations: state.failedOperations,
  queue: state.queue,
});

// Temporarily disable cross-tab sync to fix infinite loop
const storeConfig = (set: any, get: any, api: any) => ({
  ...createAuthSlice(set, get, api),
  ...createSessionSlice(set, get, api),
  ...createCacheSlice(set, get, api),
  ...createMetricsSlice(set, get, api),
  ...createOfflineSlice(set, get, api),
});

export const useAuthStore = create<AuthStoreState>()(
  devtools(
    subscribeWithSelector(
      persist(
        storeConfig,
        {
          name: 'auth-store',
          version: 1,
          migrate: (persisted, version) => {
            // Simple forward-compatible migration
            return persisted as AuthStoreState;
          },
          partialize,
          storage: createJSONStorage(() => localStorage),
        }
      )
    )
  )
);

// Immediately rehydrate on client side
if (typeof window !== 'undefined') {
  useAuthStore.persist.rehydrate();
}


