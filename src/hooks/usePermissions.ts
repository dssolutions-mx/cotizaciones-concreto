import { useAuthBridge } from '@/adapters/auth-context-bridge';
import type { UserRole } from '@/store/auth/types';

// Define the permissions map based on roles
export const PERMISSIONS = {
  // Permission names for various actions in the system
  CREATE_RECIPE: 'CREATE_RECIPE',
  EDIT_RECIPE: 'EDIT_RECIPE',
  DELETE_RECIPE: 'DELETE_RECIPE',
  
  CREATE_QUOTE: 'CREATE_QUOTE',
  EDIT_QUOTE: 'EDIT_QUOTE',
  APPROVE_QUOTE: 'APPROVE_QUOTE',
  VIEW_ALL_QUOTES: 'VIEW_ALL_QUOTES',
  
  MANAGE_MATERIAL_PRICES: 'MANAGE_MATERIAL_PRICES',
  MANAGE_ADMIN_COSTS: 'MANAGE_ADMIN_COSTS',
  
  MANAGE_USERS: 'MANAGE_USERS',
  
  VIEW_REPORTS: 'VIEW_REPORTS',
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Permission map by role
const permissionsByRole: Record<UserRole, Permission[]> = {
  QUALITY_TEAM: [
    'CREATE_RECIPE',
    'EDIT_RECIPE',
    'DELETE_RECIPE',
    'VIEW_REPORTS',
  ],
  
  PLANT_MANAGER: [
    'CREATE_QUOTE',
    'EDIT_QUOTE',
    'APPROVE_QUOTE',
    'VIEW_ALL_QUOTES',
    'MANAGE_ADMIN_COSTS',
    'VIEW_REPORTS',
  ],
  
  SALES_AGENT: [
    'CREATE_QUOTE',
    'EDIT_QUOTE',
    'VIEW_REPORTS',
  ],
  
  EXECUTIVE: [
    'CREATE_RECIPE',
    'EDIT_RECIPE',
    'DELETE_RECIPE',
    'CREATE_QUOTE',
    'EDIT_QUOTE',
    'APPROVE_QUOTE',
    'VIEW_ALL_QUOTES',
    'MANAGE_MATERIAL_PRICES',
    'MANAGE_ADMIN_COSTS',
    'MANAGE_USERS',
    'VIEW_REPORTS',
  ],

  CREDIT_VALIDATOR: [
    'VIEW_REPORTS',
  ],

  DOSIFICADOR: [
    'VIEW_REPORTS',
  ]
};

export function usePermissions() {
  const { profile } = useAuthBridge();
  
  /**
   * Check if the current user has the specified permission
   */
  const hasPermission = (permission: Permission): boolean => {
    // If no user is logged in, they have no permissions
    if (!profile) return false;
    
    // Get the permissions for the user's role
    const rolePermissions = permissionsByRole[profile.role];
    
    // Check if the permission is in the list
    return rolePermissions.includes(permission);
  };
  
  /**
   * Check if the current user has all of the specified permissions
   */
  const hasAllPermissions = (permissions: Permission[]): boolean => {
    return permissions.every(permission => hasPermission(permission));
  };
  
  /**
   * Check if the current user has any of the specified permissions
   */
  const hasAnyPermission = (permissions: Permission[]): boolean => {
    return permissions.some(permission => hasPermission(permission));
  };
  
  return {
    hasPermission,
    hasAllPermissions,
    hasAnyPermission,
  };
} 