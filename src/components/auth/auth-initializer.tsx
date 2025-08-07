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
      useAuthStore.setState({ session, user: session?.user ?? null });
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        void loadProfile();
        scheduleRefresh();
      } else if (event === 'SIGNED_OUT') {
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
    return () => {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  }, [setOnline]);

  return null;
}


