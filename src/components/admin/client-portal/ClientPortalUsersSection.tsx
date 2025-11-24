'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserPlus, Users } from 'lucide-react';
import { ClientAssociationsList } from './ClientAssociationsList';
import { AssignClientModal } from './AssignClientModal';
import { CreatePortalUserModal } from './CreatePortalUserModal';
import { Badge } from '@/components/ui/badge';
import { UserRoleBadge } from '@/components/client-portal/shared/UserRoleBadge';
import { useToast } from '@/components/ui/use-toast';
import type { PortalUser } from '@/lib/supabase/clientPortalAdmin';

interface ClientPortalUsersSectionProps {
  clientId: string;
}

export function ClientPortalUsersSection({ clientId }: ClientPortalUsersSectionProps) {
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPortalUsers();
  }, [clientId]);

  const fetchPortalUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/client-portal-users');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al cargar usuarios');
      }

      // Filter users that have this client in their associations
      const usersForThisClient = (result.data || []).filter((user: PortalUser) =>
        user.client_associations.some(assoc => assoc.client_id === clientId)
      );

      setPortalUsers(usersForThisClient);
    } catch (error: any) {
      console.error('Error loading portal users:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar usuarios del portal',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignClient = () => {
    setAssignModalOpen(true);
  };

  const handleRemoveClient = async (userId: string) => {
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

      toast({
        title: 'Asociación eliminada',
        description: 'La asociación ha sido eliminada exitosamente',
      });

      fetchPortalUsers();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuarios del Portal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            <span className="ml-2">Cargando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeUsers = portalUsers.filter(u => 
    u.is_active && u.client_associations.some(a => a.client_id === clientId && a.is_active)
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usuarios del Portal</CardTitle>
              <CardDescription>
                Usuarios con acceso al portal de cliente para este cliente
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAssignClient}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Asignar Usuario
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateModalOpen(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                Crear Usuario
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm">No hay usuarios del portal asignados a este cliente</p>
              <p className="text-xs text-gray-400 mt-2">
                Crea un nuevo usuario o asigna uno existente
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeUsers.map((user) => {
                const association = user.client_associations.find(
                  a => a.client_id === clientId && a.is_active
                );
                const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Sin nombre';

                return (
                  <div
                    key={user.id}
                    className="p-4 border rounded-lg bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{userName}</h4>
                          {!user.is_active && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                              Inactivo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{user.email}</p>
                        {association && (
                          <div className="flex items-center gap-2">
                            <UserRoleBadge role={association.role_within_client} />
                          </div>
                        )}
                      </div>
                      {association && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveClient(user.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreatePortalUserModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        defaultClientIds={[clientId]}
        onSuccess={() => {
          setCreateModalOpen(false);
          fetchPortalUsers();
        }}
      />

      <AssignClientModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        userId={selectedUserId || ''}
        existingClientIds={[]}
        onSuccess={() => {
          setAssignModalOpen(false);
          setSelectedUserId(null);
          fetchPortalUsers();
        }}
      />
    </>
  );
}

