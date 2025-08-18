import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// Use createMiddlewareClient from the auth-helpers package
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
// Avoid importing project-specific DB types in middleware to prevent module resolution issues

// Generate a random nonce for CSP using Web Crypto API
function generateNonce() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode.apply(null, Array.from(randomBytes)));
}

// Define a comprehensive CSP policy that allows Supabase to function
function getCSPHeader(nonce: string) {
  const policy = `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.io https://supabase.co https://supabase.io; frame-src 'self'; base-uri 'self'; form-action 'self';`;
  // console.log(`Generated CSP policy: ${policy.substring(0, 100)}...`); // Keep logging minimal unless debugging
  return policy;
}

// Removed sessionRefreshes map and MIN_REFRESH_INTERVAL as helper handles refresh

export async function middleware(request: NextRequest) {
  // Generate a nonce for CSP
  const nonce = generateNonce();
  // console.log(`Generated nonce for CSP: ${nonce.substring(0, 10)}...`);

  // Initialize response using NextResponse.next()
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });
  
  // Set CSP headers early
  const cspHeader = getCSPHeader(nonce);
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-CSP-Nonce', nonce); // Make nonce available if needed client-side

  // Create Supabase client configured for middleware
  const supabase = createMiddlewareClient({ req: request, res: response });

  // Extract pathname for logic
  const url = request.nextUrl.clone();
  const { pathname } = url;
  const clientIP = request.headers.get('x-forwarded-for') || 'unknown';

  // Logging for significant paths
  const isSignificantPath = 
    pathname === '/' || 
    pathname === '/dashboard' || 
    pathname === '/login' || 
    pathname.startsWith('/auth/');
    
  if (isSignificantPath) {
    console.log(`Middleware processing: ${pathname} from ${clientIP}`);
  }
  
  // Removed force_logout and force_refresh logic as it complicates standard auth flow
  // Handle logout via standard Supabase signOut on client-side

  // Check for invitation links (they have a hash with access_token)
  // Note: We can't access the hash directly in middleware, but we can check for the presence of '#' in the URL
  // Let Supabase client handle hash detection via detectSessionInUrl: true
  // const hasHash = request.url.includes('#');

  // Auth routes might still need specific handling (like CSP), but let Supabase manage session
  const isAuthRoute = 
    pathname.includes('/update-password') || 
    pathname.includes('/auth/callback') || 
    pathname.includes('/auth-check') ||
    pathname.includes('/login') || 
    pathname.includes('/register') || 
    pathname.includes('/reset-password');
    // Removed hasHash check here, rely on Supabase client

  if (isAuthRoute) {
    console.log(`Detected auth route: ${pathname}, CSP headers already set.`);
    // Allow auth routes to proceed, Supabase client will handle session logic
    // Return the response with CSP headers
    return response; 
  }

  // Refresh session if expired - handled automatically by auth-helpers
  // The getUser call below effectively refreshes the session and updates cookies in the response
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Log auth status for significant paths
  if (isSignificantPath) {
    console.log(`Auth status for ${pathname}:`, {
      authenticated: !!user,
      userEmail: user?.email || 'none',
      error: error?.message || 'none',
    });
  }
  
  if (error && error.status !== 401) {
    // Log unexpected errors
    console.error("Middleware auth error:", error.message);
  }

  // Define public routes - simplified based on guide
  const publicRoutes = [
    '/', 
    '/landing', // Assuming landing is public
    '/login', 
    '/register', 
    '/reset-password',
    '/update-password',
    '/auth-check', // Keep if used for specific checks
  ];
  
  const isPublicRoute = 
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/(landing)') || // Keep specific landing checks if needed
    pathname.includes('/landing/') ||
    pathname.startsWith('/_next') || 
    pathname.includes('.') || // Assume files with extensions are static assets
    pathname.startsWith('/images') || 
    pathname.startsWith('/fonts') || // Added fonts
    pathname.startsWith('/api/public') ||
    pathname.startsWith('/api/auth'); // Allow auth API routes

  // If not authenticated and trying to access a protected route
  if (!user && !isPublicRoute) {
    console.log(`Unauthenticated access attempt to protected route: ${pathname}`);
    
    const isApiRoute = pathname.startsWith('/api');
    
    if (isApiRoute) {
      // Return 401 for protected API routes
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    
    // Redirect non-API routes to login, preserving the intended destination
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname); // Add redirect param
    console.log(`Redirecting to login: ${redirectUrl.toString()}`);
    return NextResponse.redirect(redirectUrl);
  }

  // Determine user's default home based on role (Quality roles land on /quality)
  let defaultHome: string = '/dashboard';
  if (user) {
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const role = (profileData as any)?.role as string | undefined;
      if (role === 'QUALITY_TEAM') {
        defaultHome = '/quality/muestreos';
      } else if (role && ['LABORATORY', 'PLANT_MANAGER'].includes(role)) {
        defaultHome = '/quality';
      }
    } catch (err) {
      // On error, keep default to /dashboard
    }
  }

  // If authenticated and trying to access login/register pages, redirect to role-based home
  if (user && (pathname === '/login' || pathname === '/register')) {
    console.log(`Authenticated user accessing ${pathname}, redirecting to ${defaultHome}.`);
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = defaultHome;
    return NextResponse.redirect(redirectUrl);
  }

  // If authenticated user hits root '/', send them to their role-based home
  if (user && pathname === '/') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = defaultHome;
    return NextResponse.redirect(redirectUrl);
  }

  // Block QUALITY_TEAM from accessing non-quality sections and quality dashboard
  if (user && (!pathname.startsWith('/quality') || pathname === '/quality') && !pathname.startsWith('/profile') && !pathname.startsWith('/auth') && !isPublicRoute) {
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role, plant_id')
        .eq('id', user.id)
        .single();
      
      const role = (profileData as any)?.role as string | undefined;
      const plantId = (profileData as any)?.plant_id as string | undefined;
      
      // QUALITY_TEAM can only access quality module and profile/auth pages
      if (role === 'QUALITY_TEAM') {
        const restrictedPaths = [
          '/dashboard',
          '/prices',
          '/price-history',
          '/quotes',
          '/clients',
          '/orders',
          '/admin',
          '/finanzas',
          '/arkik',
          '/recipes' // top-level recipes, they have access via /quality/recipes
        ];
        
        const isRestrictedPath = restrictedPaths.some(path => 
          pathname === path || pathname.startsWith(path + '/')
        );
        
        if (isRestrictedPath || pathname === '/quality') {
          console.log(`Blocking QUALITY_TEAM user from accessing ${pathname}, redirecting to /quality/muestreos`);
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/quality/muestreos';
          return NextResponse.redirect(redirectUrl);
        }
      }
    } catch (err) {
      console.error('Error checking user role for restricted page access:', err);
    }
  }

  // Additional check for QUALITY_TEAM in restricted plants (P002, P003, P004)
  if (user && pathname.startsWith('/quality/') && (pathname.includes('/recipes') || pathname.includes('/suppliers') || pathname.includes('/reportes'))) {
    try {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role, plant_id')
        .eq('id', user.id)
        .single();
      
      const role = (profileData as any)?.role as string | undefined;
      const plantId = (profileData as any)?.plant_id as string | undefined;
      
      if (role === 'QUALITY_TEAM' && plantId) {
        // Get plant code to check if it's restricted
        const { data: plantData } = await supabase
          .from('plants')
          .select('code')
          .eq('id', plantId)
          .single();
        
        const plantCode = (plantData as any)?.code as string | undefined;
        const restrictedPlants = ['P2', 'P3', 'P4', 'P002', 'P003', 'P004']; // Support both formats
        
        if (plantCode && restrictedPlants.includes(plantCode)) {
          console.log(`Blocking QUALITY_TEAM user from plant ${plantCode} accessing ${pathname}, redirecting to /quality/muestreos`);
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/quality/muestreos';
          return NextResponse.redirect(redirectUrl);
        }
      }
    } catch (err) {
      console.error('Error checking plant restrictions for QUALITY_TEAM:', err);
    }
  }

  // Debug log for orders page access
  if (pathname.startsWith('/orders')) {
    console.log(`Middleware: User accessing orders page. User: ${user?.email}`);
    
    // Get user role if available
    if (user) {
      try {
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        console.log(`Middleware: User role for orders access: ${profileData?.role}`);
      } catch (err) {
        console.error('Error fetching user role in middleware:', err);
      }
    }
  }

  // Return the original response (with updated cookies/headers from Supabase client)
  return response;
}

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    /*
     * Match all routes including API routes, but exclude:
     * - Static files typically served directly
     * - _next system paths
     */
    '/((?!_next/static|_next/image|images|fonts|favicon.ico).*)',
  ],
}; 