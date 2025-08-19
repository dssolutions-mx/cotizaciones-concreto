/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import type { StateCreator } from 'zustand';
import type { UnifiedAuthStoreState, UserProfile } from '../types';
import { authCache, CacheKeys, type CacheStats } from '@/lib/cache/smartAuthCache';

export interface EnhancedCacheSliceState {
  // Cache metrics
  cacheHits: number;
  cacheMisses: number;
  lastAuthCheck: number | null;
  authCheckSource: string | null;
  
  // Enhanced cache methods
  getCachedProfile: (userId: string) => UserProfile | null;
  setCachedProfile: (profile: UserProfile, ttl?: number) => void;
  invalidateProfile: (userId: string) => void;
  getCacheStats: () => CacheStats;
  clearCache: () => void;
  
  // Smart caching utilities
  warmupCache: () => Promise<void>;
  preloadUserData: (userId: string) => Promise<void>;
}

export const createEnhancedCacheSlice: StateCreator<UnifiedAuthStoreState, [['zustand/devtools', never]], [], EnhancedCacheSliceState> = (set, get) => ({
  // Initial state
  cacheHits: 0,
  cacheMisses: 0,
  lastAuthCheck: null,
  authCheckSource: null,

  getCachedProfile: (userId: string) => {
    const cacheKey = CacheKeys.USER_PROFILE(userId);
    const cached = authCache.get<UserProfile>(cacheKey);
    
    if (cached) {
      set((state) => ({ 
        cacheHits: state.cacheHits + 1,
        lastAuthCheck: Date.now(),
        authCheckSource: 'cache',
      }), false, 'enhanced-cache/getCachedProfile:hit');
      return cached;
    } else {
      set((state) => ({ 
        cacheMisses: state.cacheMisses + 1,
        lastAuthCheck: Date.now(),
        authCheckSource: 'cache-miss',
      }), false, 'enhanced-cache/getCachedProfile:miss');
      return null;
    }
  },

  setCachedProfile: (profile: UserProfile, ttl?: number) => {
    const cacheKey = CacheKeys.USER_PROFILE(profile.id);
    authCache.set(cacheKey, profile, ttl);
    
    set((state) => ({ 
      lastAuthCheck: Date.now(),
      authCheckSource: 'cache-set',
    }), false, 'enhanced-cache/setCachedProfile');
  },

  invalidateProfile: (userId: string) => {
    const cacheKey = CacheKeys.USER_PROFILE(userId);
    const deleted = authCache.delete(cacheKey);
    
    if (deleted) {
      console.log(`[EnhancedCache] Invalidated profile cache for user ${userId}`);
    }
    
    set((state) => ({ 
      lastAuthCheck: Date.now(),
      authCheckSource: 'cache-invalidate',
    }), false, 'enhanced-cache/invalidateProfile');
  },

  getCacheStats: () => {
    return authCache.getStats();
  },

  clearCache: () => {
    authCache.clear();
    set({
      cacheHits: 0,
      cacheMisses: 0,
      lastAuthCheck: Date.now(),
      authCheckSource: 'cache-clear',
    }, false, 'enhanced-cache/clearCache');
  },

  warmupCache: async () => {
    const currentState = get();
    const user = currentState.user;
    const profile = currentState.profile;
    
    if (!user || !profile) {
      console.log('[EnhancedCache] Cannot warmup cache - no user/profile data');
      return;
    }

    try {
      // Cache current profile with extended TTL
      const cacheKey = CacheKeys.USER_PROFILE(user.id);
      authCache.set(cacheKey, profile, 30 * 60 * 1000); // 30 minutes
      
      // Cache session data if available
      if (currentState.session) {
        const sessionKey = CacheKeys.SESSION_DATA(currentState.session.access_token.slice(-8));
        authCache.set(sessionKey, {
          sessionId: currentState.session.access_token.slice(-8),
          userId: user.id,
          expiresAt: currentState.session.expires_at,
        }, 10 * 60 * 1000); // 10 minutes
      }
      
      // Cache role permissions
      if (profile.role) {
        const permissionKey = CacheKeys.ROLE_CHECK(profile.role, 'basic');
        authCache.set(permissionKey, true, 20 * 60 * 1000); // 20 minutes
      }
      
      set((state) => ({ 
        lastAuthCheck: Date.now(),
        authCheckSource: 'cache-warmup',
      }), false, 'enhanced-cache/warmupCache');
      
      console.log('[EnhancedCache] Cache warmup completed for user', user.id);
      
    } catch (error) {
      console.warn('[EnhancedCache] Cache warmup failed:', error);
    }
  },

  preloadUserData: async (userId: string) => {
    // This could be expanded to preload related data like permissions, preferences, etc.
    const cacheKey = CacheKeys.USER_PROFILE(userId);
    
    if (authCache.has(cacheKey)) {
      console.log(`[EnhancedCache] User ${userId} data already cached`);
      return;
    }
    
    try {
      // In a real implementation, you might fetch from API here
      // For now, we'll just mark the attempt
      set((state) => ({ 
        lastAuthCheck: Date.now(),
        authCheckSource: 'preload-attempt',
      }), false, 'enhanced-cache/preloadUserData');
      
      console.log(`[EnhancedCache] Preload attempted for user ${userId}`);
      
    } catch (error) {
      console.warn(`[EnhancedCache] Preload failed for user ${userId}:`, error);
    }
  },
});
