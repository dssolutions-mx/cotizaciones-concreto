'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MoreVertical, Plus, Edit, Trash2, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserRoleBadge } from '@/components/client-portal/shared/UserRoleBadge';
import { ClientAssociationsList } from './ClientAssociationsList';
import { AssignClientModal } from './AssignClientModal';
import type { PortalUser } from '@/lib/supabase/clientPortalAdmin';

interface PortalUsersTableProps {
  users: PortalUser[];
  loading?: boolean;
  onRefresh?: () => void;
  onAssignClient?: (userId: string) => void;
  onRemoveClient?: (userId: string, clientId: string) => void;
  onDeactivate?: (userId: string) => void;
}

export function PortalUsersTable({
  users,
  loading = false,
  onRefresh,
  onAssignClient,
  onRemoveClient,
  onDeactivate,
}: PortalUsersTableProps) {
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const toggleExpand = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const handleAssignClient = (userId: string) => {
    setSelectedUserId(userId);
    setAssignModalOpen(true);
  };

  const handleRemoveClient = async (userId: string, clientId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta asociación?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/client-portal-users/${userId}/clients?clientId=${clientId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Error al eliminar asociación');
      }

      onRefresh?.();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDeactivate = async (userId: string) => {
    if (!confirm('¿Estás seguro de desactivar este usuario?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/client-portal-users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Error al desactivar usuario');
      }

      onRefresh?.();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2">Cargando usuarios...</span>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No hay usuarios del portal registrados
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha de Creación</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const isExpanded = expandedUsers.has(user.id);
              const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Sin nombre';
              const activeAssociations = user.client_associations.filter(a => a.is_active);
              const inactiveAssociations = user.client_associations.filter(a => !a.is_active);

              return (
                <React.Fragment key={user.id}>
                  <TableRow className={!user.is_active ? 'bg-gray-50' : ''}>
                    <TableCell>
                      {user.client_associations.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(user.id)}
                          className="h-6 w-6 p-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{userName}</TableCell>
                    <TableCell className="text-gray-600">{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">
                          {activeAssociations.length} activo{activeAssociations.length !== 1 ? 's' : ''}
                          {inactiveAssociations.length > 0 && (
                            <span className="text-gray-500">
                              {' '}/ {inactiveAssociations.length} inactivo{inactiveAssociations.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          Activo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                          Inactivo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString('es-MX', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleAssignClient(user.id)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Asignar Cliente
                          </DropdownMenuItem>
                          {user.is_active && (
                            <DropdownMenuItem
                              onClick={() => handleDeactivate(user.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Desactivar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {isExpanded && user.client_associations.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-gray-50">
                        <div className="p-4">
                          <h4 className="font-medium text-sm mb-3">Asociaciones de Clientes</h4>
                          <ClientAssociationsList
                            associations={user.client_associations}
                            onRemove={(clientId) => handleRemoveClient(user.id, clientId)}
                            showActions={true}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {selectedUserId && (
        <AssignClientModal
          open={assignModalOpen}
          onOpenChange={setAssignModalOpen}
          userId={selectedUserId}
          existingClientIds={
            users.find(u => u.id === selectedUserId)?.client_associations.map(a => a.client_id) || []
          }
          onSuccess={() => {
            setAssignModalOpen(false);
            setSelectedUserId(null);
            onRefresh?.();
          }}
        />
      )}
    </>
  );
}

