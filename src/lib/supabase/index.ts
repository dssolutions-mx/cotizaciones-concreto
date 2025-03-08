import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Check that environment variables are properly defined
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Handle missing environment variables with a clear warning
if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or key is missing. API calls will fail.');
}

// Create and export the Supabase client
export const supabase = createClient<Database>(supabaseUrl, supabaseKey); 