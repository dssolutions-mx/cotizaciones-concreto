import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkBotIdWithTimeout } from '@/lib/utils/botid-timeout';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // Verify the request is not from a bot using BotID (with timeout protection)
    try {
      const verification = await checkBotIdWithTimeout(5000); // 5 second timeout
      if (verification.isBot) {
        console.warn('BotID detected bot - blocking request');
        return NextResponse.json(
          { error: 'Access denied: Bot detected' },
          { status: 403 }
        );
      }
    } catch (botIdError) {
      // Log warning but allow request to proceed (graceful degradation for admin operations)
      // BotID failures should not block internal admin user creation
      const errorMessage = botIdError instanceof Error ? botIdError.message : 'Unknown BotID error';
      console.warn('BotID verification failed or timed out, allowing request to proceed:', errorMessage);
      // Continue with user creation - this is an internal admin operation
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
    const { email: newUserEmail, password, firstName, lastName, role } = requestBody;
    
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

    // Require a real authenticated session; never trust caller identity from request payload.
    const authClient = await createServerSupabaseClient();
    const { data: { user: authenticatedUser }, error: authError } = await authClient.auth.getUser();
    if (authError || !authenticatedUser) {
      return NextResponse.json(
        { error: 'Unauthorized - No authenticated user found.' },
        { status: 401 }
      );
    }
    const authenticatedUserId = authenticatedUser.id;

    // Look up the calling user's profile
    let callerProfile;
    const { data } = await supabaseAdmin
      .from('user_profiles')
      .select('role, email, id')
      .eq('id', authenticatedUserId)
      .single();
    callerProfile = data;
    
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