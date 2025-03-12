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
  const [invitationFlow, setInvitationFlow] = useState(false); // Track if we're in an invitation flow
  const [inviteEmail, setInviteEmail] = useState<string | null>(null); // Store the email from invitation
  const [authListenerSetUp, setAuthListenerSetUp] = useState(false);
  const [passwordUpdateAttempted, setPasswordUpdateAttempted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // CRITICAL: Add a timeout to ensure users don't get stuck on loading screen
  useEffect(() => {
    if (authReady) return; // Don't set up timeout if already ready
    
    debugLog('Setting up auth ready fallback timeout');
    
    // Force auth ready state after 5 seconds maximum
    const fallbackTimer = setTimeout(() => {
      debugLog('Fallback timeout triggered - forcing authReady state');
      setAuthReady(true);
      setLoading(false);
      
      // Check if we have a session at this point
      supabase.auth.getSession().then(({ data }) => {
        if (data?.session?.user?.email) {
          setInviteEmail(data.session.user.email);
          setInvitationFlow(true);
          debugLog('Found email on forced ready:', data.session.user.email);
        }
      });
    }, 5000);
    
    // Clean up timeout
    return () => clearTimeout(fallbackTimer);
  }, [authReady]);

  // Listen for ALL auth state changes including SIGNED_IN for invitation flows - ONLY ONCE
  useEffect(() => {
    if (authListenerSetUp) return; // Prevent multiple listeners
    
    debugLog('Setting up global auth state listener');
    setAuthListenerSetUp(true);
    
    // First check immediate session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        debugLog('Found immediate session, setting authReady', { email: session.user.email });
        setAuthReady(true);
        setLoading(false);
        
        if (session.user.email) {
          setInviteEmail(session.user.email);
          setInvitationFlow(true);
        }
      }
    });
    
    // Set up auth change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog(`Global auth event detected: ${event}`, { 
          sessionExists: !!session,
          email: session?.user?.email,
          userId: session?.user?.id
        });
        
        // Handle PASSWORD_RECOVERY event specifically
        if (event === 'PASSWORD_RECOVERY') {
          debugLog('Password recovery flow detected, setting authReady');
          setAuthReady(true);
          setLoading(false);
          
          // If there's an email in the session, store it
          if (session?.user?.email) {
            setInviteEmail(session.user.email);
          }
        }
        
        // Always set authReady for any auth event except INITIAL_SESSION
        if (event !== 'INITIAL_SESSION') {
          debugLog(`Setting authReady to true due to auth event: ${event}`);
          setAuthReady(true);
          setLoading(false);
        }
        
        // Handle initial sign in (especially for invitation links)
        if (event === 'SIGNED_IN') {
          debugLog('User signed in, setting authReady to true');
          setAuthReady(true);
          setLoading(false);
          
          // If there's an email in the session, store it for the invitation flow
          if (session?.user?.email) {
            setInviteEmail(session.user.email);
            setInvitationFlow(true);
            debugLog('Identified as invitation flow for email', session.user.email);
          }
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      debugLog('Cleaning up global auth listener');
      subscription.unsubscribe();
    };
  }, [authListenerSetUp]);

  // Listen for auth state changes specifically for password update completion
  useEffect(() => {
    if (!passwordUpdateAttempted) return;

    debugLog('Setting up specific auth state listener for password update confirmation');
    
    // Set up auth change listener to detect USER_UPDATED event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog(`Auth event detected during password update attempt: ${event}`, {
          sessionExists: !!session,
          userId: session?.user?.id,
          userEmail: session?.user?.email,
          eventType: event
        });
        
        // Check for any of these events that could indicate password update
        if (event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY' || event === 'TOKEN_REFRESHED') {
          debugLog(`Password update confirmed through auth event: ${event}`);
          // Password updated successfully
          setMessage("La contraseña se ha actualizado correctamente. Serás redirigido a la página de inicio de sesión.");
          setPassword('');
          setConfirmPassword('');
          setLoading(false);
          
          // Start countdown for redirect
          debugLog('Starting countdown for redirect');
          setCountdown(5);
          setPasswordUpdateAttempted(false);
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      debugLog('Cleaning up password update auth listener');
      subscription.unsubscribe();
    };
  }, [passwordUpdateAttempted]);

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

  // Extract authentication data on component mount
  useEffect(() => {
    const extractAuthData = async () => {
      try {
        setLoading(true);
        debugLog("Component initialized");
        
        // First, check if we already have a session
        const { data: currentSession } = await supabase.auth.getSession();
        
        if (currentSession?.session) {
          debugLog("Found existing session on initialization", { 
            userId: currentSession.session.user.id,
            email: currentSession.session.user.email
          });
          
          // If there's an email in the session, it's likely an invitation
          if (currentSession.session.user.email) {
            setInviteEmail(currentSession.session.user.email);
            setInvitationFlow(true);
            debugLog('Identified as invitation flow for email', currentSession.session.user.email);
          }
          
          setAuthReady(true);
          setLoading(false);
          return; // Exit early if we already have a session
        }
        
        // Otherwise, try to extract auth data from URL
        const hashString = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hashString);
        const code = searchParams.get('code');
        const type = searchParams.get('type');
        
        debugLog("URL data", { 
          hash: !!window.location.hash, 
          search: !!window.location.search,
          code,
          type
        });
        
        // Check for invitation type
        if (type === 'invite' || type === 'signup') {
          debugLog("Detected invitation link", { type });
          setInvitationFlow(true);
        }
        
        // 1. Check URL hash for tokens - usual flow from password reset emails
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          debugLog("Found auth tokens in URL hash", { accessToken: !!accessToken, refreshToken: !!refreshToken });
          
          // Set the session with tokens
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            debugLog("Error setting session with tokens", sessionError);
            setError(`Error al establecer sesión: ${sessionError.message}`);
            // Still proceed with auth ready even if there's an error
            setAuthReady(true);
          } else {
            debugLog("Session successfully established from URL tokens", { 
              userId: sessionData?.session?.user?.id,
              email: sessionData?.session?.user?.email
            });
            
            // If there's an email in the session, store it for the invitation flow
            if (sessionData?.session?.user?.email) {
              setInviteEmail(sessionData.session.user.email);
              setInvitationFlow(true);
              debugLog('Identified as invitation flow for email', sessionData.session.user.email);
            }
            
            setAuthReady(true);
          }
        }
        // 2. Check for code in params - PKCE flow
        else if (code) {
          // Handle any type of code flow (recovery, signup invitation, etc)
          debugLog("Found auth code in query parameters", { code, type });
          
          try {
            // Exchange the code for a session
            debugLog("Exchanging code for session");
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (exchangeError) {
              debugLog("Error exchanging code for session", exchangeError);
              setError(`Error al procesar el código: ${exchangeError.message}`);
              // Still proceed with auth ready even if there's an error
              setAuthReady(true);
            } else if (data?.session) {
              debugLog("Code successfully exchanged for session", { 
                userId: data.session.user.id,
                email: data.session.user.email
              });
              
              // If there's an email in the session, it's likely an invitation
              if (data.session.user.email) {
                setInviteEmail(data.session.user.email);
                setInvitationFlow(true);
                debugLog('Identified as invitation flow for email', data.session.user.email);
              }
              
              setAuthReady(true);
            } else {
              debugLog("No session returned from code exchange");
              setError("No se pudo establecer la sesión con el código proporcionado.");
              // Still proceed with auth ready even if there's no session
              setAuthReady(true);
            }
          } catch (codeError) {
            debugLog("Unexpected error exchanging code", codeError);
            setError("Error inesperado al procesar el código de autenticación");
            // Still proceed with auth ready even if there's an error
            setAuthReady(true);
          }
        }
        // 3. Fallback case - no auth data found
        else {
          debugLog("No tokens or code found in URL, and no existing session");
          setError("No se encontró información de autenticación. El restablecimiento de contraseña podría fallar.");
          setAuthReady(true);
        }
        
        setLoading(false);
      } catch (err) {
        debugLog("Error extracting auth data", err);
        setError("Error al procesar la autenticación");
        // Always ensure we set authReady to true even if there's an error
        setAuthReady(true);
        setLoading(false);
      }
    };
    
    extractAuthData();
  }, [searchParams]);

  // SUPER DIRECT approach that avoids ANY asynchronous issues
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
    setPasswordUpdateAttempted(true);
    
    try {
      // Get current session and URL parameters
      const { data: sessionData } = await supabase.auth.getSession();
      const hashString = window.location.hash.substring(1);
      const hashParams = new URLSearchParams(hashString);
      const accessToken = hashParams.get('access_token');
      
      debugLog("Attempting password update", {
        hasSession: !!sessionData?.session,
        hasAccessToken: !!accessToken
      });

      let updateError;

      // If we have an access token in the URL (password reset flow)
      if (accessToken) {
        debugLog("Using access token from URL for password update");
        // Set the access token in the client
        supabase.auth.setSession({ access_token: accessToken, refresh_token: '' });
        const { error } = await supabase.auth.updateUser({ password });
        updateError = error;
      } 
      // If we have a session (invitation or normal flow)
      else if (sessionData?.session) {
        debugLog("Using current session for password update");
        const { error } = await supabase.auth.updateUser({ password });
        updateError = error;
      }
      else {
        debugLog("No valid auth context found for password update");
        setError("No se encontró una sesión válida para actualizar la contraseña.");
        setLoading(false);
        setPasswordUpdateAttempted(false);
        return;
      }
      
      if (updateError) {
        debugLog("Error updating password", updateError);
        setError(`Error al actualizar la contraseña: ${updateError.message}`);
        setLoading(false);
        setPasswordUpdateAttempted(false);
        return;
      }
      
      debugLog("Password update API call completed successfully");
      
      // Set up a fallback timer to show success in case the auth event doesn't fire
      const fallbackSuccessTimer = setTimeout(() => {
        debugLog("Fallback success timer triggered - forcing success state");
        if (loading && passwordUpdateAttempted) {
          debugLog("Auth event wasn't detected, showing success manually");
          setMessage("La contraseña se ha actualizado correctamente. Serás redirigido a la página de inicio de sesión.");
          setPassword('');
          setConfirmPassword('');
          setLoading(false);
          setPasswordUpdateAttempted(false);
          setCountdown(5);
        }
      }, 3000);
      
      return () => clearTimeout(fallbackSuccessTimer);
      
    } catch (err) {
      debugLog("Error during password update process", err);
      setError("Ocurrió un error al actualizar la contraseña");
      setLoading(false);
      setPasswordUpdateAttempted(false);
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