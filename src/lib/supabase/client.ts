import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Use a singleton pattern to ensure only one client instance exists
let supabaseInstance: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Get the Supabase client singleton instance
 * This prevents multiple instances from being created and causing auth conflicts
 */
function getSupabaseClient() {
  if (supabaseInstance === null) {
    if (typeof window !== 'undefined') {
      // Create the client with specific storage options to ensure consistency
      supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true, // This is important for invitation links
          flowType: 'pkce' // Use PKCE flow for better security
        },
        global: {
          // Add custom headers if needed
          headers: {
            'x-client-info': 'cotizaciones-concreto-app'
          }
        }
      });
      
      // Process URL hash for auth tokens if present (for invitation flows)
      if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
        console.log('Detected auth tokens in URL hash, will be processed by Supabase client');
      }
      
      console.log('Created Supabase client singleton instance');
    } else {
      // Create a placeholder client for SSR that will be replaced on the client side
      // This prevents null checks but won't actually be used
      supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseKey);
    }
  }
  return supabaseInstance;
}

// Initialize the singleton on module load
const supabase = getSupabaseClient();

// Export the singleton instance
export { supabase }; 