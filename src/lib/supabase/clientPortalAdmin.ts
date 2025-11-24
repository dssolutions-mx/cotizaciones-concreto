import { supabase } from './client';
import { handleError } from '@/utils/errorHandler';
import type { Permissions } from '@/lib/client-portal/permissionTemplates';

export interface PortalUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'EXTERNAL_CLIENT';
  is_active: boolean;
  created_at: string;
  client_associations: ClientAssociation[];
}

export interface ClientAssociation {
  id: string;
  client_id: string;
  client_name: string;
  client_code: string;
  role_within_client: 'executive' | 'user';
  permissions: Permissions;
  is_active: boolean;
  invited_at: string;
}

export interface CreatePortalUserData {
  email: string;
  firstName?: string;
  lastName?: string;
  clientIds: string[];
  roles: Record<string, 'executive' | 'user'>; // clientId -> role
  permissions?: Record<string, Partial<Permissions>>; // clientId -> permissions
}

export interface AssignClientData {
  clientId: string;
  role: 'executive' | 'user';
  permissions?: Partial<Permissions>;
}

export const clientPortalAdminService = {
  /**
   * Get all portal users with their client associations
   */
  async getAllPortalUsers(): Promise<PortalUser[]> {
    try {
      const { data: users, error: usersError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, role, is_active, created_at')
        .eq('role', 'EXTERNAL_CLIENT')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        return [];
      }

      const userIds = users.map(u => u.id);

      // Get all client associations for these users
      const { data: associations, error: assocError } = await supabase
        .from('client_portal_users')
        .select(`
          id,
          user_id,
          client_id,
          role_within_client,
          permissions,
          is_active,
          invited_at,
          clients!inner (
            id,
            business_name,
            client_code
          )
        `)
        .in('user_id', userIds);

      if (assocError) throw assocError;

      // Group associations by user
      const associationsByUser = new Map<string, ClientAssociation[]>();
      associations?.forEach((assoc: any) => {
        const client = assoc.clients;
        if (!associationsByUser.has(assoc.user_id)) {
          associationsByUser.set(assoc.user_id, []);
        }
        associationsByUser.get(assoc.user_id)!.push({
          id: assoc.id,
          client_id: assoc.client_id,
          client_name: client.business_name,
          client_code: client.client_code,
          role_within_client: assoc.role_within_client,
          permissions: assoc.permissions || {},
          is_active: assoc.is_active,
          invited_at: assoc.invited_at,
        });
      });

      // Combine users with their associations
      return users.map(user => ({
        ...user,
        client_associations: associationsByUser.get(user.id) || [],
      }));
    } catch (error) {
      const errorMessage = handleError(error, 'getAllPortalUsers');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Get a single portal user with all client associations
   */
  async getPortalUserById(userId: string): Promise<PortalUser | null> {
    try {
      const { data: user, error: userError } = await supabase
        .from('user_profiles')
        .select('id, email, first_name, last_name, role, is_active, created_at')
        .eq('id', userId)
        .eq('role', 'EXTERNAL_CLIENT')
        .single();

      if (userError) throw userError;
      if (!user) return null;

      // Get client associations
      const { data: associations, error: assocError } = await supabase
        .from('client_portal_users')
        .select(`
          id,
          user_id,
          client_id,
          role_within_client,
          permissions,
          is_active,
          invited_at,
          clients!inner (
            id,
            business_name,
            client_code
          )
        `)
        .eq('user_id', userId);

      if (assocError) throw assocError;

      const clientAssociations: ClientAssociation[] = (associations || []).map((assoc: any) => {
        const client = assoc.clients;
        return {
          id: assoc.id,
          client_id: assoc.client_id,
          client_name: client.business_name,
          client_code: client.client_code,
          role_within_client: assoc.role_within_client,
          permissions: assoc.permissions || {},
          is_active: assoc.is_active,
          invited_at: assoc.invited_at,
        };
      });

      return {
        ...user,
        client_associations,
      };
    } catch (error) {
      const errorMessage = handleError(error, 'getPortalUserById');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Assign a client to a portal user
   */
  async assignClientToUser(
    userId: string,
    clientId: string,
    role: 'executive' | 'user',
    permissions?: Partial<Permissions>
  ): Promise<void> {
    try {
      // Check if association already exists
      const { data: existing } = await supabase
        .from('client_portal_users')
        .select('id')
        .eq('user_id', userId)
        .eq('client_id', clientId)
        .single();

      if (existing) {
        throw new Error('User already associated with this client');
      }

      // Get client default permissions if needed
      let finalPermissions = permissions || {};
      if (role === 'user' && !permissions) {
        const { data: client } = await supabase
          .from('clients')
          .select('default_permissions')
          .eq('id', clientId)
          .single();
        
        finalPermissions = client?.default_permissions || {};
      }

      const { error } = await supabase
        .from('client_portal_users')
        .insert({
          user_id: userId,
          client_id: clientId,
          role_within_client: role,
          permissions: finalPermissions,
          is_active: true,
        });

      if (error) throw error;
    } catch (error) {
      const errorMessage = handleError(error, 'assignClientToUser');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Remove client association from user
   */
  async removeClientAssociation(userId: string, clientId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('client_portal_users')
        .delete()
        .eq('user_id', userId)
        .eq('client_id', clientId);

      if (error) throw error;
    } catch (error) {
      const errorMessage = handleError(error, 'removeClientAssociation');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Update user role within a specific client
   */
  async updateUserRoleInClient(
    userId: string,
    clientId: string,
    role: 'executive' | 'user',
    permissions?: Partial<Permissions>
  ): Promise<void> {
    try {
      const updateData: any = {
        role_within_client: role,
      };

      if (role === 'user' && permissions) {
        updateData.permissions = permissions;
      } else if (role === 'executive') {
        updateData.permissions = {};
      }

      const { error } = await supabase
        .from('client_portal_users')
        .update(updateData)
        .eq('user_id', userId)
        .eq('client_id', clientId);

      if (error) throw error;
    } catch (error) {
      const errorMessage = handleError(error, 'updateUserRoleInClient');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Deactivate a portal user
   */
  async deactivatePortalUser(userId: string): Promise<void> {
    try {
      // Deactivate all client associations
      const { error: assocError } = await supabase
        .from('client_portal_users')
        .update({ is_active: false })
        .eq('user_id', userId);

      if (assocError) throw assocError;

      // Deactivate user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('id', userId);

      if (profileError) throw profileError;
    } catch (error) {
      const errorMessage = handleError(error, 'deactivatePortalUser');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },

  /**
   * Reactivate a portal user
   */
  async reactivatePortalUser(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: true })
        .eq('id', userId);

      if (error) throw error;
    } catch (error) {
      const errorMessage = handleError(error, 'reactivatePortalUser');
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  },
};

