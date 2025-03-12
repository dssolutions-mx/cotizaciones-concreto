/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { createBrowserClient } from '@supabase/ssr';
// Import the package.json as JSON
import ssrPackage from '@supabase/ssr/package.json';

export async function GET(request: NextRequest) {
  try {
    const environment = {
      nextVersion: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local',
      nodeVersion: process.version,
      supbasePackageVersion: ssrPackage.version,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // Get all cookie information
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieStore = await cookies();
    const allCookieEntries = cookieStore.getAll().map(c => [c.name, c.value?.substring(0, 20) + '...']);
    const allCookies = Object.fromEntries(allCookieEntries);
    
    // Extract Supabase-related cookies
    const supabaseCookies = Object.keys(allCookies).filter(name => 
      name.startsWith('sb-') || 
      name.includes('supabase') || 
      name.includes('auth')
    );

    // Try to get session using server component client
    let serverSessionResult: { 
      success: boolean; 
      error: string | null; 
      user: { 
        id: string;
        email: string | undefined;
        aud: string;
        created_at: string;
      } | null; 
    } = { success: false, error: null, user: null };
    
    try {
      const supabase = await createClient();
      
      // Try both getUser (secure) and getSession
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (userError) {
        console.error('Error from getUser():', userError);
      }
      
      if (sessionError) {
        console.error('Error from getSession():', sessionError);
      }
      
      if (user) {
        serverSessionResult = {
          success: true,
          error: null,
          user: {
            id: user.id,
            email: user.email,
            aud: user.app_metadata?.provider || 'unknown',
            created_at: user.created_at,
          }
        };
      } else if (session) {
        serverSessionResult = {
          success: true,
          error: 'Note: getUser() failed but getSession() succeeded - less secure',
          user: {
            id: session.user.id,
            email: session.user.email,
            aud: session.user.aud,
            created_at: session.user.created_at,
          }
        };
      } else {
        serverSessionResult = {
          success: false,
          error: userError ? userError.message : 'No authenticated user found',
          user: null
        };
      }
    } catch (error: unknown) {
      serverSessionResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting server session',
        user: null
      };
    }

    // Try to get the token expiry time
    const tokenExpiryInfo: Record<string, any> = {};
    const supabaseDomainCookie = Object.keys(allCookies).find(name => name.startsWith('sb-') && name.endsWith('-auth-token'));
    if (supabaseDomainCookie) {
      try {
        const cookieValue = cookieStore.get(supabaseDomainCookie)?.value || '';
        if (cookieValue.startsWith('base64-')) {
          const tokenParts = cookieValue.split('-')[1];
          const decodedData = Buffer.from(tokenParts, 'base64').toString();
          const sessionData = JSON.parse(decodedData);
          if (sessionData.expires_at) {
            const expiresAt = new Date(sessionData.expires_at * 1000);
            const now = new Date();
            Object.assign(tokenExpiryInfo, {
              expiresAt: expiresAt.toISOString(),
              now: now.toISOString(),
              isExpired: expiresAt < now,
              timeToExpiry: (expiresAt.getTime() - now.getTime()) / 1000 // seconds
            });
          }
        }
      } catch (error) {
        Object.assign(tokenExpiryInfo, { error: 'Failed to parse token expiry' });
      }
    }

    // Return comprehensive debug information
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment,
      cookies: {
        count: Object.keys(allCookies).length,
        cookieHeaderLength: cookieHeader.length,
        supabaseCookiesFound: supabaseCookies,
        allCookies,
      },
      serverSessionResult,
      tokenExpiryInfo,
      headers: {
        userAgent: request.headers.get('user-agent'),
        host: request.headers.get('host'),
        referer: request.headers.get('referer'),
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error in debug endpoint';
    const errorStack = error instanceof Error && process.env.NODE_ENV === 'development' ? error.stack : undefined;
    
    return NextResponse.json({
      error: errorMessage,
      stack: errorStack
    }, { status: 500 });
  }
} 