import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { UserRole } from '@/store/auth/types';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://dcconcretos-hub.com';

export async function POST(req: Request) {
  try {
    const authClient = await createServerSupabaseClient();
    const { data: { user: authUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: UNAUTHORIZED_HEADERS });
    }
    const { email, role, callerId, callerEmail } = await req.json();

    if (!email || !role || !callerId || !callerEmail) {
      console.error('Invite user failed: Missing required fields', { email, role, callerId, callerEmail });
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (callerId !== authUser.id || callerEmail !== authUser.email) {
      return NextResponse.json(
        { success: false, message: 'Forbidden - Caller identity mismatch' },
        { status: 403, headers: UNAUTHORIZED_HEADERS }
      );
    }

    const adminClient = createAdminClient();
    const { data: caller } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', callerId)
      .single();
    if (!caller || (caller.role !== 'EXECUTIVE' && caller.role !== 'ADMIN_OPERATIONS')) {
      return NextResponse.json({ success: false, message: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    console.log(`Processing invite for ${email} with role ${role}`, { callerId, callerEmail });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ success: false, message: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let userId: string | null = null;

    // Check if user already exists (re-invite case)
    const { data: existingProfile } = await adminClient
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (existingProfile) {
      userId = existingProfile.id;
    }

    // Create user if new (no Supabase email - we send our own via SendGrid)
    if (!userId) {
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: {
          invited: true,
          invited_at: new Date().toISOString(),
          role,
        },
      });

      if (createError) {
        if (createError.message?.includes('already') || createError.message?.includes('registered')) {
          const { data: profile } = await adminClient
            .from('user_profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
          if (profile) userId = profile.id;
        }
        if (!userId) {
          console.error('Error creating user:', createError);
          return NextResponse.json(
            { success: false, message: createError.message },
            { status: 500 }
          );
        }
      } else if (newUserData?.user) {
        userId = newUserData.user.id;
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'Could not obtain or create user' },
        { status: 500 }
      );
    }

    // Upsert user profile
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          email,
          role: role as UserRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: 'id', ignoreDuplicates: false }
      );
    if (profileError) console.error('Error upserting user profile:', profileError);

    // Create invitation token (client_id null for admin invites)
    const invitationToken = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { error: tokenError } = await adminClient
      .from('invitation_tokens')
      .insert({
        token: invitationToken,
        user_id: userId,
        email,
        invited_by: authUser.id,
        client_id: null,
        role,
        expires_at: expiresAt.toISOString(),
        metadata: { role },
      });

    if (tokenError) {
      console.error('Error storing invitation token:', tokenError);
      return NextResponse.json(
        { success: false, message: 'Failed to create invitation token' },
        { status: 500 }
      );
    }

    const invitationUrl = `${ORIGIN}/api/auth/verify-invitation?token=${invitationToken}`;

    // Send email via SendGrid (app-sent, more reliable than Supabase emails)
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      console.error('SENDGRID_API_KEY not configured');
      return NextResponse.json(
        { success: false, message: 'Email service not configured. Please set SENDGRID_API_KEY.' },
        { status: 500 }
      );
    }

    const emailHtml = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Invitación a DC HUB</title></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f5f5f7;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f7; padding: 40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
<tr><td style="padding: 48px 32px; text-align: center; background: linear-gradient(135deg, #f0f9f4 0%, #ffffff 100%);">
<h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1E3A5F;">Has sido invitado a DC HUB</h1>
<p style="margin: 0; font-size: 17px; color: #86868b;">DC Concretos</p>
</td></tr>
<tr><td style="padding: 32px;">
<p style="margin: 0 0 24px 0; font-size: 17px; color: #1d1d1f; line-height: 1.6;">
Has sido invitado a unirte a <strong style="color: #00B050;">DC HUB</strong>, nuestra plataforma de gestión.
</p>
<p style="margin: 0 0 40px 0; font-size: 17px; color: #1d1d1f; line-height: 1.6;">
Haz clic en el botón para aceptar la invitación y configurar tu contraseña:
</p>
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding: 0 0 40px 0;">
<a href="${invitationUrl}" style="display: inline-block; background: #00B050; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 17px;">Aceptar invitación</a>
</td></tr></table>
<p style="margin: 0; font-size: 13px; color: #86868b; text-align: center;">
Si no solicitaste esta invitación, puedes ignorar este mensaje.
</p>
</td></tr>
<tr><td style="padding: 32px; text-align: center; background-color: #f5f5f7;">
<p style="margin: 0; font-size: 12px; color: #a1a1a6;">© 2025 DC Concretos</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;

    const sendgridResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: 'juan.aguirre@dssolutions-mx.com', name: 'DC Concretos' },
        subject: 'Invitación a DC HUB',
        content: [{ type: 'text/html', value: emailHtml }],
        tracking_settings: {
          click_tracking: { enable: false },
          open_tracking: { enable: true },
        },
      }),
    });

    if (!sendgridResponse.ok) {
      const errorText = await sendgridResponse.text();
      console.error('SendGrid error:', errorText);
      return NextResponse.json(
        { success: false, message: 'Failed to send invitation email' },
        { status: 500 }
      );
    }

    console.log('Admin invitation email sent via SendGrid', { userId, email, role });
    return NextResponse.json({
      success: true,
      message: 'Invitation sent successfully',
      user: { id: userId, email },
    });
  } catch (error) {
    console.error('Unexpected error in invite user endpoint:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error processing invitation',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
