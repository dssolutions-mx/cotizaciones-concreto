import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      // Redirect to login with error message
      const origin = process.env.NEXT_PUBLIC_APP_URL || 
        (typeof request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://cotizaciones-concreto.vercel.app');
      return NextResponse.redirect(
        `${origin}/login?error=missing_token`
      );
    }

    // Create admin client to verify token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Look up token in database
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('invitation_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      console.error('Invalid invitation token:', tokenError);
      const origin = process.env.NEXT_PUBLIC_APP_URL || 
        (typeof request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://cotizaciones-concreto.vercel.app');
      return NextResponse.redirect(
        `${origin}/login?error=invalid_token`
      );
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      console.error('Expired invitation token');
      const origin = process.env.NEXT_PUBLIC_APP_URL || 
        (typeof request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://cotizaciones-concreto.vercel.app');
      return NextResponse.redirect(
        `${origin}/login?error=expired_token`
      );
    }

    // Check if token was already used
    if (tokenRecord.used_at) {
      console.error('Token already used');
      const origin = process.env.NEXT_PUBLIC_APP_URL || 
        (typeof request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://cotizaciones-concreto.vercel.app');
      return NextResponse.redirect(
        `${origin}/login?error=token_already_used`
      );
    }

    // Get user from auth.users
    const { data: authUser, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      tokenRecord.user_id
    );

    if (userError || !authUser?.user) {
      console.error('User not found for token:', userError);
      const origin = process.env.NEXT_PUBLIC_APP_URL || 
        (typeof request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://cotizaciones-concreto.vercel.app');
      return NextResponse.redirect(
        `${origin}/login?error=user_not_found`
      );
    }

    // Generate a magic link for the user to establish session
    // This creates a one-time link that establishes the session when clicked
    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://dcconcretos-hub.com';
    
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email!,
      options: {
        redirectTo: `${origin}/update-password?type=invite`,
      },
    });

    if (linkError || !linkData) {
      console.error('Error generating magic link:', linkError);
      // If magic link generation fails, we can't establish session automatically
      // Redirect to update-password with error message
      return NextResponse.redirect(
        `${origin}/update-password?type=invite&error=session_failed&invitation_token=${token}`
      );
    }

    // Mark token as used (before redirecting, so if user refreshes they get an error)
    await supabaseAdmin
      .from('invitation_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // Redirect to the magic link
    // The magic link will establish the session and redirect to update-password
    const magicLinkUrl = linkData.properties.action_link;
    return NextResponse.redirect(magicLinkUrl);

  } catch (error) {
    console.error('Error verifying invitation token:', error);
    const origin = process.env.NEXT_PUBLIC_APP_URL || 
      (typeof request.headers.get('host') ? `https://${request.headers.get('host')}` : 'https://cotizaciones-concreto.vercel.app');
    return NextResponse.redirect(
      `${origin}/login?error=verification_failed`
    );
  }
}
