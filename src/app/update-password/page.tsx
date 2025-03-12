'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
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

  // Initialize auth state on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setLoading(true);
        console.log('Initializing auth state for password update...');
        
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
        
        // Determine if this is an invitation flow
        if (type === 'invite' || type === 'signup' || tokenType === 'invite') {
          console.log('Detected invitation flow');
          setInvitationFlow(true);
        }
        
        // First check if we have tokens in the URL hash (invitation flow)
        if (accessToken && refreshToken) {
          console.log('Found tokens in URL hash, setting session');
          try {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              console.error('Error setting session from tokens:', error);
              setError(`Error al establecer la sesión: ${error.message}`);
            } else if (data.user) {
              console.log('Session set successfully from tokens', data);
              setInviteEmail(data.user.email || null);
              setCurrentSessionData({
                session: data.session,
                user: data.user
              });
            }
            
            setAuthReady(true);
          } catch (err) {
            console.error('Exception setting session from tokens:', err);
            setError('Error al procesar la invitación');
            setAuthReady(true);
          }
        }
        // Check current session if no tokens in URL
        else {
          // Check current session first
          const { data: sessionData } = await supabase.auth.getSession();
          
          if (sessionData?.session) {
            console.log('Found existing session', {
              email: sessionData.session.user.email,
            });
            
            if (sessionData.session.user.email) {
              setInviteEmail(sessionData.session.user.email);
            }
            
            setCurrentSessionData({
              session: sessionData.session,
              user: sessionData.session.user
            });
            setAuthReady(true);
          } 
          // If no session but we have a recovery code, exchange it
          else if (code) {
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
                console.log('Successfully exchanged code for session', newSession);
              }
            } catch (exchangeError) {
              console.error('Exception during code exchange:', exchangeError);
              setError('Error al procesar el código de recuperación');
            }
            
            setAuthReady(true);
          } else {
            console.log('No auth data found');
            setError('No se encontró información de autenticación válida');
            setAuthReady(true);
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        setError('Error al inicializar la autenticación');
        setAuthReady(true);
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
    
    // Set up a fallback timer to ensure we don't get stuck
    const fallbackTimer = setTimeout(() => {
      console.log('Fallback timeout triggered - forcing authReady state');
      setAuthReady(true);
      setLoading(false);
    }, 5000);
    
    return () => clearTimeout(fallbackTimer);
  }, [searchParams]);

  // Listen for auth state changes to detect when password is updated
  useEffect(() => {
    if (!passwordUpdateAttempted) return;

    console.log('Setting up auth listener for password update. please addhere to the @Supabase auth and @subaserules.mdc');
    // Set up auth change listener to detect USER_UPDATED event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event detected in password update:', event, session ? 'Session present' : 'No session');
        
        if (event === 'USER_UPDATED') {
          console.log('Password update confirmed through auth event');
          setMessage("La contraseña se ha actualizado correctamente. Serás redirigido a la página de inicio de sesión.");
          setPassword('');
          setConfirmPassword('');
          setLoading(false);
          setCountdown(5);
          setPasswordUpdateAttempted(false);
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [passwordUpdateAttempted]);

  // Effect to handle countdown and redirect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (countdown !== null) {
      console.log(`Countdown: ${countdown}`);
      
      if (countdown <= 0) {
        console.log('Countdown complete, redirecting to login');
        // Sign out and redirect
        supabase.auth.signOut().then(() => {
          router.push('/login');
        });
        return;
      }
      
      timer = setTimeout(() => {
        setCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown, router]);

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
        setError("No hay una sesión válida. Por favor, intenta acceder nuevamente desde el enlace de invitación.");
        setLoading(false);
        setPasswordUpdateAttempted(false);
        return;
      }
      
      // Update password directly using the authenticated session
      const { data, error } = await supabase.auth.updateUser({
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
      console.log('Password update API call completed successfully', data);
      
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