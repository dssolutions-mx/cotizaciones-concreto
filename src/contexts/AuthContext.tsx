/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import { checkPermission } from '@/lib/auth/roleUtils';
import { supabase } from '@/lib/supabase';
import { 
  cacheUserProfile, 
  getCachedUserProfile,
  cacheSessionExpiry,
  getCachedSessionExpiry,
  cacheLastRefresh,
  getCachedLastRefresh,
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
  refreshSession: () => Promise<void>;
  hasRole: (allowedRoles: UserRole | UserRole[]) => boolean;
};

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Utility for calculating session expiration time
const calculateExpiryTime = (session: Session | null): Date | null => {
  if (!session?.expires_at) return null;
  return new Date(session.expires_at * 1000);
};

// Utility for calculating time to expiration
const calculateTimeToExpiry = (expiryDate: Date | null): number | null => {
  if (!expiryDate) return null;
  const now = new Date();
  return Math.max(0, expiryDate.getTime() - now.getTime());
};

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
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activityCheckInterval, setActivityCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Constants for activity tracking
  const ACTIVITY_CHECK_INTERVAL = 15 * 1000; // Check every 15 seconds
  const ACTIVITY_THRESHOLD = 10 * 60 * 1000; // 10 minutes
  const SESSION_EXPIRATION = 55 * 60 * 1000; // 55 minutes

  // Record user activity
  const recordActivity = useCallback(() => {
    setLastActivity(Date.now());
  }, []);

  // Check if user has a specific role
  const hasRole = useCallback((allowedRoles: UserRole | UserRole[]): boolean => {
    return checkPermission(profile?.role, allowedRoles);
  }, [profile]);

  // Refresh the session
  const refreshSession = useCallback(async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('Error refreshing session:', error.message);
        
        // If unauthorized, sign out and redirect to login
        if (error.status === 401) {
          await supabase.auth.signOut();
          router.push('/login');
        }
        return;
      }

      setSession(data.session);
      
      // Fetch user profile if we have a session
      if (data.session?.user) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        }
      }
    } catch (err) {
      console.error('Session refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, router]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      setSession(data.session);
      
      // Fetch user profile
      if (data.session?.user) {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
        }
      }

      recordActivity();
      return { success: true };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: 'An unexpected error occurred' };
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
        return { success: false, error: error.message };
      }

      // Create user profile
      if (data.user) {
        const { error: profileError } = await supabase.from('user_profiles').insert({
          id: data.user.id,
          first_name,
          last_name,
          email,
        });

        if (profileError) {
          return { success: false, error: profileError.message };
        }
      }

      return { 
        success: true, 
        message: 'Registration successful! Please check your email to confirm your account.' 
      };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out function
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      setSession(null);
      setProfile(null);
      router.push('/login');
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Check for inactivity and refresh token if needed
  useEffect(() => {
    if (!session) return;

    const checkActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivity;

      // If user has been inactive for longer than SESSION_EXPIRATION, sign out
      if (timeSinceLastActivity > SESSION_EXPIRATION) {
        signOut();
        return;
      }

      // If user has been inactive for longer than ACTIVITY_THRESHOLD, refresh token
      if (timeSinceLastActivity > ACTIVITY_THRESHOLD) {
        refreshSession();
      }
    };

    // Set up interval to check activity
    const interval = setInterval(checkActivity, ACTIVITY_CHECK_INTERVAL);
    setActivityCheckInterval(interval);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lastActivity, refreshSession, session, ACTIVITY_CHECK_INTERVAL, ACTIVITY_THRESHOLD, SESSION_EXPIRATION, signOut]);

  // Add event listeners for user activity
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'click'];
    
    const handleActivity = () => {
      recordActivity();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [recordActivity, activityCheckInterval]);

  // Initial session check and setup auth subscription
  useEffect(() => {
    const checkSession = async () => {
      try {
        setIsLoading(true);
        
        // Get current session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        
        // Fetch user profile if we have a session
        if (currentSession?.user) {
          const { data: profileData } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();
          
          if (profileData) {
            setProfile(profileData);
          }
        }
        
        // Check if we need to redirect to redirect_url from login
        const redirectTo = searchParams.get('redirect');
        if (currentSession && redirectTo) {
          router.push(decodeURIComponent(redirectTo));
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Set up auth change subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, updatedSession) => {
      setSession(updatedSession);
      recordActivity();
      
      if (event === 'SIGNED_IN' && updatedSession) {
        // Fetch user profile when signed in
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', updatedSession.user.id)
          .single();
        
        setProfile(data);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setProfile(null);
      } else if (event === 'TOKEN_REFRESHED') {
        setSession(updatedSession);
      }
    });

    // Initial session check
    checkSession();

    return () => {
      subscription.unsubscribe();
      if (activityCheckInterval) {
        clearInterval(activityCheckInterval);
      }
    };
  }, [router, searchParams]);

  // Auth context value
  const value = useMemo(() => {
    return {
      session,
      profile,
      isAuthenticated: !!session,
      isLoading,
      hasRole,
      refreshSession,
      signIn,
      signUp,
      signOut,
      // Calculate time until session expiration
      sessionExpiresIn: session ? calculateExpiryTime(session) : null,
    };
  }, [session, profile, isLoading, hasRole, refreshSession, signOut]);

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
  
  const signInWithCallback = async (
    values: z.infer<typeof formSchema>,
    callbackUrl: string | null = null
  ) => {
    setIsLoading(true);
    
    try {
      const result = await signIn(values.email, values.password);
      
      if (!result.success) {
        return { error: result.error };
      }
      
      // Get the callback URL from searchParams or use the default
      // Handle null searchParams for SSR safety
      const callbackFromParams = searchParams ? searchParams.get("callbackUrl") : null;
      const redirectTo = callbackUrl || callbackFromParams || "/dashboard";
      
      router.refresh();
      router.push(redirectTo);
      
      return { success: true };
    } catch (error) {
      console.error("Error with login", error);
      return { error };
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    signInWithCallback,
    isLoading
  };
}; 