'use client';

import { useState, useEffect } from 'react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';

export default function ChangePasswordPage() {
  const { session, isLoading: authLoading, signOut, profile } = useAuthBridge();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [passwordUpdateAttempted, setPasswordUpdateAttempted] = useState(false);
  const router = useRouter();
  const isClientPortalUser = profile?.role === 'EXTERNAL_CLIENT';

  // Listen for auth state changes to detect when password is updated
  useEffect(() => {
    if (!passwordUpdateAttempted) return;

    // Set up auth change listener to detect USER_UPDATED event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        console.log('Auth event detected in password change page:', event);
        
        if (event === 'USER_UPDATED') {
          console.log('Password update confirmed through auth event');
          // Password updated successfully
          setMessage("La contraseña se ha actualizado correctamente. Por razones de seguridad, se cerrará tu sesión automáticamente.");
          setNewPassword('');
          setConfirmPassword('');
          setLoading(false);
          
          // Start countdown for logout
          console.log('Starting countdown for logout');
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
      if (countdown <= 0) {
        console.log('Countdown complete, redirecting to login');
        router.push('/login');
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

  // Effect to handle direct signout
  useEffect(() => {
    const performSignOut = async () => {
      if (countdown === 1) {
        try {
          console.log('Executing signOut from useEffect');
          await signOut();
        } catch (error) {
          console.error('Error in signOut from useEffect:', error);
          // Force redirect anyway
          router.push('/login');
        }
      }
    };

    performSignOut();
  }, [countdown, signOut, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    setLoading(true);
    setPasswordUpdateAttempted(true);

    try {
      console.log('Attempting to update password...');
      // Update password directly using the authenticated session
      const { error } = await supabase.auth.updateUser({
        password: newPassword
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

      // The success case is now handled by the auth state change listener
      console.log('Password update API call completed successfully');
      // We don't set success message here because it will be set by the auth state change listener
      
    } catch (err) {
      console.error('Error inesperado al cambiar la contraseña:', err);
      setError('Ocurrió un error inesperado al cambiar la contraseña');
      setLoading(false);
      setPasswordUpdateAttempted(false);
    }
  };

  // Show loading state while authentication status is being checked
  if (authLoading) {
    return (
      <Container>
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="animate-pulse text-center">
            <div className="h-12 w-48 bg-gray-200 rounded-2xl mx-auto mb-4"></div>
            <div className="h-4 w-64 bg-gray-200 rounded-xl mx-auto"></div>
          </div>
        </div>
      </Container>
    );
  }

  // Redirect unauthenticated users
  if (!session && !authLoading) {
    return (
      <Container>
        <div className="text-center py-12">
          <div className="glass-thick rounded-3xl p-8 max-w-md mx-auto">
            <h1 className="text-title-1 font-bold text-red-600 mb-2">
              Acceso no autorizado
            </h1>
            <p className="text-body text-label-secondary mb-4">
              Debes iniciar sesión para acceder a esta página.
            </p>
            <Link
              href="/login"
              className="inline-block px-6 py-3 text-callout font-semibold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-lg"
            >
              Ir al inicio de sesión
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  const backLink = isClientPortalUser ? '/client-portal' : '/profile';

  return (
    <Container maxWidth="md">
      <div className="glass-thick rounded-3xl p-8 border border-white/30 shadow-2xl">
        <div className="text-center mb-8">
          <div className="mb-4">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${isClientPortalUser ? 'bg-blue-100' : 'bg-indigo-100'} mb-4`}>
              <svg className={`w-8 h-8 ${isClientPortalUser ? 'text-blue-600' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h1 className="text-title-1 font-bold text-label-primary">Cambiar Contraseña</h1>
          {isClientPortalUser && (
            <p className="mt-2 text-callout text-label-secondary">
              Actualiza tu contraseña para mantener tu cuenta segura
            </p>
          )}
        </div>

        {message && (
          <div className="mb-6 p-4 glass-thin rounded-2xl border border-green-200/50 bg-green-50/50">
            <p className="text-callout text-green-700 font-medium">{message}</p>
            {countdown !== null && (
              <p className="text-body font-semibold text-green-800 mt-2">
                Cerrando sesión en {countdown} segundo{countdown !== 1 ? 's' : ''}...
              </p>
            )}
            <div className="mt-4 flex justify-center">
              <Link
                href="/login"
                className="px-6 py-3 text-callout font-semibold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-all shadow-lg"
              >
                Ir a Iniciar Sesión
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 glass-thin rounded-2xl border border-red-200/50 bg-red-50/50">
            <p className="text-callout text-red-700 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-callout font-medium text-label-primary mb-2" htmlFor="newPassword">
              Nueva Contraseña
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 glass-thin rounded-2xl border border-white/20 
                         text-body text-label-primary placeholder:text-label-tertiary
                         focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600
                         transition-all disabled:opacity-50"
              required
              disabled={countdown !== null || loading}
            />
          </div>

          <div>
            <label className="block text-callout font-medium text-label-primary mb-2" htmlFor="confirmPassword">
              Confirmar Nueva Contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 glass-thin rounded-2xl border border-white/20 
                         text-body text-label-primary placeholder:text-label-tertiary
                         focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600
                         transition-all disabled:opacity-50"
              required
              disabled={countdown !== null || loading}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-4">
            <Link
              href={backLink}
              className="text-callout font-medium text-blue-600 hover:text-blue-700 transition-colors text-center sm:text-left"
            >
              {isClientPortalUser ? 'Volver al Portal' : 'Volver al Perfil'}
            </Link>
            
            <button
              type="submit"
              disabled={loading || countdown !== null}
              className="px-6 py-3 rounded-2xl text-callout font-semibold text-white bg-blue-600 hover:bg-blue-700 
                         focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-600
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
            </button>
          </div>
        </form>
      </div>
    </Container>
  );
} 