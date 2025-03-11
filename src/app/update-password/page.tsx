'use client';

import { useState, useEffect, Suspense } from 'react';
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
  useEffect(() => {
    const checkSession = async () => {
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
    };
    
    checkSession();
  }, [searchParams, isInvitation]);

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
      
      // Try to update password without checking session first
      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) {
        console.error('Error updating password:', error);
        setError(error.message);
        setLoading(false);
        return;
      }
      
      console.log('Password updated successfully');
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