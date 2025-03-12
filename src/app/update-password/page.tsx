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
  const [isInvitation] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [passwordUpdateAttempted, setPasswordUpdateAttempted] = useState(false);
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);

  // Listen for ALL auth state changes including SIGNED_IN for invitation flows
  useEffect(() => {
    debugLog('Setting up global auth state listener');
    
    // Set up auth change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debugLog(`Global auth event detected: ${event}`, { sessionExists: !!session });
        
        // Handle initial sign in (especially for invitation links)
        if (event === 'SIGNED_IN') {
          debugLog('User signed in, setting authReady to true');
          setAuthReady(true);
          setLoading(false);
        }
        
        // Handle password update specific events
        if (passwordUpdateAttempted && event === 'USER_UPDATED') {
          debugLog('Password update confirmed through auth event');
          setPasswordUpdateAttempted(false);
          
          // Show success message
          setMessage("Tu contraseña ha sido actualizada con éxito");
          setLoading(false);
          setShowSuccessScreen(true);
          
          // Clear local storage to prevent cookie/storage conflicts
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith('supabase.auth.')) {
              localStorage.removeItem(key);
            }
          }
          
          // Clear cookies
          document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          });
          
          // Explicit sign out
          await supabase.auth.signOut({ scope: 'global' });
          
          // Delay before redirecting
          setTimeout(() => {
            debugLog("Redirecting to login page");
            // Direct navigation with cache-busting
            window.location.href = `/login?updated=true&t=${Date.now()}`;
          }, 3000);
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [passwordUpdateAttempted]);

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
            userId: currentSession.session.user.id 
          });
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
              userId: sessionData?.session?.user?.id 
            });
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
              debugLog("Code successfully exchanged for session", { userId: data.session.user.id });
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
      // 1. Check if we have valid tokens or session
      const { data: sessionData } = await supabase.auth.getSession();
      debugLog("Session before update", { 
        exists: !!sessionData?.session,
        userId: sessionData?.session?.user?.id
      });
      
      if (!sessionData?.session) {
        debugLog("No active session found, cannot update password");
        setError("No hay una sesión activa. Por favor, inténtalo de nuevo.");
        setLoading(false);
        setPasswordUpdateAttempted(false);
        return;
      }
      
      // 2. Try updating the password
      debugLog("Calling updateUser with new password");
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      
      if (updateError) {
        debugLog("Error updating password", updateError);
        setError(`Error al actualizar la contraseña: ${updateError.message}`);
        setLoading(false);
        setPasswordUpdateAttempted(false);
        return;
      }
      
      // Log detailed API response to verify password update
      debugLog("Password update API call completed successfully", {
        userUpdated: !!data?.user,
        userId: data?.user?.id,
        updatedAt: data?.user?.updated_at,
        responseData: data
      });
      
      // 3. Verify the update was successful by checking the user data
      if (!data?.user) {
        debugLog("Password update API returned success but no user data");
        setError("La actualización de contraseña no pudo ser verificada. Por favor, intenta de nuevo.");
        setLoading(false);
        setPasswordUpdateAttempted(false);
        return;
      }
      
      // If we got here, the password was successfully updated at the API level
      debugLog("Password update CONFIRMED via API response");
      
      // Set a fallback timer in case the USER_UPDATED event is not triggered
      const fallbackTimer = setTimeout(() => {
        debugLog("Fallback timer triggered - no USER_UPDATED event detected");
        if (loading) {
          // Force success state if we're still loading after 3 seconds
          debugLog("Forcing success state via fallback timer");
          setMessage("Tu contraseña ha sido actualizada con éxito");
          setLoading(false);
          setShowSuccessScreen(true);
          setPasswordUpdateAttempted(false);
          
          // Clear local storage to prevent cookie/storage conflicts
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith('supabase.auth.')) {
              localStorage.removeItem(key);
            }
          }
          
          // Clear cookies
          document.cookie.split(";").forEach(function(c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          });
          
          // Explicit sign out
          supabase.auth.signOut({ scope: 'global' }).then(() => {
            // Delay before redirecting
            setTimeout(() => {
              debugLog("Redirecting to login page (from fallback)");
              window.location.href = `/login?updated=true&t=${Date.now()}`;
            }, 3000);
          });
        }
      }, 3000); // Wait 3 seconds for the event before falling back
      
      // Clean up the fallback timer if component unmounts
      return () => clearTimeout(fallbackTimer);
      
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

  // If update is complete, show success screen
  if (showSuccessScreen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <svg 
              className="mx-auto h-12 w-12 text-green-500" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M5 13l4 4L19 7" 
              />
            </svg>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">¡Contraseña Actualizada!</h1>
            <p className="mt-2 text-lg text-gray-600">
              Tu contraseña ha sido actualizada correctamente.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Serás redirigido a la página de inicio de sesión en unos segundos...
            </p>
          </div>
          
          <div className="mt-8 text-center">
            <a
              href={`/login?updated=true&t=${Date.now()}`}
              className="inline-block w-full px-4 py-2 text-lg font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
            >
              Ir a Iniciar Sesión Ahora
            </a>
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
            {isInvitation ? 'Configura tu Contraseña' : 'Actualizar Contraseña'}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {isInvitation 
              ? 'Crea una contraseña para acceder a tu cuenta' 
              : 'Crea una nueva contraseña para tu cuenta'}
          </p>
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