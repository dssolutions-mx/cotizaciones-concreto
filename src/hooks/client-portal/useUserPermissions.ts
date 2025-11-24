/**
 * useUserPermissions Hook
 *
 * Hook to access and check user permissions in the client portal.
 * Integrates with the auth store to determine user's role and permissions.
 */

'use client';

import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { hasPermission, getEffectivePermissions, PermissionKey, Permissions } from '@/lib/client-portal/permissionTemplates';
import { useEffect, useState } from 'react';

export interface UserRole {
  role: 'executive' | 'user' | null;
  permissions: Permissions | null;
}

export function useUserPermissions() {
  const { profile } = useAuthBridge();
  const [userRole, setUserRole] = useState<UserRole>({
    role: null,
    permissions: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUserRole() {
      if (!profile || profile.role !== 'EXTERNAL_CLIENT') {
        setUserRole({ role: null, permissions: null });
        setIsLoading(false);
        return;
      }

      try {
        // Fetch user's role and permissions from client_portal_users
        const response = await fetch('/api/client-portal/me/role-and-permissions', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const role = data.role_within_client as 'executive' | 'user';
          const configuredPermissions = data.permissions as Partial<Permissions>;

          const effectivePermissions = getEffectivePermissions(role, configuredPermissions);

          setUserRole({
            role,
            permissions: effectivePermissions,
          });
        } else {
          // If API doesn't exist yet, fallback to default behavior
          // Assume user role with view-only permissions
          setUserRole({
            role: 'user',
            permissions: getEffectivePermissions('user', {}),
          });
        }
      } catch (error) {
        console.error('Error loading user role:', error);
        // Fallback to user role with view-only permissions
        setUserRole({
          role: 'user',
          permissions: getEffectivePermissions('user', {}),
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadUserRole();
  }, [profile]);

  /**
   * Check if the user has a specific permission
   */
  const hasPermissionCheck = (permissionKey: PermissionKey): boolean => {
    if (!userRole.role || !userRole.permissions) return false;
    return hasPermission(userRole.role, userRole.permissions, permissionKey);
  };

  /**
   * Check if user is an executive
   */
  const isExecutive = userRole.role === 'executive';

  /**
   * Check if user is a regular (non-executive) user
   */
  const isRegularUser = userRole.role === 'user';

  return {
    role: userRole.role,
    permissions: userRole.permissions,
    isExecutive,
    isRegularUser,
    isLoading,
    hasPermission: hasPermissionCheck,
    // Convenience checks for common permissions
    canCreateOrders: hasPermissionCheck('create_orders'),
    canViewOrders: hasPermissionCheck('view_orders'),
    canViewPrices: hasPermissionCheck('view_prices'),
    canViewQualityData: hasPermissionCheck('view_quality_data'),
    canBypassApproval: hasPermissionCheck('bypass_executive_approval'),
    canManageTeam: hasPermissionCheck('manage_team'),
    canApproveOrders: hasPermissionCheck('approve_orders'),
    // Legacy: map view_prices to view_balance for backward compatibility
    canViewBalance: hasPermissionCheck('view_prices'),
  };
}
