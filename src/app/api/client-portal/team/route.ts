import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for inviting users
const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed || undefined;
      }
      return val;
    },
    z.string().optional()
  ),
  lastName: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        return trimmed || undefined;
      }
      return val;
    },
    z.string().optional()
  ),
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
    // Filter out any members where user_profiles is null (data integrity issue)
    const formattedTeamMembers = teamMembers
      ?.filter((member) => member.user_profiles !== null)
      .map((member) => ({
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
    
    // Names are already normalized by zod transform, but ensure they're not empty strings
    const normalizedFirstName = firstName && firstName.trim() ? firstName.trim() : undefined;
    const normalizedLastName = lastName && lastName.trim() ? lastName.trim() : undefined;

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
      .select('id, first_name, last_name')
      .eq('email', email)
      .maybeSingle();

    let newUserId: string | undefined;

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
    }

    // Always attempt to send invitation email, even for existing users
    // Supabase will handle resending if needed or skip if user is already confirmed
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
    // For existing users, this will resend the invitation if they haven't confirmed yet
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo,
        data: {
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
          invited_by: user.id,
          invited_to_client: clientId,
          role: 'EXTERNAL_CLIENT',
        },
      }
    );

    if (inviteError) {
      console.error('Error inviting user:', inviteError);
      // Don't fail if user already exists and is confirmed - that's expected
      if (!inviteError.message?.includes('already registered') && !inviteError.message?.includes('already exists')) {
        return NextResponse.json(
          { error: inviteError.message || 'Failed to send invitation' },
          { status: 500 }
        );
      }
      // If user exists, we should have newUserId from existingUser check above
      // But if invitation failed for a new user, we need to handle it
      if (!newUserId) {
        // Try to get user ID from auth.users if invitation partially succeeded
        try {
          const { data: authUser } = await supabaseAdmin.auth.admin.getUserByEmail(email);
          if (authUser?.user?.id) {
            newUserId = authUser.user.id;
            console.log('Retrieved user ID from auth.users:', newUserId);
          } else {
            console.error('Could not retrieve user ID after invitation error');
            return NextResponse.json(
              { error: 'Error creating user. Please try again.' },
              { status: 500 }
            );
          }
        } catch (authError) {
          console.error('Error retrieving user from auth:', authError);
          return NextResponse.json(
            { error: 'Error creating user. Please try again.' },
            { status: 500 }
          );
        }
      }
      console.log('User already exists, continuing with existing user:', newUserId);
    } else if (inviteData?.user) {
      // If invitation succeeded, use the returned user ID (might be new or existing)
      newUserId = inviteData.user.id;
    }

    // Validate newUserId exists before proceeding
    if (!newUserId) {
      return NextResponse.json(
        { error: 'Error: Could not obtain user ID. Please try again.' },
        { status: 500 }
      );
    }

    // Generate secure invitation token (SendGrid-compatible - uses query params not hash)
    const crypto = await import('crypto');
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Token valid for 7 days

    // Store token in database
    const { error: tokenError } = await supabaseAdmin
      .from('invitation_tokens')
      .insert({
        token: invitationToken,
        user_id: newUserId,
        email,
        invited_by: user.id,
        client_id: clientId,
        role: 'EXTERNAL_CLIENT',
        expires_at: expiresAt.toISOString(),
        metadata: {
          first_name: normalizedFirstName,
          last_name: normalizedLastName,
        },
      });

    if (tokenError) {
      console.error('Error storing invitation token:', tokenError);
      // Continue anyway - Supabase email was already sent
    } else {
      // Send custom email with token-based URL (SendGrid-compatible)
      const sendgridApiKey = process.env.SENDGRID_API_KEY;
      const invitationUrl = `${origin}/api/auth/verify-invitation?token=${invitationToken}`;
      
      if (sendgridApiKey) {
        const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Invitación a DC HUB</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7; -webkit-font-smoothing: antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f7; padding: 40px 20px;">
<tr>
<td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); max-width: 100%;">
<tr>
<td style="padding: 48px 32px 32px; text-align: center; background: linear-gradient(135deg, #f0f9f4 0%, #ffffff 100%);">
<table width="64" height="64" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 20px; background: linear-gradient(135deg, #00B050 0%, #00D563 100%); border-radius: 16px; box-shadow: 0 8px 16px rgba(0, 176, 80, 0.25);">
<tr>
<td align="center" valign="middle">
<img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='white' d='M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z'/%3E%3C/svg%3E" width="32" height="32" alt="Mail" style="display: block;" />
</td>
</tr>
</table>
<h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1E3A5F; letter-spacing: -0.5px;">Tienes una invitación</h1>
<p style="margin: 0; font-size: 17px; color: #86868b; font-weight: 400;">DC Concretos</p>
</td>
</tr>
<tr>
<td style="padding: 32px;">
<p style="margin: 0 0 24px 0; font-size: 17px; color: #1d1d1f; line-height: 1.6;">
Has sido invitado a unirte a <strong style="font-weight: 600; color: #00B050;">DC HUB</strong>, nuestra plataforma integral de gestión y colaboración.
</p>
<p style="margin: 0 0 40px 0; font-size: 17px; color: #1d1d1f; line-height: 1.6;">
Acepta tu invitación para acceder a todas las herramientas y servicios disponibles para tu equipo.
</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding: 0 0 40px 0;">
<a href="${invitationUrl}" style="display: inline-block; background: #00B050; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 17px; letter-spacing: -0.2px; box-shadow: 0 4px 12px rgba(0, 176, 80, 0.3);">Aceptar invitación</a>
</td>
</tr>
</table>
<p style="margin: 0 0 32px 0; font-size: 15px; color: #86868b; text-align: center; line-height: 1.5;">
¿Necesitas ayuda? Estamos aquí para asistirte en cualquier momento.
</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding: 0 0 32px 0;">
<div style="height: 1px; background: linear-gradient(90deg, transparent, #d2d2d7, transparent);"></div>
</td>
</tr>
</table>
<p style="margin: 0; font-size: 13px; color: #86868b; line-height: 1.6; text-align: center;">
Si no solicitaste esta invitación, puedes ignorar este mensaje de forma segura.
</p>
</td>
</tr>
<tr>
<td style="padding: 32px; text-align: center; background-color: #f5f5f7;">
<p style="margin: 0; font-size: 12px; color: #a1a1a6; font-weight: 500;">
© 2025 DC Concretos. Todos los derechos reservados.
</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;

        try {
          const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${sendgridApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              personalizations: [{
                to: [{ email }],
              }],
              from: {
                email: 'juan.aguirre@dssolutions-mx.com',
                name: 'DC Concretos',
              },
              subject: 'Invitación a DC HUB',
              content: [{
                type: 'text/html',
                value: emailHtml,
              }],
            }),
          });

          if (!sendgridResponse.ok) {
            const errorText = await sendgridResponse.text();
            console.error('Error sending email via SendGrid:', errorText);
          } else {
            console.log('Custom invitation email sent via SendGrid with token URL');
          }
        } catch (sendgridError) {
          console.error('Exception sending email via SendGrid:', sendgridError);
        }
      }
    }

    // Ensure user profile exists with correct role and portal user flag
    // Use upsert to handle race condition where trigger may have created profile first
    // This ensures the profile always has EXTERNAL_CLIENT role and is_portal_user=true
    const { error: profileUpsertError } = await supabaseAdmin
      .from('user_profiles')
      .upsert({
        id: newUserId,
        email,
        first_name: normalizedFirstName || null,
        last_name: normalizedLastName || null,
        role: 'EXTERNAL_CLIENT', // Always ensure role is EXTERNAL_CLIENT for portal users
        is_portal_user: true,
        is_active: true,
      }, {
        onConflict: 'id',
        ignoreDuplicates: false, // Update existing records
      });

    if (profileUpsertError) {
      console.error('Error upserting user profile:', profileUpsertError);
      // Non-critical error - profile might have been created by trigger with correct role
      // Continue with association creation
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
