/**
 * Permission Templates for Client Portal Users
 *
 * Defines standard permission sets that can be applied to team members.
 * Executives automatically have all permissions regardless of these settings.
 */

export type PermissionKey =
  | 'create_orders'
  | 'view_orders'
  | 'create_quotes'
  | 'view_quotes'
  | 'view_materials'
  | 'view_quality_data'
  | 'manage_team'
  | 'approve_orders';

export type Permissions = Record<PermissionKey, boolean>;

/**
 * Full Access - All permissions enabled
 * Suitable for: Senior team members who need complete access
 */
export const FULL_ACCESS: Permissions = {
  create_orders: true,
  view_orders: true,
  create_quotes: true,
  view_quotes: true,
  view_materials: true,
  view_quality_data: true,
  manage_team: false, // Reserved for executives
  approve_orders: false, // Reserved for executives
};

/**
 * Order Manager - Can create and view orders, access materials
 * Suitable for: Procurement team members, construction managers
 */
export const ORDER_MANAGER: Permissions = {
  create_orders: true,
  view_orders: true,
  create_quotes: false,
  view_quotes: true,
  view_materials: true,
  view_quality_data: false,
  manage_team: false,
  approve_orders: false,
};

/**
 * View Only - Read access to orders, quotes, and materials
 * Suitable for: Stakeholders who need visibility without edit rights
 */
export const VIEW_ONLY: Permissions = {
  create_orders: false,
  view_orders: true,
  create_quotes: false,
  view_quotes: true,
  view_materials: true,
  view_quality_data: false,
  manage_team: false,
  approve_orders: false,
};

/**
 * Quote Manager - Can create and view quotes
 * Suitable for: Estimators, pre-sales team
 */
export const QUOTE_MANAGER: Permissions = {
  create_orders: false,
  view_orders: false,
  create_quotes: true,
  view_quotes: true,
  view_materials: true,
  view_quality_data: false,
  manage_team: false,
  approve_orders: false,
};

/**
 * Quality Viewer - Can view quality data and orders
 * Suitable for: Quality control teams, engineers
 */
export const QUALITY_VIEWER: Permissions = {
  create_orders: false,
  view_orders: true,
  create_quotes: false,
  view_quotes: false,
  view_materials: true,
  view_quality_data: true,
  manage_team: false,
  approve_orders: false,
};

/**
 * Executive Permissions - All permissions (read-only reference)
 * Executives always have these permissions regardless of database settings
 */
export const EXECUTIVE_PERMISSIONS: Permissions = {
  create_orders: true,
  view_orders: true,
  create_quotes: true,
  view_quotes: true,
  view_materials: true,
  view_quality_data: true,
  manage_team: true,
  approve_orders: true,
};

/**
 * Permission template definitions with metadata
 */
export const PERMISSION_TEMPLATES = {
  FULL_ACCESS: {
    name: 'Full Access',
    description: 'Complete access to all features (except team management)',
    permissions: FULL_ACCESS,
    icon: 'Shield',
  },
  ORDER_MANAGER: {
    name: 'Order Manager',
    description: 'Create and manage orders, view materials',
    permissions: ORDER_MANAGER,
    icon: 'Package',
  },
  VIEW_ONLY: {
    name: 'View Only',
    description: 'Read-only access to orders, quotes, and materials',
    permissions: VIEW_ONLY,
    icon: 'Eye',
  },
  QUOTE_MANAGER: {
    name: 'Quote Manager',
    description: 'Create and manage quotes',
    permissions: QUOTE_MANAGER,
    icon: 'FileText',
  },
  QUALITY_VIEWER: {
    name: 'Quality Viewer',
    description: 'View quality data and testing results',
    permissions: QUALITY_VIEWER,
    icon: 'CheckCircle',
  },
} as const;

/**
 * Permission labels and descriptions for UI display
 */
export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string }> = {
  create_orders: {
    label: 'Create Orders',
    description: 'Ability to create new concrete orders',
  },
  view_orders: {
    label: 'View Orders',
    description: 'View order history and details',
  },
  create_quotes: {
    label: 'Create Quotes',
    description: 'Create price quotes for clients',
  },
  view_quotes: {
    label: 'View Quotes',
    description: 'View quote history and details',
  },
  view_materials: {
    label: 'View Materials & Pricing',
    description: 'Access material catalog and pricing information',
  },
  view_quality_data: {
    label: 'View Quality Data',
    description: 'Access quality test results and reports',
  },
  manage_team: {
    label: 'Manage Team',
    description: 'Invite and manage team members (executives only)',
  },
  approve_orders: {
    label: 'Approve Orders',
    description: 'Approve orders created by team members (executives only)',
  },
};

/**
 * Get effective permissions for a user based on role
 * Executives always get full permissions
 */
export function getEffectivePermissions(
  role: 'executive' | 'user',
  configuredPermissions?: Partial<Permissions>
): Permissions {
  if (role === 'executive') {
    return EXECUTIVE_PERMISSIONS;
  }

  // Merge configured permissions with defaults
  return {
    ...VIEW_ONLY, // Default to view-only
    ...configuredPermissions,
    // Always ensure these are false for non-executives
    manage_team: false,
    approve_orders: false,
  };
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  role: 'executive' | 'user',
  permissions: Partial<Permissions> | undefined,
  permissionKey: PermissionKey
): boolean {
  if (role === 'executive') {
    return true; // Executives always have all permissions
  }

  return permissions?.[permissionKey] ?? false;
}

/**
 * Get template by key
 */
export function getTemplate(key: keyof typeof PERMISSION_TEMPLATES) {
  return PERMISSION_TEMPLATES[key];
}

/**
 * Get all template options for selection
 */
export function getAllTemplates() {
  return Object.entries(PERMISSION_TEMPLATES).map(([key, template]) => ({
    key,
    ...template,
  }));
}
