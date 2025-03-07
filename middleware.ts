import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

export async function middleware(req: NextRequest) {
  // Create a response object
  const res = NextResponse.next();
  
  try {
    // Create a supabase middleware client
    const supabase = createMiddlewareClient({ req, res });
    
    // Check if the user is authenticated
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Middleware session error:", error.message);
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
    if (!session && !isPublicRoute) {
      console.log(`Unauthenticated access attempt to ${pathname}`);
      
      // For API routes, return 401 Unauthorized
      if (isApiRoute) {
        const errorRes = NextResponse.json(
          { error: 'Unauthorized - No session found' },
          { status: 401 }
        );
        
        // Copy cookies from res to errorRes to preserve authentication state
        res.cookies.getAll().forEach(cookie => {
          errorRes.cookies.set(cookie.name, cookie.value, cookie);
        });
        
        return errorRes;
      }
      
      // For other routes, redirect to login
      url.pathname = '/login';
      const redirectRes = NextResponse.redirect(url);
      
      // Copy cookies from res to redirectRes to preserve authentication state
      res.cookies.getAll().forEach(cookie => {
        redirectRes.cookies.set(cookie.name, cookie.value, cookie);
      });
      
      return redirectRes;
    }

    // If authenticated and trying to access login/register pages
    if (session && (pathname === '/login' || pathname === '/register')) {
      url.pathname = '/dashboard';
      const redirectRes = NextResponse.redirect(url);
      
      // Copy cookies from res to redirectRes to preserve authentication state
      res.cookies.getAll().forEach(cookie => {
        redirectRes.cookies.set(cookie.name, cookie.value, cookie);
      });
      
      return redirectRes;
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