'use client';

import { useState } from 'react';
import type { UserRole } from '@/store/auth/types';
import RoleGuard from '@/components/auth/RoleGuard';
import Link from 'next/link';
import { authService } from '@/lib/supabase/auth';

export default function InviteUserPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('SALES_AGENT');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      // Invitar al usuario a través del servicio
      await authService.inviteUser(email, role);
      setSuccess(`Invitación enviada a ${email} con éxito. El usuario recibirá un correo para configurar su contraseña.`);
      setEmail('');
      setRole('SALES_AGENT');
    } catch (err: unknown) {
      console.error('Error al invitar usuario:', err);
      setError(err instanceof Error ? err.message : 'Error al enviar la invitación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles="EXECUTIVE" redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Invitar Usuario</h1>
            <Link 
              href="/admin/users" 
              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
            >
              Volver a la lista
            </Link>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                Correo Electrónico *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-hidden focus:shadow-outline"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
                Rol *
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                required
                className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-hidden focus:shadow-outline"
              >
                <option value="SALES_AGENT">Vendedor</option>
                <option value="QUALITY_TEAM">Equipo de Calidad</option>
                <option value="PLANT_MANAGER">Jefe de Planta</option>
                <option value="EXECUTIVE">Directivo</option>
              </select>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-hidden focus:shadow-outline disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar Invitación'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
} 