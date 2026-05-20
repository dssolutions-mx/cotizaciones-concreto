import type { UserRole } from '@/store/auth/types';

/** How `/dashboard` renders for this role */
export type DashboardVariant = 'standard' | 'operations' | 'admin-operations';

export interface RoleHomeDefinition {
  /** Where the user lands after login or visiting `/` */
  defaultPath: string;
  dashboardVariant: DashboardVariant;
  /** Sidebar label for `/dashboard` (defaults to "Dashboard") */
  dashboardNavLabel?: string;
  /** Short description for docs / tooltips */
  homeDescription: string;
}

/**
 * Canonical "home" per role — keep in sync with login, auth callback, and proxy redirects.
 */
export const ROLE_HOME: Record<UserRole, RoleHomeDefinition> = {
  DOSIFICADOR: {
    defaultPath: '/production-control',
    dashboardVariant: 'operations',
    dashboardNavLabel: 'Resumen del día',
    homeDescription: 'Control de producción como espacio principal; resumen con pedidos de hoy.',
  },
  ADMIN_OPERATIONS: {
    defaultPath: '/dashboard',
    dashboardVariant: 'admin-operations',
    dashboardNavLabel: 'Centro operativo',
    homeDescription:
      'Hub de admin operaciones: remisiones semanal, compras, proveedores y reportes.',
  },
  CREDIT_VALIDATOR: {
    defaultPath: '/finanzas/credito-validacion',
    dashboardVariant: 'standard',
    dashboardNavLabel: 'Resumen',
    homeDescription: 'Validación de crédito como entrada; dashboard con cartera y pendientes.',
  },
  ADMINISTRATIVE: {
    defaultPath: '/rh/remisiones-semanal',
    dashboardVariant: 'standard',
    dashboardNavLabel: 'Resumen',
    homeDescription:
      'Reporte semanal de remisiones (RH). Finanzas y CxP siguen en el menú cuando se necesiten.',
  },
  SALES_AGENT: {
    defaultPath: '/comercial',
    dashboardVariant: 'standard',
    dashboardNavLabel: 'Resumen comercial',
    homeDescription: 'Comercial y cotizaciones; dashboard con pipeline de ventas.',
  },
  EXTERNAL_SALES_AGENT: {
    defaultPath: '/comercial',
    dashboardVariant: 'standard',
    homeDescription: 'Comercial externo; cotizaciones y clientes.',
  },
  PLANT_MANAGER: {
    defaultPath: '/dashboard',
    dashboardVariant: 'standard',
    homeDescription: 'Operación de planta, pedidos, calidad y aprobaciones.',
  },
  EXECUTIVE: {
    defaultPath: '/dashboard',
    dashboardVariant: 'standard',
    homeDescription: 'Vista consolidada por planta o unidad de negocio.',
  },
  QUALITY_TEAM: {
    defaultPath: '/quality/muestreos',
    dashboardVariant: 'standard',
    homeDescription: 'Muestreos y módulo de calidad.',
  },
  LABORATORY: {
    defaultPath: '/quality',
    dashboardVariant: 'standard',
    homeDescription: 'Laboratorio y ensayos.',
  },
  ADMIN: {
    defaultPath: '/admin',
    dashboardVariant: 'standard',
    homeDescription: 'Administración del sistema.',
  },
  EXTERNAL_CLIENT: {
    defaultPath: '/client-portal',
    dashboardVariant: 'standard',
    homeDescription: 'Portal de cliente.',
  },
};

export function getRoleHome(role: string | undefined): RoleHomeDefinition {
  if (role && role in ROLE_HOME) {
    return ROLE_HOME[role as UserRole];
  }
  return ROLE_HOME.EXECUTIVE;
}

export function getDefaultPathForRole(role: string | undefined): string {
  return getRoleHome(role).defaultPath;
}

export function getDashboardVariant(role: string | undefined): DashboardVariant {
  return getRoleHome(role).dashboardVariant;
}

export function getDashboardNavLabel(role: string | undefined): string {
  return getRoleHome(role).dashboardNavLabel ?? 'Dashboard';
}
