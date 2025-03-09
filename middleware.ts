import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddleware } from './src/lib/supabase/server';

export async function middleware(req: NextRequest) {
  // Create a response object
  const res = NextResponse.next();
  
  try {
    // Create a Supabase client for the middleware
    const supabase = createMiddleware(req, res);
    
    // Get authenticated user - this is more secure than getSession
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Middleware auth error:", error.message);
    }

    // URL information
    const url = req.nextUrl.clone();
    const { pathname } = url;

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

    // Check if this is an API route
    const isApiRoute = pathname.startsWith('/api') && !pathname.startsWith('/api/public') && !pathname.startsWith('/api/auth');

    // If not authenticated and trying to access a protected route (including API routes)
    if (!user && !isPublicRoute) {
      console.log(`Unauthenticated access attempt to ${pathname}`);
      
      // For API routes, return 401 Unauthorized
      if (isApiRoute) {
        return NextResponse.json(
          { error: 'Unauthorized - No user found' },
          { status: 401 }
        );
      }
      
      // For other routes, redirect to login
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // If authenticated and trying to access login/register pages
    if (user && (pathname === '/login' || pathname === '/register')) {
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }

    return res;
  } catch (error) {
    console.error("Middleware error:", error);
    return res;
  }
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