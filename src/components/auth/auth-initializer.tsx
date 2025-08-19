'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { supabase } from '@/lib/supabase/client';

export default function AuthInitializer() {
  const initialize = useAuthStore((s) => s.initialize);
  const scheduleRefresh = useAuthStore((s) => s.scheduleRefresh);
  const clearRefreshTimer = useAuthStore((s) => s.clearRefreshTimer);
  const setOnline = useAuthStore((s) => s.setOnlineStatus);
  const session = useAuthStore((s) => s.session);
  const loadProfile = useAuthStore((s) => s.loadProfile);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[AuthInitializer] Auth event: ${event}`, session ? 'Session exists' : 'No session');
      
      // Always update session and user state immediately
      useAuthStore.setState({ session, user: session?.user ?? null });
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log(`[AuthInitializer] Processing ${event} - loading profile`);
        void loadProfile();
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


