/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import type { StateCreator } from 'zustand';
import type { AuthStoreState, SessionSliceState } from '../types';
import { supabase } from '@/lib/supabase/client';

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export const createSessionSlice: StateCreator<AuthStoreState, [['zustand/devtools', never]], [], SessionSliceState> = (set, get) => ({
  session: null,

  scheduleRefresh: () => {
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    const session = get().session;
    const expiresAtSec = session?.expires_at;
    if (!expiresAtSec) return;
    const nowSec = Math.floor(Date.now() / 1000);
    const lifetimeSec = expiresAtSec - (session?.created_at ? Math.floor(new Date(session.created_at).getTime() / 1000) : nowSec);
    const refreshAtSec = (expiresAtSec - Math.floor(lifetimeSec * 0.25)); // ~75% of lifetime
    const delayMs = Math.max((refreshAtSec - nowSec) * 1000, 0);
    refreshTimer = setTimeout(async () => {
      try {
        await supabase.auth.refreshSession();
        const { data } = await supabase.auth.getSession();
        set({ session: data.session ?? null }, false, 'session/refresh:set');
        get().scheduleRefresh();
      } catch {
        // Swallow errors; metrics slice can track failures elsewhere
      }
    }, delayMs);
  },

  clearRefreshTimer: () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
  },

  isSessionExpiringSoon: () => {
    const s = get().session;
    if (!s?.expires_at) return true;
    const nowSec = Math.floor(Date.now() / 1000);
    const remainingSec = s.expires_at - nowSec;
    return remainingSec < 60 * 5; // 5 minutes
  },

  refreshSessionNow: async () => {
    try {
      await supabase.auth.refreshSession();
      const { data } = await supabase.auth.getSession();
      set({ session: data.session ?? null }, false, 'session/refreshNow:set');
      get().scheduleRefresh();
    } catch {
      // ignore
    }
  },
});


