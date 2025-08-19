/**
 * Unified Auth Bridge
 * 
 * Provides a bridge between the legacy auth store and the new unified auth store,
 * allowing for gradual migration of components without breaking existing functionality.
 */

import { useAuthStore } from '@/store/auth';
import { useUnifiedAuthStore } from '@/store/auth/unified-store';
import { eventDeduplicationService, AuthEvents } from '@/services/eventDeduplicationService';
import type { UserRole, UserProfile } from '@/store/auth/types';
import { useMemo } from 'react';

export interface UnifiedAuthBridgeReturn {
  // Core auth state
  user: any;
  profile: UserProfile | null;
  session: any;
  isInitialized: boolean;
  error: string | null;
  
  // Enhanced state info
  stateVersion: number;
  lastUpdated: number;
  
  // Auth methods
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  loadProfile: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (allowed: UserRole | UserRole[]) => boolean;
  
  // Session methods
  scheduleRefresh: () => void;
  clearRefreshTimer: () => void;
  isSessionExpiringSoon: () => boolean;
  refreshSessionNow: () => Promise<void>;
  
  // Cache methods
  getCachedProfile: (userId: string) => UserProfile | null;
  setCachedProfile: (profile: UserProfile, ttl?: number) => void;
  getCacheStats: () => any;
  clearCache: () => void;
  
  // Enhanced features
  isUsingUnifiedStore: boolean;
  migrateLegacyData: () => void;
  getEventStats: () => any;
}

/**
 * Hook that provides unified auth functionality with backward compatibility
 */
export function useUnifiedAuthBridge(options: { preferUnified?: boolean } = {}): UnifiedAuthBridgeReturn {
  const preferUnified = options.preferUnified ?? false;
  
  // Get both stores
  const legacyStore = useAuthStore();
  const unifiedStore = useUnifiedAuthStore();
  
  // Decide which store to use
  const isUsingUnified = preferUnified && unifiedStore.stateVersion > 0;
  
  // Event-driven synchronization
  useMemo(() => {
    if (isUsingUnified) {
      // Set up event listeners for the unified store
      const unsubscribers = [
        eventDeduplicationService.on(AuthEvents.SIGN_IN, (data) => {
          console.log('[UnifiedAuthBridge] Handling sign in event');
        }),
        eventDeduplicationService.on(AuthEvents.SIGN_OUT, (data) => {
          console.log('[UnifiedAuthBridge] Handling sign out event');
        }),
        eventDeduplicationService.on(AuthEvents.PROFILE_LOAD, (data) => {
          console.log('[UnifiedAuthBridge] Handling profile load event');
        }),
      ];
      
      return () => {
        unsubscribers.forEach(unsub => unsub());
      };
    }
  }, [isUsingUnified]);

  const currentStore = isUsingUnified ? unifiedStore : legacyStore;

  // Enhanced methods that integrate with event deduplication
  const enhancedSignIn = async (email: string, password: string) => {
    const context = {
      source: 'unified-auth-bridge',
      timestamp: Date.now(),
      metadata: { email },
    };
    
    const shouldProceed = eventDeduplicationService.emit(AuthEvents.SIGN_IN, { email }, context);
    if (!shouldProceed) {
      console.log('[UnifiedAuthBridge] Sign in request deduplicated');
      return { success: false, error: 'Request in progress' };
    }
    
    return currentStore.signIn(email, password);
  };

  const enhancedSignOut = async () => {
    const context = {
      source: 'unified-auth-bridge',
      timestamp: Date.now(),
    };
    
    const shouldProceed = eventDeduplicationService.emit(AuthEvents.SIGN_OUT, {}, context);
    if (!shouldProceed) {
      console.log('[UnifiedAuthBridge] Sign out request deduplicated');
      return { success: false, error: 'Request in progress' };
    }
    
    return currentStore.signOut();
  };

  const enhancedLoadProfile = async () => {
    const context = {
      source: 'unified-auth-bridge',
      timestamp: Date.now(),
      userId: currentStore.user?.id,
    };
    
    const shouldProceed = eventDeduplicationService.emit(AuthEvents.PROFILE_LOAD, {}, context);
    if (!shouldProceed) {
      console.log('[UnifiedAuthBridge] Profile load request deduplicated');
      return;
    }
    
    return currentStore.loadProfile();
  };

  const migrateLegacyData = () => {
    if (isUsingUnified) {
      console.log('[UnifiedAuthBridge] Already using unified store');
      return;
    }
    
    try {
      // Copy current state from legacy to unified store
      const legacyState = legacyStore;
      
      unifiedStore.updateState({
        user: legacyState.user,
        profile: legacyState.profile,
        session: legacyState.session,
        isInitialized: legacyState.isInitialized,
        error: legacyState.error,
      }, 'legacy-migration');
      
      console.log('[UnifiedAuthBridge] Legacy data migrated to unified store');
      
      // Emit migration event
      eventDeduplicationService.emit('auth:legacy_migrated', {
        timestamp: Date.now(),
        hasUser: !!legacyState.user,
        hasProfile: !!legacyState.profile,
        hasSession: !!legacyState.session,
      });
      
    } catch (error) {
      console.error('[UnifiedAuthBridge] Migration failed:', error);
    }
  };

  return {
    // Core state
    user: currentStore.user,
    profile: currentStore.profile,
    session: currentStore.session,
    isInitialized: currentStore.isInitialized,
    error: currentStore.error,
    
    // Enhanced state (unified store only)
    stateVersion: isUsingUnified ? unifiedStore.stateVersion : 0,
    lastUpdated: isUsingUnified ? unifiedStore.lastUpdated : Date.now(),
    
    // Core methods (enhanced with event deduplication)
    initialize: currentStore.initialize,
    signIn: enhancedSignIn,
    signOut: enhancedSignOut,
    loadProfile: enhancedLoadProfile,
    refreshProfile: currentStore.refreshProfile || currentStore.loadProfile,
    hasRole: currentStore.hasRole,
    
    // Session methods
    scheduleRefresh: currentStore.scheduleRefresh,
    clearRefreshTimer: currentStore.clearRefreshTimer,
    isSessionExpiringSoon: currentStore.isSessionExpiringSoon,
    refreshSessionNow: currentStore.refreshSessionNow,
    
    // Cache methods (unified store only)
    getCachedProfile: isUsingUnified ? unifiedStore.getCachedProfile : () => null,
    setCachedProfile: isUsingUnified ? unifiedStore.setCachedProfile : () => {},
    getCacheStats: isUsingUnified ? unifiedStore.getCacheStats : () => ({}),
    clearCache: isUsingUnified ? unifiedStore.clearCache : () => {},
    
    // Bridge-specific features
    isUsingUnifiedStore: isUsingUnified,
    migrateLegacyData,
    getEventStats: () => eventDeduplicationService.getStats(),
  };
}

/**
 * Factory for gradually migrating components to unified auth
 */
export function createAuthHook(componentName: string, options: { preferUnified?: boolean } = {}) {
  return function useComponentAuth() {
    const bridge = useUnifiedAuthBridge(options);
    
    // Component-specific event tracking
    useMemo(() => {
      eventDeduplicationService.emit('component:auth_hook_used', {
        component: componentName,
        store: bridge.isUsingUnifiedStore ? 'unified' : 'legacy',
      }, {
        source: componentName,
        timestamp: Date.now(),
      });
    }, [bridge.isUsingUnifiedStore]);
    
    return bridge;
  };
}

// Pre-configured hooks for specific components
export const useOrderDetailsAuth = createAuthHook('OrderDetails');
export const useAuthInitializerBridge = createAuthHook('AuthInitializer');
export const useHeaderAuth = createAuthHook('Header');

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).unifiedAuthBridge = {
    useUnifiedAuthBridge,
    createAuthHook,
    eventStats: () => eventDeduplicationService.getStats(),
  };
  console.log('🔧 Unified auth bridge utilities available via window.unifiedAuthBridge');
}
