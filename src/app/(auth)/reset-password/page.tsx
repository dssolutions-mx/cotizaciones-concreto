'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
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
      // Clear any existing sessions before sending reset email to avoid conflicts
      try {
        await supabase.auth.signOut();
        console.log('Signed out existing user before password reset');
      } catch (signOutError) {
        console.error('Error during sign out before reset:', signOutError);
        // Continue anyway
      }
      
      // Send password reset email via custom API route (uses SendGrid)
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Reset password error:', data.error);
        setError(data.error || 'Ocurrió un error al enviar el correo. Por favor, intenta de nuevo.');
      } else {
        console.log('Reset password email sent successfully');
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-primary p-4">
      <div className="w-full max-w-md p-8 space-y-8 glass-thick rounded-3xl border border-white/30 shadow-2xl">
        <div className="text-center">
          <div className="mb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <h1 className="text-title-1 font-bold text-label-primary">Recuperar Contraseña</h1>
          <p className="mt-2 text-callout text-label-secondary">
            Ingresa tu correo para recibir instrucciones de recuperación
          </p>
        </div>

        {error && (
          <div className="p-4 glass-thin rounded-2xl border border-red-200/50 bg-red-50/50">
            <p className="text-callout text-red-700 font-medium">{error}</p>
          </div>
        )}

        {message && (
          <div className="p-4 glass-thin rounded-2xl border border-green-200/50 bg-green-50/50">
            <p className="text-callout text-green-700 font-medium">{message}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-callout font-medium text-label-primary mb-2">
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
              className="w-full px-4 py-3 glass-thin rounded-2xl border border-white/20 
                         text-body text-label-primary placeholder:text-label-tertiary
                         focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-blue-600
                         transition-all"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-6 rounded-2xl 
                         text-callout font-semibold text-white bg-blue-600 hover:bg-blue-700 
                         focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-600
                         disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            >
              {loading ? 'Enviando...' : 'Enviar Instrucciones'}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="text-callout font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Volver a Iniciar Sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
} 