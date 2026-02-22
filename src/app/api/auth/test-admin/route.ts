/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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

    // Try using the createRouteHandlerClient approach first
    try {
      const supabase = createRouteHandlerClient({ cookies });
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error from getSession():', sessionError);
      }
      
      if (session) {
        console.log('Successfully retrieved session from createRouteHandlerClient:', session.user.email);
        
        // Check if the session matches the expected user if provided
        if (expectedUserId && session.user.id !== expectedUserId) {
          console.log(`Session user ID ${session.user.id} doesn't match expected ${expectedUserId}`);
        } else if (expectedEmail && session.user.email !== expectedEmail) {
          console.log(`Session email ${session.user.email} doesn't match expected ${expectedEmail}`);
        } else {
          // Create a Supabase admin client for accessing the profiles
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
          
          // Check if user profile exists
          const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, role, email, first_name, last_name')
            .eq('id', session.user.id)
            .maybeSingle();
            
          // Get all users to test admin permissions
          const { data: allUsers, error: usersError } = await supabaseAdmin
            .from('user_profiles')
            .select('id, email, role, first_name, last_name')
            .limit(10);

          if (usersError) {
            console.error('Error fetching users:', usersError);
            return NextResponse.json({
              success: false,
              error: 'Error fetching users',
              status: 'users-error',
              debug: { error: usersError }
            }, { status: 500 });
          }
            
          return NextResponse.json({
            success: true,
            currentUser: {
              id: session.user.id,
              email: session.user.email,
              role: userProfile?.role || session.user.user_metadata?.role || 'unknown',
              metadata: session.user.user_metadata
            },
            profile: userProfile || null,
            profileExists: !!userProfile,
            users: allUsers,
            status: 'session-active',
            method: 'route-handler-client',
          });
        }
      } else {
        console.log('No session found from createRouteHandlerClient');
      }
    } catch (routeHandlerError) {
      console.error('Error with route handler client approach:', routeHandlerError);
    }

    // Never query profiles from caller-provided identifiers when unauthenticated.

    // Try to find auth cookies using regex
    const authCookieMatches = Array.from(
      cookieHeader.matchAll(/sb-([a-zA-Z0-9_-]+)-auth-token/g) || []
    ).map(match => match[0]);

    console.log(`Found ${authCookieMatches.length} auth cookies via regex`);
    
    if (authCookieMatches.length > 0) {
      // Process auth cookies...
      // [This part of the code remains the same as before]
      // [Omitted for brevity]
    }

    // If we reach here, we couldn't find a valid session
    // Create a detailed debug response
    return NextResponse.json({
      success: false,
      error: 'No auth cookie found',
      status: 'no-auth-cookie',
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
        },
      },
      help: "The session appears to be active on the client side but not on the server. This may be due to: 1) Cookie settings preventing cookies from being sent to the API, 2) The browser not properly setting cookies, or 3) Auth configuration issues."
    });
  } catch (error: unknown) {
    console.error('Error in test-admin API route:', error);
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