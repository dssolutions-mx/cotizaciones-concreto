'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useSearchParams } from 'next/navigation';

// Helper function to log debug information
function debugLog(message: string, data: unknown = null) {
  console.log(`[DEBUG] ${message}`, data || '');
}

// Create a client component that uses useSearchParams
function UpdatePasswordForm() {
  const searchParams = useSearchParams();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [invitationFlow, setInvitationFlow] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Effect to handle countdown and redirect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (countdown !== null) {
      debugLog(`Countdown: ${countdown}`);
      
      if (countdown <= 0) {
        debugLog('Countdown complete, redirecting to login');
        // Handle sign out if needed
        try {
          supabase.auth.signOut({ scope: 'global' }).then(() => {
            debugLog('User signed out during redirect');
            window.location.href = `/login?updated=true&t=${Date.now()}`;
          });
        } catch (e) {
          debugLog('Error during signout, forcing redirect', e);
          window.location.href = `/login?updated=true&t=${Date.now()}`;
        }
        return;
      }
      
      timer = setTimeout(() => {
        setCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  // Extract authentication data and set up auth listener on mount
  useEffect(() => {
    let authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;
    
    const setupAuth = async () => {
      try {
        setLoading(true);
        debugLog("Setting up authentication");
        
        // Set up auth change listener first
        authSubscription = supabase.auth.onAuthStateChange(async (event, session) => {
          debugLog(`Auth event detected: ${event}`, {
            sessionExists: !!session,
            email: session?.user?.email,
            userId: session?.user?.id
          });
          
          if (event === 'USER_UPDATED') {
            debugLog('Password update detected through auth event');
            setMessage("La contraseña se ha actualizado correctamente. Serás redirigido a la página de inicio de sesión.");
            setPassword('');
            setConfirmPassword('');
            setLoading(false);
            setCountdown(5);
          }
          
          // Set auth ready for these events
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY' || event === 'INITIAL_SESSION') {
            setAuthReady(true);
            setLoading(false);
            
            if (session?.user?.email) {
              setInviteEmail(session.user.email);
              setInvitationFlow(true);
            }
          }
        });
        
        // Check current session
        const { data: currentSession } = await supabase.auth.getSession();
        
        if (currentSession?.session) {
          debugLog("Found existing session", {
            email: currentSession.session.user.email,
            id: currentSession.session.user.id
          });
          
          if (currentSession.session.user.email) {
            setInviteEmail(currentSession.session.user.email);
            setInvitationFlow(true);
          }
          
          setAuthReady(true);
          setLoading(false);
        } else {
          // Try to extract auth data from URL
          const hashString = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hashString);
          const code = searchParams.get('code');
          const type = searchParams.get('type');
          
          if (type === 'invite' || type === 'signup') {
            setInvitationFlow(true);
          }
          
          // Check for tokens in URL hash
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            debugLog("Setting session from URL tokens");
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            setAuthReady(true);
          }
          // Check for recovery code
          else if (code) {
            debugLog("Exchanging code for session");
            await supabase.auth.exchangeCodeForSession(code);
            setAuthReady(true);
          }
          else {
            debugLog("No auth data found");
            setError("No se encontró información de autenticación válida.");
            setAuthReady(true);
          }
        }
        
        setLoading(false);
      } catch (err) {
        debugLog("Error setting up auth", err);
        setError("Error al procesar la autenticación");
        setAuthReady(true);
        setLoading(false);
      }
    };
    
    // Set up a timeout to ensure we don't get stuck
    const fallbackTimer = setTimeout(() => {
      debugLog('Fallback timeout triggered - forcing authReady state');
      setAuthReady(true);
      setLoading(false);
    }, 5000);
    
    setupAuth();
    
    // Cleanup function
    return () => {
      clearTimeout(fallbackTimer);
      if (authSubscription) {
        authSubscription.data.subscription.unsubscribe();
      }
    };
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    debugLog("Password update form submitted");
    setMessage(null);
    setError(null);
    
    // Validate passwords
    if (password !== confirmPassword) {
      debugLog("Password validation failed - passwords don't match");
      setError("Las contraseñas no coinciden");
      return;
    }
    
    if (password.length < 8) {
      debugLog("Password validation failed - password too short");
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    
    debugLog("Password validation passed, proceeding with update");
    setLoading(true);
    
    let fallbackTimer: NodeJS.Timeout;
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const hashString = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hashString);
      const accessToken = hashParams.get('access_token');
      
      debugLog("Current auth state", {
        hasSession: !!sessionData?.session,
        hasAccessToken: !!accessToken,
        sessionUserId: sessionData?.session?.user?.id,
        sessionEmail: sessionData?.session?.user?.email
      });

      let userId = sessionData?.session?.user?.id;

      // If we have an access token in the URL (password reset flow)
      if (accessToken) {
        debugLog("Using access token from URL for password update");
        const sessionResult = await supabase.auth.setSession({ 
          access_token: accessToken, 
          refresh_token: '' 
        });
        
        if (sessionResult.error) {
          debugLog("Error setting session from access token", sessionResult.error);
          setError(`Error al establecer la sesión: ${sessionResult.error.message}`);
          setLoading(false);
          return;
        }

        userId = sessionResult.data.user?.id;
      }

      if (!userId) {
        debugLog("No user ID found for password update");
        setError("No se pudo identificar el usuario para actualizar la contraseña.");
        setLoading(false);
        return;
      }

      // Call our API endpoint to update the password
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password,
          userId
        })
      });

      const result = await response.json();

      if (!response.ok) {
        debugLog("Error from password update API", result);
        setError(result.error || 'Error al actualizar la contraseña');
        setLoading(false);
        return;
      }
      
      debugLog("Password update API call completed successfully", result);
      
      // Show success message and start countdown
      setMessage("La contraseña se ha actualizado correctamente. Serás redirigido a la página de inicio de sesión.");
      setPassword('');
      setConfirmPassword('');
      setLoading(false);
      setCountdown(5);
      
    } catch (err) {
      debugLog("Error during password update process", err);
      setError("Ocurrió un error al actualizar la contraseña");
      setLoading(false);
    }
  };

  // Show loading state while authentication data is being processed
  if (!authReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">Verificando sesión</h1>
            <p className="mt-2 text-sm text-gray-600">
              Por favor espera mientras verificamos tu sesión...
            </p>
          </div>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            {invitationFlow ? 'Configura tu Contraseña' : 'Actualizar Contraseña'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {invitationFlow 
              ? 'Crea una contraseña para acceder a tu cuenta' 
              : 'Crea una nueva contraseña para tu cuenta'}
          </p>
          {inviteEmail && (
            <p className="mt-2 text-sm font-medium text-indigo-600">
              {inviteEmail}
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {message && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
            <p>{message}</p>
            {countdown !== null && (
              <p className="mt-2 font-medium">
                Redirigiendo en {countdown} segundo{countdown !== 1 ? 's' : ''}...
              </p>
            )}
            <div className="mt-4 text-center">
              <Link
                href="/login"
                className="inline-block px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Ir a Iniciar Sesión Ahora
              </Link>
            </div>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Nueva Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirmar Contraseña
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md 
                         shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 
                         focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
                         disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Volver a Iniciar Sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// Create a loading fallback component
function UpdatePasswordLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Cargando</h1>
          <p className="mt-2 text-sm text-gray-600">
            Por favor espera un momento...
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
export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={<UpdatePasswordLoading />}>
      <UpdatePasswordForm />
    </Suspense>
  );
} 