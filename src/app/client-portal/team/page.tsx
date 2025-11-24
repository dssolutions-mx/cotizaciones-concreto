/**
 * Team Management Page
 *
 * Allows executive users to manage team members within their client organization.
 * Features: View members, invite new users, edit roles/permissions, deactivate users.
 *
 * Following Apple HIG principles: Clear hierarchy, immediate feedback, reversible actions.
 */

'use client';

import React, { useState } from 'react';
import { useUserPermissions } from '@/hooks/client-portal/useUserPermissions';
import { useTeamMembers } from '@/hooks/client-portal/useTeamMembers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/client-portal/shared/EmptyState';
import { LoadingState } from '@/components/client-portal/shared/LoadingState';
import { UserRoleBadge } from '@/components/client-portal/shared/UserRoleBadge';
import { Users, UserPlus, MoreVertical, Edit, Trash2, Key } from 'lucide-react';
import { InviteUserModal } from '@/components/client-portal/team/InviteUserModal';
import { EditUserRoleModal } from '@/components/client-portal/team/EditUserRoleModal';
import { EditPermissionsModal } from '@/components/client-portal/team/EditPermissionsModal';
import { DeactivateUserDialog } from '@/components/client-portal/team/DeactivateUserDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { TeamMember } from '@/lib/client-portal/teamService';

export default function TeamManagementPage() {
  const { isExecutive, isLoading: permissionsLoading } = useUserPermissions();
  const { teamMembers, isLoading, isError, error, refresh } = useTeamMembers();

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [editRoleModalOpen, setEditRoleModalOpen] = useState(false);
  const [editPermissionsModalOpen, setEditPermissionsModalOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Check permissions
  if (permissionsLoading) {
    return <LoadingState message="Verificando permisos..." />;
  }

  if (!isExecutive) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Acceso denegado. Solo los usuarios ejecutivos pueden acceder a la gestión de equipo.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoadingState variant="skeleton" rows={5} />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error al cargar miembros del equipo: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Empty state
  if (!teamMembers || teamMembers.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Equipo</CardTitle>
            <CardDescription>Gestiona miembros del equipo y sus accesos</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Users}
              title="Aún no hay miembros del equipo"
              description="Invita a tu primer miembro del equipo para comenzar a colaborar"
              action={{
                label: 'Invitar Miembro',
                onClick: () => setInviteModalOpen(true),
              }}
            />
          </CardContent>
        </Card>
        <InviteUserModal
          open={inviteModalOpen}
          onOpenChange={setInviteModalOpen}
          onSuccess={refresh}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Gestión de Equipo</h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona miembros del equipo y sus permisos
          </p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invitar Miembro
        </Button>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Miembros del Equipo ({teamMembers.length})</CardTitle>
          <CardDescription>
            Ver y gestionar los miembros del equipo de tu organización
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último Acceso</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => {
                const memberName = `${member.first_name} ${member.last_name}`.trim() || 'Usuario sin nombre';
                const lastLogin = member.last_login
                  ? new Date(member.last_login).toLocaleDateString('es-MX', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Nunca';

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{memberName}</TableCell>
                    <TableCell className="text-gray-600">{member.email}</TableCell>
                    <TableCell>
                      <UserRoleBadge role={member.role_within_client} />
                    </TableCell>
                    <TableCell>
                      {member.is_active ? (
                        <span className="text-green-600 text-sm">Activo</span>
                      ) : (
                        <span className="text-gray-500 text-sm">Inactivo</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">{lastLogin}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedMember(member);
                              setEditRoleModalOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Cambiar Rol
                          </DropdownMenuItem>
                          {member.role_within_client === 'user' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member);
                                setEditPermissionsModalOpen(true);
                              }}
                            >
                              <Key className="h-4 w-4 mr-2" />
                              Editar Permisos
                            </DropdownMenuItem>
                          )}
                          {member.is_active && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member);
                                setDeactivateDialogOpen(true);
                              }}
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
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modals */}
      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onSuccess={refresh}
      />
      {selectedMember && (
        <>
          <EditUserRoleModal
            open={editRoleModalOpen}
            onOpenChange={setEditRoleModalOpen}
            member={selectedMember}
            onSuccess={refresh}
          />
          <EditPermissionsModal
            open={editPermissionsModalOpen}
            onOpenChange={setEditPermissionsModalOpen}
            member={selectedMember}
            onSuccess={refresh}
          />
          <DeactivateUserDialog
            open={deactivateDialogOpen}
            onOpenChange={setDeactivateDialogOpen}
            member={selectedMember}
            onSuccess={refresh}
          />
        </>
      )}
    </div>
  );
}
