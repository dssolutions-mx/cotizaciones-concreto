import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for inviting users
const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  role: z.enum(['executive', 'user'], {
    required_error: 'Role must be either executive or user',
  }),
  permissions: z.record(z.boolean()).optional(),
});

/**
 * GET /api/client-portal/team
 * Lists all team members for the current user's client organization(s)
 * Only accessible by executive users
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, is_portal_user')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'EXTERNAL_CLIENT') {
      return NextResponse.json(
        { error: 'Access denied. Only client portal users can access this endpoint.' },
        { status: 403 }
      );
    }

    // Get all clients the user has access to
    const { data: clientAssociations, error: clientsError } = await supabase
      .from('client_portal_users')
      .select('client_id, role_within_client')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (clientsError) {
      console.error('Error fetching user clients:', clientsError);
      return NextResponse.json(
        { error: 'Failed to fetch user clients' },
        { status: 500 }
      );
    }

    // Check if user is an executive for at least one client
    const isExecutiveForAnyClient = clientAssociations?.some(
      (assoc) => assoc.role_within_client === 'executive'
    );

    if (!isExecutiveForAnyClient) {
      return NextResponse.json(
        { error: 'Access denied. Only executive users can manage team members.' },
        { status: 403 }
      );
    }

    // Get the first client where user is executive (for MVP, could be enhanced for multi-client)
    const executiveClient = clientAssociations.find(
      (assoc) => assoc.role_within_client === 'executive'
    );

    if (!executiveClient) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get all team members for this client
    const { data: teamMembers, error: teamError } = await supabase
      .from('client_portal_users')
      .select(`
        id,
        user_id,
        client_id,
        role_within_client,
        permissions,
        is_active,
        invited_at,
        invited_by,
        created_at,
        user_profiles!client_portal_users_user_id_fkey (
          email,
          first_name,
          last_name
        )
      `)
      .eq('client_id', executiveClient.client_id)
      .order('created_at', { ascending: false });

    if (teamError) {
      console.error('Error fetching team members:', teamError);
      return NextResponse.json(
        { error: 'Failed to fetch team members' },
        { status: 500 }
      );
    }

    // Transform the data to a cleaner format
    const formattedTeamMembers = teamMembers?.map((member) => ({
      id: member.id,
      user_id: member.user_id,
      email: member.user_profiles?.email || '',
      first_name: member.user_profiles?.first_name || '',
      last_name: member.user_profiles?.last_name || '',
      role_within_client: member.role_within_client,
      permissions: member.permissions,
      is_active: member.is_active,
      invited_at: member.invited_at,
      last_login: null, // last_sign_in_at is in auth.users, not user_profiles
    })) || [];

    return NextResponse.json({
      success: true,
      data: formattedTeamMembers,
    });
  } catch (error) {
    console.error('Team API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/client-portal/team
 * Invites a new team member to the client organization
 * Only accessible by executive users
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = inviteUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { email, firstName, lastName, role, permissions } = validation.data;

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'EXTERNAL_CLIENT') {
      return NextResponse.json(
        { error: 'Access denied. Only client portal users can access this endpoint.' },
        { status: 403 }
      );
    }

    // Get the client where user is executive
    const { data: clientAssociations, error: clientsError } = await supabase
      .from('client_portal_users')
      .select('client_id, role_within_client, clients!inner(id, business_name, default_permissions)')
      .eq('user_id', user.id)
      .eq('role_within_client', 'executive')
      .eq('is_active', true)
      .single();

    if (clientsError || !clientAssociations) {
      return NextResponse.json(
        { error: 'Access denied. Only executive users can invite team members.' },
        { status: 403 }
      );
    }

    const clientId = clientAssociations.client_id;
    const client = clientAssociations.clients as any;

    // Check if user already exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    let newUserId: string;

    if (existingUser) {
      // User already exists - check if already associated with this client
      const { data: existingAssociation, error: assocError } = await supabase
        .from('client_portal_users')
        .select('id, is_active')
        .eq('user_id', existingUser.id)
        .eq('client_id', clientId)
        .maybeSingle();

      if (existingAssociation && existingAssociation.is_active) {
        return NextResponse.json(
          { error: 'This user is already a member of your organization' },
          { status: 400 }
        );
      }

      if (existingAssociation && !existingAssociation.is_active) {
        // Reactivate the user
        const { error: reactivateError } = await supabase
          .from('client_portal_users')
          .update({
            is_active: true,
            role_within_client: role,
            permissions: permissions || client.default_permissions || {},
            invited_by: user.id,
            invited_at: new Date().toISOString(),
          })
          .eq('id', existingAssociation.id);

        if (reactivateError) {
          console.error('Error reactivating user:', reactivateError);
          return NextResponse.json(
            { error: 'Failed to reactivate user' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            userId: existingUser.id,
            invitationSent: false,
            message: 'User reactivated successfully',
          },
        });
      }

      newUserId = existingUser.id;
    } else {
      // Create new user account via Supabase Admin API with invitation email
      // Note: This requires SUPABASE_SERVICE_ROLE_KEY environment variable
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      if (!serviceRoleKey || !supabaseUrl) {
        return NextResponse.json(
          { error: 'Server configuration error' },
          { status: 500 }
        );
      }

      // Create admin client for invitation
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      // Get redirect URL for invitation
      const origin = process.env.NEXT_PUBLIC_APP_URL || 
        (typeof window !== 'undefined' ? window.location.origin : 'https://cotizaciones-concreto.vercel.app');
      const redirectTo = `${origin}/auth/callback`;

      // Invite user by email (this sends the invitation email)
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo,
          data: {
            first_name: firstName,
            last_name: lastName,
            invited_by: user.id,
            invited_to_client: clientId,
            role: 'EXTERNAL_CLIENT',
          },
        }
      );

      if (inviteError || !inviteData?.user) {
        console.error('Error inviting user:', inviteError);
        return NextResponse.json(
          { error: inviteError?.message || 'Failed to send invitation' },
          { status: 500 }
        );
      }

      newUserId = inviteData.user.id;

      // Create user profile
      const { error: profileCreateError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: newUserId,
          email,
          first_name: firstName || '',
          last_name: lastName || '',
          role: 'EXTERNAL_CLIENT',
          is_portal_user: true,
        });

      if (profileCreateError) {
        console.error('Error creating user profile:', profileCreateError);
        // Note: User invited but profile failed - should be handled in cleanup
      }
    }

    // Create client portal user association
    const { error: associationError } = await supabase
      .from('client_portal_users')
      .insert({
        client_id: clientId,
        user_id: newUserId,
        role_within_client: role,
        permissions: permissions || (role === 'executive' ? {} : client.default_permissions || {}),
        is_active: true,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      });

    if (associationError) {
      console.error('Error creating client association:', associationError);
      return NextResponse.json(
        { error: 'Failed to associate user with client' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: newUserId,
        invitationSent: true,
        message: 'Invitación enviada exitosamente al usuario',
      },
    });
  } catch (error) {
    console.error('Team API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
