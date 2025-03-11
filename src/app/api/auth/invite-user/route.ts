import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Create a Supabase client with the URL and anon key from env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error - Missing required environment variables' },
        { status: 500 }
      );
    }

    // Get request body early to extract caller information if available
    const requestBody = await request.json();
    const { email: newUserEmail, role, callerId, callerEmail } = requestBody;
    
    // Create a Supabase admin client
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

    // First try the standard route handler approach
    let authenticatedUserId = null;
    let authenticatedUserEmail = null;
    
    try {
      const supabase = createRouteHandlerClient({ cookies });
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        authenticatedUserId = session.user.id;
        authenticatedUserEmail = session.user.email;
        console.log('Session found via createRouteHandlerClient:', authenticatedUserEmail);
      }
    } catch (sessionError) {
      console.error('Error retrieving session:', sessionError);
    }
    
    // If no session, try to get the user ID from the request body callerId/callerEmail
    if (!authenticatedUserId && (callerId || callerEmail)) {
      console.log('Using caller info from request body:', callerId || callerEmail);
      authenticatedUserId = callerId;
      authenticatedUserEmail = callerEmail;
    }
    
    // If we still don't have a user ID, check for it in query params
    if (!authenticatedUserId) {
      const url = new URL(request.url);
      const queryCallerId = url.searchParams.get('callerId');
      const queryCallerEmail = url.searchParams.get('callerEmail');
      
      if (queryCallerId || queryCallerEmail) {
        console.log('Using caller info from query params:', queryCallerId || queryCallerEmail);
        authenticatedUserId = queryCallerId;
        authenticatedUserEmail = queryCallerEmail;
      }
    }
    
    // If we don't have any user ID, we can't proceed
    if (!authenticatedUserId && !authenticatedUserEmail) {
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user found. Please provide callerId or callerEmail.' },
        { status: 401 }
      );
    }

    // Look up the calling user's profile
    let callerProfile;
    if (authenticatedUserId) {
      const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('role, email')
        .eq('id', authenticatedUserId)
        .single();
      callerProfile = data;
    } else if (authenticatedUserEmail) {
      const { data } = await supabaseAdmin
        .from('user_profiles')
        .select('role, email, id')
        .eq('email', authenticatedUserEmail)
        .single();
      callerProfile = data;
      if (callerProfile) {
        authenticatedUserId = callerProfile.id;
      }
    }
    
    // Check if user has EXECUTIVE role
    if (!callerProfile || callerProfile.role !== 'EXECUTIVE') {
      console.error('User is not an executive:', callerProfile?.role);
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validación básica
    if (!newUserEmail) {
      console.error('Invite user API: No email provided');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Validate role if provided
    if (role && !['QUALITY_TEAM', 'PLANT_MANAGER', 'SALES_AGENT', 'EXECUTIVE'].includes(role)) {
      console.error('Invite user API: Invalid role provided', { role });
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    console.log('Inviting user with email:', newUserEmail, 'and role:', role);

    // Crear usuario sin contraseña
    const { data: newUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: newUserEmail,
      password: undefined, // Sin contraseña para que necesite usar el link de reseteo
      email_confirm: true,
      user_metadata: {
        invited: true,
        invited_at: new Date().toISOString(),
      }
    });

    if (createUserError) {
      console.error('Error creating user for invitation:', {
        message: createUserError.message,
      });
      return NextResponse.json(
        { 
          error: 'User creation failed', 
          details: createUserError.message 
        },
        { status: 400 }
      );
    }

    // Actualizar el perfil del usuario con el rol asignado
    if (newUserData.user) {
      console.log('User created for invitation, updating profile for user ID:', newUserData.user.id);
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: newUserData.user.id,
          email: newUserEmail,
          role: role || 'SALES_AGENT',
          is_active: true
        });

      if (profileUpdateError) {
        console.error('Error updating profile for invited user:', profileUpdateError);
        return NextResponse.json(
          { error: profileUpdateError.message },
          { status: 400 }
        );
      }

      // Construir la URL de redirección
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://cotizaciones-concreto.vercel.app';
      console.log('Site URL from env:', process.env.NEXT_PUBLIC_SITE_URL);
      console.log('Using site URL:', siteUrl);
      
      // Make sure the URL is properly formatted with protocol
      const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`;
      const redirectTo = `${baseUrl}/update-password?source=invitation`;
      console.log('Reset password redirect URL:', redirectTo);

      // Enviar correo de restablecimiento de contraseña
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(newUserEmail, {
        redirectTo
      });

      if (resetError) {
        console.error('Error sending password reset email:', resetError);
        return NextResponse.json(
          { error: resetError.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation sent successfully', 
      user: newUserData.user 
    });
  } catch (error: unknown) {
    console.error('Error in invite-user API route:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 