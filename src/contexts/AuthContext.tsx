/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
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

// Type definitions
export type UserRole = 'QUALITY_TEAM' | 'PLANT_MANAGER' | 'SALES_AGENT' | 'EXECUTIVE';

export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  refreshSession: () => Promise<void>;
  isSessionLoading: boolean;
  lastSessionRefresh: Date | null;
  authStatus: 'authenticated' | 'unauthenticated' | 'loading';
  sessionExpiresAt: Date | null;
  timeToExpiration: number | null;
}

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
export function AuthProvider({ children }: { children: ReactNode }) {
  // Use the singleton Supabase client instead of creating a new one
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [lastSessionRefresh, setLastSessionRefresh] = useState<Date | null>(null);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<Date | null>(null);
  const [timeToExpiration, setTimeToExpiration] = useState<number | null>(null);
  const [authStatus, setAuthStatus] = useState<'authenticated' | 'unauthenticated' | 'loading'>('loading');
  const router = useRouter();
  
  // Create a ref for the refreshSession function to avoid dependency cycles
  const refreshSessionRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // Update auth state based on session
  const updateAuthState = useCallback(async (currentSession: Session | null) => {
    try {
      if (currentSession) {
        // Use getUser for secure verification
        const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('Error verifying user:', userError.message);
          setUser(null);
          setSession(null);
          setIsAuthenticated(false);
          setAuthStatus('unauthenticated');
          clearUserCache();
          return;
        }
        
        setUser(verifiedUser);
        setSession(currentSession);
        setIsAuthenticated(true);
        setAuthStatus('authenticated');
        
        // Set session expiration
        const expiryDate = calculateExpiryTime(currentSession);
        setSessionExpiresAt(expiryDate);
        setTimeToExpiration(calculateTimeToExpiry(expiryDate));
        
        // Cache session expiry
        cacheSessionExpiry(expiryDate);
        
        // Fetch user profile
        if (verifiedUser) {
          // Check if we have a cached profile first
          const cachedProfile = getCachedUserProfile();
          if (cachedProfile && cachedProfile.id === verifiedUser.id) {
            setUserProfile(cachedProfile as UserProfile);
          } else {
            const { data: profile, error: profileError } = await supabase
              .from('user_profiles')
              .select('id, role, email, first_name, last_name')
              .eq('id', verifiedUser.id)
              .maybeSingle();
              
            if (profileError) {
              console.error('Error fetching user profile:', profileError.message);
            } else if (profile) {
              setUserProfile(profile as UserProfile);
              // Cache the profile
              cacheUserProfile(profile as UserProfile);
            } else {
              console.warn(`No profile found for user ${verifiedUser.id}`);
              setUserProfile(null);
            }
          }
        }
      } else {
        // No session, clear auth state
        setUser(null);
        setSession(null);
        setUserProfile(null);
        setIsAuthenticated(false);
        setSessionExpiresAt(null);
        setTimeToExpiration(null);
        setAuthStatus('unauthenticated');
        clearUserCache();
      }
    } catch (error) {
      console.error('Error updating auth state:', error);
      setUser(null);
      setSession(null);
      setUserProfile(null);
      setIsAuthenticated(false);
      setAuthStatus('unauthenticated');
      clearUserCache();
    }
  }, []);

  // Refresh session manually (can be called from components)
  const refreshSession = useCallback(async () => {
    try {
      setIsSessionLoading(true);
      console.log('Manually refreshing session...');
      
      // Add retry logic for session refresh
      const maxRetries = 3;
      let attempts = 0;
      let refreshSuccess = false;
      
      while (attempts < maxRetries && !refreshSuccess) {
        attempts++;
        try {
          // Try to refresh the session
          const { data: { session: refreshedSession }, error } = await supabase.auth.refreshSession();
          
          if (error) {
            console.error(`Session refresh attempt ${attempts}/${maxRetries} failed:`, error);
            
            // Wait before retrying (exponential backoff)
            if (attempts < maxRetries) {
              const delay = Math.pow(2, attempts) * 300; // 600ms, 1200ms, 2400ms
              console.log(`Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            continue;
          }
          
          // Success - update auth state and break the loop
          await updateAuthState(refreshedSession);
          refreshSuccess = true;
          
          const now = new Date();
          setLastSessionRefresh(now);
          cacheLastRefresh(now);
          
          console.log('Session refreshed successfully at', now.toISOString());
        } catch (retryError) {
          console.error(`Unexpected error during refresh attempt ${attempts}:`, retryError);
          if (attempts >= maxRetries) break;
          
          // Wait before retrying
          const delay = Math.pow(2, attempts) * 300;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      if (!refreshSuccess) {
        console.error('Failed to refresh session after maximum retries');
        // Get current session as fallback
        const { data } = await supabase.auth.getSession();
        await updateAuthState(data.session);
      }
    } catch (err) {
      console.error('Error refreshing session:', err);
    } finally {
      setIsSessionLoading(false);
    }
  }, [updateAuthState]);
  
  // Update the ref whenever refreshSession changes
  useEffect(() => {
    refreshSessionRef.current = refreshSession;
  }, [refreshSession]);

  // Update time to expiration
  useEffect(() => {
    if (!sessionExpiresAt) return;
    
    // Update time to expiration every minute
    const updateTimeToExpiry = () => {
      setTimeToExpiration(calculateTimeToExpiry(sessionExpiresAt));
    };
    
    updateTimeToExpiry(); // Initial update
    const interval = setInterval(updateTimeToExpiry, 60000); // Update every minute
    
    // Auto refresh session if it's about to expire (10 minutes before)
    const timeToExpiry = calculateTimeToExpiry(sessionExpiresAt);
    if (timeToExpiry && timeToExpiry < 600000 && timeToExpiry > 0) {
      if (refreshSessionRef.current) {
        refreshSessionRef.current();
      }
    }
    
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  // Initialize auth state on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        setAuthStatus('loading');
        
        // Check for cached data first
        const cachedProfile = getCachedUserProfile();
        const cachedExpiryDate = getCachedSessionExpiry();
        const cachedLastRefresh = getCachedLastRefresh();
        
        const timeToExpiry = cachedExpiryDate ? calculateTimeToExpiry(cachedExpiryDate) : null;
        if (cachedProfile && cachedExpiryDate && timeToExpiry !== null && timeToExpiry > 0) {
          // Use cached data to show UI faster
          setUserProfile(cachedProfile as UserProfile);
          setSessionExpiresAt(cachedExpiryDate);
          setTimeToExpiration(timeToExpiry);
          setLastSessionRefresh(cachedLastRefresh);
          setIsAuthenticated(true);
          setAuthStatus('authenticated');
        }
        
        // Get initial session (even if we used cache, still validate with server)
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        await updateAuthState(initialSession);
        
        // Set up auth change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, newSession) => {
            console.log('Auth state changed:', event);
            await updateAuthState(newSession);
            
            // Handle specific auth events
            if (event === 'SIGNED_IN') {
              console.log('User signed in');
              router.refresh();
            } else if (event === 'SIGNED_OUT') {
              console.log('User signed out');
              router.push('/login');
            } else if (event === 'USER_UPDATED') {
              console.log('User updated');
              router.refresh();
            } else if (event === 'TOKEN_REFRESHED') {
              const now = new Date();
              console.log('Token refreshed at', now.toISOString());
              setLastSessionRefresh(now);
              cacheLastRefresh(now);
            }
          }
        );
        
        // Cleanup subscription on unmount
        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
        setAuthStatus('unauthenticated');
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, [router, updateAuthState]);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setAuthStatus('loading');
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error.message);
        setAuthStatus('unauthenticated');
        return { error };
      }
      
      // Update auth state with new session
      await updateAuthState(data.session);
      
      return { error: null };
    } catch (error: unknown) {
      console.error('Unexpected sign in error:', error);
      setAuthStatus('unauthenticated');
      return { 
        error: error instanceof Error ? error : new Error('An unexpected error occurred') 
      };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      // Clear caches
      clearUserCache();
      // Auth state will be updated by the onAuthStateChange listener
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if user has required role(s)
  const hasRole = useCallback((roles: UserRole | UserRole[]) => {
    // Use the checkPermission utility for consistent role validation
    return checkPermission(userProfile?.role, roles);
  }, [userProfile?.role]);

  // Provide auth context to children
  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        session,
        signIn,
        signOut,
        loading,
        isAuthenticated,
        hasRole,
        refreshSession,
        isSessionLoading,
        lastSessionRefresh,
        authStatus,
        sessionExpiresAt,
        timeToExpiration,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 