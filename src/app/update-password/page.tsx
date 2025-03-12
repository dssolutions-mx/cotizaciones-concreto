'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
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

  // Listen for ALL auth state changes including SIGNED_IN for invitation flows - ONLY ONCE
  useEffect(() => {
    if (authListenerSetUp) return; // Prevent multiple listeners
    
    debugLog('Setting up global auth state listener');
    setAuthListenerSetUp(true);
    
    // Set up auth change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog(`Global auth event detected: ${event}`, { 
          sessionExists: !!session,
          email: session?.user?.email 
        });
        
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
      subscription.unsubscribe();
    };
  }, [authListenerSetUp]);

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
            }
          } catch (codeError) {
            debugLog("Unexpected error exchanging code", codeError);
            setError("Error inesperado al procesar el código de autenticación");
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
    
    try {
      // DIRECT APPROACH: Just update the password and immediately show success
      debugLog("Using ultra-simplified password update approach");
      
      // Get current session synchronously
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData?.session) {
        debugLog("No active session, cannot update password");
        setError("No hay una sesión activa. Por favor, intenta de nuevo o solicita un nuevo correo de invitación.");
        setLoading(false);
        return;
      }
      
      debugLog("Found active session, proceeding with password update");
      
      // Update password synchronously
      const { error: updateError } = await supabase.auth.updateUser({ 
        password 
      });
      
      if (updateError) {
        debugLog("Error updating password", updateError);
        setError(`Error al actualizar la contraseña: ${updateError.message}`);
        setLoading(false);
        return;
      }
      
      // Success case - immediately show success message
      debugLog("Password update succeeded, showing success UI");
      
      // Create success element directly in DOM to avoid any React state issues
      const successHtml = `
        <div class="flex min-h-screen flex-col items-center justify-center bg-gray-50">
          <div class="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
            <div class="text-center">
              <svg 
                class="mx-auto h-12 w-12 text-green-500" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  stroke-linecap="round" 
                  stroke-linejoin="round" 
                  stroke-width="2" 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
              <h1 class="mt-4 text-3xl font-bold text-gray-900">¡Contraseña Actualizada!</h1>
              <p class="mt-2 text-lg text-gray-600">
                Tu contraseña ha sido actualizada correctamente.
              </p>
              <p class="mt-2 text-sm text-gray-500">
                Serás redirigido a la página de inicio de sesión en 3 segundos...
              </p>
            </div>
            
            <div class="mt-8 text-center">
              <a
                href="/login?updated=true&t=${Date.now()}"
                class="inline-block w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
              >
                Ir a Iniciar Sesión Ahora
              </a>
            </div>
          </div>
        </div>
      `;
      
      // Replace the entire content of the page with our success message
      document.body.innerHTML = successHtml;
      
      // Clean up auth state
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('supabase.auth.')) {
            localStorage.removeItem(key);
          }
        }
        
        document.cookie.split(";").forEach(function(c) {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
        });
        
        await supabase.auth.signOut({ scope: 'global' });
      } catch (e) {
        debugLog("Non-critical error during cleanup", e);
        // Continue anyway
      }
      
      // Redirect after 3 seconds
      setTimeout(() => {
        debugLog("Auto-redirecting to login page");
        window.location.href = `/login?updated=true&t=${Date.now()}`;
      }, 3000);
      
      return;
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
            {message}
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