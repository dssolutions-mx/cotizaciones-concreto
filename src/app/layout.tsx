'use client';

import React, { useEffect, useState, ErrorInfo } from 'react';
import { DM_Sans, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Analytics } from '@vercel/analytics/react';
import { 
  FileText, 
  DollarSign, 
  BarChart2, 
  Users, 
  ClipboardList,
  Menu,
  X,
  Plus,
  UserCog,
  Package,
  Home,
  FileBarChart2,
  Beaker,
  FlaskConical,
  Clipboard,
  ClipboardCheck,
  BarChart,
  CreditCard,
  Building2,
  FileSpreadsheet,
  TrendingUp,
  Warehouse,
  Inbox,
  Settings,
  FileUp,
  Calendar,
  BarChart3,
  Truck,
  Clock,
  Layers,
  GitBranch,
  ShieldCheck,
  Briefcase,
  MapPin,
  ArrowLeftRight,
  AlertTriangle,
  TrendingDown,
  ClipboardPlus,
  Gauge,
  CalendarClock,
  BookOpen,
  Lightbulb,
  Upload,
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { PlantProvider, usePlantContext } from '@/contexts/PlantContext';
import ProfileMenu from '@/components/auth/ProfileMenu';
import AuthStatusIndicator from '@/components/auth/AuthStatusIndicator';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { OrderPreferencesProvider } from '@/contexts/OrderPreferencesContext';
import { Toaster as SonnerToaster } from 'sonner';
import { cn } from '@/lib/utils';
import AuthInitializer from '@/components/auth/auth-initializer';
import { ReleaseAnnouncementGate } from '@/components/release/ReleaseAnnouncementGate';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { BotIdClientGate } from '@/components/security/BotIdClientGate';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

const jetMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-jet-mono',
})

// Define navigation items for different roles
// const NAV_ITEMS = { ... }; // Removed as it's unused

// Remove Inter font and rely on system fonts defined in globals.css

// Define Finanzas submenu items with component types
const finanzasSubMenuItems = [
  {
    title: "Centro de Compras",
    href: "/finanzas/procurement",
    IconComponent: Briefcase,
  },
  {
    title: "Reporte de Producción",
    href: "/finanzas/produccion",
    IconComponent: BarChart,
  },
  {
    title: "Cartera CxC",
    href: "/finanzas/clientes",
    IconComponent: Users,
  },
  {
    title: "Reporte de Ventas",
    href: "/finanzas/ventas",
    IconComponent: BarChart2,
  },
  {
    title: "Reporte Diario (Ventas y Pagos)",
    href: "/finanzas/ventas-diarias",
    IconComponent: BarChart,
  },
  {
    title: "Remisiones por Cliente",
    href: "/finanzas/remisiones",
    IconComponent: FileBarChart2,
  },
  {
    title: "Evidencia remisiones (concreto)",
    href: "/finanzas/evidencia-remisiones-concreto",
    IconComponent: Layers,
  },
  {
    title: "Reportes para clientes",
    href: "/finanzas/reportes-clientes",
    IconComponent: FileSpreadsheet,
  },
  {
    title: "Ubicaciones (Mapa)",
    href: "/finanzas/ubicaciones",
    IconComponent: MapPin,
  },
];

function getFinanzasSubMenuItemsForRole(userRole?: string) {
  const procurementWorkspaceItem = { title: "Centro de Compras", href: "/finanzas/procurement", IconComponent: Briefcase };

  if (userRole === 'ADMIN_OPERATIONS') {
    return [
      procurementWorkspaceItem,
      { title: "Reporte de Ventas", href: "/finanzas/ventas", IconComponent: BarChart2 },
      { title: "Reporte Diario (Ventas y Pagos)", href: "/finanzas/ventas-diarias", IconComponent: BarChart },
      { title: "Remisiones por Cliente", href: "/finanzas/remisiones", IconComponent: FileBarChart2 },
      {
        title: "Evidencia remisiones (concreto)",
        href: "/finanzas/evidencia-remisiones-concreto",
        IconComponent: Layers,
      },
      { title: "Reportes para clientes", href: "/finanzas/reportes-clientes", IconComponent: FileSpreadsheet },
      { title: "Ubicaciones (Mapa)", href: "/finanzas/ubicaciones", IconComponent: MapPin },
    ];
  }
  if (userRole === 'SALES_AGENT') {
    return [
      procurementWorkspaceItem,
      { title: "Cartera CxC", href: "/finanzas/clientes", IconComponent: Users },
      { title: "Reporte de Ventas", href: "/finanzas/ventas", IconComponent: BarChart2 },
      { title: "Remisiones por Cliente", href: "/finanzas/remisiones", IconComponent: FileBarChart2 },
      {
        title: "Evidencia remisiones (concreto)",
        href: "/finanzas/evidencia-remisiones-concreto",
        IconComponent: Layers,
      },
      { title: "Reportes para clientes", href: "/finanzas/reportes-clientes", IconComponent: FileSpreadsheet },
      { title: "Ubicaciones (Mapa)", href: "/finanzas/ubicaciones", IconComponent: MapPin },
    ];
  }
  return finanzasSubMenuItems;
}

// Define Comercial submenu items
const comercialSubMenuItems = [
  { title: "Clientes", href: "/clients", IconComponent: Users },
  { title: "Cotizaciones", href: "/quotes", IconComponent: ClipboardList },
  { title: "Precios", href: "/prices", IconComponent: DollarSign },
  { title: "Precios Ejecutivos", href: "/prices/list-prices", IconComponent: DollarSign },
  { title: "Autorización", href: "/finanzas/gobierno-precios", IconComponent: ShieldCheck },
  { title: "Crédito", href: "/finanzas/credito-validacion", IconComponent: CreditCard },
];

// Define RH submenu items
const rhSubMenuItems = [
  {
    title: "Remisiones Semanal",
    href: "/rh/remisiones-semanal",
    IconComponent: BarChart3,
  },
  {
    title: "Reloj Checador",
    href: "/production-control/reloj-checador",
    IconComponent: Clock,
  },
];

// Control de Producción: solo las 4 acciones principales del dashboard (ACCIONES PRINCIPALES).
type InventoryNavLink = {
  title: string;
  href: string;
  IconComponent: React.ElementType;
  badge?: 'pending_alerts';
  primary?: boolean;
};

const productionControlSidebarLinks: InventoryNavLink[] = [
  { title: 'Registrar entrada', href: '/production-control/entries?tab=new', IconComponent: Inbox },
  {
    title: 'Solicitar material',
    href: '/production-control/material-request',
    IconComponent: ClipboardPlus,
    primary: true,
  },
  { title: 'Procesar Arkik', href: '/production-control/arkik-upload', IconComponent: Upload },
  { title: 'Servicio de bombeo', href: '/production-control/pumping-service', IconComponent: Truck },
];

function isProductionControlLinkActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  const pathOnly = href.split('?')[0];
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

function ProductionControlSubnav({
  pathname,
  pendingMaterialAlerts,
  variant,
  onNavigate,
}: {
  pathname: string | null | undefined;
  pendingMaterialAlerts: number;
  variant: 'inset' | 'flyout' | 'mobile';
  onNavigate?: () => void;
}) {
  const linkClassesInset = (active: boolean) =>
    cn(
      'flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-footnote w-full',
      active ? 'bg-primary/10 text-gray-900 font-medium' : 'text-gray-600 hover:bg-muted/50'
    );

  const linkClassesFlyout = (active: boolean) =>
    cn(
      'flex items-center gap-2 px-3 py-2 rounded text-sm w-full',
      active ? 'bg-gray-100' : 'hover:bg-gray-50'
    );

  const linkClassesMobile = (active: boolean) =>
    cn(
      'flex items-center gap-2 py-1.5 px-2 rounded-md text-footnote w-full',
      active ? 'bg-primary/10 text-gray-900 font-medium' : 'text-gray-600 hover:bg-muted/50'
    );

  return (
    <div className={variant === 'flyout' ? 'py-0.5' : undefined}>
      {productionControlSidebarLinks.map((item, i) => {
        const active = isProductionControlLinkActive(pathname, item.href);
        const showAlertBadge = item.badge === 'pending_alerts' && pendingMaterialAlerts > 0;
        const SubIcon = item.IconComponent;
        const key = `pc-${variant}-${i}`;

        if (variant === 'flyout') {
          return (
            <Link
              key={key}
              href={item.href}
              className={linkClassesFlyout(active)}
              onClick={onNavigate}
            >
              <SubIcon size={16} className="shrink-0" />
              <span
                className={cn('flex-1 min-w-0 truncate', item.primary && 'font-semibold text-emerald-900')}
              >
                {item.title}
              </span>
              {showAlertBadge && (
                <span className="shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingMaterialAlerts > 9 ? '9+' : pendingMaterialAlerts}
                </span>
              )}
            </Link>
          );
        }

        if (variant === 'mobile') {
          return (
            <Link
              key={key}
              href={item.href}
              onClick={onNavigate}
              className={linkClassesMobile(active)}
            >
              <span className="mr-2 shrink-0">{SubIcon && <SubIcon size={16} />}</span>
              <span
                className={cn('flex-1 min-w-0 truncate', item.primary && 'font-semibold text-emerald-900')}
              >
                {item.title}
              </span>
              {showAlertBadge && (
                <span className="shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingMaterialAlerts > 9 ? '9+' : pendingMaterialAlerts}
                </span>
              )}
            </Link>
          );
        }

        return (
          <Link key={key} href={item.href} className={linkClassesInset(active)}>
            <span className="mr-2 shrink-0">{SubIcon && <SubIcon size={16} />}</span>
            <span
              className={cn('flex-1 min-w-0 truncate', item.primary && 'font-semibold text-emerald-900')}
            >
              {item.title}
            </span>
            {showAlertBadge && (
              <span className="shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                {pendingMaterialAlerts > 9 ? '9+' : pendingMaterialAlerts}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

// Quality sidebar: purpose-driven collapsible sections
type QualityMenuItem = {
  title: string;
  href: string;
  IconComponent: React.ElementType;
  comingSoon?: boolean;
  subGroup?: string;
  excludeRestrictedPlants?: boolean;
  onlyRoles?: string[];
};

type QualitySection = {
  id: string;
  title: string;
  hubHref: string;
  IconComponent: React.ElementType;
  hideForRestrictedPlants?: boolean;
  items: QualityMenuItem[];
};

const QUALITY_SECTIONS: QualitySection[] = [
  {
    id: 'operaciones',
    title: 'Operaciones',
    hubHref: '/quality/operaciones',
    IconComponent: Clipboard,
    items: [
      { title: 'Muestreos', href: '/quality/muestreos', IconComponent: Beaker },
      { title: 'Ensayos', href: '/quality/ensayos', IconComponent: FlaskConical },
      { title: 'Control en obra', href: '/quality/site-checks/new', IconComponent: ClipboardCheck },
      { title: 'Reportes', href: '/quality/reportes', IconComponent: Clipboard, excludeRestrictedPlants: true },
    ],
  },
  {
    id: 'equipos',
    title: 'Equipos',
    hubHref: '/quality/instrumentos',
    IconComponent: ShieldCheck,
    items: [
      { title: 'Catálogo', href: '/quality/instrumentos/catalogo', IconComponent: Gauge },
      { title: 'Programa', href: '/quality/instrumentos/programa', IconComponent: CalendarClock },
      { title: 'Conjuntos', href: '/quality/conjuntos', IconComponent: BookOpen },
      { title: 'Plantillas', href: '/quality/plantillas', IconComponent: ClipboardList },
      { title: 'Paquetes', href: '/quality/paquetes', IconComponent: Package },
    ],
  },
  {
    id: 'validaciones',
    title: 'Validaciones',
    hubHref: '/quality/validaciones',
    IconComponent: FlaskConical,
    items: [
      { title: 'Investigación', href: '/quality/validaciones/investigacion', IconComponent: Lightbulb, comingSoon: true, subGroup: 'I+D' },
      { title: 'Caracterizaciones', href: '/quality/caracterizacion-materiales', IconComponent: FlaskConical, subGroup: 'Nuevos Materiales' },
      { title: 'Materiales', href: '/quality/materials', IconComponent: Package, subGroup: 'Nuevos Materiales' },
      {
        title: 'Proveedores',
        href: '/quality/suppliers',
        IconComponent: Truck,
        subGroup: 'Nuevos Materiales',
        excludeRestrictedPlants: true,
      },
      { title: 'Curvas de Abrams', href: '/quality/curvas-abrams', IconComponent: TrendingUp, subGroup: 'Evaluar Mezcla' },
    ],
  },
  {
    id: 'controles',
    title: 'Controles',
    hubHref: '/quality/controles',
    IconComponent: BarChart,
    items: [
      { title: 'Mezcla de Referencia', href: '/quality/controles/mezcla-referencia', IconComponent: Beaker, comingSoon: true, subGroup: 'Mezcla Ref.', excludeRestrictedPlants: true },
      { title: 'Verificación Lab', href: '/quality/controles/lab-checking', IconComponent: ClipboardCheck, comingSoon: true, subGroup: 'Lab Checking', excludeRestrictedPlants: true },
      { title: 'Dashboard Calidad', href: '/quality/dashboard', IconComponent: BarChart, subGroup: 'Análisis', onlyRoles: ['EXECUTIVE', 'PLANT_MANAGER'] },
      { title: 'Análisis por Cliente', href: '/quality/clientes', IconComponent: Users, subGroup: 'Análisis' },
      { title: 'Análisis por Receta', href: '/quality/recetas-analisis', IconComponent: FileBarChart2, subGroup: 'Análisis' },
    ],
  },
  {
    id: 'recetas',
    title: 'Recetas',
    hubHref: '/quality/recetas-hub',
    IconComponent: FileText,
    items: [
      { title: 'Recetas', href: '/quality/recipes', IconComponent: FileText, excludeRestrictedPlants: true },
      { title: 'Solicitudes Arkik', href: '/quality/arkik-requests', IconComponent: FileUp },
      { title: 'Maestros', href: '/masters/recipes', IconComponent: Layers, excludeRestrictedPlants: true },
      { title: 'Agrupación', href: '/masters/grouping', IconComponent: Layers, excludeRestrictedPlants: true },
      { title: 'Consolidación Precios', href: '/masters/pricing', IconComponent: DollarSign, excludeRestrictedPlants: true },
      { title: 'Gobernanza', href: '/quality/recipe-governance', IconComponent: GitBranch, excludeRestrictedPlants: true },
    ],
  },
];

function getQualitySections(userRole: string | undefined, plantCode: string | undefined): QualitySection[] {
  const isRestricted = isQualityTeamInRestrictedPlant(userRole, plantCode);
  return QUALITY_SECTIONS
    .filter((section) => !(section.hideForRestrictedPlants && isRestricted))
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.excludeRestrictedPlants && isRestricted) return false;
        if (item.onlyRoles && userRole && !item.onlyRoles.includes(userRole)) return false;
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0 || !isRestricted);
}

function getActiveQualitySectionId(pathname: string | null | undefined, sections: QualitySection[]): string | null {
  if (!pathname) return null;
  for (const section of sections) {
    if (pathname === section.hubHref || pathname.startsWith(section.hubHref + '/')) return section.id;
    for (const item of section.items) {
      const itemPath = item.href.split('?')[0];
      if (pathname === itemPath || pathname.startsWith(itemPath + '/')) return section.id;
    }
  }
  return null;
}

// Canonical navigation config: ordered array filtered by role
type NavItemDef = {
  href: string;
  label: string;
  IconComponent: React.ElementType;
  roles: string[];
};

const COMERCIAL_ROLES = ['CREDIT_VALIDATOR', 'EXTERNAL_SALES_AGENT', 'SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE'];

const CANONICAL_NAV_ITEMS: NavItemDef[] = [
  { href: '/dashboard', label: 'Dashboard', IconComponent: Home, roles: ['DOSIFICADOR', 'CREDIT_VALIDATOR', 'EXTERNAL_SALES_AGENT', 'SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'] },
  { href: '/orders', label: 'Pedidos', IconComponent: Package, roles: ['DOSIFICADOR', 'CREDIT_VALIDATOR', 'EXTERNAL_SALES_AGENT', 'SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE'] },
  { href: '/recipes', label: 'Recetas', IconComponent: FileText, roles: ['SALES_AGENT'] },
  { href: '/comercial', label: 'Comercial', IconComponent: Briefcase, roles: COMERCIAL_ROLES },
  { href: '/production-control', label: 'Control de Producción', IconComponent: Warehouse, roles: ['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS', 'CREDIT_VALIDATOR'] },
  { href: '/rh', label: 'RH', IconComponent: Users, roles: ['DOSIFICADOR', 'CREDIT_VALIDATOR', 'EXTERNAL_SALES_AGENT', 'SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'] },
  { href: '/finanzas', label: 'Finanzas', IconComponent: DollarSign, roles: ['CREDIT_VALIDATOR', 'SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'] },
  { href: '/quality', label: 'Calidad', IconComponent: Beaker, roles: ['PLANT_MANAGER', 'EXECUTIVE', 'QUALITY_TEAM'] },
  { href: '/admin', label: 'Administración', IconComponent: UserCog, roles: ['EXECUTIVE'] },
];

function getNavItemsForRole(role: string | undefined): Array<{ href: string; label: string; IconComponent: React.ElementType }> {
  if (!role) return [];
  const items = CANONICAL_NAV_ITEMS
    .filter((item) => item.roles.includes(role))
    .map(({ href, label, IconComponent }) => ({ href, label, IconComponent }));
  // Remove top-level Recipes when Quality section exists (recetas in quality submenu)
  const hasQuality = items.some((i) => i.href === '/quality');
  if (hasQuality) {
    return items.filter((i) => i.href !== '/recipes');
  }
  return items;
}

// Helper function to check if QUALITY_TEAM user is in restricted plant
export function isQualityTeamInRestrictedPlant(userRole: string | undefined, plantCode: string | undefined): boolean {
  if (userRole !== 'QUALITY_TEAM') return false;
  // Support both formats: P2/P3/P4 and P002/P003/P004
  const restrictedPlants = ['P2', 'P3', 'P4', 'P002', 'P003', 'P004'];
  return plantCode ? restrictedPlants.includes(plantCode) : false;
}


// Componente interno para navegación con soporte de roles
function Navigation({ children }: { children: React.ReactNode }) {
  const { profile, session, isLoading } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [pendingMaterialAlerts, setPendingMaterialAlerts] = useState(0);

  const isLandingRoute = pathname?.startsWith('/landing');
  const isAuthRoute = pathname?.startsWith('/login') || pathname?.startsWith('/auth') || pathname?.startsWith('/reset-password') || pathname?.startsWith('/update-password');
  const isGobiernoPreciosOrCredito =
    pathname?.startsWith('/finanzas/gobierno-precios') ||
    pathname?.startsWith('/finanzas/credito-validacion');
  const isFinanzasRoute =
    pathname?.startsWith('/finanzas') && !isGobiernoPreciosOrCredito;
  const isQualityRoute = pathname?.startsWith('/quality') || pathname?.startsWith('/masters');
  const isAdminRoute = pathname?.startsWith('/admin');
  const isInventoryRoute = pathname?.startsWith('/production-control');
  const isRhRoute = pathname?.startsWith('/rh');
  const isComercialRoute =
    pathname?.startsWith('/comercial') ||
    pathname?.startsWith('/clients') ||
    pathname?.startsWith('/quotes') ||
    pathname?.startsWith('/prices') ||
    isGobiernoPreciosOrCredito;

  // Persist collapsed state (default collapsed)
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem('sidebar:collapsed') : null;
      if (saved !== null) {
        setIsSidebarCollapsed(saved === '1');
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('sidebar:collapsed', isSidebarCollapsed ? '1' : '0');
      }
    } catch {
      // ignore storage errors
    }
  }, [isSidebarCollapsed]);

  // Close mobile menu on route change
  useEffect(() => {
    if (mobileMenuOpen) setMobileMenuOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);


  // Badge: material alerts pending confirmation (dosificador action)
  useEffect(() => {
    if (!currentPlant?.id || !session?.user) {
      setPendingMaterialAlerts(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/alerts/material?plant_id=${currentPlant.id}&status=pending_confirmation`
        );
        const j = await r.json();
        if (!cancelled && j.success && Array.isArray(j.data)) {
          setPendingMaterialAlerts(j.data.length);
        }
      } catch {
        if (!cancelled) setPendingMaterialAlerts(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentPlant?.id, session?.user, pathname]);

  // Check for new users (invited but haven't set password) and redirect to password setup
  useEffect(() => {
    // Only check if we have a session and profile, and we're not already on an auth page
    if (session?.user && profile && !isAuthRoute && !isLandingRoute) {
      // Check if this is a new user who hasn't set their password yet
      // New users have created_at === last_sign_in_at (they've never logged in with password)
      const isNewUser = session.user.created_at === session.user.last_sign_in_at;
      
      // Also check user metadata for invitation indicators
      const userMetadata = session.user.user_metadata || {};
      const isInvitationMetadata = userMetadata.invited === true || userMetadata.role === 'EXTERNAL_CLIENT';
      const hasPasswordSet = userMetadata.password_set === true; // Check if password has been set
      
      // Only redirect if user is new/invited AND hasn't set password yet
      if ((isNewUser || isInvitationMetadata) && !hasPasswordSet) {
        console.log('Root layout: Detected new user/invitation without password, redirecting to update-password', {
          isNewUser,
          isInvitationMetadata,
          hasPasswordSet,
          email: session.user.email
        });
        router.replace('/update-password?type=invite');
        return;
      }
    }
  }, [session?.user, profile, pathname, router, isAuthRoute, isLandingRoute]);

  // Safety redirect: External clients should always land in client-portal
  useEffect(() => {
    if (profile?.role === 'EXTERNAL_CLIENT' && profile.id && profile.email) {
      const isPortal = pathname?.startsWith('/client-portal');
      const isAuth = pathname === '/login' || pathname?.startsWith('/auth') || pathname?.startsWith('/update-password');
      if (!isPortal && !isAuth) {
        console.log(`Root layout: Redirecting external client ${profile.email} to client-portal`);
        router.replace('/client-portal');
        return;
      }
    }
  }, [profile?.role, profile?.id, profile?.email, pathname, router]);

  // Global fallback guard:
  // If auth state resolves with no session on any protected page, force redirect to login.
  useEffect(() => {
    if (isLoading) return;
    if (isLandingRoute || isAuthRoute || pathname?.startsWith('/client-portal')) return;
    if (session) return;

    const redirectPath =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search || ''}`
        : (pathname || '/dashboard');

    const encodedRedirect = encodeURIComponent(redirectPath || '/dashboard');
    router.replace(`/login?redirect=${encodedRedirect}`);
  }, [isLoading, isLandingRoute, isAuthRoute, pathname, session, router]);

  // If it's a landing, client-portal, or auth route, render children without global Navigation
  if (isLandingRoute || pathname?.startsWith('/client-portal') || isAuthRoute) {
    return <>{children}</>;
  }

  // Determinar los elementos de navegación basados en el rol (declarative config)
  const navItems = profile ? getNavItemsForRole(profile.role) : [];

  // Define preferred items for mobile bottom navigation
  const preferredBottomNavOrder = ['/orders', '/comercial', '/finanzas'];
  const mobileBottomNavItems = preferredBottomNavOrder
    .map(href => navItems.find(item => item.href === href))
    .filter(item => item !== undefined) as typeof navItems;

  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-[#f5f3f0]">
      {/* Sidebar - fixed, collapsible with glass */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 h-screen sticky top-0 glass-thin transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        <div className={cn(
          "border-b flex items-center",
          isSidebarCollapsed ? "justify-center p-4" : "justify-center p-6"
        )}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setIsSidebarCollapsed(prev => !prev)}
                className="flex items-center gap-2 rounded hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-green-500 p-1"
                aria-label={isSidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
              >
                <Image
                  src="/images/dcconcretos/logo-dark.svg"
                  alt="DC Concretos"
                  width={isSidebarCollapsed ? 32 : 120}
                  height={isSidebarCollapsed ? 32 : 40}
                  className={cn(isSidebarCollapsed ? "h-8 w-8" : "h-10 w-auto")}
                  priority
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <p>{isSidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        {!isSidebarCollapsed ? (
          <nav className="p-3 space-y-1 overflow-y-auto">
            {navItems.map((item, index) => {
              const isFinanzasMainLink = item.href === '/finanzas';
              const isQualityMainLink = item.href === '/quality';
              const isRhMainLink = item.href === '/rh';
              const isComercialMainLink = item.href === '/comercial';
              const isActive = isFinanzasMainLink
                ? isFinanzasRoute
                : isQualityMainLink
                ? isQualityRoute
                : isRhMainLink
                ? isRhRoute
                : isComercialMainLink
                ? isComercialRoute
                : item.href === '/admin'
                ? isAdminRoute
                : item.href === '/production-control'
                ? isInventoryRoute
                : pathname === item.href;
              const Icon = item.IconComponent;

              return (
                <React.Fragment key={`nav-${index}`}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 py-2 px-3 rounded transition-colors w-full text-footnote border-l-4",
                      isActive ? "bg-primary/15 border-primary text-gray-900 font-medium" : "border-transparent text-gray-700 hover:bg-muted/50"
                    )}
                  >
                    <span className="mr-1.5">{Icon && <Icon size={18} />}</span>
                    <span className="truncate">{item.label}</span>
                  </Link>

                  {isFinanzasMainLink && isFinanzasRoute && (
                    <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                      {getFinanzasSubMenuItemsForRole(profile?.role).map((subItem, subIndex) => {
                        const SubIcon = subItem.IconComponent;
                        return (
                          <Link
                            key={`subnav-${subIndex}`}
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-footnote w-full",
                              pathname === subItem.href
                                ? "bg-primary/10 text-gray-900 font-medium"
                                : "text-gray-600 hover:bg-muted/50"
                            )}
                          >
                            <span className="mr-2">{SubIcon && <SubIcon size={16} />}</span>
                            {subItem.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {isComercialMainLink && isComercialRoute && (
                    <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                      {comercialSubMenuItems.map((subItem, subIndex) => {
                        const SubIcon = subItem.IconComponent;
                        return (
                          <Link
                            key={`comercial-subnav-${subIndex}`}
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-footnote w-full",
                              pathname === subItem.href
                                ? "bg-primary/10 text-gray-900 font-medium"
                                : "text-gray-600 hover:bg-muted/50"
                            )}
                          >
                            <span className="mr-2">{SubIcon && <SubIcon size={16} />}</span>
                            {subItem.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {isRhMainLink && isRhRoute && (
                    <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                      {rhSubMenuItems.map((subItem, subIndex) => {
                        const SubIcon = subItem.IconComponent;
                        return (
                          <Link
                            key={`rh-subnav-${subIndex}`}
                            href={subItem.href}
                            className={cn(
                              "flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-footnote w-full",
                              pathname === subItem.href
                                ? "bg-primary/10 text-gray-900 font-medium"
                                : "text-gray-600 hover:bg-muted/50"
                            )}
                          >
                            <span className="mr-2">{SubIcon && <SubIcon size={16} />}</span>
                            {subItem.title}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {isQualityMainLink && isQualityRoute && (
                    <div className="mt-1 space-y-0.5 ml-3 border-l border-gray-200 pl-2">
                      {getQualitySections(profile?.role, currentPlant?.code).map((section) => {
                        const SectionIcon = section.IconComponent;
                        const isActive = getActiveQualitySectionId(pathname, getQualitySections(profile?.role, currentPlant?.code)) === section.id;
                        return (
                          <Link
                            key={`qs-${section.id}`}
                            href={section.hubHref}
                            className={cn(
                              "flex items-center gap-2 py-1.5 px-2 rounded transition-colors text-footnote w-full",
                              isActive ? "bg-primary/10 text-gray-900 font-medium" : "text-gray-600 hover:bg-muted/50"
                            )}
                          >
                            <SectionIcon size={14} className="shrink-0" />
                            <span className="truncate">{section.title}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  {item.href === '/production-control' && isInventoryRoute && (
                    <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                      <ProductionControlSubnav
                        pathname={pathname}
                        pendingMaterialAlerts={pendingMaterialAlerts}
                        variant="inset"
                      />
                    </div>
                  )}

                  {/* Render Admin submenu if active */}
                  {item.href === '/admin' && isAdminRoute && (
                    <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                      {[
                        { title: 'Usuarios', href: '/admin/users', IconComponent: UserCog },
                        { title: 'Plantas', href: '/admin/plants', IconComponent: Building2 },
                      ].map((subItem, subIndex) => (
                        <Link
                          key={`admin-subnav-${subIndex}`}
                          href={subItem.href}
                          className={cn(
                            "flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-footnote w-full",
                            pathname === subItem.href
                              ? "bg-primary/10 text-gray-900 font-medium"
                              : "text-gray-600 hover:bg-muted/50"
                          )}
                        >
                          <span className="mr-2">{subItem.IconComponent && <subItem.IconComponent size={16} />}</span>
                          {subItem.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        ) : (
          <nav className="py-3 px-2 space-y-1 overflow-y-auto">
            <TooltipProvider>
              {navItems.map((item, index) => {
                const isFinanzasMainLink = item.href === '/finanzas';
                const isQualityMainLink = item.href === '/quality';
                const isAdminMainLink = item.href === '/admin';
                const isRhMainLink = item.href === '/rh';
                const isComercialMainLink = item.href === '/comercial';
                const isActive = isFinanzasMainLink
                  ? isFinanzasRoute
                  : isQualityMainLink
                  ? isQualityRoute
                  : isRhMainLink
                  ? isRhRoute
                  : isComercialMainLink
                  ? isComercialRoute
                  : isAdminMainLink
                  ? isAdminRoute
                  : item.href === '/production-control'
                  ? isInventoryRoute
                  : pathname === item.href;
                const Icon = item.IconComponent;

                const renderCollapsedItem = (content?: React.ReactNode) => (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center py-2 rounded-md transition-colors border-l-4",
                      isActive ? "bg-primary/15 border-primary text-gray-900" : "border-transparent text-gray-700 hover:bg-muted/50"
                    )}
                    aria-label={item.label}
                  >
                    {Icon && <Icon size={20} />}
                    {/* Hidden text for screen readers if no tooltip content */}
                    {!content && <span className="sr-only">{item.label}</span>}
                  </Link>
                );

                // Show submenu inside tooltip for Finanzas/Quality
                if (isFinanzasMainLink) {
                  return (
                    <Tooltip key={`nav-col-${index}`}>
                      <TooltipTrigger asChild>{renderCollapsedItem(<></>)}</TooltipTrigger>
                      <TooltipContent sideOffset={8} side="right" className="p-0">
                        <div className="min-w-48 bg-white text-gray-700 rounded-md shadow-md p-1">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Finanzas</div>
                          {getFinanzasSubMenuItemsForRole(profile?.role).map((subItem, subIndex) => (
                            <Link
                              key={`fin-sub-${subIndex}`}
                              href={subItem.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded text-sm",
                                pathname === subItem.href ? "bg-gray-100" : "hover:bg-gray-50"
                              )}
                            >
                              <subItem.IconComponent size={16} />
                              {subItem.title}
                            </Link>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                if (isComercialMainLink) {
                  return (
                    <Tooltip key={`nav-col-${index}`}>
                      <TooltipTrigger asChild>{renderCollapsedItem(<></>)}</TooltipTrigger>
                      <TooltipContent sideOffset={8} side="right" className="p-0">
                        <div className="min-w-48 bg-white text-gray-700 rounded-md shadow-md p-1">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Comercial</div>
                          {comercialSubMenuItems.map((subItem, subIndex) => (
                            <Link
                              key={`comercial-sub-${subIndex}`}
                              href={subItem.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded text-sm",
                                pathname === subItem.href ? "bg-gray-100" : "hover:bg-gray-50"
                              )}
                            >
                              <subItem.IconComponent size={16} />
                              {subItem.title}
                            </Link>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                if (isRhMainLink) {
                  return (
                    <Tooltip key={`nav-col-${index}`}>
                      <TooltipTrigger asChild>{renderCollapsedItem(<></>)}</TooltipTrigger>
                      <TooltipContent sideOffset={8} side="right" className="p-0">
                        <div className="min-w-48 bg-white text-gray-700 rounded-md shadow-md p-1">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">RH</div>
                          {rhSubMenuItems.map((subItem, subIndex) => (
                            <Link
                              key={`rh-sub-${subIndex}`}
                              href={subItem.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded text-sm",
                                pathname === subItem.href ? "bg-gray-100" : "hover:bg-gray-50"
                              )}
                            >
                              <subItem.IconComponent size={16} />
                              {subItem.title}
                            </Link>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                if (isQualityMainLink) {
                  return (
                    <Tooltip key={`nav-col-${index}`}>
                      <TooltipTrigger asChild>{renderCollapsedItem(<></>)}</TooltipTrigger>
                      <TooltipContent sideOffset={8} side="right" className="p-0">
                        <div className="min-w-48 bg-white text-gray-700 rounded-md shadow-md p-1">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Calidad</div>
                          {getQualitySections(profile?.role, currentPlant?.code).map((section) => {
                            const isActive = getActiveQualitySectionId(pathname, getQualitySections(profile?.role, currentPlant?.code)) === section.id;
                            return (
                              <Link
                                key={`qf-${section.id}`}
                                href={section.hubHref}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors",
                                  isActive ? "bg-sky-50 text-sky-700 font-medium" : "text-gray-700 hover:bg-gray-100"
                                )}
                              >
                                <section.IconComponent size={14} className="shrink-0" />
                                <span>{section.title}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                if (item.href === '/production-control') {
                  return (
                    <Tooltip key={`nav-col-${index}`}>
                      <TooltipTrigger asChild>{renderCollapsedItem(<></>)}</TooltipTrigger>
                      <TooltipContent sideOffset={8} side="right" className="p-0">
                        <div className="min-w-56 bg-white text-gray-700 rounded-md shadow-md p-1">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Control de Producción</div>
                          <ProductionControlSubnav
                            pathname={pathname}
                            pendingMaterialAlerts={pendingMaterialAlerts}
                            variant="flyout"
                          />
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                if (isAdminMainLink) {
                  return (
                    <Tooltip key={`nav-col-${index}`}>
                      <TooltipTrigger asChild>{renderCollapsedItem(<></>)}</TooltipTrigger>
                      <TooltipContent sideOffset={8} side="right" className="p-0">
                        <div className="min-w-48 bg-white text-gray-700 rounded-md shadow-md p-1">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Administración</div>
                          {[
                            { title: 'Usuarios', href: '/admin/users', IconComponent: UserCog },
                            { title: 'Plantas', href: '/admin/plants', IconComponent: Building2 },
                          ].map((subItem, subIndex) => (
                            <Link
                              key={`ad-sub-${subIndex}`}
                              href={subItem.href}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded text-sm",
                                pathname === subItem.href ? "bg-gray-100" : "hover:bg-gray-50"
                              )}
                            >
                              <subItem.IconComponent size={16} />
                              {subItem.title}
                            </Link>
                          ))}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return (
                  <Tooltip key={`nav-col-${index}`}>
                    <TooltipTrigger asChild>{renderCollapsedItem()}</TooltipTrigger>
                    <TooltipContent sideOffset={8} side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </TooltipProvider>
          </nav>
        )}

        {/* No explicit footer handle; logo toggles sidebar */}
      </aside>

      {/* Contenido principal - scroll independiente del sidebar */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden bg-[#f5f3f0] p-4 md:p-6 pb-24 md:pb-6">
        {/* Header móvil */}
        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 md:hidden">
          <Link href="/dashboard">
            <Image 
              src="/images/dcconcretos/logo-dark.svg" 
              alt="DC Concretos" 
              width={96}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          
          <div className="flex min-w-0 max-w-[min(100%,calc(100vw-7rem))] shrink items-center justify-end gap-2">
            <PlantContextDisplay className="min-w-0 max-w-[11rem] sm:max-w-none sm:min-w-[160px]" showLabel={false} />
            <ProfileMenu />
            
            {/* Botón de menú móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full bg-stone-200/70 hover:bg-stone-300/80 active:bg-stone-300 
                         focus:outline-hidden focus:ring-2 focus:ring-green-500 transition-all
                         transform active:scale-95"
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
          </div>
        </div>
        
        {/* Header desktop */}
        <div className="mb-6 hidden min-w-0 items-center justify-end md:flex">
          <div className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-4">
            <PlantContextDisplay className="min-w-0 max-w-xs sm:min-w-[200px]" showLabel={false} />
            <ProfileMenu />
          </div>
        </div>
        
        {/* Añadir el indicador de estado de autenticación */}
        <div className="hidden md:block">
          <AuthStatusIndicator />
        </div>
        
        {/* Menú móvil: Sheet lateral */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-64 p-0 flex flex-col overscroll-contain">
            <div className="p-4 border-b shrink-0">
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center gap-2">
                <Image
                  src="/images/dcconcretos/logo-dark.svg"
                  alt="DC Concretos"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                  priority
                />
              </Link>
            </div>
            <div className="p-2 flex-1 overflow-y-auto">
              {navItems.map((item, index) => {
                const Icon = item.IconComponent;
                const isCurrentItemActive = item.href === '/finanzas'
                  ? isFinanzasRoute
                  : item.href === '/rh'
                  ? isRhRoute
                  : item.href === '/quality'
                  ? isQualityRoute
                  : item.href === '/admin'
                  ? isAdminRoute
                  : item.href === '/production-control'
                  ? isInventoryRoute
                  : pathname === item.href;

                return (
                  <React.Fragment key={`mobile-full-${index}`}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center py-2.5 px-3 rounded-md mb-1 text-footnote border-l-4",
                        isCurrentItemActive ? "bg-primary/15 border-primary text-gray-900 font-medium" : "border-transparent text-gray-700 hover:bg-muted/50"
                      )}
                    >
                      <span className="mr-2">{Icon && <Icon size={18} />}</span>
                      <span>{item.label}</span>
                    </Link>

                    {item.href === '/finanzas' && isFinanzasRoute && (
                      <div className="pl-6 mb-2 space-y-1">
                        {getFinanzasSubMenuItemsForRole(profile?.role).map((subItem, subIndex) => {
                          const SubIcon = subItem.IconComponent;
                          const isSubItemActive = pathname === subItem.href;
                          return (
                            <Link
                              key={`mobile-finanzas-sub-${subIndex}`}
                              href={subItem.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center py-1.5 px-2 rounded-md text-footnote",
                                isSubItemActive ? "bg-primary/10 text-gray-900 font-medium" : "text-gray-600 hover:bg-muted/50"
                              )}
                            >
                              <span className="mr-2">{SubIcon && <SubIcon size={16} />}</span>
                              {subItem.title}
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {item.href === '/rh' && isRhRoute && (
                      <div className="pl-6 mb-2 space-y-1">
                        {rhSubMenuItems.map((subItem, subIndex) => {
                          const isSubItemActive = pathname === subItem.href;
                          const SubIcon = subItem.IconComponent;
                          return (
                            <Link
                              key={`mobile-rh-sub-${subIndex}`}
                              href={subItem.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center py-1.5 px-2 rounded-md text-footnote",
                                isSubItemActive ? "bg-primary/10 text-gray-900 font-medium" : "text-gray-600 hover:bg-muted/50"
                              )}
                            >
                              <span className="mr-2">{SubIcon && <SubIcon size={16} />}</span>
                              {subItem.title}
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {item.href === '/quality' && isQualityRoute && (
                      <div className="pl-4 mb-2 space-y-0.5">
                        {getQualitySections(profile?.role, currentPlant?.code).map((section) => {
                          const SectionIcon = section.IconComponent;
                          const isActive = getActiveQualitySectionId(pathname, getQualitySections(profile?.role, currentPlant?.code)) === section.id;
                          return (
                            <Link
                              key={`mqs-${section.id}`}
                              href={section.hubHref}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center gap-2 py-1.5 px-2 rounded-md text-footnote w-full",
                                isActive ? "bg-primary/10 text-gray-900 font-medium" : "text-gray-600 hover:bg-muted/50"
                              )}
                            >
                              <SectionIcon size={14} className="shrink-0" />
                              <span className="truncate">{section.title}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}

                    {item.href === '/production-control' && isInventoryRoute && (
                      <div className="pl-6 mb-2 space-y-1">
                        <ProductionControlSubnav
                          pathname={pathname}
                          pendingMaterialAlerts={pendingMaterialAlerts}
                          variant="mobile"
                          onNavigate={() => setMobileMenuOpen(false)}
                        />
                      </div>
                    )}

                    {item.href === '/admin' && isAdminRoute && (
                      <div className="pl-6 mb-2 space-y-1">
                        {[
                          { title: 'Usuarios', href: '/admin/users', IconComponent: UserCog },
                          { title: 'Plantas', href: '/admin/plants', IconComponent: Building2 },
                        ].map((subItem, subIndex) => {
                          const isSubItemActive = pathname === subItem.href;
                          return (
                            <Link
                              key={`mobile-admin-sub-${subIndex}`}
                              href={subItem.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "flex items-center py-1.5 px-2 rounded-md text-footnote",
                                isSubItemActive ? "bg-primary/10 text-gray-900 font-medium" : "text-gray-600 hover:bg-muted/50"
                              )}
                            >
                              <span className="mr-2">{subItem.IconComponent && <subItem.IconComponent size={16} />}</span>
                              {subItem.title}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
        
        {/* Contenido de la página — min-w-0 evita que flex hijos (formularios) desborden horizontalmente */}
        <div className="mt-4 min-w-0 w-full max-w-full flex-1">
          {children}
        </div>
      </main>
      
      {/* Menú móvil mejorado (barra inferior) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white shadow-lg z-10 border-t">
        <div className="flex justify-around items-center">
          {mobileBottomNavItems.map((item, index) => {
            const Icon = item.IconComponent;
            // Adjusted active state logic for bottom navigation
            const currentItemIsActive = item.href === '/finanzas' 
              ? isFinanzasRoute 
              : (pathname === item.href || pathname?.startsWith(item.href + '/'));

            return (
              <Link 
                key={`mobile-nav-${index}`}
                href={item.href}
                className={`flex flex-col items-center py-2 px-1 relative mobile-nav-item ${
                  currentItemIsActive 
                    ? "text-green-500 active" 
                    : "text-gray-600 hover:text-gray-800 active:text-green-400"
                }`}
                aria-label={item.label}
              >
                {currentItemIsActive && (
                  <span className="absolute top-0 left-0 right-0 h-0.5 bg-green-500 mobile-nav-indicator" />
                )}
                <span className="text-xl mb-0.5 transform transition-transform active:scale-90">
                  {Icon && <Icon size={22} />}
                </span>
                <span className={`text-xs ${currentItemIsActive ? "font-medium" : ""}`}>
                  {item.label}
                </span>
                {currentItemIsActive && (
                  <span className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full mobile-nav-indicator" />
                )}
              </Link>
            );
          })}
        </div>
        {/* Botón de acción flotante - Crear nueva cotización */}
        <div className="fixed right-4 bottom-16 md:hidden">
          <Link href="/quotes?tab=create">
            <button 
              className="bg-green-500 hover:bg-green-600 active:bg-green-700 
                        text-white rounded-full p-3 shadow-lg transform 
                        transition-transform active:scale-95 focus:outline-hidden 
                        focus:ring-2 focus:ring-green-400"
              aria-label="Crear nueva cotización"
            >
              <Plus className="w-6 h-6" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode }, 
  { hasError: boolean, error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // You can log the error to an error reporting service
    console.error('Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-50">
          {/* ... (Fallback UI content) ... */}
        </div>
      );
    }
    return this.props.children;
  }
}

// Define protected routes for BotID
const protectedRoutes = [
  // Auth routes
  { path: '/api/auth/create-user', method: 'POST' },
  { path: '/api/auth/invite-user', method: 'POST' },
  { path: '/api/auth/reset-password', method: 'POST' },
  { path: '/api/auth/update-password', method: 'POST' },
  // Client portal routes
  { path: '/api/client-portal/orders', method: 'POST' },
  { path: '/api/client-portal/team', method: 'POST' },
  // Order and quote routes
  { path: '/api/quotes', method: 'POST' },
  { path: '/api/orders', method: 'POST' },
  // Credit and payment routes
  { path: '/api/credit-actions', method: 'POST' },
  { path: '/api/credit-terms', method: 'POST' },
  // Inventory routes (POST /api/inventory: material entries only; adjustments → /api/inventory/adjustments)
  { path: '/api/inventory', method: 'POST' },
  { path: '/api/inventory/entries', method: 'POST' },
  { path: '/api/inventory/adjustments', method: 'POST' },
  { path: '/api/inventory/adjustments', method: 'PUT' },
  { path: '/api/inventory/inter-plant-transfers', method: 'POST' },
  // Quality routes
  { path: '/api/quality', method: 'POST' },
  // Arkik integration routes
  { path: '/api/arkik/process', method: 'POST' },
  { path: '/api/arkik/quality-request', method: 'POST' },
  { path: '/api/arkik/quality-request', method: 'PATCH' },
];

// Componente principal
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontClassName = cn(dmSans.className, jetMono.variable)

  return (
    <html lang="es" suppressHydrationWarning className={fontClassName}>
      <head>
        <title>DC Concretos - Sistema de Manejo de Plantas</title>
        <meta name="description" content="Sistema de manejo integral de plantas de concreto - DC Concretos" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/images/dcconcretos/favicon.svg" />
      </head>
      {/* Body doesn't need conditional class anymore based on route */}
      <body className="min-h-screen bg-[#f5f3f0]" suppressHydrationWarning>
        {/* Initialize Zustand auth store */}
        <AuthInitializer />
        <PlantProvider>
          <OrderPreferencesProvider>
            <ErrorBoundary>
              {/* Always render Navigation; it will handle landing internally */}
              <Navigation>{children}</Navigation>
            </ErrorBoundary>
            <ReleaseAnnouncementGate />
            <Toaster />
            <SonnerToaster position="top-right" richColors/>
            <Analytics />
            <BotIdClientGate protect={protectedRoutes} />
          </OrderPreferencesProvider>
        </PlantProvider>
      </body>
    </html>
  );
}