import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-password
 * Sends a password reset email via SendGrid with custom template
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      console.error('Missing Supabase configuration');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Try to generate recovery link - Supabase will handle invalid emails gracefully
    // We don't check if user exists first to prevent email enumeration attacks

    // Get origin URL - use dcconcretos-hub.com as default
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://dcconcretos-hub.com';

    // Generate password recovery link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Don't reveal if user exists or not (security best practice)
      // Return success even if link generation fails to prevent email enumeration
      console.log('Error generating recovery link (user may not exist):', linkError?.message);
      // Still return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
      });
    }

    const resetLink = linkData.properties.action_link;
    console.log('Recovery link generated successfully, sending email via SendGrid');

    // Custom email template
    const emailHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Restablecer Contraseña - DC HUB</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7; -webkit-font-smoothing: antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f7; padding: 40px 20px;">
<tr>
<td align="center">
<!-- Container principal -->
<table width="560" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08); max-width: 100%;">
<!-- Header -->
<tr>
<td style="padding: 48px 32px 32px; text-align: center; background: linear-gradient(135deg, #f0f9f4 0%, #ffffff 100%);">
<!-- Icono de seguridad -->
<table width="64" height="64" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 20px; background: linear-gradient(135deg, #1E3A5F 0%, #2B5278 100%); border-radius: 16px; box-shadow: 0 8px 16px rgba(30, 58, 95, 0.25);">
<tr>
<td align="center" valign="middle">
<img src="data:image/svg+xml,%3Csvg viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill='white' d='M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z'/%3E%3C/svg%3E" width="32" height="32" alt="Seguridad" style="display: block;" />
</td>
</tr>
</table>
<!-- Título -->
<h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 600; color: #1E3A5F; letter-spacing: -0.5px;">Restablecer contraseña</h1>
<p style="margin: 0; font-size: 17px; color: #86868b; font-weight: 400;">DC HUB</p>
</td>
</tr>
                    
<!-- Content -->
<tr>
<td style="padding: 32px;">
<!-- Mensaje 1 -->
<p style="margin: 0 0 24px 0; font-size: 17px; color: #1d1d1f; line-height: 1.6;">
Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong style="font-weight: 600; color: #00B050;">DC HUB</strong>.
</p>
                        
<!-- Mensaje 2 -->
<p style="margin: 0 0 40px 0; font-size: 17px; color: #1d1d1f; line-height: 1.6;">
Para establecer una nueva contraseña, haz clic en el siguiente botón:
</p>
                        
<!-- Botón -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" style="padding: 0 0 40px 0;">
<a href="${resetLink}" style="display: inline-block; background: #1E3A5F; color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 17px; letter-spacing: -0.2px; box-shadow: 0 4px 12px rgba(30, 58, 95, 0.3);">Restablecer contraseña</a>
</td>
</tr>
</table>
                        
<!-- Mensaje de expiración -->
<p style="margin: 0 0 32px 0; font-size: 15px; color: #86868b; text-align: center; line-height: 1.5;">
Este enlace expirará en 24 horas por seguridad.
</p>
                        
<!-- Nota de seguridad -->
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
<tr>
<td style="background-color: #f8f9fa; border-left: 4px solid #00B050; padding: 20px; border-radius: 8px;">
<p style="margin: 0 0 8px 0; font-size: 15px; color: #1E3A5F; font-weight: 600;">🔒 Nota de seguridad</p>
<p style="margin: 0; font-size: 14px; color: #5a5a5d; line-height: 1.5;">
Nunca compartimos tus datos personales y jamás te pediremos tu contraseña por correo electrónico. Si no solicitaste este cambio o recibes un correo sospechoso, por favor ignóralo y repórtalo a nuestro equipo.
</p>
</td>
</tr>
</table>
                        
<!-- Divider -->
<table width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="padding: 0 0 32px 0;">
<div style="height: 1px; background: linear-gradient(90deg, transparent, #d2d2d7, transparent);"></div>
</td>
</tr>
</table>
                        
<!-- Footer text -->
<p style="margin: 0; font-size: 13px; color: #86868b; line-height: 1.6; text-align: center;">
Si no solicitaste este cambio, tu cuenta permanece segura. Simplemente ignora este mensaje.
</p>
</td>
</tr>
                    
<!-- Footer -->
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
</html>
    `;

    // Send email via SendGrid
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    let emailSent = false;

    if (!sendgridApiKey) {
      console.error('SENDGRID_API_KEY not configured');
      return NextResponse.json(
        { error: 'Email service not configured. Please contact support.' },
        { status: 500 }
      );
    }

    try {
      console.log('Attempting to send password reset email via SendGrid to:', email);
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
          subject: 'Restablecer Contraseña - DC HUB',
          content: [{
            type: 'text/html',
            value: emailHtml,
          }],
          tracking_settings: {
            click_tracking: {
              enable: false, // Disable click tracking to prevent link wrapping
            },
            open_tracking: {
              enable: true, // Keep open tracking for analytics
            },
          },
        }),
      });

      if (!sendgridResponse.ok) {
        const errorText = await sendgridResponse.text();
        console.error('SendGrid API error response:', {
          status: sendgridResponse.status,
          statusText: sendgridResponse.statusText,
          error: errorText,
        });
        emailSent = false;
      } else {
        console.log('Password reset email sent successfully via SendGrid to:', email);
        emailSent = true;
      }
    } catch (sendgridError) {
      console.error('Exception sending password reset email via SendGrid:', sendgridError);
      emailSent = false;
    }

    // If SendGrid email failed, return error
    if (!emailSent) {
      console.error('Failed to send password reset email via SendGrid');
      return NextResponse.json(
        { error: 'Failed to send password reset email. Please try again later.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    console.error('Unexpected error in reset password API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
