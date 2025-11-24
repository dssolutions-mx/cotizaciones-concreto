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

      // Check for hash parameters (used in invitation and password recovery flows)
      const hashParams = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
      );
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      // Check for code in URL (used in OAuth, magic link, and password recovery flows)
      const code = searchParams.get('code');
      const recoveryType = searchParams.get('type'); // Check query param for recovery type

      // Handle invitation or password recovery flow (access_token in hash)
      if (accessToken && refreshToken) {
        console.log('Processing authentication tokens...', { type });

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('Error setting session from tokens:', error);
          setError(`Error al establecer la sesión: ${error.message}`);
          return;
        }

        // Check if this is a new user (likely from invitation) or password recovery
        const isNewUser = data.user?.created_at === data.user?.last_sign_in_at;
        const isRecoveryFlow = type === 'recovery' || recoveryType === 'recovery';

        // Both new users (invitations) and password recovery should go to update-password
        if (isNewUser || type === 'invite' || type === 'signup' || isRecoveryFlow) {
          console.log('Redirecting to update-password', { isNewUser, type, isRecoveryFlow });
          // Pass recovery type if it's a recovery flow
          const updatePasswordUrl = isRecoveryFlow 
            ? '/update-password?type=recovery'
            : '/update-password';
          router.push(updatePasswordUrl);
        } else {
          const target = await getRedirectTarget();
          router.push(target);
        }
      }
      // Handle OAuth, magic link, or password recovery flow (code in URL)
      else if (code) {
        console.log('Processing authentication code...', { recoveryType });

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error('Error exchanging code for session:', error);
          setError(`Error al procesar el código: ${error.message}`);
          return;
        }

        // Check if this is a password recovery flow
        const isRecoveryFlow = recoveryType === 'recovery';
        
        if (isRecoveryFlow) {
          console.log('Password recovery flow detected, redirecting to update-password');
          router.push('/update-password?type=recovery');
        } else {
          const target = await getRedirectTarget();
          router.push(target);
        }
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-primary p-4">
      <div className="w-full max-w-md p-8 space-y-8 glass-thick rounded-3xl border border-white/30 shadow-2xl">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-title-1 font-bold text-label-primary">Procesando autenticación</h1>
          <p className="mt-2 text-callout text-label-secondary">
            {loading ? 'Por favor espera mientras procesamos tu autenticación...' : 
              error ? 'Ocurrió un error al procesar la autenticación' : 
              'Redireccionando...'}
          </p>
          
          {/* Add a direct manual link that's always visible */}
          <div className="mt-4">
            <a 
              href="/update-password"
              className="text-callout font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Si la página no cambia, haz clic aquí para ir a configurar tu contraseña
            </a>
          </div>
        </div>
        
        {loading && (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {error && (
          <div className="p-4 glass-thin rounded-2xl border border-red-200/50 bg-red-50/50">
            <p className="text-callout text-red-700 font-medium mb-4">{error}</p>
            <div className="mt-4">
              <p className="text-footnote text-label-secondary mb-3">Intenta acceder manualmente a la página de configuración de contraseña:</p>
              <a 
                href="/update-password"
                className="inline-flex justify-center py-3 px-6 rounded-2xl text-callout font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg"
              >
                Ir a Configurar Contraseña
              </a>
            </div>
          </div>
        )}
        
        {!loading && !error && (
          <div className="mt-6 text-center">
            <p className="text-body text-label-secondary mb-4">
              Si no eres redirigido automáticamente, haz clic en el botón:
            </p>
            <a
              href="/update-password"
              className="inline-flex justify-center py-3 px-6 rounded-2xl text-callout font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg"
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-primary p-4">
      <div className="w-full max-w-md p-8 space-y-8 glass-thick rounded-3xl border border-white/30 shadow-2xl">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-title-1 font-bold text-label-primary">Procesando autenticación</h1>
          <p className="mt-2 text-callout text-label-secondary">
            Cargando...
          </p>
        </div>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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