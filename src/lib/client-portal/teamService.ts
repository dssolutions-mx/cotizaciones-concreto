/**
 * Team Management Service
 *
 * Provides functions for managing team members in the client portal.
 * All functions communicate with the backend API endpoints.
 */

import { Permissions } from './permissionTemplates';

export interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role_within_client: 'executive' | 'user';
  permissions: Permissions;
  is_active: boolean;
  invited_at: string;
  last_login: string | null;
}

export interface InviteUserData {
  email: string;
  firstName?: string;
  lastName?: string;
  role: 'executive' | 'user';
  permissions?: Partial<Permissions>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Fetch all team members for the current user's client
 */
export async function fetchTeamMembers(): Promise<TeamMember[]> {
  const response = await fetch('/api/client-portal/team', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch team members');
  }

  const result = await response.json();
  return result.data || [];
}

/**
 * Invite a new team member
 */
export async function inviteTeamMember(
  data: InviteUserData
): Promise<ApiResponse<{ userId: string; invitationSent: boolean }>> {
  const response = await fetch('/api/client-portal/team', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to invite team member');
  }

  return result;
}

/**
 * Update a team member's role
 */
export async function updateTeamMemberRole(
  userId: string,
  role: 'executive' | 'user'
): Promise<ApiResponse<TeamMember>> {
  const response = await fetch(`/api/client-portal/team/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ role }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to update role');
  }

  return result;
}

/**
 * Update a team member's permissions
 */
export async function updateTeamMemberPermissions(
  userId: string,
  permissions: Permissions
): Promise<ApiResponse<{ permissions: Permissions }>> {
  const response = await fetch(`/api/client-portal/team/${userId}/permissions`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ permissions }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to update permissions');
  }

  return result;
}

/**
 * Deactivate a team member
 */
export async function deactivateTeamMember(
  userId: string
): Promise<ApiResponse<void>> {
  const response = await fetch(`/api/client-portal/team/${userId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to deactivate team member');
  }

  return result;
}
