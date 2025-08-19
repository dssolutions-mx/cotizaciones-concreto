/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { supabase } from '@/lib/supabase/client';
import { checkPermission } from '@/lib/auth/roleUtils';
import { cacheUserProfile, clearUserCache, getCachedUserProfile } from '@/lib/cache/userDataCache';
import type { StateCreator } from 'zustand';
import type { UnifiedAuthStoreState, UserRole, UserProfile, UnifiedAuthSliceState } from '../types';
import type { Session, User } from '@supabase/supabase-js';

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export const createUnifiedAuthSlice: StateCreator<UnifiedAuthStoreState, [['zustand/devtools', never]], [], UnifiedAuthSliceState> = (set, get) => {
  
  // Helper to update state with versioning
  const updateStateWithVersion = (update: Partial<UnifiedAuthSliceState>, reason = 'unknown') => {
    const currentState = get();
    const nextVersion = currentState.stateVersion + 1;
    const timestamp = Date.now();
    
    set({
      ...update,
      stateVersion: nextVersion,
      lastUpdated: timestamp,
    }, false, `unified-auth/${reason}:v${nextVersion}`);
    
    console.log(`[UnifiedAuth] State updated (v${nextVersion}): ${reason}`);
  };

  return {
    // Initial state
    user: null,
    profile: null,
    session: null,
    isInitialized: false,
    error: null,
    stateVersion: 0,
    lastUpdated: Date.now(),

    initialize: async () => {
      const start = performance.now();
      try {
        // Try to load cached profile first
        const cached = getCachedUserProfile();
        if (cached) {
          updateStateWithVersion({ profile: cached }, 'initialize:setCachedProfile');
        }

        // Get current session
        const { data: sessionData } = await supabase.auth.getSession();
        const currentState = get();
        
        // Only update if user or session actually changed to avoid unnecessary re-renders
        const nextUser = sessionData.session?.user ?? null;
        const nextSession = sessionData.session ?? null;
        
        const userChanged = (currentState.user?.id !== nextUser?.id) || 
                           (currentState.user?.email !== nextUser?.email);
        const sessionChanged = (currentState.session?.access_token !== nextSession?.access_token) || 
                              (currentState.session?.user?.id !== nextSession?.user?.id);
        
        if (userChanged || sessionChanged) {
          updateStateWithVersion({ 
            user: nextUser, 
            session: nextSession 
          }, 'initialize:setUserAndSession');
        }

        // Load profile if we have a user
        if (sessionData.session?.user) {
          await get().loadProfile();
        } else {
          clearUserCache();
          updateStateWithVersion({ profile: null }, 'initialize:clearProfile');
        }
        
      } catch (e: any) {
        updateStateWithVersion({ 
          error: e?.message ?? 'initialize failed' 
        }, 'initialize:error');
      } finally {
        updateStateWithVersion({ isInitialized: true }, 'initialize:done');
        console.log(`[UnifiedAuth] Initialization completed in ${(performance.now() - start).toFixed(2)}ms`);
      }
    },

    signIn: async (email: string, password: string) => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        
        updateStateWithVersion({ 
          user: data.user, 
          session: data.session,
          error: null 
        }, 'signIn:success');
        
        if (data.user) {
          await get().loadProfile();
        }
        
        return { success: true };
      } catch (e: any) {
        const error = e?.message ?? 'Unexpected error';
        updateStateWithVersion({ error }, 'signIn:error');
        return { success: false, error };
      }
    },

    signOut: async () => {
      try {
        await supabase.auth.signOut();
        get().clearRefreshTimer();
        clearUserCache();
        
        updateStateWithVersion({ 
          user: null, 
          profile: null, 
          session: null,
          error: null 
        }, 'signOut:success');
        
        return { success: true };
      } catch (e: any) {
        const error = e?.message ?? 'Unexpected error';
        updateStateWithVersion({ error }, 'signOut:error');
        return { success: false, error };
      }
    },

    loadProfile: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      
      if (!userId) { 
        updateStateWithVersion({ profile: null }, 'loadProfile:noUser');
        return;
      }

      const { data: profileData, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        updateStateWithVersion({ 
          profile: null, 
          error: error.message 
        }, 'loadProfile:error');
        clearUserCache();
      } else if (profileData) {
        const profile = profileData as unknown as UserProfile;
        const prev = get().profile;
        
        // Only update state if something meaningful changed to avoid rippling re-renders
        const changed = !prev ||
          prev.id !== profile.id ||
          prev.role !== profile.role ||
          prev.plant_id !== profile.plant_id ||
          prev.business_unit_id !== profile.business_unit_id;
          
        if (changed) {
          updateStateWithVersion({ profile }, 'loadProfile:setChanged');
          cacheUserProfile(profile);
        } else {
          // Profile unchanged, but update timestamp
          updateStateWithVersion({ profile: prev }, 'loadProfile:noChange');
        }
      }
    },

    refreshProfile: async () => {
      await get().loadProfile();
    },

    hasRole: (allowed: UserRole | UserRole[]) => {
      const current = get().profile?.role;
      return checkPermission(current, allowed);
    },

    // Session management methods
    scheduleRefresh: () => {
      if (refreshTimer) { 
        clearTimeout(refreshTimer); 
        refreshTimer = null; 
      }
      
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
          updateStateWithVersion({ session: data.session ?? null }, 'refresh:scheduled');
          get().scheduleRefresh();
        } catch (error) {
          console.warn('[UnifiedAuth] Session refresh failed:', error);
        }
      }, delayMs);
      
      console.log(`[UnifiedAuth] Session refresh scheduled in ${Math.round(delayMs / 1000)}s`);
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
        updateStateWithVersion({ session: data.session ?? null }, 'refresh:manual');
        get().scheduleRefresh();
      } catch (error) {
        console.warn('[UnifiedAuth] Manual session refresh failed:', error);
      }
    },

    // State management helpers
    updateState: (update: Partial<UnifiedAuthSliceState>, reason = 'manual') => {
      updateStateWithVersion(update, reason);
    },

    isStateStale: (incomingVersion: number) => {
      const currentVersion = get().stateVersion;
      return incomingVersion <= currentVersion;
    },
  };
};
