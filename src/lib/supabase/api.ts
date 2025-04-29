import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Get Supabase URL and key with fallbacks for build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-for-build.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-build';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key-for-build';

// Check if we're using fallback values (during build)
export const isUsingFallbackEnv = 
  supabaseUrl === 'https://placeholder-for-build.supabase.co' || 
  supabaseKey === 'placeholder-key-for-build' ||
  supabaseAnonKey === 'placeholder-key-for-build';

// Create a Supabase admin client with the service role key
export function createAdminClientForApi() {
  return createClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// Create a basic Supabase client with the anon key
export function createAnonClientForApi() {
  return createClient<Database>(
    supabaseUrl,
    supabaseAnonKey
  );
}

// Get the environment configuration status
export function getEnvironmentStatus() {
  return {
    hasSupabaseUrl: supabaseUrl !== 'https://placeholder-for-build.supabase.co',
    hasServiceKey: supabaseKey !== 'placeholder-key-for-build',
    hasAnonKey: supabaseAnonKey !== 'placeholder-key-for-build',
    isUsingFallbackEnv,
  };
} 