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
    name: 'Acceso Completo',
    description: 'Acceso completo a todas las funciones (excepto gestión de equipo)',
    permissions: FULL_ACCESS,
    icon: 'Shield',
  },
  ORDER_MANAGER: {
    name: 'Gestor de Pedidos',
    description: 'Crear y gestionar pedidos, ver materiales',
    permissions: ORDER_MANAGER,
    icon: 'Package',
  },
  VIEW_ONLY: {
    name: 'Solo Lectura',
    description: 'Acceso de solo lectura a pedidos, cotizaciones y materiales',
    permissions: VIEW_ONLY,
    icon: 'Eye',
  },
  QUOTE_MANAGER: {
    name: 'Gestor de Cotizaciones',
    description: 'Crear y gestionar cotizaciones',
    permissions: QUOTE_MANAGER,
    icon: 'FileText',
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
    description: 'Ver historial y detalles de pedidos',
  },
  create_quotes: {
    label: 'Crear Cotizaciones',
    description: 'Crear cotizaciones de precios para clientes',
  },
  view_quotes: {
    label: 'Ver Cotizaciones',
    description: 'Ver historial y detalles de cotizaciones',
  },
  view_materials: {
    label: 'Ver Materiales y Precios',
    description: 'Acceder al catálogo de materiales e información de precios',
  },
  view_quality_data: {
    label: 'Ver Datos de Calidad',
    description: 'Acceder a resultados de pruebas de calidad e informes',
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
