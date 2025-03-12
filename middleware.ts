import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export async function middleware(request: NextRequest) {
  // Check for invitation links (they have a hash with access_token)
  // Note: We can't access the hash directly in middleware, but we can check for the presence of '#' in the URL
  const hasHash = request.url.includes('#');
  const isInvitationLink = hasHash && 
    (request.url.includes('/update-password') || 
     request.url.includes('/auth/callback') || 
     request.url.includes('/auth-check'));
  
  // For invitation links, we want to bypass normal auth checks
  if (isInvitationLink) {
    console.log('Detected invitation link in middleware, bypassing auth checks');
    // Just pass through without auth checks for invitation links
    return NextResponse.next();
  }
  
  // Normal auth flow for non-invitation links
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // First set cookies on the request object
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          
          // Create a new response with the updated request
          supabaseResponse = NextResponse.next({
            request,
          });
          
          // Then set cookies on the response with full options
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
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