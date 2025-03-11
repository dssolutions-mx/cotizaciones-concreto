'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

// Create a client component that uses useSearchParams
function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInvitation, setIsInvitation] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check if we have a valid session from reset link and check for source parameter
  const checkSession = useCallback(async () => {
    try {
      console.log('Checking session...');
      
      // Check URL parameters (both query and hash)
      const source = searchParams.get('source');
      const type = searchParams.get('type');
      
      // Also check hash parameters
      const hashParams = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.hash.replace('#', '') : ''
      );
      const hashSource = hashParams.get('source');
      const hashType = hashParams.get('type');
      
      console.log('URL parameters:', { source, type, hashSource, hashType });
      
      // Set invitation flag if either source indicates it
      if (source === 'invitation' || hashSource === 'invitation') {
        setIsInvitation(true);
      }
      
      // Check for session
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        // Don't show error for invitation flow
        if (!isInvitation) {
          setError("Error al verificar la sesión: " + error.message);
        }
        setSessionChecked(true);
        return;
      }
      
      if (!data.session) {
        console.error('No session found');
        // Don't show error for invitation flow
        if (!isInvitation) {
          setError("Sesión inválida o expirada. Por favor, solicita un nuevo correo de restablecimiento.");
        }
        setSessionChecked(true);
        return;
      }

      console.log('Session found:', data.session.user.id);
      setSessionChecked(true);
    } catch (err) {
      console.error('Unexpected error checking session:', err);
      // Don't show error for invitation flow
      if (!isInvitation) {
        setError("Error inesperado al verificar la sesión.");
      }
      setSessionChecked(true);
    }
  }, [searchParams, isInvitation]);

  // Extract tokens from the URL on mount
  useEffect(() => {
    // Add explicit check for existing session on component mount
    const checkExistingSession = async () => {
      if (sessionChecked) return; // Skip if already checked
      
      try {
        console.log('Performing initial session check on mount...');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Initial session check error:', error);
          return;
        }
        
        if (data.session) {
          console.log('Found existing session on mount:', data.session.user.id);
          
          // Force session refresh to ensure it's valid and fully established
          try {
            await supabase.auth.refreshSession();
            console.log('Session refreshed on mount');
            
            // Check for user metadata to see if this is an invited user
            const { data: { user } } = await supabase.auth.getUser();
            if (user?.user_metadata?.invited) {
              console.log('This is an invited user (from initial check)');
              setIsInvitation(true);
            }
            
            // Mark session as checked to stop polling
            setSessionChecked(true);
          } catch (refreshErr) {
            console.error('Error refreshing session on mount:', refreshErr);
          }
        }
      } catch (err) {
        console.error('Error in initial session check:', err);
      }
    };
    
    // Check for existing session first
    checkExistingSession();
    
    // This is critical for password reset flows - we need to capture auth tokens
    // from the URL hash fragment
    const setAuthFromHash = async () => {
      try {
        if (typeof window === 'undefined') return;
        
        // Get hash parameters excluding the # symbol
        const hashString = window.location.hash.substring(1);
        
        // Parse error_code and error_description if present
        const hashParams = new URLSearchParams(hashString);
        
        // Check for hash parameters related to auth flow
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const errorCode = hashParams.get('error_code');
        const errorDescription = hashParams.get('error_description');
        
        // If we have an error, display it
        if (errorCode || errorDescription) {
          console.error('Auth error in URL:', { errorCode, errorDescription });
          setError(`Error de autenticación: ${errorDescription || errorCode}`);
          setSessionChecked(true);
          return;
        }
        
        // If there's access token and refresh token, we can set the session
        if (accessToken && refreshToken) {
          console.log('Found auth tokens in URL, setting session');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            console.error('Error setting session from tokens:', sessionError);
            setError(`Error al establecer la sesión: ${sessionError.message}`);
            setSessionChecked(true);
            return;
          }
          
          console.log('Session set successfully from URL tokens');
          
          // Check for user metadata to see if this is an invited user
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.user_metadata?.invited) {
            console.log('This is an invited user');
            setIsInvitation(true);
          }
        } else {
          console.log('No auth tokens found in URL hash');
          
          // Check if there's a code in the query parameters (from email link redirect)
          const queryParams = new URLSearchParams(window.location.search);
          const authCode = queryParams.get('code');
          
          if (authCode) {
            console.log('Found auth code in query parameters, handling auth from code...');
            try {
              // Exchange the code for a session
              const { error: codeExchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
              
              if (codeExchangeError) {
                console.error('Error exchanging code for session:', codeExchangeError);
                setError(`Error al procesar el código de autenticación: ${codeExchangeError.message}`);
                setSessionChecked(true);
                return;
              }
              
              console.log('Successfully exchanged code for session');
              
              // Check for user metadata to see if this is an invited user
              const { data: { user } } = await supabase.auth.getUser();
              if (user?.user_metadata?.invited) {
                console.log('This is an invited user (from code)');
                setIsInvitation(true);
              }
            } catch (codeErr) {
              console.error('Unexpected error handling auth code:', codeErr);
              setError('Error inesperado al procesar el código de autenticación');
              setSessionChecked(true);
              return;
            }
          }
        }
        
        // Now proceed with the regular session check
        await checkSession();
      } catch (err) {
        console.error('Error setting auth from hash:', err);
        setError('Error inesperado al procesar la URL de autenticación');
        setSessionChecked(true);
      }
    };
    
    setAuthFromHash();
    
    // Add a session polling mechanism for cases where the redirect
    // doesn't immediately provide the session
    let pollAttempts = 0;
    const maxPollAttempts = 5;
    
    const pollForSession = async () => {
      if (sessionChecked) return; // Stop if session check is already complete
      
      pollAttempts += 1;
      console.log(`Polling for session (attempt ${pollAttempts}/${maxPollAttempts})...`);
      
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error polling for session:', error);
          // Only set error and stop polling on last attempt
          if (pollAttempts >= maxPollAttempts) {
            setError(`Error al verificar la sesión: ${error.message}`);
            setSessionChecked(true);
          }
          return;
        }
        
        if (data.session) {
          console.log('Session found on poll attempt:', pollAttempts);
          
          // Check for user metadata to see if this is an invited user
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.user_metadata?.invited) {
            console.log('This is an invited user (from polling)');
            setIsInvitation(true);
          }
          
          // Important: signal that session checking is complete
          setSessionChecked(true);
          
          // Fix: Attempt to reestablish the session explicitly
          try {
            const accessToken = data.session.access_token;
            const refreshToken = data.session.refresh_token;
            
            if (accessToken && refreshToken) {
              console.log('Explicitly setting session from polling result');
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              console.log('Session explicitly set from polling result');
            }
          } catch (sessionSetError) {
            console.error('Error setting explicit session from polling:', sessionSetError);
          }
          
          return;
        }
        
        // If we've hit the max attempts, stop polling
        if (pollAttempts >= maxPollAttempts) {
          console.log('Max poll attempts reached, stopping');
          if (!isInvitation) {
            setError("No se pudo recuperar la sesión después de varios intentos. Intenta refrescar la página.");
          }
          setSessionChecked(true);
        }
      } catch (err) {
        console.error('Error in session polling:', err);
        if (pollAttempts >= maxPollAttempts) {
          setError('Error inesperado al verificar la sesión');
          setSessionChecked(true);
        }
      }
    };
    
    // Set up polling with proper cleanup
    let pollIntervalRef: NodeJS.Timeout | null = null;
    
    // Wait 1 second before starting to poll to allow auth system to initialize
    const initialDelay = setTimeout(() => {
      pollIntervalRef = setInterval(() => {
        if (pollAttempts < maxPollAttempts && !sessionChecked) {
          pollForSession();
        } else if (pollIntervalRef) {
          clearInterval(pollIntervalRef);
          pollIntervalRef = null;
        }
      }, 2000); // Poll every 2 seconds
    }, 1000);
    
    // Clean up all timers on unmount
    return () => {
      clearTimeout(initialDelay);
      if (pollIntervalRef) {
        clearInterval(pollIntervalRef);
        pollIntervalRef = null;
      }
    };
  }, [checkSession, isInvitation, sessionChecked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    
    // Validate passwords
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    
    setLoading(true);

    try {
      console.log('Updating password...');
      
      // Add max retry attempts for better reliability
      let updateError = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        // Try to update password
        const { error } = await supabase.auth.updateUser({
          password
        });
        
        if (!error) {
          // Success - break out of retry loop
          console.log('Password updated successfully');
          updateError = null;
          break;
        } else {
          // Error - log and retry
          console.error(`Error updating password (attempt ${retryCount + 1}/${maxRetries}):`, error);
          updateError = error;
          retryCount++;
          
          if (retryCount < maxRetries) {
            // Wait before next retry (increasing delay with each retry)
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            
            // Before retrying, check if we have a valid session
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) {
              console.error('No valid session for password update, aborting retries');
              break;
            }
          }
        }
      }
      
      // Handle final result
      if (updateError) {
        console.error('Final error updating password after retries:', updateError);
        setError(updateError.message);
        setLoading(false);
        return;
      }
      
      // Password update succeeded
      setMessage("Tu contraseña ha sido actualizada con éxito");
      
      // Sign out the user after password update to ensure a clean state
      try {
        await supabase.auth.signOut();
        console.log('User signed out successfully');
      } catch (signOutErr) {
        console.error('Error signing out:', signOutErr);
        // Continue with redirect even if sign out fails
      }
      
      // Redirect to login after 2 seconds
      try {
        setTimeout(() => {
          console.log('Redirecting to login page...');
          setLoading(false); // Ensure loading is set to false before redirect
          router.push('/login');
        }, 2000);
      } catch (redirectErr) {
        console.error('Error during redirect:', redirectErr);
        setLoading(false);
        setError('Error al redirigir. Por favor, ve a la página de inicio de sesión manualmente.');
      }
    } catch (err) {
      console.error('Error updating password:', err);
      setError('Ocurrió un error al actualizar la contraseña.');
    } finally {
      // Ensure loading state is reset if there's an error
      if (loading) {
        setLoading(false);
      }
    }
  };

  // Show loading state while checking session
  if (!sessionChecked) {
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