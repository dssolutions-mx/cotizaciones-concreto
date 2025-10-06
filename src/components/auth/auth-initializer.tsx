'use client';

import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase/client';
import { getDebugControls } from '@/utils/debugControls';
import { eventDeduplicationService, AuthEvents } from '@/services/eventDeduplicationService';
import { renderTracker } from '@/lib/performance/renderTracker';

// Global de-duplication state to survive HMR and StrictMode remounts
declare global {
  interface Window {
    __AUTH_DEDUP__?: {
      lastToken: string | null;
      lastTs: number;
      lastUserId?: string | null;
      lastProfileFetchAt?: number;
    }
  }
}

export default function AuthInitializer() {
  // Use only the main auth store - no dual-store complexity
  const initialize = useAuthStore((s) => s.initialize);
  const scheduleRefresh = useAuthStore((s) => s.scheduleRefresh);
  const clearRefreshTimer = useAuthStore((s) => s.clearRefreshTimer);
  const setOnline = useAuthStore((s) => s.setOnlineStatus);
  const session = useAuthStore((s) => s.session);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  
  // Track last handled auth state to avoid duplicate processing on HMR/visibility
  const lastAccessTokenRef = useRef<string | null>(null);
  const lastEventTsRef = useRef<number>(0);

  // Track render performance for AuthInitializer
  useEffect(() => {
    const finishRender = renderTracker.trackRender('AuthInitializer', 'auth-flow', undefined, {
      hasSession: !!session,
    });
    finishRender();
  }, [session]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthInitializer] Auth event: ${event}`, session ? 'Session exists' : 'No session');
      
      // Check if this event should be processed (use event deduplication)
      const eventContext = {
        source: 'auth-initializer',
        timestamp: Date.now(),
        sessionId: session?.access_token?.slice(-8),
        userId: session?.user?.id,
        metadata: { event, hasSession: !!session }
      };
      
      const authEventType = event === 'SIGNED_IN' ? AuthEvents.SIGN_IN :
                            event === 'SIGNED_OUT' ? AuthEvents.SIGN_OUT :
                            event === 'TOKEN_REFRESHED' ? AuthEvents.TOKEN_REFRESH :
                            'auth:unknown';
      
      const shouldProcess = eventDeduplicationService.emit(authEventType, {
        event,
        sessionExists: !!session,
        userId: session?.user?.id,
      }, eventContext);
      
      if (!shouldProcess) {
        console.log(`[AuthInitializer] Event ${event} deduplicated - skipping processing`);
        return;
      }
      
      // Always update session and user state immediately
      useAuthStore.setState({ session, user: session?.user ?? null });
      
      const now = Date.now();
      const currentToken = session?.access_token ?? null;
      const previousToken = lastAccessTokenRef.current ?? useAuthStore.getState().session?.access_token ?? null;
      const userId = session?.user?.id ?? null;

      // Initialize global dedup state
      const g = (typeof window !== 'undefined') ? (window.__AUTH_DEDUP__ = window.__AUTH_DEDUP__ || {
        lastToken: null,
        lastTs: 0,
        lastUserId: null,
        lastProfileFetchAt: 0,
      }) : { lastToken: null, lastTs: 0, lastUserId: null, lastProfileFetchAt: 0 };

      // De-duplicate rapid successive events only if token/user hasn't changed
      const WINDOW_MS = 1000; // Reduce throttle window for faster response
      lastEventTsRef.current = now;

      if (event === 'SIGNED_IN') {
        // Only ignore if token AND user are exactly the same AND it's within 1 second
        const sameToken = currentToken && previousToken === currentToken;
        const sameUser = userId && userId === lastAccessTokenRef.current;
        const isRapidRepeat = now - (g.lastTs || 0) < WINDOW_MS;
        
        if (sameToken && sameUser && isRapidRepeat) {
          console.log('[AuthInitializer] Ignoring duplicate SIGNED_IN (same token/user within 1s)');
          return;
        }
        
        lastAccessTokenRef.current = currentToken;
        g.lastToken = currentToken;
        g.lastTs = now;
        g.lastUserId = userId;
        g.lastProfileFetchAt = now;
        
        console.log(`[AuthInitializer] Processing ${event} - loading profile`);
        void loadProfile();
        scheduleRefresh();
        
      } else if (event === 'TOKEN_REFRESHED') {
        lastAccessTokenRef.current = currentToken;
        g.lastToken = currentToken;
        g.lastTs = now;
        g.lastUserId = userId;
        
        console.log(`[AuthInitializer] Processing ${event} - refreshing session`);
        scheduleRefresh();
      } else if (event === 'SIGNED_OUT') {
        console.log('[AuthInitializer] Processing SIGNED_OUT - clearing state');
        useAuthStore.setState({ user: null, profile: null });
        clearRefreshTimer();
      }
    });
    return () => subscription?.unsubscribe();
  }, [scheduleRefresh, clearRefreshTimer, loadProfile]);

  useEffect(() => {
    if (session) {
      scheduleRefresh();
    }
  }, [session, scheduleRefresh]);

  useEffect(() => {
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    
    // Handle visibility changes - only re-initialize if session expired or missing
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentState = useAuthStore.getState();
        const debugControls = getDebugControls();
        
        // Use event deduplication for visibility changes
        const eventContext = {
          source: 'auth-initializer-visibility',
          timestamp: Date.now(),
          sessionId: currentState.session?.access_token?.slice(-8),
          userId: currentState.user?.id,
          metadata: { 
            hasSession: !!currentState.session,
            hasProfile: !!currentState.profile,
            isInitialized: currentState.isInitialized,
            debugMode: debugControls.simulateSessionExpiry
          }
        };
        
        const shouldProcess = eventDeduplicationService.emit(AuthEvents.VISIBILITY_CHANGE, {
          visibilityState: document.visibilityState,
          hasValidSession: !!currentState.session,
        }, eventContext);
        
        if (!shouldProcess) {
          console.log('[AuthInitializer] Visibility change deduplicated - skipping check');
          return;
        }
        
        // Check if session is actually expired
        let isSessionExpired = currentState.session && 
          currentState.session.expires_at && 
          currentState.session.expires_at < Math.floor(Date.now() / 1000);
        
        // Simulate session expiry if debug mode is enabled
        if (debugControls.simulateSessionExpiry && currentState.session) {
          isSessionExpired = true;
          if (debugControls.enableVerboseLogging) {
            console.log('[AuthInitializer] 🔧 DEBUG: Simulating session expiry');
          }
        }
        
        // Check if we're missing critical auth state
        const isMissingAuthState = !currentState.session || !currentState.profile;
        
        // Check if we've never initialized
        const isUninitialized = !currentState.isInitialized;
        
        const logData = {
          hasSession: !!currentState.session,
          hasProfile: !!currentState.profile,
          isInitialized: currentState.isInitialized,
          isSessionExpired,
          shouldReinitialize: isSessionExpired || (isMissingAuthState && isUninitialized),
          debugMode: debugControls.simulateSessionExpiry
        };
        
        if (debugControls.enableVerboseLogging) {
          console.log('[AuthInitializer] 🔧 VERBOSE: Visibility change - checking state:', logData);
        } else {
          console.log('[AuthInitializer] Visibility change - checking state:', logData);
        }
        
        // Only re-initialize if session expired OR we're missing auth state and never initialized
        if (isSessionExpired || (isMissingAuthState && isUninitialized)) {
          const reinitReason = {
            expired: isSessionExpired,
            missing: isMissingAuthState,
            uninitialized: isUninitialized,
            simulated: debugControls.simulateSessionExpiry && isSessionExpired
          };
          
          if (debugControls.enableVerboseLogging) {
            console.log('[AuthInitializer] 🔧 VERBOSE: Re-initializing due to:', reinitReason);
          } else {
            console.log('[AuthInitializer] Re-initializing due to:', reinitReason);
          }
          void initialize();
        } else {
          if (debugControls.enableVerboseLogging) {
            console.log('[AuthInitializer] 🔧 VERBOSE: Skipping re-initialization - valid session exists');
          } else {
            console.log('[AuthInitializer] Skipping re-initialization - valid session exists');
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [setOnline, initialize]);

  return null;
}


