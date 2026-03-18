/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Default role for new profiles; never accept role from client to prevent privilege escalation
const DEFAULT_NEW_PROFILE_ROLE = 'SALES_AGENT';
// Roles allowed from invite metadata (set server-side by invite-user); client-supplied role is never trusted
const INVITE_METADATA_ALLOWED_ROLES = ['EXTERNAL_CLIENT'] as const;

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error - Missing required environment variables' },
        { status: 500 }
      );
    }

    // Verify identity using server client + getUser() — authoritative JWT verification
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user found' },
        { status: 401 }
      );
    }

    const userId = user.id;
    const userEmail = user.email ?? '';

    // Derive role: only from server-set invite metadata, never from client
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const invitedRole = meta?.invited && typeof meta?.role === 'string' && INVITE_METADATA_ALLOWED_ROLES.includes(meta.role as (typeof INVITE_METADATA_ALLOWED_ROLES)[number])
      ? (meta.role as (typeof INVITE_METADATA_ALLOWED_ROLES)[number])
      : DEFAULT_NEW_PROFILE_ROLE;

    // Parse body — do NOT accept role from client (prevents privilege escalation)
    let firstName: string | null = null;
    let lastName: string | null = null;
    try {
      const body = await request.json();
      firstName = typeof body?.firstName === 'string' ? body.firstName : null;
      lastName = typeof body?.lastName === 'string' ? body.lastName : null;
      // role is intentionally ignored; always derived from invite metadata or default
    } catch {
      // Allow empty body; firstName/lastName stay null
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Check if the user already has a profile
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (existingProfile) {
      return NextResponse.json(
        { message: 'User profile already exists', profile: existingProfile },
        { status: 200 }
      );
    }
    
    // Create the user profile — role is always set server-side; never from client
    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: userId,
        email: userEmail,
        first_name: firstName || null,
        last_name: lastName || null,
        role: invitedRole,
        is_active: true
      })
      .select();
      
    if (profileError) {
      console.error('Error creating user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to create user profile', details: profileError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'User profile created successfully',
      profile: newProfile[0]
    });
    
  } catch (error: unknown) {
    console.error('Error in create-profile API route:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 