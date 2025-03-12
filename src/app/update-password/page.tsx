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
            
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (sessionError) {
              console.error('Error setting session from tokens:', sessionError);
              setError(`Error al establecer la sesión: ${sessionError.message}`);
            } else if (sessionData.user) {
              console.log('Session set successfully from URL tokens', sessionData);
              setInviteEmail(sessionData.user.email || null);
              setCurrentSessionData({
                session: sessionData.session,
                user: sessionData.user
              });
              setSessionEstablished(true);
            }
            
            setAuthReady(true);
            setLoading(false);
          } catch (err) {
            console.error('Exception setting session from tokens:', err);
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
    if (loading || !authReady || passwordUpdateAttempted) return;

    console.log('Setting up auth listener for password update. please adhere to the @Supabase auth and @subaserules.mdc');

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event detected in password update:', event, session ? 'Session present' : 'No session');

        // Check for successful password update
        if (event === 'USER_UPDATED' && passwordUpdateAttempted) {
          console.log('Password update confirmed through auth event');
          
          // Display success message
          setMessage('¡Contraseña actualizada con éxito!');
          setLoading(false);
          
          // Start countdown for auto-redirect
          let count = 5;
          setCountdown(count);
          
          // Explicitly logout the user and redirect
          const countdown = setInterval(async () => {
            count -= 1;
            setCountdown(count);
            
            if (count <= 0) {
              clearInterval(countdown);
              
              // Explicitly sign out the user
              try {
                console.log('Signing out user after password update');
                const { error } = await supabase.auth.signOut();
                if (error) {
                  console.error('Error signing out:', error);
                }
              } catch (err) {
                console.error('Exception during sign out:', err);
              }
              
              // Redirect to login page regardless of sign out result
              try {
                router.push('/login');
              } catch (navError) {
                console.error('Navigation error:', navError);
                // Direct fallback
                window.location.href = '/login';
              }
            }
          }, 1000);
        }
      }
    );

    // Clean up subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [loading, authReady, passwordUpdateAttempted, router]);

  // Effect to handle countdown and redirect
  useEffect(() => {
    // Skip this effect as we're now handling countdown in the auth state change handler
    if (countdown === null || !message) return;
    
    // Keep this effect only for fallback/compatibility with the rest of the code
    // but don't trigger any redirects from here, as they're handled in the auth state change handler
  }, [countdown, message, router]);

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
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
              
              if (sessionError) {
                console.error('Error recovering session from hash:', sessionError);
                setError(`Error al recuperar la sesión: ${sessionError.message}`);
                setLoading(false);
                setPasswordUpdateAttempted(false);
                return;
              }
              
              console.log('Session recovered successfully for password update');
              // Continue with password update
            } catch (err) {
              console.error('Exception recovering session:', err);
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