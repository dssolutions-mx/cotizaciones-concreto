'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// Create a client component that uses useSearchParams
function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const authBridge = useAuthBridge();
  const { signIn, profile } = authBridge;
  
  // Direct store subscription for debugging
  const directProfile = useAuthStore((s) => s.profile);
  
  // Debug: Log profile changes
  useEffect(() => {
    console.log('[Login] Profile from bridge:', profile);
    console.log('[Login] Profile from direct store:', directProfile);
    console.log('[Login] Profile from getState:', useAuthStore.getState().profile);
  }, [profile, directProfile]);

  // Handle role-based routing after authentication
  useEffect(() => {
    console.log('[Login] Profile effect triggered:', { 
      hasProfile: !!profile, 
      profileRole: profile?.role,
      loading,
      profileId: profile?.id
    });
    
    // Check for redirect parameter first (from password update flow)
    const redirectParam = searchParams.get('redirect');
    if (redirectParam && profile && !loading) {
      console.log(`[Login] Redirecting to specified target: ${redirectParam}`);
      router.push(redirectParam);
      return;
    }
    
    // If we have a profile and not loading, redirect to appropriate page
    if (profile && !loading) {
      let target = '/dashboard';

      switch (profile.role) {
        case 'EXTERNAL_CLIENT':
          target = '/client-portal';
          break;
        case 'QUALITY_TEAM':
          target = '/quality/muestreos';
          break;
        case 'LABORATORY':
        case 'PLANT_MANAGER':
          target = '/quality';
          break;
        default:
          target = '/dashboard';
      }

      console.log(`[Login] Redirecting ${profile.role} user to ${target}`);
      router.push(target);
    } else {
      console.log('[Login] Not redirecting:', { 
        reason: !profile ? 'no profile' : 'still loading'
      });
    }

  }, [profile, loading, router, searchParams]);

  // Handle URL parameters
  useEffect(() => {
    const isUpdated = searchParams.get('updated') === 'true';
    if (isUpdated) {
      setSuccess('Tu contraseña ha sido actualizada con éxito. Por favor, inicia sesión con tu nueva contraseña.');
    }

    const forceLogout = searchParams.get('force_logout') === 'true';
    if (forceLogout) {
      // Simple logout for password reset scenarios
      supabase.auth.signOut({ scope: 'global' });
      setSuccess('La sesión se ha cerrado. Por favor, inicia sesión con tu nueva contraseña.');
    }
  }, [searchParams]);

  // This effect is now handled by the profile-based routing above

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await signIn(email, password);
      
      if (result.error) {
        const msg = result.error;
        console.error('Login error details:', msg);

        if (msg.includes('profile not found') || msg.includes('Profile not found')) {
          setError('Tu cuenta existe pero no tiene un perfil asociado. Por favor, contacta al administrador.');
        } else if (msg.includes('Invalid login credentials')) {
          setError('Credenciales inválidas. Por favor, verifica tu correo y contraseña.');
        } else if (msg.includes('Email not confirmed')) {
          setError('Tu correo electrónico no ha sido confirmado. Por favor, revisa tu bandeja de entrada.');
        } else {
          setError(`Error al iniciar sesión: ${msg || 'Credenciales inválidas'}`);
        }
        setLoading(false);
        return;
      }
      
      // Success - profile should be loaded by signIn
      console.log('[Login] Sign in successful');
      
      // Get the profile directly from store to verify it's there
      const storeProfile = useAuthStore.getState().profile;
      console.log('[Login] Profile in store after signIn:', storeProfile);
      
      if (!storeProfile) {
        console.error('[Login] Profile not in store after successful signIn!');
        setError('Error al cargar el perfil. Por favor, recarga la página.');
        setLoading(false);
        return;
      }
      
      // Profile is in store, clear loading to trigger redirect
      setLoading(false);
      
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('Ocurrió un error inesperado al iniciar sesión. Por favor, intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Header */}
      <header className="relative z-10 bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/landing" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <Image
                src="/images/dcconcretos/logo-dark.svg"
                alt="DC Concretos"
                width={120}
                height={40}
                className="h-10 w-auto"
              />
              <span className="text-slate-600 text-sm font-medium">Portal de Gestión</span>
            </Link>

            <div className="flex items-center space-x-4">
              <Link
                href="/landing"
                className="group flex items-center space-x-2 text-slate-600 hover:text-slate-800 text-sm font-medium transition-all duration-200"
              >
                <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Regresar al sitio</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Welcome content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <div className="mb-8">
              <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                Bienvenido al Portal de Gestión
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed">
                Accede a tu panel personalizado con herramientas especializadas para tu rol en la organización.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto lg:mx-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Portal del Cliente</h3>
                <p className="text-sm text-slate-600">Seguimiento de pedidos, balances y calidad</p>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto lg:mx-0">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">Panel Interno</h3>
                <p className="text-sm text-slate-600">Gestión completa de operaciones</p>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Acceso Seguro</h4>
                  <p className="text-sm text-slate-600">Tu sesión será redirigida automáticamente según tu rol</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right side - Login form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Iniciar Sesión</h2>
              <p className="text-slate-600">
                Ingresa tus credenciales para continuar
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg"
              >
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg"
              >
                {success}
              </motion.div>
            )}

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                  placeholder="tu@empresa.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center justify-between">
                <Link
                  href="/reset-password"
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:transform-none hover:shadow-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Iniciando sesión...</span>
                  </div>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                ¿Problemas para acceder? Contacta al administrador del sistema.
              </p>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Image
                src="/images/dcconcretos/logo-dark.svg"
                alt="DC Concretos"
                width={100}
                height={32}
                className="h-8 w-auto"
              />
              <span className="text-slate-600 text-sm">Sistema de Gestión Empresarial</span>
            </div>
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} DC Concretos. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Loading component to show while the search params are being loaded
function LoginLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-200 rounded-lg animate-pulse"></div>
              <div className="w-24 h-4 bg-slate-200 rounded animate-pulse"></div>
            </div>
            <div className="w-20 h-4 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left side - Loading content */}
          <div className="text-center lg:text-left">
            <div className="mb-8">
              <div className="w-3/4 h-12 bg-slate-200 rounded-lg animate-pulse mx-auto lg:mx-0 mb-4"></div>
              <div className="w-full h-6 bg-slate-200 rounded animate-pulse mb-2"></div>
              <div className="w-2/3 h-6 bg-slate-200 rounded animate-pulse mx-auto lg:mx-0"></div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                  <div className="w-12 h-12 bg-slate-200 rounded-lg animate-pulse mx-auto lg:mx-0 mb-4"></div>
                  <div className="w-24 h-4 bg-slate-200 rounded animate-pulse mx-auto lg:mx-0 mb-2"></div>
                  <div className="w-32 h-3 bg-slate-200 rounded animate-pulse mx-auto lg:mx-0"></div>
                </div>
              ))}
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-200 rounded-full animate-pulse"></div>
                <div className="flex-1">
                  <div className="w-20 h-4 bg-slate-200 rounded animate-pulse mb-2"></div>
                  <div className="w-40 h-3 bg-slate-200 rounded animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Loading form */}
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
            <div className="text-center mb-8">
              <div className="w-32 h-8 bg-slate-200 rounded-lg animate-pulse mx-auto mb-2"></div>
              <div className="w-48 h-4 bg-slate-200 rounded animate-pulse mx-auto"></div>
            </div>

            <div className="space-y-6">
              <div>
                <div className="w-24 h-4 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="w-full h-12 bg-slate-200 rounded-lg animate-pulse"></div>
              </div>
              <div>
                <div className="w-20 h-4 bg-slate-200 rounded animate-pulse mb-2"></div>
                <div className="w-full h-12 bg-slate-200 rounded-lg animate-pulse"></div>
              </div>
              <div className="flex justify-between">
                <div className="w-32 h-4 bg-slate-200 rounded animate-pulse"></div>
              </div>
              <div className="w-full h-12 bg-slate-200 rounded-lg animate-pulse"></div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-center">
            <div className="w-32 h-4 bg-slate-200 rounded animate-pulse"></div>
          </div>
        </div>
      </footer>
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