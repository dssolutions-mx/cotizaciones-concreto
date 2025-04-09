'use client';

import { useState, useEffect } from 'react';
import { UserRole } from '@/contexts/AuthContext';
import RoleGuard from '@/components/auth/RoleGuard';
import Link from 'next/link';
import { authService } from '@/lib/supabase/auth';
import { Search } from 'lucide-react';

interface UserData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  created_at: string;
  is_active?: boolean;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = users.filter(
        user => 
          (user.first_name?.toLowerCase().includes(term) || 
           user.last_name?.toLowerCase().includes(term) || 
           user.email.toLowerCase().includes(term))
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await authService.getAllUsers();
      setUsers(data || []);
    } catch (err: unknown) {
      console.error('Error loading users:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar usuarios';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setLoading(true);
      await authService.updateUserRole(userId, newRole);
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
      
      setEditingUser(null);
    } catch (err: unknown) {
      console.error('Error updating role:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar el rol';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleUserStatusToggle = async (userId: string, isCurrentlyActive: boolean) => {
    try {
      setLoading(true);
      if (isCurrentlyActive) {
        await authService.deactivateUser(userId);
      } else {
        await authService.reactivateUser(userId);
      }
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_active: !isCurrentlyActive } : user
      ));
      
    } catch (err: unknown) {
      console.error('Error updating user status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar el estado del usuario';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles="EXECUTIVE" redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link 
              href="/admin/users/invite"
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-md text-center"
            >
              Invitar Usuario
            </Link>
            <Link 
              href="/admin/users/create"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md text-center"
            >
              Crear Usuario
            </Link>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-md flex justify-between items-center">
            <span>{error}</span>
            <button 
              onClick={() => setError(null)} 
              className="text-red-500 hover:text-red-700 font-bold"
              aria-label="Cerrar mensaje de error"
            >
              &times;
            </button>
          </div>
        )}
        
        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Buscar usuarios..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                    Usuario
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">
                    Correo
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Rol
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12">
                    Estado
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Fecha
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-4 text-center">
                      <div className="flex justify-center items-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        <span className="ml-2">Cargando usuarios...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {searchTerm ? 'No se encontraron resultados para la búsqueda' : 'No se encontraron usuarios'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-gray-50 ${!user.is_active ? "bg-gray-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name || ''} {user.last_name || ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-500 truncate max-w-[180px]">{user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        {editingUser?.id === user.id ? (
                          <select
                            value={editingUser.role}
                            onChange={(e) => setEditingUser({
                              ...editingUser,
                              role: e.target.value as UserRole
                            })}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm 
                                   focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          >
                            <option value="SALES_AGENT">Vendedor</option>
                            <option value="QUALITY_TEAM">Equipo de Calidad</option>
                            <option value="PLANT_MANAGER">Jefe de Planta</option>
                            <option value="EXECUTIVE">Directivo</option>
                            <option value="CREDIT_VALIDATOR">Validador de Crédito</option>
                            <option value="DOSIFICADOR">Dosificador</option>
                          </select>
                        ) : (
                          <div className="text-sm text-gray-900">
                            {user.role === 'SALES_AGENT' && 'Vendedor'}
                            {user.role === 'QUALITY_TEAM' && 'Equipo de Calidad'}
                            {user.role === 'PLANT_MANAGER' && 'Jefe de Planta'}
                            {user.role === 'EXECUTIVE' && 'Directivo'}
                            {user.role === 'CREDIT_VALIDATOR' && 'Validador de Crédito'}
                            {user.role === 'DOSIFICADOR' && 'Dosificador'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                          ${user.is_active !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
                        >
                          {user.is_active !== false ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {editingUser?.id === user.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleRoleChange(user.id, editingUser.role)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1 rounded-md text-sm"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1 rounded-md text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setEditingUser(user)}
                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1 rounded-md text-sm"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleUserStatusToggle(user.id, user.is_active !== false)}
                              className={`px-3 py-1 rounded-md text-sm ${
                                user.is_active !== false 
                                  ? 'bg-red-50 hover:bg-red-100 text-red-600' 
                                  : 'bg-green-50 hover:bg-green-100 text-green-600'
                              }`}
                            >
                              {user.is_active !== false ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
} 