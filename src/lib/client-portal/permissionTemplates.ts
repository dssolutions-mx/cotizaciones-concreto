/**
 * Permission Templates for Client Portal Users
 *
 * Defines standard permission sets that can be applied to team members.
 * Executives automatically have all permissions regardless of these settings.
 */

export type PermissionKey =
  | 'create_orders'
  | 'view_orders'
  | 'view_prices'
  | 'view_quality_data'
  | 'bypass_executive_approval'
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
  view_prices: true,
  view_quality_data: true,
  bypass_executive_approval: true,
  manage_team: false, // Reserved for executives
  approve_orders: false, // Reserved for executives
};

/**
 * Order Manager - Can create and view orders, see prices
 * Suitable for: Procurement team members, construction managers
 */
export const ORDER_MANAGER: Permissions = {
  create_orders: true,
  view_orders: true,
  view_prices: true,
  view_quality_data: false,
  bypass_executive_approval: false,
  manage_team: false,
  approve_orders: false,
};

/**
 * View Only - Read access to orders without prices
 * Suitable for: Stakeholders who need visibility without edit rights or financial access
 */
export const VIEW_ONLY: Permissions = {
  create_orders: false,
  view_orders: true,
  view_prices: false,
  view_quality_data: false,
  bypass_executive_approval: false,
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
  view_prices: false,
  view_quality_data: true,
  bypass_executive_approval: false,
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
  view_prices: true,
  view_quality_data: true,
  bypass_executive_approval: true,
  manage_team: true,
  approve_orders: true,
};

/**
 * Permission template definitions with metadata
 */
export const PERMISSION_TEMPLATES = {
  FULL_ACCESS: {
    name: 'Acceso Completo',
    description: 'Acceso completo a todas las funciones (excepto gestión de equipo)',
    permissions: FULL_ACCESS,
    icon: 'Shield',
  },
  ORDER_MANAGER: {
    name: 'Gestor de Pedidos',
    description: 'Crear y gestionar pedidos, ver precios y balance',
    permissions: ORDER_MANAGER,
    icon: 'Package',
  },
  VIEW_ONLY: {
    name: 'Solo Lectura',
    description: 'Acceso de solo lectura a pedidos (sin precios ni información financiera)',
    permissions: VIEW_ONLY,
    icon: 'Eye',
  },
  QUALITY_VIEWER: {
    name: 'Visualizador de Calidad',
    description: 'Ver datos de calidad y resultados de pruebas',
    permissions: QUALITY_VIEWER,
    icon: 'CheckCircle',
  },
} as const;

/**
 * Permission labels and descriptions for UI display
 */
export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string }> = {
  create_orders: {
    label: 'Crear Pedidos',
    description: 'Capacidad de crear nuevos pedidos de concreto',
  },
  view_orders: {
    label: 'Ver Pedidos',
    description: 'Ver historial y detalles de pedidos (los precios se muestran según el permiso "Ver Precios")',
  },
  view_prices: {
    label: 'Ver Precios',
    description: 'Ver precios, totales y acceso a información financiera (incluye balance y precios en pedidos)',
  },
  view_quality_data: {
    label: 'Ver Datos de Calidad',
    description: 'Acceder a resultados de pruebas de calidad e informes',
  },
  bypass_executive_approval: {
    label: 'Crear Pedidos Sin Aprobación',
    description: 'Los pedidos creados no requieren aprobación ejecutiva (solo aplica si tiene permiso para crear pedidos)',
  },
  manage_team: {
    label: 'Gestionar Equipo',
    description: 'Invitar y gestionar miembros del equipo (solo ejecutivos)',
  },
  approve_orders: {
    label: 'Aprobar Pedidos',
    description: 'Aprobar pedidos creados por miembros del equipo (solo ejecutivos)',
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
    ...VIEW_ONLY, // Default to view-only (no prices, no quality, no order creation)
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
