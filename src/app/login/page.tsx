'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Create a client component that uses useSearchParams
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginAttempted, setLoginAttempted] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, isAuthenticated } = useAuth();

  // Listen for auth state changes to improve login flow
  useEffect(() => {
    if (!loginAttempted) return;

    // Set up auth change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        console.log('Auth event detected in login page:', event);
        
        if (event === 'SIGNED_IN') {
          console.log('Login confirmed through auth event');
          setLoading(false);
          setLoginAttempted(false);
          router.push('/dashboard');
        }
      }
    );
    
    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [loginAttempted, router]);

  // Check for updated=true parameter in URL
  useEffect(() => {
    const isUpdated = searchParams.get('updated') === 'true';
    if (isUpdated) {
      setSuccess('Tu contraseña ha sido actualizada con éxito. Por favor, inicia sesión con tu nueva contraseña.');
    }
    
    // Check for force_logout parameter which indicates we need to ensure the user is logged out
    const forceLogout = searchParams.get('force_logout') === 'true';
    if (forceLogout) {
      console.log('Detected force_logout parameter, ensuring user is completely logged out');
      
      // Execute complete logout process
      const performForceLogout = async () => {
        try {
          console.log('Executing force logout on login page');
          
          // First check for the special flag that indicates we need complete logout
          const needsCompleteLogout = sessionStorage.getItem('force_complete_logout') === 'true';
          console.log('Complete logout required:', needsCompleteLogout);
          
          // Clear the flag so we don't repeat this unnecessarily
          try {
            sessionStorage.removeItem('force_complete_logout');
          } catch (_) {}
          
          // Define a thorough storage clearing function
          const clearAllStorage = () => {
            // Clear localStorage
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
            } catch (storageErr) {
              console.error('Error clearing localStorage:', storageErr);
            }
            
            // Clear all cookies
            try {
              document.cookie.split(';').forEach(c => {
                const cookieName = c.split('=')[0].trim();
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`;
              });
            } catch (cookieErr) {
              console.error('Error clearing cookies:', cookieErr);
            }
            
            // Clear sessionStorage
            try {
              sessionStorage.clear();
            } catch (_) {}
          };
          
          // Execute signOut with multiple approaches
          try {
            // Try global signOut first
            await supabase.auth.signOut({ scope: 'global' });
            
            // Create a fresh client with persistSession: false
            const { createClient } = await import('@supabase/supabase-js');
            const freshClient = createClient(
              process.env.NEXT_PUBLIC_SUPABASE_URL || '',
              process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              { 
                auth: { 
                  persistSession: false
                }
              }
            );
            
            // Try another signOut with this client
            await freshClient.auth.signOut({ scope: 'global' });
          } catch (signOutErr) {
            console.error('Error during sign out:', signOutErr);
          }
          
          // Clear all storage
          clearAllStorage();
          
          // Check if we're still logged in after all this
          const { data: checkSession } = await supabase.auth.getSession();
          if (checkSession?.session) {
            console.log('CRITICAL: Still logged in after all logout attempts. Trying page reload.');
            
            // If we're still logged in, something is very wrong - try reloading the page
            if (needsCompleteLogout) {
              window.location.reload();
            }
          } else {
            console.log('Logout successful, user is signed out');
          }
          
          // Display a message indicating the logout was forced
          setSuccess('La sesión se ha cerrado para proteger tu cuenta después de actualizar la contraseña. Por favor, inicia sesión con tu nueva contraseña.');
        } catch (err) {
          console.error('Exception during force logout:', err);
        }
      };
      
      performForceLogout();
    }
  }, [searchParams]);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    setLoginAttempted(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        console.error('Login error details:', error);
        
        // Check for specific error types
        if (error.message?.includes('profile not found')) {
          setError('Tu cuenta existe pero no tiene un perfil asociado. Por favor, contacta al administrador.');
        } else if (error.message?.includes('Invalid login credentials')) {
          setError('Credenciales inválidas. Por favor, verifica tu correo y contraseña.');
        } else if (error.message?.includes('Email not confirmed')) {
          setError('Tu correo electrónico no ha sido confirmado. Por favor, revisa tu bandeja de entrada.');
        } else {
          setError(`Error al iniciar sesión: ${error.message || 'Credenciales inválidas'}`);
        }
        
        setLoading(false);
        setLoginAttempted(false);
      }
      // Success case is handled by the auth state change listener
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('Ocurrió un error inesperado al iniciar sesión. Por favor, intenta de nuevo.');
      setLoading(false);
      setLoginAttempted(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Iniciar Sesión</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sistema de Gestión de Cotizaciones | DC Concretos
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
            {success}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Correo Electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                         focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="text-sm">
              <Link 
                href="/reset-password" 
                className="font-medium text-indigo-600 hover:text-indigo-500"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
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
              {loading ? 'Cargando...' : 'Iniciar Sesión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Loading component to show while the search params are being loaded
function LoginLoading() {
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

// Main page component with Suspense boundary around the component that uses useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
} 