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
    return <LoadingState message="Checking permissions..." />;
  }

  if (!isExecutive) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. Only executive users can access team management.
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
            Failed to load team members: {error}
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
            <CardTitle>Team Management</CardTitle>
            <CardDescription>Manage team members and their access</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Users}
              title="No team members yet"
              description="Invite your first team member to start collaborating"
              action={{
                label: 'Invite Team Member',
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
          <h1 className="text-3xl font-semibold text-gray-900">Team Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage team members and their permissions
          </p>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({teamMembers.length})</CardTitle>
          <CardDescription>
            View and manage your organization's team members
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => {
                const memberName = `${member.first_name} ${member.last_name}`.trim() || 'Unnamed User';
                const lastLogin = member.last_login
                  ? new Date(member.last_login).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Never';

                return (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{memberName}</TableCell>
                    <TableCell className="text-gray-600">{member.email}</TableCell>
                    <TableCell>
                      <UserRoleBadge role={member.role_within_client} />
                    </TableCell>
                    <TableCell>
                      {member.is_active ? (
                        <span className="text-green-600 text-sm">Active</span>
                      ) : (
                        <span className="text-gray-500 text-sm">Inactive</span>
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
                            Change Role
                          </DropdownMenuItem>
                          {member.role_within_client === 'user' && (
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedMember(member);
                                setEditPermissionsModalOpen(true);
                              }}
                            >
                              <Key className="h-4 w-4 mr-2" />
                              Edit Permissions
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
                              Deactivate
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
