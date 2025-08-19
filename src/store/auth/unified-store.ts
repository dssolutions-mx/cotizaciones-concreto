'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';

import type { UnifiedAuthStoreState } from './types';
import { createUnifiedAuthSlice } from './slices/unified-auth-slice';
import { createCacheSlice } from './slices/cache-slice';
import { createMetricsSlice } from './slices/metrics-slice';
import { createOfflineSlice } from './slices/offline-slice';
import { withEnhancedCrossTabSync } from './middleware/enhanced-cross-tab-sync';

const partializeUnified = (state: UnifiedAuthStoreState) => ({
  // Safe-to-persist fields only
  user: state.user ? { id: state.user.id, email: state.user.email } : null,
  profile: state.profile,
  stateVersion: state.stateVersion,
  lastUpdated: state.lastUpdated,
  // Cache metrics
  cacheHits: state.cacheHits,
  cacheMisses: state.cacheMisses,
  lastAuthCheck: state.lastAuthCheck,
  // Offline state
  failedOperations: state.failedOperations,
  queue: state.queue,
});

export const useUnifiedAuthStore = create<UnifiedAuthStoreState>()(
  devtools(
    subscribeWithSelector(
      persist(
        withEnhancedCrossTabSync((set, get, api) => ({
          ...createUnifiedAuthSlice(set, get, api),
          ...createCacheSlice(set, get, api),
          ...createMetricsSlice(set, get, api),
          ...createOfflineSlice(set, get, api),
        }), { 
          whitelistKeys: ['user', 'profile', 'session', 'stateVersion', 'lastUpdated'] as unknown as Array<keyof UnifiedAuthStoreState>,
          throttleMs: 300, // Faster throttling for better responsiveness
          enableVersioning: true,
        }),
        {
          name: 'unified-auth-store',
          version: 2, // Increment version to trigger migration
          migrate: (persistedState: any, version: number) => {
            console.log(`[UnifiedAuthStore] Migrating from version ${version} to 2`);
            
            if (version < 2) {
              // Migrate from legacy store structure
              return {
                ...persistedState,
                stateVersion: 1,
                lastUpdated: Date.now(),
                // Initialize any missing fields with defaults
                isInitialized: false,
                error: null,
              } as UnifiedAuthStoreState;
            }
            
            return persistedState as UnifiedAuthStoreState;
          },
          partialize: partializeUnified,
          storage: createJSONStorage(() => localStorage),
        }
      )
    ),
    {
      name: 'unified-auth-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// Migration helper to transfer state from legacy store
export const migrateLegacyAuthStore = () => {
  try {
    const legacyData = localStorage.getItem('auth-store');
    if (!legacyData) return;
    
    const parsed = JSON.parse(legacyData);
    const legacyState = parsed.state;
    
    if (legacyState) {
      console.log('[UnifiedAuthStore] Migrating legacy auth store data');
      
      // Extract relevant data from legacy store
      const migratedState = {
        user: legacyState.user,
        profile: legacyState.profile,
        session: legacyState.session,
        stateVersion: 1,
        lastUpdated: Date.now(),
        isInitialized: legacyState.isInitialized || false,
        error: legacyState.error || null,
        // Cache data
        cacheHits: legacyState.cacheHits || 0,
        cacheMisses: legacyState.cacheMisses || 0,
        lastAuthCheck: legacyState.lastAuthCheck || null,
        authCheckSource: legacyState.authCheckSource || null,
        // Metrics
        authLatencyMs: legacyState.authLatencyMs || [],
        failedOperationsCount: legacyState.failedOperationsCount || 0,
        // Offline
        isOnline: legacyState.isOnline ?? true,
        queue: legacyState.queue || [],
        failedOperations: legacyState.failedOperations || [],
      };
      
      // Save to new store
      const newStoreData = {
        state: migratedState,
        version: 2,
      };
      
      localStorage.setItem('unified-auth-store', JSON.stringify(newStoreData));
      
      // Optionally remove legacy store
      // localStorage.removeItem('auth-store');
      
      console.log('[UnifiedAuthStore] Legacy data migration completed');
    }
  } catch (error) {
    console.warn('[UnifiedAuthStore] Migration failed:', error);
  }
};

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).unifiedAuthStore = useUnifiedAuthStore;
  (window as any).migrateLegacyStore = migrateLegacyAuthStore;
  
  console.log('🔧 Unified auth store utilities available:');
  console.log('- window.unifiedAuthStore: Direct store access');
  console.log('- window.migrateLegacyStore(): Migrate from legacy store');
}
