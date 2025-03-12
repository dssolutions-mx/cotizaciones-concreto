import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Export a function that creates a new client each time it's called
// This is the recommended pattern from Supabase
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    }
  );
}

// Create a singleton instance for direct imports
// This helps maintain backward compatibility with existing code
const supabase = createClient();

export { supabase }; 