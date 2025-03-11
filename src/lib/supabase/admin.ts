import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

let adminClientInstance: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Creates a Supabase admin client with service role key
 * This client has admin privileges and should only be used in server contexts
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase environment variables for admin client');
  }
  
  // Create a new admin client if one doesn't exist
  if (!adminClientInstance) {
    adminClientInstance = createClient<Database>(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    console.log('Created Supabase admin client');
  }
  
  return adminClientInstance;
} 