'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'QUALITY_TEAM' | 'PLANT_MANAGER' | 'SALES_AGENT' | 'EXECUTIVE';

interface UserProfile {
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
  signIn: (email: string, password: string) => Promise<{ error: any | null }>;
  signOut: () => Promise<void>;
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Memoize the fetchUserProfile function to prevent unnecessary re-renders
  const fetchUserProfile = useCallback(async (userId: string) => {
    console.log('Starting fetchUserProfile for userId:', userId);
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      console.log('Supabase user profile query result:', { 
        data: data ? 'Profile found' : 'No profile', 
        error 
      });
      
      if (error) {
        console.error('Error fetching user profile:', {
          message: error.message, 
          details: error.details, 
          hint: error.hint,
          code: error.code
        });
        
        // Check if this is a "not found" error
        if (error.code === 'PGRST116') {
          console.warn('User profile not found. User may exist in auth but not have a profile yet.');
          
          // Attempt to create a profile if it doesn't exist
          const createProfileResult = await createUserProfileIfNotExists(userId);
          if (createProfileResult) {
            return;
          }
        }
        
        // If profile creation fails or isn't possible, handle accordingly
        setUserProfile(null);
        return;
      }
      
      console.log('Setting user profile:', data);
      setUserProfile(data as UserProfile);
    } catch (catchError) {
      console.error('Unexpected error in fetchUserProfile:', catchError);
      setUserProfile(null);
    }
  }, []); // Empty dependency array to prevent re-creation

  // Memoize the createUserProfileIfNotExists function
  const createUserProfileIfNotExists = useCallback(async (userId: string) => {
    try {
      // Fetch user details from Supabase auth
      const { data: userData, error: userError } = await supabase.auth.getUser(userId);
      
      if (userError || !userData.user) {
        console.error('Could not retrieve user details:', userError);
        return false;
      }

      const { email, user_metadata } = userData.user;

      // Attempt to insert a new profile
      const { data: insertData, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: email,
          first_name: user_metadata.first_name || null,
          last_name: user_metadata.last_name || null,
          role: 'SALES_AGENT' // Default role, adjust as needed
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating user profile:', insertError);
        return false;
      }

      console.log('Created new user profile:', insertData);
      setUserProfile(insertData as UserProfile);
      return true;
    } catch (catchError) {
      console.error('Unexpected error creating user profile:', catchError);
      return false;
    }
  }, []); // Empty dependency array to prevent re-creation

  // Memoize the getInitialSession function
  const getInitialSession = useCallback(async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error retrieving session:', error);
      }
      
      setSession(data?.session);
      setUser(data?.session?.user || null);
      
      if (data?.session?.user) {
        await fetchUserProfile(data.session.user.id);
      }
    } catch (err) {
      console.error('Unexpected error in getInitialSession:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile]);

  // Use useEffect with proper dependencies and cleanup
  useEffect(() => {
    // Initial session fetch
    getInitialSession();

    // Set up listener for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('Auth State Change Event:', {
          event,
          hasSession: !!newSession,
          userId: newSession?.user?.id,
          pathname
        });

        // Prevent unnecessary state updates if session hasn't changed
        if (newSession?.user?.id !== user?.id) {
          setSession(newSession);
          setUser(newSession?.user || null);
          
          if (newSession?.user) {
            console.log('Fetching user profile for:', newSession.user.id);
            await fetchUserProfile(newSession.user.id);
          } else {
            console.log('No session, clearing user profile');
            setUserProfile(null);
            
            // Redirect to login if not authenticated and not on a public route
            const publicRoutes = [
              '/', 
              '/login', 
              '/register', 
              '/reset-password', 
              '/landing'
            ];
            const isLandingRelated = pathname && (
              pathname.startsWith('/(landing)') || 
              pathname.includes('/landing/')
            );
            if (pathname && !publicRoutes.includes(pathname) && !isLandingRelated) {
              console.log('Redirecting to login due to no session');
              router.push('/login');
            }
          }
        }
        
        setLoading(false);
      }
    );

    // Cleanup function
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [
    router, 
    pathname, 
    user?.id, 
    fetchUserProfile, 
    getInitialSession
  ]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }
      
      // Ensure we have a user
      if (!data.user) {
        console.error('No user returned after sign in');
        return { error: new Error('Authentication failed') };
      }
      
      // Check if user profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      // If no profile exists, attempt to create one
      if (profileError) {
        console.warn('No profile found, attempting to create:', profileError);
        
        try {
          const { data: newProfileData, error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: data.user.id,
              email: data.user.email || email,
              first_name: data.user.user_metadata?.first_name || null,
              last_name: data.user.user_metadata?.last_name || null,
              role: 'SALES_AGENT' // Default role
            })
            .select()
            .single();
          
          if (insertError) {
            console.error('Error creating profile:', insertError);
            return { 
              error: new Error('Could not create user profile. Please contact support.') 
            };
          }
          
          console.log('Created new user profile:', newProfileData);
        } catch (catchError) {
          console.error('Unexpected error creating profile:', catchError);
          return { 
            error: new Error('Unexpected error during profile creation') 
          };
        }
      }
      
      return { error: null };
    } catch (err) {
      console.error('Unexpected error during sign in:', err);
      return { error: err instanceof Error ? err : new Error('Unknown error') };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const hasRole = (roles: UserRole | UserRole[]) => {
    if (!userProfile) return false;
    
    if (Array.isArray(roles)) {
      return roles.includes(userProfile.role);
    }
    
    return userProfile.role === roles;
  };

  const isAuthenticated = !!user;

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}; 