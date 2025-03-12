'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Import the singleton instance instead of the createClient function
import { supabase } from '@/lib/supabase/client';

// Component that uses useSearchParams
function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setLoading(true);
        console.log('Auth callback page loaded');
        
        // Use the singleton instance instead of creating a new one
        // const supabase = createClient();
        
        // Check for hash parameters (used in invitation flows)
        const hashParams = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
        );
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // Check for code in URL (used in OAuth and magic link flows)
        const code = searchParams.get('code');
        
        // Handle invitation flow (access_token in hash)
        if (accessToken && refreshToken) {
          console.log('Found tokens in URL hash, setting session in callback page');
          
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('Error setting session from tokens in callback:', error);
              setError(`Error al establecer la sesión: ${error.message}`);
              return;
            }
            
            console.log('Session set successfully in callback page', data.user?.email);
            
            // Redirect to update-password page for invitation flows
            if (type === 'invite' || type === 'signup') {
              console.log('Redirecting to update-password page');
              router.push('/update-password');
            } else {
              // For other auth flows, redirect to dashboard
              router.push('/dashboard');
            }
          } catch (err) {
            console.error('Exception setting session from tokens in callback:', err);
            setError('Error al procesar la autenticación');
          }
        }
        // Handle OAuth or magic link flow (code in URL)
        else if (code) {
          console.log('Found code in URL, exchanging for session');
          
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Error exchanging code for session:', error);
              setError(`Error al procesar el código: ${error.message}`);
              return;
            }
            
            console.log('Code exchanged for session successfully');
            
            // Get the session to check if it's a new user
            const { data: sessionData } = await supabase.auth.getSession();
            
            if (sessionData.session) {
              // Redirect to dashboard
              router.push('/dashboard');
            } else {
              // If no session, something went wrong
              setError('No se pudo establecer la sesión');
            }
          } catch (err) {
            console.error('Exception exchanging code:', err);
            setError('Error al procesar el código de autenticación');
          }
        } else {
          // No auth parameters found
          console.error('No auth parameters found in URL');
          setError('No se encontraron parámetros de autenticación en la URL');
        }
      } catch (err) {
        console.error('Unexpected error in auth callback:', err);
        setError('Error inesperado al procesar la autenticación');
      } finally {
        setLoading(false);
      }
    };
    
    handleCallback();
  }, [router, searchParams]);

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