'use client'
import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext' // Import useAuth hook
// No need to import supabase client directly anymore
// Import types for the callback parameters
import { AuthChangeEvent, Session } from '@supabase/supabase-js' 

export default function SessionManager() {
  // Get both trigger function and supabase client from context
  const { triggerAuthCheck, supabase } = useAuth(); 

  useEffect(() => {
    // No need for getSupabaseClient anymore

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      // Add explicit types for event and session
      (event: AuthChangeEvent, session: Session | null) => {
        console.log('SessionManager detected event:', event);
        // Call triggerAuthCheck from context on relevant events
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('SessionManager triggering AuthContext check.');
          triggerAuthCheck(); // Call the context function
        } else if (event === 'SIGNED_OUT') {
          console.log('SessionManager detected SIGNED_OUT. AuthContext handles state.');
          // No specific action needed here now, context listener handles clearing state
        }
      }
    );

    // Cleanup subscription on component unmount
    return () => {
      subscription?.unsubscribe();
    };
    // Ensure supabase is in dependency array if its identity could change (though unlikely for singleton)
  }, [triggerAuthCheck, supabase]); 

  // This component does not render anything
  return null;
} 