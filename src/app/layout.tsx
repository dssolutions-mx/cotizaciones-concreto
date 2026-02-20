'use client';

import React, { useEffect, useState, ErrorInfo } from 'react';
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
  Briefcase
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { BotIdClient } from 'botid/client';


// Define navigation items for different roles
// const NAV_ITEMS = { ... }; // Removed as it's unused

// Remove Inter font and rely on system fonts defined in globals.css

// Define Finanzas submenu items with component types
const finanzasSubMenuItems = [
  {
    title: "Procurement Workspace",
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
    title: "Reportes PDF",
    href: "/finanzas/reportes-clientes",
    IconComponent: FileSpreadsheet,
  },
];

function getFinanzasSubMenuItemsForRole(userRole?: string) {
  const procurementWorkspaceItem = { title: "Procurement Workspace", href: "/finanzas/procurement", IconComponent: Briefcase };

  if (userRole === 'ADMIN_OPERATIONS') {
    return [
      procurementWorkspaceItem,
      { title: "Reporte de Ventas", href: "/finanzas/ventas", IconComponent: BarChart2 },
      { title: "Reporte Diario (Ventas y Pagos)", href: "/finanzas/ventas-diarias", IconComponent: BarChart },
      { title: "Remisiones por Cliente", href: "/finanzas/remisiones", IconComponent: FileBarChart2 },
      { title: "Reportes PDF", href: "/finanzas/reportes-clientes", IconComponent: FileSpreadsheet },
    ];
  }
  if (userRole === 'SALES_AGENT') {
    return [
      procurementWorkspaceItem,
      { title: "Cartera CxC", href: "/finanzas/clientes", IconComponent: Users },
      { title: "Reporte de Ventas", href: "/finanzas/ventas", IconComponent: BarChart2 },
      { title: "Remisiones por Cliente", href: "/finanzas/remisiones", IconComponent: FileBarChart2 },
      { title: "Reportes PDF", href: "/finanzas/reportes-clientes", IconComponent: FileSpreadsheet },
    ];
  }
  return finanzasSubMenuItems;
}

// Define Comercial submenu items
const comercialSubMenuItems = [
  { title: "Clientes", href: "/clients", IconComponent: Users },
  { title: "Cotizaciones", href: "/quotes", IconComponent: ClipboardList },
  { title: "Precios", href: "/prices", IconComponent: DollarSign },
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

// Define inventory submenu items
type InventoryNavItem = 
  | { title: string; href: string; IconComponent: React.ElementType }
  | { type: 'group'; title: string };

const inventorySubMenuItems: InventoryNavItem[] = [
  { title: "Inicio", href: "/production-control", IconComponent: Home },
  { type: 'group', title: "Materiales" },
  { title: "Entradas de Material", href: "/production-control/entries", IconComponent: Inbox },
  { title: "Ajustes de Inventario", href: "/production-control/adjustments", IconComponent: Settings },
  { title: "Reportes de Materiales", href: "/production-control/advanced-dashboard", IconComponent: BarChart3 },
  { type: 'group', title: "Producción" },
  { title: "Bitácora Diaria", href: "/production-control/daily-log", IconComponent: Calendar },
  { title: "Reloj Checador", href: "/production-control/reloj-checador", IconComponent: Clock },
  { title: "Servicio de Bombeo", href: "/production-control/pumping-service", IconComponent: Truck },
  { title: "Procesador Arkik", href: "/production-control/arkik-upload", IconComponent: FileUp },
];

// Define quality submenu items (grouped for better UX)
type QualityNavItem =
  | { title: string; href: string; IconComponent: React.ElementType }
  | { type: 'group'; title: string };

const qualitySubMenuItems: QualityNavItem[] = [
  { title: "Dashboard Calidad", href: "/quality", IconComponent: BarChart },
  { type: 'group', title: "Análisis" },
  { title: "Análisis por Cliente", href: "/quality/clientes", IconComponent: Users },
  { title: "Análisis por Receta", href: "/quality/recetas-analisis", IconComponent: FileBarChart2 },
  { type: 'group', title: "Operación" },
  { title: "Muestreos", href: "/quality/muestreos", IconComponent: Beaker },
  { title: "Ensayos", href: "/quality/ensayos", IconComponent: FlaskConical },
  { title: "Control en obra", href: "/quality/site-checks/new", IconComponent: ClipboardCheck },
  { title: "Reportes", href: "/quality/reportes", IconComponent: Clipboard },
  { type: 'group', title: "Gestión" },
  { title: "Recetas", href: "/quality/recipes", IconComponent: FileText },
  { title: "Maestros", href: "/masters/recipes", IconComponent: Layers },
  { title: "Agrupación", href: "/masters/grouping", IconComponent: Layers },
  { title: "Consolidación Precios", href: "/masters/pricing", IconComponent: DollarSign },
  { title: "Gobernanza de Versiones", href: "/quality/recipe-governance", IconComponent: GitBranch },
  { type: 'group', title: "Laboratorio" },
  { title: "Proveedores", href: "/quality/suppliers", IconComponent: Users },
  { title: "Caracterizaciones", href: "/quality/caracterizacion-materiales", IconComponent: FlaskConical },
  { title: "Curvas de Abrams", href: "/quality/curvas-abrams", IconComponent: TrendingUp },
  { title: "Estudios", href: "/quality/estudios", IconComponent: Layers },
  { title: "Materiales", href: "/quality/materials", IconComponent: Package },
];

// Quality submenu for QUALITY_TEAM (without dashboard)
const qualitySubMenuItemsForQualityTeam: QualityNavItem[] = [
  { type: 'group', title: "Análisis" },
  { title: "Análisis por Cliente", href: "/quality/clientes", IconComponent: Users },
  { title: "Análisis por Receta", href: "/quality/recetas-analisis", IconComponent: FileBarChart2 },
  { type: 'group', title: "Operación" },
  { title: "Muestreos", href: "/quality/muestreos", IconComponent: Beaker },
  { title: "Ensayos", href: "/quality/ensayos", IconComponent: FlaskConical },
  { title: "Control en obra", href: "/quality/site-checks/new", IconComponent: ClipboardCheck },
  { title: "Reportes", href: "/quality/reportes", IconComponent: Clipboard },
  { type: 'group', title: "Gestión" },
  { title: "Recetas", href: "/quality/recipes", IconComponent: FileText },
  { title: "Maestros", href: "/masters/recipes", IconComponent: Layers },
  { title: "Agrupación", href: "/masters/grouping", IconComponent: Layers },
  { title: "Consolidación Precios", href: "/masters/pricing", IconComponent: DollarSign },
  { title: "Gobernanza de Versiones", href: "/quality/recipe-governance", IconComponent: GitBranch },
  { type: 'group', title: "Laboratorio" },
  { title: "Proveedores", href: "/quality/suppliers", IconComponent: Users },
  { title: "Caracterizaciones", href: "/quality/caracterizacion-materiales", IconComponent: FlaskConical },
  { title: "Curvas de Abrams", href: "/quality/curvas-abrams", IconComponent: TrendingUp },
  { title: "Estudios", href: "/quality/estudios", IconComponent: Layers },
  { title: "Materiales", href: "/quality/materials", IconComponent: Package },
];

// Quality submenu for QUALITY_TEAM in specific plants (P002, P003, P004) - limited access
const qualitySubMenuItemsForRestrictedPlants: QualityNavItem[] = [
  { type: 'group', title: "Análisis" },
  { title: "Análisis por Cliente", href: "/quality/clientes", IconComponent: Users },
  { title: "Análisis por Receta", href: "/quality/recetas-analisis", IconComponent: FileBarChart2 },
  { type: 'group', title: "Operación" },
  { title: "Muestreos", href: "/quality/muestreos", IconComponent: Beaker },
  { title: "Ensayos", href: "/quality/ensayos", IconComponent: FlaskConical },
  { title: "Control en obra", href: "/quality/site-checks/new", IconComponent: ClipboardCheck },
  { type: 'group', title: "Gestión" },
  { type: 'group', title: "Laboratorio" },
  { title: "Proveedores", href: "/quality/suppliers", IconComponent: Users },
  { title: "Caracterizaciones", href: "/quality/caracterizacion-materiales", IconComponent: FlaskConical },
  { title: "Curvas de Abrams", href: "/quality/curvas-abrams", IconComponent: TrendingUp },
  { title: "Estudios", href: "/quality/estudios", IconComponent: Layers },
  { title: "Materiales", href: "/quality/materials", IconComponent: Package },
];

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
  { href: '/production-control', label: 'Control de Producción', IconComponent: Warehouse, roles: ['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'] },
  { href: '/rh', label: 'RH', IconComponent: Users, roles: ['DOSIFICADOR', 'CREDIT_VALIDATOR', 'EXTERNAL_SALES_AGENT', 'SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'] },
  { href: '/finanzas', label: 'Finanzas', IconComponent: DollarSign, roles: ['CREDIT_VALIDATOR', 'SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'] },
  { href: '/quality', label: 'Calidad', IconComponent: Beaker, roles: ['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE', 'QUALITY_TEAM'] },
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
  console.log('isQualityTeamInRestrictedPlant called with:', { userRole, plantCode });
  if (userRole !== 'QUALITY_TEAM') return false;
  // Support both formats: P2/P3/P4 and P002/P003/P004
  const restrictedPlants = ['P2', 'P3', 'P4', 'P002', 'P003', 'P004'];
  const isRestricted = plantCode ? restrictedPlants.includes(plantCode) : false;
  console.log('Plant restriction check result:', isRestricted, 'against plants:', restrictedPlants);
  return isRestricted;
}

// Function to get appropriate quality submenu based on user role and plant
function getQualitySubMenuItems(userRole: string | undefined, plantCode: string | undefined): QualityNavItem[] {
  if (userRole === 'QUALITY_TEAM') {
    // Check if user is in restricted plants (P2, P3, P4)
    const isRestricted = isQualityTeamInRestrictedPlant(userRole, plantCode);
    
    if (isRestricted) {
      return qualitySubMenuItemsForRestrictedPlants;
    }
    return qualitySubMenuItemsForQualityTeam;
  }
  return qualitySubMenuItems;
}

// Componente interno para navegación con soporte de roles
function Navigation({ children }: { children: React.ReactNode }) {
  const { profile, session } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const isLandingRoute = pathname?.startsWith('/landing');
  const isAuthRoute = pathname?.startsWith('/login') || pathname?.startsWith('/auth') || pathname?.startsWith('/reset-password') || pathname?.startsWith('/update-password');
  const isGobiernoPreciosOrCredito =
    pathname?.startsWith('/finanzas/gobierno-precios') ||
    pathname?.startsWith('/finanzas/credito-validacion');
  const isFinanzasRoute =
    pathname?.startsWith('/finanzas') && !isGobiernoPreciosOrCredito;
  const isQualityRoute = pathname?.startsWith('/quality');
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
    <div className="flex h-screen overflow-hidden">
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
                    <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                      {getQualitySubMenuItems(profile?.role, currentPlant?.code).map((subItem, subIndex) => {
                        if (!('href' in subItem)) {
                          return (
                            <div
                              key={`quality-group-${subIndex}`}
                              className="text-[10px] tracking-wider uppercase text-gray-400 font-semibold mt-3 mb-1 pl-1"
                            >
                              {subItem.title}
                            </div>
                          );
                        }
                        const SubIcon = subItem.IconComponent;
                            return (
                              <Link
                                key={`quality-subnav-${subIndex}`}
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

                  {item.href === '/production-control' && isInventoryRoute && (
                    <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                      {inventorySubMenuItems.map((subItem, subIndex) => {
                        if (!('href' in subItem)) {
                          return (
                            <div
                              key={`inventory-group-${subIndex}`}
                              className="text-[10px] tracking-wider uppercase text-gray-400 font-semibold mt-3 mb-1 pl-1"
                            >
                              {subItem.title}
                            </div>
                          );
                        }
                        const SubIcon = subItem.IconComponent;
                        return (
                          <Link
                            key={`inventory-subnav-${subIndex}`}
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
                        <div className="min-w-56 bg-white text-gray-700 rounded-md shadow-md p-1">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500">Calidad</div>
                          {getQualitySubMenuItems(profile?.role, currentPlant?.code).map((subItem, subIndex) => {
                            if (!('href' in subItem)) {
                              return (
                                <div
                                  key={`q-group-${subIndex}`}
                                  className="px-3 pt-2 pb-1 text-[10px] tracking-wider uppercase text-gray-400"
                                >
                                  {subItem.title}
                                </div>
                              );
                            }
                            return (
                              <Link
                                key={`q-sub-${subIndex}`}
                                href={subItem.href}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded text-sm",
                                  pathname === subItem.href ? "bg-gray-100" : "hover:bg-gray-50"
                                )}
                              >
                                <subItem.IconComponent size={16} />
                                {subItem.title}
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
                          {inventorySubMenuItems.map((subItem, subIndex) => {
                            if (!('href' in subItem)) {
                              return (
                                <div
                                  key={`inv-group-${subIndex}`}
                                  className="px-3 pt-2 pb-1 text-[10px] tracking-wider uppercase text-gray-400"
                                >
                                  {subItem.title}
                                </div>
                              );
                            }
                            return (
                              <Link
                                key={`inv-sub-${subIndex}`}
                                href={subItem.href}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded text-sm",
                                  pathname === subItem.href ? "bg-gray-100" : "hover:bg-gray-50"
                                )}
                              >
                                <subItem.IconComponent size={16} />
                                {subItem.title}
                              </Link>
                            );
                          })}
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
      <main className="flex-1 min-h-0 overflow-y-auto bg-gray-100 p-4 md:p-6 pb-24 md:pb-6">
        {/* Header móvil */}
        <div className="md:hidden flex items-center justify-between mb-4">
          <Link href="/dashboard">
            <Image 
              src="/images/dcconcretos/logo-dark.svg" 
              alt="DC Concretos" 
              width={96}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          
          <div className="flex items-center gap-2">
                                        <PlantContextDisplay className="min-w-[160px]" showLabel={false} />
            <ProfileMenu />
            
            {/* Botón de menú móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 
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
        <div className="hidden md:flex justify-end items-center mb-6">
          <div className="flex items-center gap-4">
                                      <PlantContextDisplay className="min-w-[200px]" showLabel={false} />
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
                      <div className="pl-6 mb-2 space-y-1">
                        {getQualitySubMenuItems(profile?.role, currentPlant?.code).map((subItem, subIndex) => {
                          if (!('href' in subItem)) {
                            return (
                              <div
                                key={`mobile-quality-group-${subIndex}`}
                                className="text-[10px] tracking-wider uppercase text-gray-400 font-semibold mt-3 mb-1 pl-1"
                              >
                                {subItem.title}
                              </div>
                            );
                          }
                          const SubIcon = subItem.IconComponent;
                          const isSubItemActive = pathname === subItem.href;
                          return (
                            <Link
                              key={`mobile-quality-sub-${subIndex}`}
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

                    {item.href === '/production-control' && isInventoryRoute && (
                      <div className="pl-6 mb-2 space-y-1">
                        {inventorySubMenuItems.map((subItem, subIndex) => {
                          if (!('href' in subItem)) {
                            return (
                              <div
                                key={`mobile-inventory-group-${subIndex}`}
                                className="text-[10px] tracking-wider uppercase text-gray-400 font-semibold mt-3 mb-1 pl-1"
                              >
                                {subItem.title}
                              </div>
                            );
                          }
                          const SubIcon = subItem.IconComponent;
                          const isSubItemActive = pathname === subItem.href;
                          return (
                            <Link
                              key={`mobile-inventory-sub-${subIndex}`}
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
        
        {/* Contenido de la página */}
        <div className="mt-4">
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
  // Inventory routes
  { path: '/api/inventory', method: 'POST' },
  { path: '/api/inventory/entries', method: 'POST' },
  // Quality routes
  { path: '/api/quality', method: 'POST' },
  // Arkik integration routes
  { path: '/api/arkik/process', method: 'POST' },
];

// Componente principal
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Use system fonts via global CSS; no extra class needed
  const fontClassName = '';

  // We no longer need pathname or isLandingRoute check here

  return (
    <html lang="es" suppressHydrationWarning className={fontClassName}>
      <head>
        <title>DC Concretos - Sistema de Manejo de Plantas</title>
        <meta name="description" content="Sistema de manejo integral de plantas de concreto - DC Concretos" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/images/dcconcretos/favicon.svg" />
        <BotIdClient protect={protectedRoutes} />
      </head>
      {/* Body doesn't need conditional class anymore based on route */}
      <body className="bg-gray-100" suppressHydrationWarning>
        {/* Initialize Zustand auth store */}
        <AuthInitializer />
        <PlantProvider>
          <OrderPreferencesProvider>
            <ErrorBoundary>
              {/* Always render Navigation; it will handle landing internally */}
              <Navigation>{children}</Navigation>
            </ErrorBoundary>
            <Toaster />
            <SonnerToaster position="top-right" richColors/>
            <Analytics />
          </OrderPreferencesProvider>
        </PlantProvider>
      </body>
    </html>
  );
}