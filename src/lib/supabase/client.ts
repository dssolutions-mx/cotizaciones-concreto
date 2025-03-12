import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// This function is kept for backward compatibility and server-side usage
// but for client components, prefer using the exported singleton instance
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
// IMPORTANT: Always use this singleton instance in client components
// to avoid "Multiple GoTrueClient instances" warning
const supabase = createClient();

export { supabase }; 