/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { checkPermission } from '@/lib/auth/roleUtils';
import { supabase } from '@/lib/supabase/client';
import { 
  cacheUserProfile, 
  getCachedUserProfile,
  clearUserCache,
  isUserCacheValid
} from '@/lib/cache/userDataCache';
import { z } from 'zod';

// Type definitions
export type UserRole = 'QUALITY_TEAM' | 'PLANT_MANAGER' | 'SALES_AGENT' | 'EXECUTIVE' | 'CREDIT_VALIDATOR' | 'DOSIFICADOR';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
}

// Auth context type
type AuthContextType = {
  supabase: typeof supabase;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, first_name: string, last_name: string) => Promise<{ 
    success: boolean; 
    error?: string;
    message?: string;
  }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  hasRole: (allowedRoles: UserRole | UserRole[]) => boolean;
  triggerAuthCheck: (source?: string) => Promise<void>;
};

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export const AuthContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Suspense fallback={<div>Loading authentication...</div>}>
      <AuthContextContent>{children}</AuthContextContent>
    </Suspense>
  );
};

// Auth context content that uses searchParams
const AuthContextContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check if user has a specific role
  const hasRole = useCallback((allowedRoles: UserRole | UserRole[]): boolean => {
    return checkPermission(profile?.role, allowedRoles);
  }, [profile]);

  // Function to manually trigger a re-check of the session and profile
  const triggerAuthCheck = useCallback(async (source: string = 'unknown') => {
    console.log(`%cAuthContext: Triggering manual auth check from [${source}]...`, 'color: blue; font-weight: bold;');
    setIsLoading(true);
    let sessionFound = false;
    let profileFound = false;
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error(`AuthContext [${source}]: Error during session fetch:`, sessionError.message);
      } else {
        console.log(`AuthContext [${source}]: getSession result:`, currentSession ? `Session for ${currentSession.user.email}` : 'No Session');
        sessionFound = !!currentSession;
      }
      
      setSession(currentSession); 

      if (currentSession?.user) {
        console.log(`AuthContext [${source}]: Session found, fetching profile for user ${currentSession.user.id}...`);
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', currentSession.user.id)
          .single();
          
        if (profileError) {
          console.error(`AuthContext [${source}]: Error fetching profile:`, profileError.message);
          setProfile(null);
          clearUserCache();
        } else if (profileData) {
          console.log(`AuthContext [${source}]: Profile found:`, profileData);
          profileFound = true;
          setProfile(profileData);
          cacheUserProfile(profileData);
        } else {
           console.warn(`AuthContext [${source}]: User session found, but no profile data in DB.`);
           setProfile(null);
           clearUserCache();
        }
      } else {
        console.log(`AuthContext [${source}]: No session found, clearing profile.`);
        setProfile(null);
        clearUserCache();
      }
    } catch (error: any) {
      console.error(`AuthContext [${source}]: Exception during auth check:`, error.message);
      setSession(null);
      setProfile(null);
      clearUserCache();
    } finally {
      console.log(`AuthContext [${source}]: Check complete. Session found: ${sessionFound}, Profile found: ${profileFound}`);
      setIsLoading(false);
    }
  }, [supabase]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    console.log('AuthContext: Attempting sign in...');
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('AuthContext: Sign in error:', error.message);
        return { success: false, error: error.message };
      }
      console.log('AuthContext: Sign in successful via Supabase.', data.session ? 'Session received.' : 'No session received.');

      // Session state handled by onAuthStateChange + SessionManager trigger
      // Trigger check immediately for faster UI update after direct action
      if (data.session) {
         await triggerAuthCheck('signIn'); 
      } else {
         setProfile(null);
         clearUserCache(); 
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('AuthContext: Sign in exception:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign up function
  const signUp = async (email: string, password: string, first_name: string, last_name: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('Sign up error:', error.message);
        return { success: false, error: error.message };
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('user_profiles').insert({
          id: data.user.id,
          first_name,
          last_name,
          email,
        });

        if (profileError) {
          console.error('Error creating profile after sign up:', profileError.message);
          return { 
            success: false, 
            error: `Sign up successful, but profile creation failed: ${profileError.message}` 
          };
        }
      }

      return { 
        success: true, 
        message: 'Registration successful! Please check your email to confirm your account.' 
      };
    } catch (error: any) {
      console.error('Sign up exception:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out function
  const signOut = useCallback(async () => {
    console.log('AuthContext: Attempting sign out...');
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('AuthContext: Sign out error:', error.message);
        return { success: false, error: error.message };
      }

      console.log('AuthContext: Sign out successful via Supabase. Clearing local state.');
      setSession(null);
      setProfile(null);
      clearUserCache();
      
      // Optional: Explicit redirect if needed
      // router.push('/login');
      return { success: true };
    } catch (error: any) {
      console.error('AuthContext: Sign out exception:', error);
      return { success: false, error: error.message || 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  }, [supabase, router]);

  // Initial session check and setup auth subscription
  useEffect(() => {
    let mounted = true;

    const cachedProfile = getCachedUserProfile();
    if (cachedProfile) {
      console.log('AuthContext: Initial load from cached profile:', cachedProfile);
      setProfile(cachedProfile);
    }

    // Perform initial check when component mounts
    triggerAuthCheck('initialMount'); 

    // Set up auth change subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, updatedSession) => {
      if (!mounted) return;
      // Minimal logging here, SessionManager/triggerAuthCheck provide more detail
      console.log(`%cAuth State Change Event [Context Listener]: ${event}`, 'color: green;'); 
      
      // Instantly clear profile on SIGNED_OUT
      if (event === 'SIGNED_OUT') {
         console.log('AuthContext Listener: Reacting to SIGNED_OUT, clearing profile.');
         setProfile(null);
         clearUserCache();
      }
      
      // Update session object in state immediately
      setSession(updatedSession);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [triggerAuthCheck, supabase]);

  // Auth context value
  const value = useMemo(() => {
    return {
      supabase,
      session,
      profile,
      isLoading,
      hasRole,
      signIn,
      signUp,
      signOut,
      triggerAuthCheck,
    };
  }, [session, profile, isLoading, hasRole, signIn, signUp, signOut, triggerAuthCheck, supabase]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Form schema for validation
export const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// Hook for sign-in functionality with callback URL support
export const useSignIn = () => {
  const { signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const signInWithCallback = async (
    values: z.infer<typeof formSchema>,
    callbackUrl: string | null = null
  ) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await signIn(values.email, values.password);
      
      if (!result.success) {
        setError(result.error || 'Sign in failed');
        return { success: false, error: result.error };
      }
      
      const callbackFromParams = searchParams?.get("redirect");
      const redirectTo = callbackUrl || callbackFromParams || "/dashboard";
      
      console.log(`Sign in successful, redirecting to: ${redirectTo}`);
      router.push(redirectTo);
      
      return { success: true };
    } catch (err: any) {
      console.error("Exception during sign in with callback", err);
      const errorMessage = err.message || 'An unexpected error occurred during sign in.';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    signInWithCallback,
    isLoading,
    error
  };
}; 