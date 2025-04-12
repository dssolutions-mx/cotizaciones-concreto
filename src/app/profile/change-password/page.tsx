'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const { session, isLoading: authLoading, signOut } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [passwordUpdateAttempted, setPasswordUpdateAttempted] = useState(false);
  const router = useRouter();

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
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-pulse text-center">
          <div className="h-12 w-48 bg-gray-200 rounded-md mx-auto mb-4"></div>
          <div className="h-4 w-64 bg-gray-200 rounded-md mx-auto"></div>
        </div>
      </div>
    );
  }

  // Redirect unauthenticated users
  if (!session && !authLoading) {
    // This should automatically redirect via the AuthProvider, but just in case:
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600 mb-2">
          Acceso no autorizado
        </h1>
        <p className="text-gray-600 mb-4">
          Debes iniciar sesión para acceder a esta página.
        </p>
        <Link
          href="/login"
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Ir al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Cambiar Contraseña</h1>

      {message && (
        <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
          <p className="font-medium">{message}</p>
          {countdown !== null && (
            <p className="font-medium mt-2">
              Cerrando sesión en {countdown} segundo{countdown !== 1 ? 's' : ''}...
            </p>
          )}
          <div className="mt-4 flex justify-center">
            <Link
              href="/login"
              className="px-4 py-2 bg-indigo-600 text-white text-center font-medium rounded hover:bg-indigo-700"
            >
              Ir a Iniciar Sesión
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="newPassword">
            Nueva Contraseña
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-hidden focus:shadow-outline"
            required
            disabled={countdown !== null || loading}
          />
        </div>

        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="confirmPassword">
            Confirmar Nueva Contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-hidden focus:shadow-outline"
            required
            disabled={countdown !== null || loading}
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 mt-6">
          <Link
            href="/profile"
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            Volver al Perfil
          </Link>
          
          <button
            type="submit"
            disabled={loading || countdown !== null}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-hidden focus:shadow-outline disabled:opacity-50"
          >
            {loading ? 'Actualizando...' : 'Cambiar Contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
} 