'use client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const fetchCache = 'force-no-store';

import { useState, useEffect, useMemo } from 'react';
import type { UserRole } from '@/store/auth/types';
import RoleGuard from '@/components/auth/RoleGuard';
import Link from 'next/link';
import { authService } from '@/lib/supabase/auth';
import { Search, UserPlus, Filter, Download } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { UserCard } from '@/components/admin/users/UserCard';
import { UserEditModal } from '@/components/admin/users/UserEditModal';
import { BulkActionsBar } from '@/components/admin/users/BulkActionsBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import UserPlantAssignment from '@/components/plants/UserPlantAssignment';

interface UserData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  created_at: string;
  is_active?: boolean;
  plant_id?: string | null;
  business_unit_id?: string | null;
  plant_name?: string;
  plant_code?: string;
  business_unit_name?: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const { availablePlants, businessUnits } = usePlantContext();
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const filteredUsers = useMemo(() => {
    let filtered = users;

    // Apply search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        user =>
          (user.first_name?.toLowerCase().includes(term) ||
           user.last_name?.toLowerCase().includes(term) ||
           user.email.toLowerCase().includes(term))
      );
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter(user => user.is_active !== false);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter(user => user.is_active === false);
    }

    return filtered;
  }, [users, searchTerm, roleFilter, statusFilter]);

  const handleUserStatusToggle = async (userId: string, isCurrentlyActive: boolean) => {
    try {
      setLoading(true);
      if (isCurrentlyActive) {
        await authService.deactivateUser(userId);
      } else {
        await authService.reactivateUser(userId);
      }
      
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_active: !isCurrentlyActive } : user
      ));
      
      toast({
        title: 'Éxito',
        description: `Usuario ${isCurrentlyActive ? 'desactivado' : 'activado'} correctamente`,
      });
    } catch (err: unknown) {
      console.error('Error updating user status:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar el estado del usuario';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSuccess = () => {
    fetchUsers();
    setEditingUser(null);
  };

  const handleExport = () => {
    const csv = [
      ['Nombre', 'Email', 'Rol', 'Estado', 'Planta', 'Fecha Creación'].join(','),
      ...filteredUsers.map(user =>
        [
          `"${(user.first_name || '')} ${(user.last_name || '')}"`.trim() || 'Sin nombre',
          user.email,
          user.role,
          user.is_active !== false ? 'Activo' : 'Inactivo',
          user.plant_name || user.business_unit_name || 'Global',
          new Date(user.created_at).toLocaleDateString('es-ES'),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `usuarios_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <RoleGuard allowedRoles="EXECUTIVE" redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
            <p className="text-sm text-gray-600 mt-1">
              Gestiona usuarios internos del sistema
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/admin/client-portal-users">
              <Button variant="outline" className="w-full sm:w-auto">
              Usuarios del Portal
              </Button>
            </Link>
            <Link href="/admin/users/invite">
              <Button variant="outline" className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4 mr-2" />
              Invitar Usuario
              </Button>
            </Link>
            <Link href="/admin/users/create">
              <Button className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4 mr-2" />
              Crear Usuario
              </Button>
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
        
        {/* Filters */}
        <div className="glass-base rounded-xl p-4 mb-6 border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
              <Input
            type="text"
            placeholder="Buscar usuarios..."
                className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="SALES_AGENT">Vendedor</SelectItem>
                <SelectItem value="QUALITY_TEAM">Equipo de Calidad</SelectItem>
                <SelectItem value="PLANT_MANAGER">Jefe de Planta</SelectItem>
                <SelectItem value="EXECUTIVE">Directivo</SelectItem>
                <SelectItem value="CREDIT_VALIDATOR">Validador de Crédito</SelectItem>
                <SelectItem value="DOSIFICADOR">Dosificador</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleExport} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
                              </div>
                            </div>

        {/* Users Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-2 text-gray-600">Cargando usuarios...</span>
                              </div>
        ) : filteredUsers.length === 0 ? (
          <div className="glass-base rounded-xl p-12 text-center border">
            <p className="text-gray-500">
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'No se encontraron usuarios que coincidan con los filtros'
                : 'No se encontraron usuarios'}
            </p>
                            </div>
                          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map((user, index) => (
              <UserCard
                key={user.id}
                user={user}
                onEdit={setEditingUser}
                onToggleStatus={handleUserStatusToggle}
                delay={index * 0.05}
              />
            ))}
          </div>
        )}

        {/* Edit Modal */}
        <UserEditModal
          open={!!editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          user={editingUser}
          onSuccess={handleEditSuccess}
        />

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={selectedUsers.size}
          onDeselectAll={() => setSelectedUsers(new Set())}
          onBulkExport={handleExport}
        />
      </div>
    </RoleGuard>
  );
} 
