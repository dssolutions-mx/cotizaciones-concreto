import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Check if we're in a build environment without env vars and provide fallbacks
// This prevents build errors but won't actually connect to Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:54321');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  (process.env.NODE_ENV === 'production' ? '' : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTl9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0');

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or key is missing. API calls will fail.');
}

// Cliente Supabase unificado para toda la aplicación
export const supabase = createClient<Database>(
  supabaseUrl, 
  supabaseKey, 
  { 
    auth: { 
      persistSession: true,
      autoRefreshToken: true,
    } 
  }
); 