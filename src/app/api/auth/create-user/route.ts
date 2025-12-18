import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkBotId } from 'botid/server';

export async function POST(request: NextRequest) {
  try {
    // Verify the request is not from a bot using BotID
    const verification = await checkBotId();
    if (verification.isBot) {
      return NextResponse.json(
        { error: 'Access denied: Bot detected' },
        { status: 403 }
      );
    }
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
    const { email: newUserEmail, password, firstName, lastName, role, callerId, callerEmail } = requestBody;
    
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
    if (!callerProfile || (callerProfile.role !== 'EXECUTIVE' && callerProfile.role !== 'ADMIN_OPERATIONS')) {
      console.error('User is not an executive:', callerProfile?.role);
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Validación básica
    if (!newUserEmail) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('Creating user with email:', newUserEmail, 'and role:', role);

    // Usar el servicio de administración para crear el usuario
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: newUserEmail,
      password: password || undefined,
      email_confirm: true,
      user_metadata: {
        first_name: firstName || null,
        last_name: lastName || null,
      }
    });

    if (adminError) {
      console.error('Error creating user:', adminError);
      return NextResponse.json(
        { error: adminError.message },
        { status: 400 }
      );
    }

    // Actualizar el perfil del usuario
    if (adminData.user) {
      console.log('User created, updating profile for user ID:', adminData.user.id);
      const { error: profileUpdateError } = await supabaseAdmin
        .from('user_profiles')
        .upsert({
          id: adminData.user.id,
          first_name: firstName || null,
          last_name: lastName || null,
          role: role || 'SALES_AGENT',
          email: newUserEmail,
          is_active: true
        });

      if (profileUpdateError) {
        console.error('Error updating user profile:', profileUpdateError);
        return NextResponse.json(
          { error: profileUpdateError.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true, user: adminData.user });
  } catch (error: unknown) {
    console.error('Error in create-user API route:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 