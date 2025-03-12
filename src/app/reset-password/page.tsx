'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    try {
      // Get the site URL with fallback
      const origin = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_APP_URL || 'https://cotizaciones-concreto.vercel.app';
      
      console.log('Using origin for reset password:', origin);
      
      // Create a redirect URL with a type parameter to identify the flow
      const redirectTo = `${origin}/update-password?type=recovery`;
      console.log('Reset password redirect URL:', redirectTo);
      
      // Clear any existing sessions before sending reset email to avoid conflicts
      try {
        await supabase.auth.signOut();
        console.log('Signed out existing user before password reset');
      } catch (signOutError) {
        console.error('Error during sign out before reset:', signOutError);
        // Continue anyway
      }
      
      // Send the password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) {
        console.error('Reset password error:', error);
        setError(error.message);
      } else {
        console.log('Reset password email sent successfully');
        console.log('Email will contain a link to:', redirectTo);
        setMessage(
          'Se ha enviado un correo para restablecer tu contraseña. Por favor, revisa tu bandeja de entrada.'
        );
      }
    } catch (err) {
      console.error('Unexpected error during reset password:', err);
      setError('Ocurrió un error al enviar el correo. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Recuperar Contraseña</h1>
          <p className="mt-2 text-sm text-gray-600">
            Ingresa tu correo para recibir instrucciones de recuperación
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
              {loading ? 'Enviando...' : 'Enviar Instrucciones'}
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