/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { supabase } from '@/lib/supabase/client';
import { checkPermission } from '@/lib/auth/roleUtils';
import { cacheUserProfile, clearUserCache, getCachedUserProfile } from '@/lib/cache/userDataCache';
import type { StateCreator } from 'zustand';
import type { AuthSliceState, AuthStoreState, UserRole, UserProfile } from '../types';

export const createAuthSlice: StateCreator<AuthStoreState, [['zustand/devtools', never]], [], AuthSliceState> = (set, get) => ({
  user: null,
  profile: null,
  isInitialized: false,
  error: null,

  initialize: async () => {
    const start = performance.now();
    try {
      const cached = getCachedUserProfile();
      if (cached) set({ profile: cached }, false, 'auth/initialize:setCachedProfile');

      const { data: sessionData } = await supabase.auth.getSession();
      // Only update if user or session actually changed to avoid unnecessary re-renders
      const prevUser = get().user;
      const prevSession = get().session;
      const nextUser = sessionData.session?.user ?? null;
      const nextSession = sessionData.session ?? null;
      const userChanged = (prevUser?.id !== nextUser?.id) || (prevUser?.email !== nextUser?.email);
      const sessionChanged = (prevSession?.access_token !== nextSession?.access_token) || (prevSession?.user?.id !== nextSession?.user?.id);
      if (userChanged || sessionChanged) {
        set({ user: nextUser, session: nextSession }, false, 'auth/initialize:setUserAndSession');
      }

      if (sessionData.session?.user) {
        await get().loadProfile();
      } else {
        clearUserCache();
        set({ profile: null }, false, 'auth/initialize:clearProfile');
      }
    } catch (e: any) {
      set({ error: e?.message ?? 'initialize failed' }, false, 'auth/initialize:error');
    } finally {
      set({ isInitialized: true }, false, 'auth/initialize:done');
      const end = performance.now();
      const elapsed = Math.round(end - start);
      const latencies = [...get().authLatencyMs, elapsed].slice(-50);
      set({ authLatencyMs: latencies }, false, 'metrics/latency:add');
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };
      
      if (!data.session?.user) {
        return { success: false, error: 'No user session created' };
      }
      
      // Set session immediately
      console.log('[AuthStore] Setting user and session:', {
        userId: data.session.user.id,
        email: data.session.user.email
      });
      set({ 
        user: data.session.user,
        session: data.session
      }, false, 'auth/signIn:setUserAndSession');
      
      // Load profile directly without redundant session fetch
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.session.user.id)
        .single();
      
      if (profileError) {
        set({ profile: null, error: profileError.message }, false, 'auth/signIn:profileError');
        return { success: false, error: `Profile not found: ${profileError.message}` };
      }
      
      if (!profileData) {
        return { success: false, error: 'Profile not found after sign in' };
      }
      
      // Force set the profile - no change detection during login
      const profile = profileData as unknown as UserProfile;
      console.log('[AuthStore] Setting profile after sign in:', {
        profileId: profile.id,
        role: profile.role,
        email: profile.email
      });
      set({ profile, error: null }, false, 'auth/signIn:setProfile');
      cacheUserProfile(profile);
      console.log('[AuthStore] Profile set successfully, returning success');
      
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message ?? 'Unexpected error' };
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) return { success: false, error: error.message };
      clearUserCache();
      set({ user: null, profile: null }, false, 'auth/signOut:clear');
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message ?? 'Unexpected error' };
    }
  },

  loadProfile: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) { set({ profile: null }, false, 'auth/loadProfile:noUser'); return; }

    const { data: profileData, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      set({ profile: null, error: error.message }, false, 'auth/loadProfile:error');
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
        set({ profile }, false, 'auth/loadProfile:setChanged');
        cacheUserProfile(profile);
      } else {
        // Keep as-is to avoid unnecessary state updates
        set({ profile: prev }, false, 'auth/loadProfile:noChange');
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
});


