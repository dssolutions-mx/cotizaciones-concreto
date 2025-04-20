import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Removed customStorage as @supabase/ssr defaults to localStorage
// Removed recentAuthCalls map and rate limiting logic
// Removed customFetch implementation

// This function is kept for backward compatibility and server-side usage
// but for client components, prefer using the exported singleton instance
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // These are default values in ssr/browser client but explicitly set for clarity
        persistSession: true, 
        autoRefreshToken: true,
        detectSessionInUrl: true, // Default: true
        flowType: 'pkce', // Default: 'pkce'
        // Keep debug logs in development
        debug: process.env.NODE_ENV === 'development', 
      },
      global: {
        // Keep essential headers
        headers: {
          'X-Client-Info': 'supabase-js-v2',
          'Accept': 'application/json'
        },
        // Removed custom fetch, use default
      },
      // Keep reasonable timeout
      realtime: {
        timeout: 30000 // 30 seconds
      }
    }
  );
}

// Create a singleton instance for direct imports
// IMPORTANT: Always use this singleton instance in client components
// to avoid "Multiple GoTrueClient instances" warning
const supabase = createClient();

export { supabase }; 