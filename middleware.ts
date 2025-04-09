import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Generate a random nonce for CSP using Web Crypto API
function generateNonce() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode.apply(null, Array.from(randomBytes)));
}

// Define a comprehensive CSP policy that allows Supabase to function
function getCSPHeader(nonce: string) {
  const policy = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.io https://supabase.co https://supabase.io; frame-src 'self'; base-uri 'self'; form-action 'self';`;
  console.log(`Generated CSP policy: ${policy.substring(0, 100)}...`);
  return policy;
}

export async function middleware(request: NextRequest) {
  // Generate a nonce for CSP
  const nonce = generateNonce();
  console.log(`Generated nonce for CSP: ${nonce.substring(0, 10)}...`);
  
  // Initialize the response variable
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Extract pathname for clearer debugging
  const url = request.nextUrl.clone();
  const { pathname } = url;
  
  // Extract query params for better control over auth flow
  const searchParams = url.searchParams;
  
  // Check if this is a force logout situation
  const isForceLogout = searchParams.get('force_logout') === 'true';
  // Check for timestamp parameter - this indicates a hard redirect from password update
  const hasTimestamp = !!searchParams.get('t');
  const isForceLogoutWithTimestamp = isForceLogout && hasTimestamp;
  
  if (isForceLogout) {
    console.log('Detected force_logout in middleware - bypassing auth checks and clearing session cookies');
    if (isForceLogoutWithTimestamp) {
      console.log('Detected timestamp parameter - this is a hard redirect logout, being more aggressive');
    }
    
    // Create a response that adds CSP headers and clears auth cookies
    const response = NextResponse.next({
      request,
    });
    
    // Add CSP headers
    const nonce = generateNonce();
    const cspHeader = getCSPHeader(nonce);
    response.headers.set('Content-Security-Policy', cspHeader);
    response.headers.set('X-CSP-Nonce', nonce);
    
    // Attempt to clear auth cookies by setting them to expire
    try {
      // Clear all possible Supabase auth cookies (expanded and more comprehensive list)
      const cookieNames = [
        // Standard Supabase cookie names
        'sb-access-token', 
        'sb-refresh-token',
        'supabase-auth-token',
        '__session',
        'sb-auth-token',
        
        // Project-specific variations (using project ref patterns)
        'sb:*:auth-token',
        'sb-*-auth-token',
        
        // Legacy and alternative formats
        'supabase.auth.token',
        'sb-provider-token',
        'sb-token-type',
        'sb-expires-at',
        
        // Session-related cookies
        'sb-session',
        'sb-*-session',
        '__supabase_session',
        
        // Generic auth cookies that might be used
        'auth-token',
        'auth-refresh-token',
        'auth-session',
        'auth',
        'token',
        'session'
      ];
      
      // First get all current cookies to check for any auth-related ones
      const allCookies = request.cookies.getAll();
      
      // Process all cookies that might be related to auth
      allCookies.forEach(cookie => {
        const name = cookie.name.toLowerCase();
        if (name.includes('auth') || 
            name.includes('token') || 
            name.includes('session') || 
            name.includes('supabase') || 
            name.includes('sb-')) {
          console.log(`Clearing detected auth cookie: ${cookie.name}`);
          response.cookies.set({
            name: cookie.name,
            value: '',
            expires: new Date(0),
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true
          });
        }
      });
      
      // Also explicitly try all the known cookie names
      cookieNames.forEach(name => {
        response.cookies.set({
          name,
          value: '',
          expires: new Date(0),
          path: '/',
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true
        });
      });
      
      console.log('Cleared auth cookies in middleware for force_logout');
    } catch (clearError) {
      console.error('Error clearing cookies in middleware:', clearError);
    }
    
    // For hard redirects with timestamp, add a special header to indicate to the client
    // that this request has had cookies fully cleared
    if (isForceLogoutWithTimestamp) {
      response.headers.set('X-Auth-Cookies-Cleared', 'true');
    }
    
    return response;
  }
  
  // Check for invitation links (they have a hash with access_token)
  // Note: We can't access the hash directly in middleware, but we can check for the presence of '#' in the URL
  const hasHash = request.url.includes('#');
  
  // Check if this is an auth-related route - be very inclusive to catch all auth scenarios
  const isAuthRoute = 
    pathname.includes('/update-password') || 
    pathname.includes('/auth/callback') || 
    pathname.includes('/auth-check') ||
    pathname.includes('/login') || 
    pathname.includes('/register') || 
    pathname.includes('/reset-password') ||
    hasHash; // Consider any URL with a hash as potentially an auth route
  
  const isInvitationLink = hasHash;
  
  // For auth routes, we want to add CSP headers
  if (isAuthRoute) {
    console.log(`Detected auth route: ${pathname}, adding CSP headers`);
    // Create a response that adds necessary CSP headers
    const response = NextResponse.next({
      request,
    });
    
    // Add Content-Security-Policy header that allows 'unsafe-eval' for Supabase auth to work
    const cspHeader = getCSPHeader(nonce);
    response.headers.set('Content-Security-Policy', cspHeader);
    
    // Add the nonce to the request headers so it can be accessed by the page
    response.headers.set('X-CSP-Nonce', nonce);
    
    // For invitation links, we bypass auth checks
    if (isInvitationLink) {
      console.log(`Detected invitation link in middleware, bypassing auth checks for: ${pathname}`);
      return response;
    }
    
    // For other auth routes, we continue with the response that has CSP headers
    // but still perform auth checks below
    supabaseResponse = response;
  }
  
  // Normal auth flow for non-invitation links
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Middleware auth error:", error.message);
  }

  // Log request details for debugging
  console.log(`Middleware processing: ${pathname}`, {
    authenticated: !!user,
    userEmail: user?.email || 'none',
    hasHash: hasHash,
    isInvitationLink: isInvitationLink
  });

  // Define public routes that don't require authentication
  // Rutas que son accesibles sin autenticación
  const isPublicRoute = 
    pathname === '/' || 
    pathname === '/landing' ||
    pathname.startsWith('/(landing)') ||
    pathname.includes('/landing/') ||
    pathname === '/login' || 
    pathname === '/register' || 
    pathname === '/reset-password' ||
    pathname === '/update-password' ||
    pathname === '/auth-check' ||  // Add auth-check route as public for testing
    pathname.startsWith('/_next') || 
    pathname.includes('.') || 
    pathname.startsWith('/images') || 
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/auth') ||
    isForceLogout; // Consider any URL with force_logout=true as public
    
  // If not authenticated and trying to access a protected route (including API routes)
  if (!user && !isPublicRoute) {
    console.log(`Unauthenticated access attempt to ${pathname}`);
    
    // Check if this is an API route
    const isApiRoute = pathname.startsWith('/api') && !pathname.startsWith('/api/public') && !pathname.startsWith('/api/auth');
    
    // For API routes, return 401 Unauthorized
    if (isApiRoute) {
      const apiResponse = NextResponse.json(
        { error: 'Unauthorized - No user found' },
        { status: 401 }
      );
      
      // Copy cookies from supabaseResponse to apiResponse
      supabaseResponse.cookies.getAll().forEach(cookie => {
        apiResponse.cookies.set(cookie.name, cookie.value, cookie);
      });
      
      return apiResponse;
    }
    
    // For other routes, redirect to login
    const loginUrl = url.clone();
    loginUrl.pathname = '/login';
    const redirectResponse = NextResponse.redirect(loginUrl);
    
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return redirectResponse;
  }

  // If authenticated and trying to access login/register pages
  if (user && (pathname === '/login' || pathname === '/register')) {
    // Skip the redirect if this is a force logout request
    if (isForceLogout) {
      console.log('Detected force_logout, allowing access to login page even though user is authenticated');
      return supabaseResponse;
    }
    
    const dashboardUrl = url.clone();
    dashboardUrl.pathname = '/dashboard';
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return redirectResponse;
  }

  return supabaseResponse;
}

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all routes including API routes, but exclude:
     * - Static files
     * - _next system paths
     */
    '/((?!_next/static|_next/image|images|fonts|favicon.ico).*)',
  ],
}; 