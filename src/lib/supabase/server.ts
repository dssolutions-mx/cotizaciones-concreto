/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
// This file contains utility functions for creating Supabase clients on the server side
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

// Utility function to create a Supabase client for Server Components,
// Route Handlers, and Server Actions.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  // Create and return the Supabase client using the standard pattern
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Pass the cookieStore methods directly as expected by createServerClient
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

// Alternative function for API routes that need to work with NextRequest
export function createServerSupabaseClientFromRequest(req: Request) {
  // Parse cookies from the request headers
  const cookieHeader = req.headers.get('cookie');
  const cookies: Record<string, string> = {};

  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...valueParts] = cookie.trim().split('=');
      if (name && valueParts.length > 0) {
        cookies[name] = valueParts.join('=');
      }
    });
  }

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies[name] || null;
        },
        set(name: string, value: string, options: CookieOptions) {
          // In API routes, we don't set cookies directly
          // The middleware handles cookie setting
        },
        remove(name: string, options: CookieOptions) {
          // In API routes, we don't remove cookies directly
          // The middleware handles cookie management
        },
      },
    }
  );
}

// For creating a service client with admin privileges
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing environment variables for service client');
  }
  
  return createServerClient<Database>(
    supabaseUrl,
    supabaseServiceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      cookies: {
        getAll: () => [],
        setAll: () => {},
      }
    }
  );
} 