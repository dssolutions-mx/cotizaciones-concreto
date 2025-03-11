'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Create a client component that uses useSearchParams
function UpdatePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInvitation, setIsInvitation] = useState(false);
  // Change the approach - don't rely on session checked state
  const [authReady, setAuthReady] = useState(false);
  // Add a state to track if the update completed
  const [updateCompleted, setUpdateCompleted] = useState(false);
  // Store tokens directly when found
  const [authTokens, setAuthTokens] = useState<{
    access_token?: string;
    refresh_token?: string;
  } | null>(null);

  // Extract authentication data on component mount
  useEffect(() => {
    const extractAuthData = async () => {
      try {
        // Initialize status
        setLoading(true);
        
        // Log all potential sources of auth data for debugging
        console.log('URL hash present:', !!window.location.hash);
        console.log('URL query params present:', !!window.location.search);
        
        // 1. Check URL hash for tokens (primary method from password reset emails)
        const hashString = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hashString);
        
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const errorCode = hashParams.get('error_code');
        const errorDescription = hashParams.get('error_description');
        
        // Handle errors in URL
        if (errorCode || errorDescription) {
          console.error('Auth error in URL:', { errorCode, errorDescription });
          setError(`Error de autenticación: ${errorDescription || errorCode}`);
          setLoading(false);
          setAuthReady(true);
          return;
        }

        // 2. If tokens found in hash, use them directly
        if (accessToken && refreshToken) {
          console.log('Found auth tokens in URL hash');
          
          // Store tokens for later use (don't trust session state)
          setAuthTokens({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          // Try to establish session with multiple attempts
          let sessionEstablished = false;
          for (let attempt = 1; attempt <= 3 && !sessionEstablished; attempt++) {
            try {
              console.log(`Setting session from URL tokens (attempt ${attempt})`);
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              // Verify the session was set
              const { data: sessionCheck } = await supabase.auth.getSession();
              if (sessionCheck?.session) {
                console.log('Session successfully established from URL tokens');
                sessionEstablished = true;
                
                // Check if this is an invited user
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (user?.user_metadata?.invited) {
                    console.log('Detected invited user from URL tokens');
                    setIsInvitation(true);
                  }
                } catch (userError) {
                  console.error('Error checking user metadata:', userError);
                }
              } else {
                console.warn('Session not established after setSession attempt', attempt);
                if (attempt < 3) {
                  // Wait before retrying
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
            } catch (sessionError) {
              console.error(`Session setting error (attempt ${attempt}):`, sessionError);
              if (attempt < 3) {
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            }
          }
          
          setAuthReady(true);
          setLoading(false);
          return;
        }
        
        // 3. Check for code in query params 
        const queryParams = new URLSearchParams(window.location.search);
        const authCode = queryParams.get('code');
        
        if (authCode) {
          console.log('Found auth code in query parameters');
          try {
            // Exchange the code for a session - we need to handle differently depending on the source
            // First, try to get code_verifier from localStorage (where Supabase SDK stores it)
            let codeVerifier = null;
            try {
              // Supabase stores this in localStorage during the auth flow
              if (typeof window !== 'undefined') {
                codeVerifier = localStorage.getItem('supabase.auth.token.code_verifier');
                console.log('Code verifier found in localStorage:', !!codeVerifier);
              }
            } catch (storageError) {
              console.error('Error retrieving code verifier from storage:', storageError);
            }

            // Use the appropriate method to exchange code based on what's available
            let authResult;
            if (codeVerifier) {
              console.log('Using code verifier with exchangeCodeForSession');
              authResult = await supabase.auth.exchangeCodeForSession(authCode);
            } else {
              // Fallback approach - manually parse the URL and set session
              console.log('No code verifier, trying direct session method');
              
              // Constructing the full URL with the code
              const redirectUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
              console.log('Using redirect URL:', redirectUrl);
              
              // Try to extract session from the URL directly
              const { data: hashData, error: hashError } = await supabase.auth.getSession();
              if (hashError) {
                console.error('Error getting session:', hashError);
                throw hashError;
              }
              authResult = { data: hashData, error: null };
            }
            
            if (authResult.error) {
              console.error('Error exchanging code for session:', authResult.error);
              setError(`Error al procesar el código de autenticación: ${authResult.error.message}`);
              setAuthReady(true);
              setLoading(false);
              return;
            }
            
            if (authResult.data?.session) {
              console.log('Got session from code exchange, storing tokens');
              // Store tokens for direct use
              setAuthTokens({
                access_token: authResult.data.session.access_token,
                refresh_token: authResult.data.session.refresh_token
              });
              
              // Check if this is an invited user - we need to get user data separately
              try {
                // After setting the session, get the user data
                const { data: userData } = await supabase.auth.getUser();
                if (userData?.user?.user_metadata?.invited) {
                  console.log('Detected invited user from code exchange');
                  setIsInvitation(true);
                }
              } catch (userDataError) {
                console.error('Error getting user data after code exchange:', userDataError);
              }
            } else {
              console.warn('No session returned from code exchange');
            }
            
            setAuthReady(true);
            setLoading(false);
            return;
          } catch (codeErr) {
            console.error('Unexpected error handling auth code:', codeErr);
            setError('Error inesperado al procesar el código de autenticación');
            setAuthReady(true);
            setLoading(false);
            return;
          }
        }
        
        // 4. As a fallback, check for existing session
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log('Found existing session, using it for password update');
            setAuthTokens({
              access_token: sessionData.session.access_token,
              refresh_token: sessionData.session.refresh_token
            });
            
            // Check if this is an invited user
            try {
              const { data: userData } = await supabase.auth.getUser();
              if (userData?.user?.user_metadata?.invited) {
                console.log('Detected invited user from existing session');
                setIsInvitation(true);
              }
            } catch (userError) {
              console.error('Error checking user metadata from existing session:', userError);
            }
            
            setAuthReady(true);
            setLoading(false);
            return;
          }
        } catch (sessionErr) {
          console.error('Error checking existing session:', sessionErr);
        }
        
        // 5. If we get here, no auth tokens found - show error but allow form submission
        console.warn('No authentication tokens found in URL or session');
        if (isInvitation) {
          console.log('Invitation flow will attempt direct password update');
        } else {
          setError('No se encontró información de autenticación. El restablecimiento de contraseña podría fallar.');
        }
        
        setAuthReady(true);
        setLoading(false);
      } catch (err) {
        console.error('Error extracting auth data:', err);
        setError('Error inesperado al procesar la autenticación');
        setAuthReady(true);
        setLoading(false);
      }
    };
    
    extractAuthData();
  }, [isInvitation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setUpdateCompleted(false);
    
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
      console.log('Updating password with new method...');
      let updateSuccessful = false;
      let updateAttempts = 0;
      
      // Check if there's actually a session or tokens before attempting update
      const { data: sessionCheck } = await supabase.auth.getSession();
      console.log('Current session before update:', sessionCheck?.session ? 'Valid session found' : 'No valid session');
      console.log('Current session ID:', sessionCheck?.session?.user?.id);
      
      if (!sessionCheck?.session && (!authTokens?.access_token || !authTokens?.refresh_token)) {
        console.error('No valid session or tokens found before password update');
        setError('No se pudo actualizar la contraseña: no hay sesión válida. Por favor, inicia sesión nuevamente.');
        setLoading(false);
        return;
      }
      
      // Get access token to use in all attempts
      const accessToken = sessionCheck?.session?.access_token || authTokens?.access_token;
      
      // Loop through multiple methods to update password
      while (!updateSuccessful && updateAttempts < 4) {  // Increased to 4 to add direct API call
        updateAttempts++;
        console.log(`Password update attempt ${updateAttempts}/4`);
        
        try {
          // Method 1: Use direct tokens if available
          if (authTokens?.access_token && authTokens?.refresh_token && updateAttempts === 1) {
            console.log('Attempt 1: Using stored tokens for password update');
            
            // First ensure we have a valid session with these tokens
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: authTokens.access_token,
              refresh_token: authTokens.refresh_token
            });
            
            if (sessionError) {
              console.error('Error setting session with tokens:', sessionError);
              // Continue to next attempt
              continue;
            }
            
            console.log('Session set successfully. Session exists:', !!sessionData?.session);
            console.log('Session user ID:', sessionData?.session?.user?.id);
            
            // Log user data before update
            const { data: userData } = await supabase.auth.getUser();
            console.log('User data before update:', userData?.user ? 'User found' : 'No user data');
            console.log('User ID:', userData?.user?.id);
            
            // Now update the password with retry logic
            const { /* data: updateData, */ error: updateError } = await supabase.auth.updateUser({ password });
            
            console.log('Update result:', updateError ? 'Error occurred' : 'Success');
            
            if (updateError) {
              console.error('Error updating password with tokens:', updateError);
              console.error('Error details:', updateError.message, updateError.status);
              // Continue to next attempt
              continue;
            }
            
            console.log('Password updated successfully with tokens.');
            updateSuccessful = true;
            setUpdateCompleted(true);
            break;
          }
          
          // Method 2: Use getSession before update 
          else if (updateAttempts === 2) {
            console.log('Attempt 2: Refreshing session before password update');
            
            // Get current session
            const { data: refreshResult, error: refreshError } = await supabase.auth.getSession();
            
            if (refreshError) {
              console.error('Error getting session in attempt 2:', refreshError);
              continue;
            }
            
            if (!refreshResult?.session) {
              console.error('No session found during attempt 2');
              continue;
            }
            
            console.log('Session refreshed, attempting password update');
            console.log('Session user ID:', refreshResult?.session?.user?.id);
            
            // Update the password using the refreshed session
            const { /* data: updateData, */ error: updateError } = await supabase.auth.updateUser({ password });
            
            if (updateError) {
              console.error('Error updating password after refresh:', updateError);
              console.error('Error details:', updateError.message, updateError.status);
              continue;
            }
            
            console.log('Password updated successfully after session refresh');
            updateSuccessful = true;
            setUpdateCompleted(true);
            break;
          }
          
          // Method 3: Direct update as last resort
          else if (updateAttempts === 3) {
            console.log('Attempt 3: Direct password update method');
            
            const { /* data: updateData, */ error } = await supabase.auth.updateUser({ password });
            
            if (error) {
              console.error('Error with direct password update:', error);
              console.error('Error details:', error.message, error.status);
              continue; // Try the direct API method as last resort
            }
            
            console.log('Password updated successfully with direct method');
            updateSuccessful = true;
            setUpdateCompleted(true);
            break;
          }
          
          // Method 4: Use direct API call as absolute last resort
          else {
            console.log('Attempt 4: Using direct Auth API call');
            
            if (!accessToken) {
              console.error('No access token available for direct API call');
              continue;
            }
            
            try {
              // Make a direct fetch to the Supabase Auth API
              const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${accessToken}`,
                  'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
                },
                body: JSON.stringify({ password })
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                console.error('Direct API call failed:', errorData);
                throw new Error(`API error: ${response.status} - ${JSON.stringify(errorData)}`);
              }
              
              const data = await response.json();
              console.log('Password updated successfully with direct API call:', data ? 'Response received' : 'No response data');
              updateSuccessful = true;
              setUpdateCompleted(true);
              break;
            } catch (apiError) {
              console.error('Error with direct API call:', apiError);
              throw apiError; // Rethrow to handle in outer catch
            }
          }
        } catch (attemptError) {
          console.error(`Error during update attempt ${updateAttempts}:`, attemptError);
          // Continue to next attempt
          await new Promise(resolve => setTimeout(resolve, 500)); // Wait before next attempt
        }
      }
      
      if (updateSuccessful) {
        // Make sure updateCompleted is set regardless of how we got here
        setUpdateCompleted(true);
        // Handle success path
        await handleSuccessAndRedirect();
      } else {
        setError('No se pudo actualizar la contraseña. Por favor intenta nuevamente.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error updating password:', err);
      setError('Ocurrió un error al actualizar la contraseña.');
      setLoading(false);
    }
  };
  
  // Helper function for post-update actions
  const handleSuccessAndRedirect = async () => {
    try {
      console.log('Password update successful, preparing for redirect');

      // Display success message immediately
      setMessage("Tu contraseña ha sido actualizada con éxito");
      setLoading(false);
      
      // IMPORTANT: Sign out the user after password update to force a clean state
      try {
        console.log('Preparing to sign out user and clear auth state');
        
        // Clear tokens from our component state first
        setAuthTokens(null);
        
        // Clear all auth state in a more comprehensive way
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith('supabase.auth.')) {
            console.log(`Removing localStorage item: ${key}`);
            localStorage.removeItem(key);
          }
        }
        
        // Then sign out explicitly
        const { error: signOutError } = await supabase.auth.signOut({
          scope: 'global' // Force a complete sign-out on all devices
        });
        
        if (signOutError) {
          console.error('Error during sign out:', signOutError);
        } else {
          console.log('User signed out successfully after password update');
        }
        
        // Verify the sign-out was successful
        const { data: sessionCheck } = await supabase.auth.getSession();
        console.log('Session after sign out:', sessionCheck?.session ? 'Still has session (problem)' : 'Session cleared successfully');
      } catch (signOutErr) {
        console.error('Error during sign out (non-fatal):', signOutErr);
        // Continue even if sign out fails
      }
      
      // Use a more reliable redirection approach with a clear indicator
      console.log('Password updated successfully! Redirecting immediately...');
      
      // Set a definitive flag in the DOM to indicate success
      document.title = "Contraseña Actualizada - Redirigiendo...";
      
      // Use a shorter timeout and more reliable approach
      setTimeout(() => {
        // Force an immediate page navigation instead of using router
        try {
          console.log('Executing immediate redirect to login page');
          window.location.replace('/login?updated=true');
        } catch (redirectError) {
          console.error('Redirect error (trying fallback):', redirectError);
          
          // Fallback to a direct DOM form submission as last resort
          try {
            const form = document.createElement('form');
            form.method = 'GET';
            form.action = '/login';
            const hiddenField = document.createElement('input');
            hiddenField.type = 'hidden';
            hiddenField.name = 'updated';
            hiddenField.value = 'true';
            form.appendChild(hiddenField);
            document.body.appendChild(form);
            console.log('Submitting fallback form redirect');
            form.submit();
          } catch (formError) {
            console.error('Form redirect error:', formError);
          }
        }
      }, 500); // Reduce to 500ms instead of 2 seconds
    } catch (err) {
      console.error('Error during post-update process:', err);
      setLoading(false);
      setError('La contraseña se actualizó, pero hubo un problema al redireccionar. Por favor, ve a la página de inicio de sesión manualmente.');
    }
  };

  // Add a safety check in the component's render to show login link if update is complete
  // but we're somehow still on this page
  useEffect(() => {
    // If the update was completed but we're still on this page after 3 seconds,
    // show a manual navigation option
    if (updateCompleted) {
      const timer = setTimeout(() => {
        if (!message) {
          setMessage("La contraseña parece haberse actualizado correctamente, pero la redirección automática no funcionó. Por favor, haz clic en 'Volver a Iniciar Sesión' abajo.");
        }
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [updateCompleted, message]);

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
            {updateCompleted ? (
              <a
                href="/login?updated=true"
                className="inline-block mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                onClick={(e) => {
                  // Clear any session data before navigating
                  try {
                    for (const key of Object.keys(localStorage)) {
                      if (key.startsWith('supabase.auth.')) {
                        localStorage.removeItem(key);
                      }
                    }
                    // Try to sign out synchronously before navigation
                    supabase.auth.signOut();
                  } catch (e) {
                    console.error('Error during emergency sign out:', e);
                  }
                }}
              >
                Ir a Página de Inicio de Sesión
              </a>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                Volver a Iniciar Sesión
              </Link>
            )}
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