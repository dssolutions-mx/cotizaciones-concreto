'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import RoleGuard from '@/components/auth/RoleGuard';
import { Search, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PortalUsersTable } from '@/components/admin/client-portal/PortalUsersTable';
import { CreatePortalUserModal } from '@/components/admin/client-portal/CreatePortalUserModal';
import { useToast } from '@/components/ui/use-toast';
import type { PortalUser } from '@/lib/supabase/clientPortalAdmin';

export default function ClientPortalUsersPage() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    let filtered = users;
    const clientFilter = searchParams.get('clientId');

    // Apply client filter if set
    if (clientFilter) {
      filtered = filtered.filter((user) =>
        user.client_associations.some((assoc) => assoc.client_id === clientFilter)
      );
    }

    // Apply search filter
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(term) ||
          (user.first_name?.toLowerCase().includes(term) || false) ||
          (user.last_name?.toLowerCase().includes(term) || false) ||
          user.client_associations.some(
            (assoc) =>
              assoc.client_name.toLowerCase().includes(term) ||
              assoc.client_code.toLowerCase().includes(term)
          )
      );
    }

    setFilteredUsers(filtered);
  }, [searchTerm, users, searchParams]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/client-portal-users');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al cargar usuarios');
      }

      setUsers(result.data || []);
    } catch (err: unknown) {
      console.error('Error loading portal users:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar usuarios del portal';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['EXECUTIVE', 'ADMIN_OPERATIONS']} redirectTo="/access-denied">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Usuarios del Portal de Cliente</h1>
            <p className="text-sm text-gray-600 mt-1">
              Gestiona usuarios del portal y sus asociaciones con clientes
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Crear Usuario
          </Button>
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
          <Input
            type="text"
            placeholder="Buscar por nombre, email o cliente..."
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md w-full sm:w-72 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <PortalUsersTable
          users={filteredUsers}
          loading={loading}
          onRefresh={fetchUsers}
        />

        <CreatePortalUserModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          onSuccess={fetchUsers}
        />
      </div>
    </RoleGuard>
  );
}

