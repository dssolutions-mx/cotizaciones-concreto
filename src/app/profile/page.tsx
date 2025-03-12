'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { authService } from '@/lib/supabase/auth';

export default function ProfilePage() {
  const { userProfile, loading, refreshSession } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Use useEffect to update the state when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.first_name || '');
      setLastName(userProfile.last_name || '');
    }
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setSaving(true);

    try {
      // Use the enhanced profile update method with retry logic
      if (!userProfile?.id) {
        throw new Error('ID de usuario no disponible');
      }
      
      await authService.updateUserProfile(userProfile.id, {
        first_name: firstName,
        last_name: lastName,
      });

      // Also manually refresh the session to ensure changes are reflected
      await refreshSession();
      
      // Add a second refresh after a short delay to ensure changes are reflected
      setTimeout(async () => {
        await refreshSession();
        console.log('Second refresh completed after profile update');
      }, 500);
      
      setMessage('Perfil actualizado correctamente');
      setTimeout(() => setMessage(null), 3000);
    } catch (err: unknown) {
      console.error('Error al actualizar perfil:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar el perfil';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Función para mapear rol a texto en español
  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'SALES_AGENT':
        return 'Vendedor';
      case 'QUALITY_TEAM':
        return 'Equipo de Calidad';
      case 'PLANT_MANAGER':
        return 'Jefe de Planta';
      case 'EXECUTIVE':
        return 'Directivo';
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="animate-pulse text-center">
          <div className="h-12 w-48 bg-gray-200 rounded-md mx-auto mb-4"></div>
          <div className="h-4 w-64 bg-gray-200 rounded-md mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600 mb-2">
          No se ha encontrado el perfil
        </h1>
        <p className="text-gray-600 mb-4">
          No se ha podido cargar la información del usuario.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Volver al inicio de sesión
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Mi Perfil</h1>

      {message && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="bg-gray-50 p-4 rounded-md mb-6">
        <div className="mb-2">
          <span className="text-sm font-medium text-gray-500">Email:</span>
          <span className="ml-2 text-gray-800">{userProfile.email}</span>
        </div>
        <div className="mb-2">
          <span className="text-sm font-medium text-gray-500">Rol:</span>
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
            {getRoleDisplay(userProfile.role)}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="firstName">
            Nombre
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="lastName">
            Apellido
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          />
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/profile/change-password')}
            className="bg-gray-100 text-gray-800 hover:bg-gray-200 font-medium py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Cambiar Contraseña
          </button>
          
          <button
            type="submit"
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
} 