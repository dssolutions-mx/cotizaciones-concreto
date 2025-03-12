'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Import the singleton instance instead of the createClient function
import { supabase } from '@/lib/supabase';

// Component that uses useSearchParams
function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Add a useEffect to inject CSP meta tag
  useEffect(() => {
    // Inject CSP meta tag to allow unsafe-eval for Supabase auth
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.io https://supabase.co https://supabase.io; frame-src 'self'; base-uri 'self'; form-action 'self';";
    document.head.appendChild(meta);
    
    // Debug output to console
    console.log('Injected CSP meta tag in auth callback page');
    
    // Clean up on unmount
    return () => {
      try {
        document.head.removeChild(meta);
      } catch (err) {
        console.error('Error removing CSP meta tag:', err);
      }
    };
  }, []);

  // Check first if we already have a session, regardless of URL parameters
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        console.log('Checking for existing session in callback page');
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          console.log('Found existing session in callback, user:', data.session.user.email);
          // Check if this is a new user (likely from invitation)
          const isNewUser = data.session.user.created_at === data.session.user.last_sign_in_at;
          console.log('Is new user (likely from invitation):', isNewUser);
          
          if (isNewUser) {
            console.log('Redirecting new user to update-password');
            redirectToUpdatePassword();
          } else {
            console.log('Redirecting existing user to dashboard');
            redirectToDashboard();
          }
          
          return true; // Session found and handled
        } else {
          console.log('No existing session found in initial check');
          return false; // No session yet
        }
      } catch (err) {
        console.error('Error checking existing session:', err);
        return false;
      } finally {
        setSessionChecked(true);
      }
    };
    
    checkExistingSession();
  }, []);

  // Helper functions for redirection
  const redirectToUpdatePassword = () => {
    console.log('Executing redirect to update-password');
    
    // Add a visible link immediately for manual navigation
    const container = document.querySelector('.text-center');
    if (container) {
      const link = document.createElement('a');
      link.href = '/update-password';
      link.innerText = 'Click here to set your password';
      link.className = 'inline-flex justify-center mt-4 py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
      container.appendChild(link);
    }
    
    // Try multiple redirect approaches
    try {
      // Use Next.js router
      router.push('/update-password');
      
      // Use direct location change as fallback
      setTimeout(() => {
        window.location.href = '/update-password';
      }, 1000);
    } catch (err) {
      console.error('Error in redirect:', err);
      // Direct fallback
      window.location.href = '/update-password';
    }
  };
  
  const redirectToDashboard = () => {
    try {
      router.push('/dashboard');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1000);
    } catch (err) {
      console.error('Error in redirect:', err);
      window.location.href = '/dashboard';
    }
  };

  // Process URL parameters for authentication
  useEffect(() => {
    // Skip if we already handled a session in the first effect
    if (!sessionChecked) {
      console.log('Waiting for session check to complete before processing URL params');
      return;
    }
    
    const handleCallback = async () => {
      try {
        setLoading(true);
        console.log('Processing URL parameters for authentication...');
        
        // Check for hash parameters (used in invitation flows)
        const hashParams = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
        );
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // Check for code in URL (used in OAuth and magic link flows)
        const code = searchParams.get('code');
        
        // Log what we found for debugging
        console.log('Auth parameters found:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken, 
          type: type || 'none',
          hasCode: !!code 
        });
        
        // Handle invitation flow (access_token in hash)
        if (accessToken && refreshToken) {
          console.log('Processing tokens from URL hash...');
          
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('Error setting session from tokens:', error);
              setError(`Error al establecer la sesión: ${error.message}`);
              return;
            }
            
            console.log('Session set successfully from tokens', data.user?.email);
            
            // For invitation flows, redirect to update-password
            if (type === 'invite' || type === 'signup') {
              redirectToUpdatePassword();
            } else {
              redirectToDashboard();
            }
          } catch (err) {
            console.error('Exception setting session from tokens:', err);
            setError('Error al procesar la autenticación');
          }
        }
        // Handle OAuth or magic link flow (code in URL)
        else if (code) {
          console.log('Processing code from URL...');
          
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Error exchanging code for session:', error);
              setError(`Error al procesar el código: ${error.message}`);
              return;
            }
            
            console.log('Code exchanged for session successfully');
            
            // Check session after exchange
            const { data: sessionData } = await supabase.auth.getSession();
            
            if (sessionData?.session) {
              redirectToDashboard();
            } else {
              setError('No se pudo establecer la sesión');
            }
          } catch (err) {
            console.error('Exception exchanging code:', err);
            setError('Error al procesar el código de autenticación');
          }
        } else {
          // Check one more time for a session that might have been established
          const { data } = await supabase.auth.getSession();
          
          if (data.session) {
            console.log('Found session in final check', data.session.user.email);
            
            // Check if this appears to be a new user (likely from invitation)
            const isNewUser = data.session.user.created_at === data.session.user.last_sign_in_at;
            console.log('Is new user (final check):', isNewUser);
            
            if (isNewUser) {
              redirectToUpdatePassword();
            } else {
              redirectToDashboard();
            }
          } else {
            console.error('No auth parameters found in URL and no session established');
            setError('No se encontraron parámetros de autenticación en la URL');
          }
        }
      } catch (err) {
        console.error('Unexpected error in auth callback:', err);
        setError('Error inesperado al procesar la autenticación');
      } finally {
        setLoading(false);
      }
    };
    
    handleCallback();
  }, [router, searchParams, sessionChecked]);

  // Set up a fallback timer to ensure redirect happens
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      console.log('Fallback timer triggered - checking session one more time');
      
      // One last check for session
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          console.log('Session found in fallback timer', data.session.user.email);
          
          // If we have a session but page still showing, force redirect
          redirectToUpdatePassword();
        } else {
          console.log('No session in fallback timer');
          setLoading(false);
        }
      });
    }, 5000);
    
    return () => clearTimeout(fallbackTimer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Procesando autenticación</h1>
          <p className="mt-2 text-sm text-gray-600">
            {loading ? 'Por favor espera mientras procesamos tu autenticación...' : 
              error ? 'Ocurrió un error al procesar la autenticación' : 
              'Redireccionando...'}
          </p>
        </div>
        
        {loading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        )}
        
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Intenta acceder manualmente a la página de configuración de contraseña:</p>
              <a 
                href="/update-password"
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Ir a Configurar Contraseña
              </a>
            </div>
          </div>
        )}
        
        {!loading && !error && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-4">
              Si no eres redirigido automáticamente, haz clic en el botón:
            </p>
            <a
              href="/update-password"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Continuar a Configurar Contraseña
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback component
function AuthCallbackLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Procesando autenticación</h1>
          <p className="mt-2 text-sm text-gray-600">
            Cargando...
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackLoading />}>
      <AuthCallbackHandler />
    </Suspense>
  );
} 