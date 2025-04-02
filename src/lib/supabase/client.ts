import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Custom storage implementation that doesn't rely on eval
const customStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from localStorage', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in localStorage', error);
    }
  },
  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from localStorage', error);
    }
  }
};

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
        flowType: 'pkce',
        storage: customStorage,
        debug: process.env.NODE_ENV === 'development',
        // Explicitly set the storage key to avoid conflicts
        storageKey: 'supabase-auth-token'
      },
      global: {
        // Add custom headers to help with CSP issues and 406 errors
        headers: {
          'X-Client-Info': 'supabase-js-v2',
          'Accept': 'application/json'
        }
      }
    }
  );
}

// Create a singleton instance for direct imports
// IMPORTANT: Always use this singleton instance in client components
// to avoid "Multiple GoTrueClient instances" warning
const supabase = createClient();

export { supabase }; 