import type { UserRole } from '@/store/auth/types';
import { getDashboardVariant, type DashboardVariant } from '@/lib/auth/role-home';
import type { UserPlantAccess } from '@/types/plant';

export type DashboardMetricKey =
  | 'monthlyQuotes'
  | 'monthlySales'
  | 'activeClients'
  | 'pendingCreditOrders'
  | 'todayOrders'
  | 'totalOutstandingBalance'
  | 'pendingQuotes';

export interface DashboardQuickAction {
  href: string;
  label: string;
  description?: string;
}

export interface RoleDashboardConfig {
  roleLabel: string;
  subtitle: string;
  variant: DashboardVariant;
  metrics: DashboardMetricKey[];
  quickActions: DashboardQuickAction[];
  showSalesChart: boolean;
  showQuotesList: boolean;
  showApprovals: boolean;
  showPlantComparison: boolean;
}

const ROLE_LABELS: Record<UserRole, string> = {
  SALES_AGENT: 'Vendedor',
  EXTERNAL_SALES_AGENT: 'Vendedor Externo',
  QUALITY_TEAM: 'Equipo de Calidad',
  PLANT_MANAGER: 'Jefe de Planta',
  EXECUTIVE: 'Directivo',
  CREDIT_VALIDATOR: 'Validador de Crédito',
  DOSIFICADOR: 'Dosificador',
  ADMIN_OPERATIONS: 'Admin Operaciones',
  ADMINISTRATIVE: 'Administrativo',
  ADMIN: 'Administrador',
  EXTERNAL_CLIENT: 'Cliente Externo',
};

const BASE_CONFIG: Record<UserRole, Omit<RoleDashboardConfig, 'subtitle' | 'showPlantComparison'>> = {
  DOSIFICADOR: {
    roleLabel: ROLE_LABELS.DOSIFICADOR,
    metrics: ['todayOrders', 'monthlySales'],
    quickActions: [
      { href: '/production-control', label: 'Control de producción', description: 'Materiales y dosificación' },
      { href: '/orders', label: 'Pedidos del día', description: 'Programación y entregas' },
      { href: '/orders?tab=calendar', label: 'Calendario', description: 'Vista semanal' },
    ],
    showSalesChart: false,
    showQuotesList: false,
    showApprovals: false,
  },
  CREDIT_VALIDATOR: {
    roleLabel: ROLE_LABELS.CREDIT_VALIDATOR,
    metrics: ['pendingCreditOrders', 'totalOutstandingBalance', 'todayOrders'],
    quickActions: [
      { href: '/finanzas/credito-validacion', label: 'Validar créditos', description: 'Pedidos pendientes' },
      { href: '/finanzas/cartera', label: 'Cartera CxC', description: 'Saldos por cliente' },
    ],
    showSalesChart: false,
    showQuotesList: false,
    showApprovals: true,
  },
  SALES_AGENT: {
    roleLabel: ROLE_LABELS.SALES_AGENT,
    metrics: ['monthlyQuotes', 'pendingQuotes', 'activeClients'],
    quickActions: [
      { href: '/quotes', label: 'Cotizaciones', description: 'Crear y dar seguimiento' },
      { href: '/comercial', label: 'Comercial', description: 'Clientes y precios' },
      { href: '/orders', label: 'Pedidos', description: 'Programación' },
    ],
    showSalesChart: true,
    showQuotesList: true,
    showApprovals: false,
  },
  EXTERNAL_SALES_AGENT: {
    roleLabel: ROLE_LABELS.EXTERNAL_SALES_AGENT,
    metrics: ['monthlyQuotes', 'pendingQuotes', 'activeClients'],
    quickActions: [
      { href: '/quotes', label: 'Mis cotizaciones', description: 'Estado y envíos' },
      { href: '/comercial', label: 'Comercial', description: 'Catálogo y clientes' },
    ],
    showSalesChart: true,
    showQuotesList: true,
    showApprovals: false,
  },
  ADMINISTRATIVE: {
    roleLabel: ROLE_LABELS.ADMINISTRATIVE,
    metrics: ['pendingCreditOrders', 'todayOrders', 'totalOutstandingBalance'],
    quickActions: [
      { href: '/finanzas', label: 'Finanzas', description: 'CxC y reportes' },
      { href: '/orders', label: 'Pedidos', description: 'Operación del día' },
    ],
    showSalesChart: false,
    showQuotesList: false,
    showApprovals: false,
  },
  ADMIN_OPERATIONS: {
    roleLabel: ROLE_LABELS.ADMIN_OPERATIONS,
    metrics: ['todayOrders', 'monthlySales', 'pendingCreditOrders'],
    quickActions: [
      { href: '/production-control', label: 'Control de producción', description: 'Inventario y alertas' },
      { href: '/orders', label: 'Pedidos', description: 'Programación diaria' },
      { href: '/finanzas', label: 'Finanzas', description: 'Indicadores y cartera' },
      { href: '/rh', label: 'RH', description: 'Remisiones y personal' },
    ],
    showSalesChart: false,
    showQuotesList: false,
    showApprovals: false,
  },
  PLANT_MANAGER: {
    roleLabel: ROLE_LABELS.PLANT_MANAGER,
    metrics: ['monthlySales', 'todayOrders', 'pendingQuotes', 'pendingCreditOrders', 'activeClients'],
    quickActions: [
      { href: '/orders', label: 'Pedidos hoy', description: 'Programación de entregas' },
      { href: '/quality', label: 'Calidad', description: 'Muestreos y ensayos' },
      { href: '/quotes', label: 'Cotizaciones', description: 'Aprobaciones pendientes' },
    ],
    showSalesChart: true,
    showQuotesList: true,
    showApprovals: true,
  },
  EXECUTIVE: {
    roleLabel: ROLE_LABELS.EXECUTIVE,
    metrics: ['monthlySales', 'monthlyQuotes', 'todayOrders', 'pendingCreditOrders', 'totalOutstandingBalance', 'activeClients'],
    quickActions: [
      { href: '/finanzas', label: 'Finanzas', description: 'KPIs y cartera' },
      { href: '/admin', label: 'Administración', description: 'Usuarios y permisos' },
      { href: '/quality', label: 'Calidad', description: 'Indicadores por planta' },
    ],
    showSalesChart: true,
    showQuotesList: true,
    showApprovals: true,
  },
  QUALITY_TEAM: {
    roleLabel: ROLE_LABELS.QUALITY_TEAM,
    metrics: [],
    quickActions: [{ href: '/quality', label: 'Módulo de calidad', description: 'Muestreos y ensayos' }],
    showSalesChart: false,
    showQuotesList: false,
    showApprovals: false,
  },
  LABORATORY: {
    roleLabel: 'Laboratorio',
    metrics: [],
    quickActions: [{ href: '/quality', label: 'Calidad', description: 'Ensayos' }],
    showSalesChart: false,
    showQuotesList: false,
    showApprovals: false,
  },
  ADMIN: {
    roleLabel: ROLE_LABELS.ADMIN,
    metrics: ['todayOrders', 'monthlySales', 'pendingCreditOrders'],
    quickActions: [{ href: '/admin', label: 'Administración', description: 'Sistema' }],
    showSalesChart: true,
    showQuotesList: false,
    showApprovals: false,
  },
  EXTERNAL_CLIENT: {
    roleLabel: ROLE_LABELS.EXTERNAL_CLIENT,
    metrics: [],
    quickActions: [{ href: '/client-portal', label: 'Portal', description: 'Mis pedidos' }],
    showSalesChart: false,
    showQuotesList: false,
    showApprovals: false,
  },
};

export function getRoleDashboardConfig(
  role: UserRole | string | undefined,
  accessLevel: UserPlantAccess['accessLevel'] | undefined,
  plantCount: number
): RoleDashboardConfig {
  const base = BASE_CONFIG[(role as UserRole) ?? 'EXECUTIVE'] ?? BASE_CONFIG.EXECUTIVE;
  const variant = getDashboardVariant(role);

  let subtitle = 'Resumen operativo de tu ámbito';
  let showPlantComparison = false;

  if (variant === 'operations') {
    subtitle =
      role === 'DOSIFICADOR'
        ? 'Resumen del día antes de entrar a producción — pedidos de hoy y acceso directo al hub'
        : 'Resumen operativo: pedidos, planta e inventario en un vistazo';
  } else if (role === 'CREDIT_VALIDATOR') {
    subtitle = 'Créditos pendientes y cartera — tu validación vive en Finanzas';
  } else if (role === 'ADMINISTRATIVE') {
    subtitle = 'Indicadores financieros y operación del día';
  } else if (role === 'SALES_AGENT' || role === 'EXTERNAL_SALES_AGENT') {
    subtitle = 'Pipeline comercial: cotizaciones, clientes y seguimiento';
  } else if (accessLevel === 'PLANT') {
    subtitle = 'Vista enfocada en tu planta asignada';
  } else if (accessLevel === 'BUSINESS_UNIT' && plantCount > 1) {
    subtitle = `Comparativo de tus ${plantCount} plantas en la unidad de negocio`;
    showPlantComparison = true;
  } else if (accessLevel === 'BUSINESS_UNIT') {
    subtitle = 'Resumen de tu unidad de negocio';
    showPlantComparison = true;
  } else if (accessLevel === 'GLOBAL' && plantCount > 1) {
    subtitle = 'Vista consolidada — selecciona una planta para el detalle';
    showPlantComparison = true;
  }

  // BU managers and executives benefit from plant breakdown
  if (
    !showPlantComparison &&
    (role === 'EXECUTIVE' || role === 'PLANT_MANAGER') &&
    plantCount > 1 &&
    accessLevel !== 'PLANT'
  ) {
    showPlantComparison = true;
  }

  if (variant === 'operations' && (role === 'ADMIN_OPERATIONS' || role === 'EXECUTIVE')) {
    showPlantComparison = showPlantComparison || plantCount > 1;
  }

  return {
    ...base,
    variant,
    subtitle,
    showPlantComparison,
  };
}

export const METRIC_DEFINITIONS: Record<
  DashboardMetricKey,
  { title: string; suffix: string; hasGrowth: boolean }
> = {
  monthlyQuotes: { title: 'Cotizaciones del mes', suffix: '', hasGrowth: true },
  monthlySales: { title: 'Venta mensual (m³)', suffix: ' m³', hasGrowth: true },
  activeClients: { title: 'Clientes activos', suffix: '', hasGrowth: true },
  pendingCreditOrders: { title: 'Créditos pendientes', suffix: '', hasGrowth: false },
  todayOrders: { title: 'Pedidos hoy', suffix: '', hasGrowth: false },
  totalOutstandingBalance: { title: 'Cartera CxC', suffix: '$', hasGrowth: false },
  pendingQuotes: { title: 'Cotizaciones pendientes', suffix: '', hasGrowth: false },
};

export { ROLE_LABELS };
