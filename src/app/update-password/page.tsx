'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter, useSearchParams } from 'next/navigation';
import { Session, User } from '@supabase/supabase-js';

// Define types for session data
interface SessionData {
  session: Session | null;
  user: User | null;
}

// Main component that uses useSearchParams
function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [passwordUpdateAttempted, setPasswordUpdateAttempted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [invitationFlow, setInvitationFlow] = useState(false);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  // Store session data for debugging purposes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentSessionData, setCurrentSessionData] = useState<SessionData | null>(null);
  const [sessionEstablished, setSessionEstablished] = useState(false);

  // Add a useEffect to inject CSP meta tag
  useEffect(() => {
    // Inject CSP meta tag to allow unsafe-eval for Supabase auth
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.supabase.io https://supabase.co https://supabase.io; frame-src 'self'; base-uri 'self'; form-action 'self';";
    document.head.appendChild(meta);
    
    // Clean up on unmount
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  // Process URL hash for auth tokens if present (for invitation flows)
  useEffect(() => {
    // This effect runs only once on component mount to handle URL hash
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
      console.log('Detected auth tokens in URL hash in component mount effect');
      setInvitationFlow(true);
      
      // Let the Supabase client handle the tokens automatically
      // We'll check for session in the next effect
    }
  }, []);

  // Initialize auth state on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        console.log('Initializing auth state for password update...');
        
        // FIRST CHECK: Get current session - this is the most reliable approach
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData?.session) {
          console.log('Found existing session on update-password page load', {
            email: sessionData.session.user.email,
            created_at: sessionData.session.user.created_at,
            last_sign_in_at: sessionData.session.user.last_sign_in_at
          });
          
          if (sessionData.session.user.email) {
            setInviteEmail(sessionData.session.user.email);
          }
          
          setCurrentSessionData({
            session: sessionData.session,
            user: sessionData.session.user
          });
          setSessionEstablished(true);
          setInvitationFlow(true); // Assume this is invitation flow if we have a session
          setAuthReady(true);
          setLoading(false);
          return; // We have a valid session, no need to check URL parameters
        }
        
        // SECOND CHECK: If no active session, check URL parameters
        
        // Check for recovery token in URL
        const code = searchParams.get('code');
        const type = searchParams.get('type');
        
        // Check for hash parameters (used in invitation flows)
        const hashParams = new URLSearchParams(
          typeof window !== 'undefined' ? window.location.hash.substring(1) : ''
        );
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const tokenType = hashParams.get('type');
        
        console.log('URL parameters:', { 
          code, 
          type, 
          hasHash: typeof window !== 'undefined' && !!window.location.hash,
          hashLength: typeof window !== 'undefined' ? window.location.hash.length : 0,
          accessToken: accessToken ? 'present' : 'not present',
          refreshToken: refreshToken ? 'present' : 'not present',
          tokenType
        });
        
        // Determine if this is an invitation flow
        if (type === 'invite' || type === 'signup' || tokenType === 'invite') {
          console.log('Detected invitation flow from URL parameters');
          setInvitationFlow(true);
        }
        
        // Process tokens if present in URL hash (invitation flow)
        if (accessToken && refreshToken) {
          console.log('Found tokens in URL hash, setting session');
          try {
            // Wait a moment to ensure Supabase client has initialized
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const { data: _sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (sessionError) {
              console.error('Error setting session from tokens:', sessionError);
              setError(`Error al establecer la sesión: ${sessionError.message}`);
            } else if (_sessionData.user) {
              console.log('Session set successfully from URL tokens', _sessionData);
              setInviteEmail(_sessionData.user.email || null);
              setCurrentSessionData({
                session: _sessionData.session,
                user: _sessionData.user
              });
              setSessionEstablished(true);
            }
            
            setAuthReady(true);
            setLoading(false);
          } catch (error) {
            console.error('Exception setting session from tokens:', error);
            setError('Error al procesar la invitación');
            setAuthReady(true);
            setLoading(false);
          }
          return; // Processed tokens, no need to continue
        }
        
        // Process recovery code if present
        if (code) {
          console.log('Exchanging recovery code for session');
          try {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
              console.error('Error exchanging code:', error.message);
              setError(`Error al procesar el código de recuperación: ${error.message}`);
            } else {
              // Get the session after exchange
              const { data: newSession } = await supabase.auth.getSession();
              
              if (newSession?.session?.user?.email) {
                setInviteEmail(newSession.session.user.email);
              }
              
              setCurrentSessionData({
                session: newSession.session,
                user: newSession.session?.user || null
              });
              setSessionEstablished(!!newSession.session);
              console.log('Successfully exchanged code for session', newSession);
            }
          } catch (exchangeError) {
            console.error('Exception during code exchange:', exchangeError);
            setError('Error al procesar el código de recuperación');
          }
          
          setAuthReady(true);
          setLoading(false);
          return; // Processed code, no need to continue
        }
        
        // If we reach here, we have no session and no URL parameters
        // Do one final session check just to be sure
        const { data: finalSessionCheck } = await supabase.auth.getSession();
        
        if (finalSessionCheck?.session) {
          console.log('Session found in final check:', finalSessionCheck.session.user.email);
          if (finalSessionCheck.session.user.email) {
            setInviteEmail(finalSessionCheck.session.user.email);
          }
          setCurrentSessionData({
            session: finalSessionCheck.session,
            user: finalSessionCheck.session.user
          });
          setSessionEstablished(true);
          setInvitationFlow(true);
        } else {
          // We truly have no session
          console.log('No auth data found after all checks');
          setError(
            'No se encontró información de autenticación válida. ' +
            'Por favor, utiliza el enlace de invitación que recibiste por correo electrónico o contacta al administrador.'
          );
        }
        
        setAuthReady(true);
        setLoading(false);
      } catch (err) {
        console.error('Error initializing auth:', err);
        setError('Error al inicializar la autenticación');
        setAuthReady(true);
        setLoading(false);
      }
    };
    
    initializeAuth();
    
    // Set up a fallback timer to ensure we don't get stuck
    const fallbackTimer = setTimeout(() => {
      console.log('Fallback timeout triggered - forcing authReady state');
      setAuthReady(true);
      setLoading(false);
      
      // Check session one more time before giving up
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          console.log('Session found in fallback check', data.session.user.email);
          setSessionEstablished(true);
          setInviteEmail(data.session.user.email || null);
          setInvitationFlow(true);
        } else {
          console.log('No session found in fallback check');
        }
      });
    }, 5000);
    
    return () => clearTimeout(fallbackTimer);
  }, [searchParams]);

  // Set up auth state listener to detect password update events
  useEffect(() => {
    // Only set up the listener when we're ready and password update is attempted
    if (!authReady || !passwordUpdateAttempted) return;

    console.log('Setting up auth listener for password update (watching for USER_UPDATED event)');

    // Create a variable to store the interval ID for cleanup
    let countdownInterval: NodeJS.Timeout | null = null;

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event detected in password update:', event, session ? 'Session present' : 'No session');

        // Check for successful password update event
        if (event === 'USER_UPDATED' && passwordUpdateAttempted) {
          console.log('Password update confirmed through USER_UPDATED auth event');
          
          // Display success message
          setMessage('¡Contraseña actualizada con éxito!');
          setPassword('');
          setConfirmPassword('');
          setLoading(false);
          
          // Verify session before sign out (for debugging)
          const { data: sessionBefore } = await supabase.auth.getSession();
          console.log('Session before sign out attempt:', 
            sessionBefore?.session ? `Active (${sessionBefore.session.user.email})` : 'None'
          );
          
          // Force a small delay to ensure auth state is settled
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // IMPORTANT: Instead of trying multiple approaches sequentially, use a more
          // comprehensive approach that forces an immediate and complete logout
          
          try {
            console.log('Executing guaranteed forced logout sequence');
            
            // 1. Prepare a function to clear ALL storage mechanisms
            const clearAllStorageMechanisms = () => {
              console.log('Clearing all storage mechanisms');
              
              // Clear localStorage thoroughly
              try {
                // Clear all known Supabase auth keys
                const keysToTry = [
                  'supabase.auth.token',
                  'sb-access-token',
                  'sb-refresh-token',
                  'supabase.auth.expires_at',
                  'supabase.auth.expires_in'
                ];
                
                // Directly clear known keys
                keysToTry.forEach(key => {
                  try { localStorage.removeItem(key); } catch (_) {}
                });
                
                // Find and clear anything that looks like an auth token
                Object.keys(localStorage).forEach(key => {
                  if (key.toLowerCase().includes('auth') || 
                      key.toLowerCase().includes('token') || 
                      key.toLowerCase().includes('supabase') || 
                      key.toLowerCase().includes('sb-')) {
                    console.log(`Clearing auth-related localStorage key: ${key}`);
                    localStorage.removeItem(key);
                  }
                });
              } catch (error) {
                console.error('Error clearing localStorage:', error);
              }
              
              // Clear all cookies 
              try {
                console.log('Clearing all cookies');
                document.cookie.split(';').forEach(c => {
                  const cookieName = c.split('=')[0].trim();
                  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                  document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
                });
              } catch (cookieErr) {
                console.error('Error clearing cookies:', cookieErr);
              }
              
              // Try clearing sessionStorage too, just to be thorough
              try {
                sessionStorage.clear();
              } catch (sessionErr) {
                console.error('Error clearing sessionStorage:', sessionErr);
              }
            };
            
            // 2. First try the official signOut method with global scope
            console.log('Executing signOut with global scope');
            await supabase.auth.signOut({ scope: 'global' });
            
            // 3. Clear ALL storage regardless of signOut success
            clearAllStorageMechanisms();
            
            // 4. Check if we're still logged in
            const { data: checkSession } = await supabase.auth.getSession();
            
            if (checkSession?.session) {
              console.log('Still logged in after first attempt, trying more aggressive approach');
              
              // 5. If still logged in, create a new supabase client
              // This is a drastic measure but should help break any lingering connections
              try {
                const { createClient } = await import('@supabase/supabase-js');
                const freshClient = createClient(
                  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
                  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
                  { 
                    auth: { 
                      persistSession: false // Critical: don't persist this session
                    }
                  }
                );
                
                // Try another signOut with the fresh client
                await freshClient.auth.signOut({ scope: 'global' });
                console.log('Executed signOut with fresh client');
                
                // Clear all storage again for good measure
                clearAllStorageMechanisms();
              } catch (freshClientErr) {
                console.error('Error creating fresh client:', freshClientErr);
              }
            }
            
            // 6. Set a flag in sessionStorage to force login page to execute extra logout logic
            try {
              sessionStorage.setItem('force_complete_logout', 'true');
            } catch (_) {
              console.error('Failed to set session storage flag');
            }
            
            console.log('Forced logout sequence completed');
            
          } catch (err) {
            console.error('Exception during guaranteed forced logout process:', err);
          }
          
          // Start countdown for auto-redirect regardless of sign out success
          let count = 3; // Shorter countdown for better UX
          setCountdown(count);
          
          // Set up countdown timer for UI feedback
          countdownInterval = setInterval(() => {
            count -= 1;
            setCountdown(count);
            
            if (count <= 0) {
              if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
              }
              
              // IMPORTANT: Use full page reload to /login with force_logout=true
              // rather than just a router.push which keeps the JS context
              console.log('Countdown complete, performing hard redirect to login');
              
              // Use more advanced approach for hard reload:
              // 1. Add special flags to URL
              // 2. Use a unique timestamp for cache busting
              // 3. Force a complete page reload
              const loginUrl = new URL('/login', window.location.origin);
              loginUrl.searchParams.set('force_logout', 'true');
              loginUrl.searchParams.set('t', Date.now().toString());
              loginUrl.searchParams.set('reason', 'password_update');
              
              // Force a hard navigation through window.location instead of router
              window.location.href = loginUrl.toString();
            }
          }, 1000);
        }
      }
    );

    // Clean up subscription and any active interval on unmount
    return () => {
      subscription.unsubscribe();
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [authReady, passwordUpdateAttempted, router]);

  // Add a dedicated auto-redirect after successful password update
  useEffect(() => {
    if (message && countdown === 0) {
      console.log('Auto-redirecting to login page after password update');
      
      // Set the special flag to ensure login page knows this is a complete logout
      try {
        sessionStorage.setItem('force_complete_logout', 'true');
      } catch (_error) {
        console.error('Failed to set session storage flag');
      }
      
      // Do one final storage clearing before navigation
      try {
        // Clear localStorage thoroughly
        const keysToTry = [
          'supabase.auth.token',
          'sb-access-token',
          'sb-refresh-token',
          'supabase.auth.expires_at',
          'supabase.auth.expires_in'
        ];
        
        keysToTry.forEach(key => {
          try { localStorage.removeItem(key); } catch (_storageError) {}
        });
        
        Object.keys(localStorage).forEach(key => {
          if (key.toLowerCase().includes('auth') || 
              key.toLowerCase().includes('token') || 
              key.toLowerCase().includes('supabase') || 
              key.toLowerCase().includes('sb-')) {
            localStorage.removeItem(key);
          }
        });
        
        // Clear cookies 
        document.cookie.split(';').forEach(c => {
          const cookieName = c.split('=')[0].trim();
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
        });
      } catch (_clearError) {
        console.error('Error in final storage clearing:', _clearError);
      }
      
      // Use more advanced approach for hard reload
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('force_logout', 'true');
      loginUrl.searchParams.set('t', Date.now().toString());
      loginUrl.searchParams.set('reason', 'password_update');
      
      // Force a hard navigation through window.location
      window.location.href = loginUrl.toString();
    }
  }, [message, countdown, router]);

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
    setPasswordUpdateAttempted(true);

    try {
      console.log('Attempting to update password...');
      
      // Verify we have a valid session before updating
      const { data: currentSession } = await supabase.auth.getSession();
      console.log('Current session before password update:', 
        currentSession?.session ? 'Valid session' : 'No valid session',
        currentSession?.session?.user?.email || 'No email'
      );
      
      if (!currentSession?.session) {
        console.error('No valid session found for password update');
        
        // For invitation flows, try to recover the session from URL hash
        if (invitationFlow && typeof window !== 'undefined' && window.location.hash) {
          console.log('Attempting to recover session from URL hash for invitation flow');
          
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            try {
              const { data: _sessionData, error: _sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (_sessionError) {
                console.error('Error recovering session from hash:', _sessionError);
                setError(`Error al recuperar la sesión: ${_sessionError.message}`);
                setLoading(false);
                setPasswordUpdateAttempted(false);
                return;
              }
              
              console.log('Session recovered successfully for password update');
              // Continue with password update
            } catch (_error) {
              console.error('Exception recovering session:', _error);
              setError('Error al recuperar la sesión para actualizar la contraseña');
              setLoading(false);
              setPasswordUpdateAttempted(false);
              return;
            }
          } else {
            setError("No hay una sesión válida. Por favor, intenta acceder nuevamente desde el enlace de invitación.");
            setLoading(false);
            setPasswordUpdateAttempted(false);
            return;
          }
        } else {
          setError("No hay una sesión válida. Por favor, intenta acceder nuevamente desde el enlace de invitación.");
          setLoading(false);
          setPasswordUpdateAttempted(false);
          return;
        }
      }
      
      // Update password directly using the authenticated session
      const { data: userData, error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Error al actualizar la contraseña:', error);
        
        // Check for the specific "same password" error
        if (error.message && error.message.includes("different from the old password")) {
          setError("La nueva contraseña debe ser diferente a la contraseña actual");
        } else {
          setError(`Error al actualizar la contraseña: ${error.message}`);
        }
        
        setLoading(false);
        setPasswordUpdateAttempted(false);
        return;
      }

      // Log success even if the auth event doesn't fire
      console.log('Password update API call completed successfully', userData);
      
      // If we don't get an auth event within 3 seconds, show success anyway
      const fallbackTimer = setTimeout(() => {
        if (passwordUpdateAttempted) {
          console.log('Auth event not detected, showing success message anyway');
          setMessage("La contraseña se ha actualizado correctamente. Serás redirigido a la página de inicio de sesión.");
          setPassword('');
          setConfirmPassword('');
          setLoading(false);
          setCountdown(5);
          setPasswordUpdateAttempted(false);
        }
      }, 3000);
      
      return () => clearTimeout(fallbackTimer);
      
    } catch (err) {
      console.error('Error inesperado al cambiar la contraseña:', err);
      setError('Ocurrió un error inesperado al cambiar la contraseña');
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
          
          {/* Show session status for debugging */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 text-xs text-gray-500">
              <p>Estado de sesión: {sessionEstablished ? 'Establecida' : 'No establecida'}</p>
              <button 
                onClick={async () => {
                  try {
                    const { data } = await supabase.auth.getSession();
                    console.log('Current session debug:', data);
                    alert(
                      `Session debug:\n` +
                      `Has session: ${!!data.session}\n` +
                      `User email: ${data.session?.user?.email || 'none'}\n` +
                      `Expires at: ${data.session?.expires_at ? new Date(data.session.expires_at * 1000).toLocaleString() : 'n/a'}`
                    );
                  } catch (err) {
                    console.error('Error checking session:', err);
                    alert('Error checking session: ' + String(err));
                  }
                }}
                className="mt-1 text-xs text-indigo-600 underline"
              >
                Debug Session
              </button>
            </div>
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
                href="/login?force_logout=true"
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
              disabled={countdown !== null || loading}
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
              disabled={countdown !== null || loading}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || countdown !== null}
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
              href="/login?force_logout=true"
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

// Loading fallback component
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