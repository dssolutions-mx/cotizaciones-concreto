import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import crypto from 'crypto';

// Generate a random nonce for CSP
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

// Define a comprehensive CSP policy that allows Supabase to function
function getCSPHeader(nonce: string) {
  return `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.io https://supabase.co https://supabase.io; frame-src 'self'; base-uri 'self'; form-action 'self';`;
}

export async function middleware(request: NextRequest) {
  // Generate a nonce for CSP
  const nonce = generateNonce();
  
  // Initialize the response variable
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Check for invitation links (they have a hash with access_token)
  // Note: We can't access the hash directly in middleware, but we can check for the presence of '#' in the URL
  const hasHash = request.url.includes('#');
  
  // Check if this is an auth-related route
  const isAuthRoute = 
    request.url.includes('/update-password') || 
    request.url.includes('/auth/callback') || 
    request.url.includes('/auth-check') ||
    request.url.includes('/login') ||
    request.url.includes('/register') ||
    request.url.includes('/reset-password');
  
  const isInvitationLink = hasHash && isAuthRoute;
  
  // For auth routes, we want to add CSP headers
  if (isAuthRoute) {
    console.log('Detected auth route, adding CSP headers');
    // Create a response that adds necessary CSP headers
    const response = NextResponse.next();
    
    // Add Content-Security-Policy header that allows 'unsafe-eval' for Supabase auth to work
    response.headers.set('Content-Security-Policy', getCSPHeader(nonce));
    
    // Add the nonce to the request headers so it can be accessed by the page
    response.headers.set('X-CSP-Nonce', nonce);
    
    // For invitation links, we bypass auth checks
    if (isInvitationLink) {
      console.log('Detected invitation link in middleware, bypassing auth checks');
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

  // URL information
  const url = request.nextUrl.clone();
  const { pathname } = url;
  
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
    pathname.startsWith('/api/auth');
    
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
    url.pathname = '/login';
    const redirectResponse = NextResponse.redirect(url);
    
    // Copy cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    
    return redirectResponse;
  }

  // If authenticated and trying to access login/register pages
  if (user && (pathname === '/login' || pathname === '/register')) {
    url.pathname = '/dashboard';
    const redirectResponse = NextResponse.redirect(url);
    
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