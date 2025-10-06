'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// Import the singleton instance instead of the createClient function
import { supabase } from '@/lib/supabase';

// Component that uses useSearchParams
function AuthCallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Get role-based redirect target
  const getRedirectTarget = async (): Promise<string> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) return '/dashboard';

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userId)
        .single();

      const role = (profileData as any)?.role as string | undefined;

      switch (role) {
        case 'EXTERNAL_CLIENT':
          return '/client-portal';
        case 'QUALITY_TEAM':
          return '/quality/muestreos';
        case 'LABORATORY':
        case 'PLANT_MANAGER':
          return '/quality';
        default:
          return '/dashboard';
      }
    } catch (err) {
      console.error('Error getting redirect target:', err);
      return '/dashboard';
    }
  };

  // Handle auth callback processing
  const handleAuthCallback = useCallback(async () => {
    try {
      setLoading(true);

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
        console.log('Processing invitation tokens...');

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('Error setting session from tokens:', error);
          setError(`Error al establecer la sesión: ${error.message}`);
          return;
        }

        // Check if this is a new user (likely from invitation)
        const isNewUser = data.user?.created_at === data.user?.last_sign_in_at;

        if (isNewUser || type === 'invite' || type === 'signup') {
          console.log('New user detected, redirecting to update-password');
          router.push('/update-password');
        } else {
          const target = await getRedirectTarget();
          router.push(target);
        }
      }
      // Handle OAuth or magic link flow (code in URL)
      else if (code) {
        console.log('Processing OAuth code...');

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('Error exchanging code for session:', error);
          setError(`Error al procesar el código: ${error.message}`);
          return;
        }

        const target = await getRedirectTarget();
        router.push(target);
      }
      // No auth parameters found, check for existing session
      else {
        const { data: sessionData } = await supabase.auth.getSession();

        if (sessionData.session) {
          console.log('Found existing session');
          const target = await getRedirectTarget();
          router.push(target);
        } else {
          console.error('No auth parameters found and no session established');
          setError('No se encontraron parámetros de autenticación');
        }
      }
    } catch (err) {
      console.error('Unexpected error in auth callback:', err);
      setError('Error inesperado al procesar la autenticación');
    } finally {
      setLoading(false);
    }
  }, [router, searchParams]);

  // Initialize auth processing on mount
  useEffect(() => {
    handleAuthCallback();
  }, [handleAuthCallback]);

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
          
          {/* Add a direct manual link that's always visible */}
          <div className="mt-4">
            <a 
              href="/update-password"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Si la página no cambia, haz clic aquí para ir a configurar tu contraseña
            </a>
          </div>
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
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-xs text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-xs text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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