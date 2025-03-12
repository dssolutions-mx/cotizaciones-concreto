import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase clients with the URL and anon key from env vars
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { 
          success: false,
          error: 'Server configuration error - Missing required environment variables',
          status: 'config-error'
        },
        { status: 500 }
      );
    }

    console.log('Environment variables:', {
      supabaseUrl: supabaseUrl.substring(0, 10) + '...',
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceRoleKey
    });

    // Get the raw cookie header
    const cookieHeader = request.headers.get('cookie') || '';
    console.log('Cookie header length:', cookieHeader.length);
    
    // Extract cookie names directly from the header
    const cookieNameRegex = /([^=]+)=/g;
    const allCookieNames: string[] = [];
    let match;
    while ((match = cookieNameRegex.exec(cookieHeader)) !== null) {
      allCookieNames.push(match[1].trim());
    }
    
    console.log('All cookie names from header:', allCookieNames);
    
    // Look for Supabase related cookies
    const supabaseCookies = allCookieNames.filter(name => 
      name.startsWith('sb-') || 
      name.includes('supabase') || 
      name.includes('auth')
    );
    console.log('Supabase related cookies:', supabaseCookies);

    // Try to get the userId and userEmail from query params if provided by client
    const url = new URL(request.url);
    const expectedUserId = url.searchParams.get('userId');
    const expectedEmail = url.searchParams.get('email');
    
    console.log('Expected user from client:', { expectedUserId, expectedEmail });

    // Use the more secure getUser method instead of getSession
    try {
      const supabase = await createClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Error from getUser():', userError);
      }
      
      if (user) {
        console.log('Successfully retrieved user:', user.email);
        
        // Check if the user matches the expected user if provided
        if (expectedUserId && user.id !== expectedUserId) {
          console.log(`User ID ${user.id} doesn't match expected ${expectedUserId}`);
        } else if (expectedEmail && user.email !== expectedEmail) {
          console.log(`User email ${user.email} doesn't match expected ${expectedEmail}`);
        } else {
          // Create a Supabase admin client for accessing the profiles
          const supabaseAdmin = createServiceClient();
          
          // Check if user profile exists
          const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, role, email, first_name, last_name')
            .eq('id', user.id)
            .maybeSingle();
            
          return NextResponse.json({
            success: true,
            session: {
              user: {
                id: user.id,
                email: user.email,
              }
            },
            profile: userProfile || null,
            profileExists: !!userProfile,
            profileError: profileError ? profileError.message : null,
            status: 'user-authenticated',
            method: 'auth-getUser',
          });
        }
      } else {
        console.log('No authenticated user found');
      }
    } catch (authError) {
      console.error('Error with authentication check:', authError);
    }

    // If we have expected user information, try to access the profile directly
    if (expectedUserId || expectedEmail) {
      try {
        const supabaseAdmin = createServiceClient();
        
        let query = supabaseAdmin.from('user_profiles').select('id, role, email, first_name, last_name');
        
        if (expectedUserId) {
          query = query.eq('id', expectedUserId);
        } else if (expectedEmail) {
          query = query.eq('email', expectedEmail);
        }
        
        const { data: userProfile, error: profileError } = await query.maybeSingle();
        
        if (userProfile && !profileError) {
          console.log('Found user profile directly:', userProfile.email);
          return NextResponse.json({
            success: true,
            session: {
              user: {
                id: userProfile.id,
                email: userProfile.email,
              }
            },
            profile: userProfile,
            profileExists: true,
            status: 'profile-only',
            method: 'direct-profile-query',
            note: 'Authentication check failed but profile found using provided user information'
          });
        }
      } catch (directProfileError) {
        console.error('Error querying profile directly:', directProfileError);
      }
    }

    // If we reach here, we couldn't find a valid session
    // Create a detailed debug response
    return NextResponse.json({
      success: false,
      error: 'No authenticated user found',
      status: 'auth-failed',
      debug: {
        cookieHeader: cookieHeader.substring(0, 100) + (cookieHeader.length > 100 ? '...' : ''),
        allCookies: allCookieNames,
        supabaseCookies,
        clientSideUserId: expectedUserId,
        clientSideEmail: expectedEmail,
        environment: {
          hasSupabaseUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey,
          hasServiceKey: !!supabaseServiceRoleKey,
        }
      },
      help: "The user appears to be logged in on the client side but not on the server. This may be due to: 1) Cookie settings preventing cookies from being sent to the API, 2) The browser not properly setting cookies, or 3) Auth configuration issues."
    });
    
  } catch (error: unknown) {
    console.error('Error in check-session API route:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      status: 'error',
    }, { status: 500 });
  }
} 