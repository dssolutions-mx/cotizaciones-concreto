'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase/client';

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
  const initialize = useAuthStore((s) => s.initialize);
  const scheduleRefresh = useAuthStore((s) => s.scheduleRefresh);
  const clearRefreshTimer = useAuthStore((s) => s.clearRefreshTimer);
  const setOnline = useAuthStore((s) => s.setOnlineStatus);
  const session = useAuthStore((s) => s.session);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  
  // Track last handled auth state to avoid duplicate processing on HMR/visibility
  const lastAccessTokenRef = useRef<string | null>(null);
  const lastEventTsRef = useRef<number>(0);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthInitializer] Auth event: ${event}`, session ? 'Session exists' : 'No session');
      
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

      // De-duplicate rapid successive events (e.g. fast refresh/visibility) using both local and global clocks
      const WINDOW_MS = 4000; // widen window slightly
      const isRapidRepeatLocal = now - lastEventTsRef.current < WINDOW_MS;
      const isRapidRepeatGlobal = now - (g.lastTs || 0) < WINDOW_MS;
      lastEventTsRef.current = now;

      if (event === 'SIGNED_IN') {
        // Ignore if token/user did not change and it's a rapid repeat (protect against HMR and visibility)
        const sameTokenLocal = currentToken && previousToken === currentToken;
        const sameTokenGlobal = currentToken && g.lastToken === currentToken;
        const sameUserGlobal = userId && g.lastUserId === userId;
        if ((sameTokenLocal || sameTokenGlobal) && sameUserGlobal && (isRapidRepeatLocal || isRapidRepeatGlobal)) {
          console.log('[AuthInitializer] Ignoring duplicate SIGNED_IN (same token/user, rapid repeat)');
          return;
        }
        lastAccessTokenRef.current = currentToken;
        g.lastToken = currentToken;
        g.lastTs = now;
        g.lastUserId = userId;
        console.log(`[AuthInitializer] Processing ${event} - loading profile`);
        // Throttle profile loads globally
        if (!g.lastProfileFetchAt || (now - g.lastProfileFetchAt) > WINDOW_MS) {
          g.lastProfileFetchAt = now;
          void loadProfile();
        } else {
          console.log('[AuthInitializer] Skipping loadProfile (throttled)');
        }
        scheduleRefresh();
      } else if (event === 'TOKEN_REFRESHED') {
        lastAccessTokenRef.current = currentToken;
        g.lastToken = currentToken;
        g.lastTs = now;
        g.lastUserId = userId;
        console.log(`[AuthInitializer] Processing ${event} - loading profile`);
        if (!g.lastProfileFetchAt || (now - g.lastProfileFetchAt) > WINDOW_MS) {
          g.lastProfileFetchAt = now;
          void loadProfile();
        } else {
          console.log('[AuthInitializer] Skipping loadProfile (throttled)');
        }
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
    
    // Handle visibility changes - only re-initialize if truly necessary
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only re-initialize if we don't have a valid session or profile
        const currentState = useAuthStore.getState();
        console.log('[AuthInitializer] Visibility change - checking state:', {
          hasSession: !!currentState.session,
          hasProfile: !!currentState.profile,
          isInitialized: currentState.isInitialized
        });
        
        // Only re-initialize if we truly don't have valid auth state
        if (!currentState.session || !currentState.profile) {
          console.log('[AuthInitializer] Re-initializing due to missing session/profile');
          void initialize();
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


