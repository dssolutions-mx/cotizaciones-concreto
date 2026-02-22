import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { UserRole } from '@/store/auth/types';

export const dynamic = 'force-dynamic';

const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };

export async function POST(req: Request) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: UNAUTHORIZED_HEADERS });
    }
    // Parse the request body to get invitation details
    const { email, role, callerId, callerEmail } = await req.json();
    
    if (!email || !role || !callerId || !callerEmail) {
      console.error('Invite user failed: Missing required fields', { email, role, callerId, callerEmail });
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Prevent caller impersonation: authenticated user must match claimed caller.
    if (callerId !== user.id || callerEmail !== user.email) {
      return NextResponse.json(
        { success: false, message: 'Forbidden - Caller identity mismatch' },
        { status: 403, headers: UNAUTHORIZED_HEADERS }
      );
    }
    
    // Ensure caller has permissions (EXECUTIVE or ADMIN_OPERATIONS)
    try {
      const adminClient = createAdminClient();
      const { data: caller } = await adminClient
        .from('user_profiles')
        .select('role')
        .eq('id', callerId)
        .single();
      if (!caller || (caller.role !== 'EXECUTIVE' && caller.role !== 'ADMIN_OPERATIONS')) {
        return NextResponse.json({ success: false, message: 'Forbidden - Insufficient permissions' }, { status: 403 });
      }
    } catch (permErr) {
      console.error('Error verifying caller permissions for invite:', permErr);
      return NextResponse.json({ success: false, message: 'Permission check failed' }, { status: 500 });
    }

    console.log(`Processing invite for ${email} with role ${role}`, { callerId, callerEmail });

    // Create admin client for user operations
    const adminClient = createAdminClient();
    
    // Get the application URL for redirects
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app';
    console.log('Using origin URL for invite:', origin);
    
    // Use the auth/callback page for better handling of invitation flows
    const redirectTo = `${origin}/auth/callback`;
    console.log('Invite redirect URL:', redirectTo);

    // Create user with Supabase Admin (invited users must verify email)
    const { data: user, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        invited: true,
        invited_at: new Date().toISOString(),
        role: role, // Store role in user metadata for easier access
      },
    });

    if (error) {
      console.error('Error inviting user:', error);
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 500 }
      );
    }

    console.log('User invited successfully, creating profile record');

    // Create user profile record after successful invitation
    if (user?.user) {
      const { error: profileError } = await adminClient
        .from('user_profiles')
        .insert({
          id: user.user.id,
          email: email,
          role: role as UserRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
        });

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // Continue anyway, as the user has been invited
      }
      
      // Log success with user ID for tracking
      console.log('User and profile created successfully', { userId: user.user.id, email, role });

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully',
        user: user.user,
      });
    }

    // This should be unreachable if user was created
    console.error('Invite failed: No user returned from invite operation');
    return NextResponse.json(
      { success: false, message: 'Error sending invitation' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Unexpected error in invite user endpoint:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Error processing invitation', 
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 