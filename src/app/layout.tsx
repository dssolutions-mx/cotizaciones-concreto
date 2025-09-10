'use client';

import React, { useEffect, useState, ErrorInfo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
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
  LineChart,
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
  Clock
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { PlantProvider, usePlantContext } from '@/contexts/PlantContext';
import ProfileMenu from '@/components/auth/ProfileMenu';
import AuthStatusIndicator from '@/components/auth/AuthStatusIndicator';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { Inter } from 'next/font/google';
import { OrderPreferencesProvider } from '@/contexts/OrderPreferencesContext';
import { Toaster as SonnerToaster } from 'sonner';
import { cn } from '@/lib/utils';
import AuthInitializer from '@/components/auth/auth-initializer';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent } from '@/components/ui/sheet';


// Define navigation items for different roles
// const NAV_ITEMS = { ... }; // Removed as it's unused

// Define Inter font
const inter = Inter({ subsets: ['latin'] });

// Define Finanzas submenu items with component types
const finanzasSubMenuItems = [
  {
    title: "Dashboard Finanzas",
    href: "/finanzas",
    IconComponent: LineChart,
  },
  {
    title: "Balances de Clientes",
    href: "/finanzas/clientes",
    IconComponent: Users,
  },
  {
    title: "Reporte de Ventas",
    href: "/finanzas/ventas",
    IconComponent: BarChart2,
  },
  {
    title: "Datos Históricos",
    href: "/finanzas/historical-data",
    IconComponent: TrendingUp,
  },
  {
    title: "Reporte Diario",
    href: "/finanzas/ventas-diarias",
    IconComponent: BarChart,
  },
  {
    title: "Pagos Diarios",
    href: "/finanzas/pagos-diarios", 
    IconComponent: CreditCard,
  },
  {
    title: "Remisiones por Cliente",
    href: "/finanzas/remisiones",
    IconComponent: FileBarChart2,
  },
  {
    title: "Reportes Dinámicos",
    href: "/finanzas/reportes-clientes",
    IconComponent: FileSpreadsheet,
  },
];

function getFinanzasSubMenuItemsForRole(userRole?: string) {
  if (userRole === 'ADMIN_OPERATIONS') {
    // Restrict to: Reporte de Ventas, Datos Históricos, Reporte Diario, Remisiones por Cliente, Reportes Dinámicos
    return [
      { title: "Reporte de Ventas", href: "/finanzas/ventas", IconComponent: BarChart2 },
      { title: "Datos Históricos", href: "/finanzas/historical-data", IconComponent: TrendingUp },
      { title: "Reporte Diario", href: "/finanzas/ventas-diarias", IconComponent: BarChart },
      { title: "Remisiones por Cliente", href: "/finanzas/remisiones", IconComponent: FileBarChart2 },
      { title: "Reportes Dinámicos", href: "/finanzas/reportes-clientes", IconComponent: FileSpreadsheet },
    ];
  }
  return finanzasSubMenuItems;
}

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
  { type: 'group', title: "Operación" },
  { title: "Muestreos", href: "/quality/muestreos", IconComponent: Beaker },
  { title: "Ensayos", href: "/quality/ensayos", IconComponent: FlaskConical },
  { title: "Control en obra", href: "/quality/site-checks/new", IconComponent: ClipboardCheck },
  { title: "Reportes", href: "/quality/reportes", IconComponent: Clipboard },
  { type: 'group', title: "Gestión" },
  { title: "Recetas", href: "/quality/recipes", IconComponent: FileText },
  { title: "Materiales", href: "/quality/materials", IconComponent: Package },
  { title: "Caracterización de Materiales", href: "/quality/caracterizacion-materiales", IconComponent: FlaskConical },
  { title: "Curvas de Abrams", href: "/quality/curvas-abrams", IconComponent: TrendingUp },
  { title: "Proveedores", href: "/quality/suppliers", IconComponent: Users },
];

// Quality submenu for QUALITY_TEAM (without dashboard)
const qualitySubMenuItemsForQualityTeam: QualityNavItem[] = [
  { type: 'group', title: "Análisis" },
  { title: "Análisis por Cliente", href: "/quality/clientes", IconComponent: Users },
  { type: 'group', title: "Operación" },
  { title: "Muestreos", href: "/quality/muestreos", IconComponent: Beaker },
  { title: "Ensayos", href: "/quality/ensayos", IconComponent: FlaskConical },
  { title: "Control en obra", href: "/quality/site-checks/new", IconComponent: ClipboardCheck },
  { title: "Reportes", href: "/quality/reportes", IconComponent: Clipboard },
  { type: 'group', title: "Gestión" },
  { title: "Recetas", href: "/quality/recipes", IconComponent: FileText },
  { title: "Materiales", href: "/quality/materials", IconComponent: Package },
  { title: "Caracterización de Materiales", href: "/quality/caracterizacion-materiales", IconComponent: FlaskConical },
  { title: "Curvas de Abrams", href: "/quality/curvas-abrams", IconComponent: TrendingUp },
  { title: "Proveedores", href: "/quality/suppliers", IconComponent: Users },
];

// Quality submenu for QUALITY_TEAM in specific plants (P002, P003, P004) - limited access
const qualitySubMenuItemsForRestrictedPlants: QualityNavItem[] = [
  { type: 'group', title: "Análisis" },
  { title: "Análisis por Cliente", href: "/quality/clientes", IconComponent: Users },
  { type: 'group', title: "Operación" },
  { title: "Muestreos", href: "/quality/muestreos", IconComponent: Beaker },
  { title: "Ensayos", href: "/quality/ensayos", IconComponent: FlaskConical },
  { title: "Control en obra", href: "/quality/site-checks/new", IconComponent: ClipboardCheck },
  { type: 'group', title: "Gestión" },
  { title: "Materiales", href: "/quality/materials", IconComponent: Package },
  { title: "Caracterización de Materiales", href: "/quality/caracterizacion-materiales", IconComponent: FlaskConical },
  { title: "Curvas de Abrams", href: "/quality/curvas-abrams", IconComponent: TrendingUp },
];

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
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const isLandingRoute = pathname?.startsWith('/landing');
  const isFinanzasRoute = pathname?.startsWith('/finanzas');
  const isQualityRoute = pathname?.startsWith('/quality');
  const isAdminRoute = pathname?.startsWith('/admin');
  const isInventoryRoute = pathname?.startsWith('/production-control');

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

  // If it's a landing route, just render children without the main layout
  if (isLandingRoute) {
    return <>{children}</>;
  }

  // Determinar los elementos de navegación basados en el rol
  const navItems: Array<{ href: string; label: string; IconComponent: React.ElementType; }> = [];

  // Añadir elementos de menú basados en el rol
  if (profile) {
    const role = profile.role;
    
    // Elementos comunes para todos los roles (excepto QUALITY_TEAM que no debe ver el Dashboard)
    if (role !== 'QUALITY_TEAM') {
      navItems.push({ href: '/dashboard', label: 'Dashboard', IconComponent: Home });
    }
    
    // Flag to check if Finanzas link should be added
    let addFinanzasLink = false;
    // Flag to check if Quality link should be added
    let addQualityLink = false;
    // Flag to check if Admin link should be added
    let addAdminLink = false;

    // Específicos por rol
    switch (role) {
      case 'DOSIFICADOR':
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
        navItems.push({ href: '/production-control', label: 'Control de Producción', IconComponent: Warehouse });
        addQualityLink = true;
        break;
        
      case 'CREDIT_VALIDATOR':
        navItems.push({ href: '/clients', label: 'Clientes', IconComponent: Users });
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
        addFinanzasLink = true;
        break;
      
      case 'EXTERNAL_SALES_AGENT':
        navItems.push({ href: '/clients', label: 'Clientes', IconComponent: Users });
        navItems.push({ href: '/quotes', label: 'Cotizaciones', IconComponent: ClipboardList });
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
        break;
        
      case 'SALES_AGENT':
        navItems.push({ href: '/recipes', label: 'Recetas', IconComponent: FileText });
        navItems.push({ href: '/prices', label: 'Precios', IconComponent: DollarSign });
        navItems.push({ href: '/clients', label: 'Clientes', IconComponent: Users });
        navItems.push({ href: '/quotes', label: 'Cotizaciones', IconComponent: ClipboardList });
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
        break;
        
      case 'PLANT_MANAGER':
        navItems.push({ href: '/prices', label: 'Precios', IconComponent: DollarSign });
        navItems.push({ href: '/price-history', label: 'Historial', IconComponent: BarChart2 });
        navItems.push({ href: '/clients', label: 'Clientes', IconComponent: Users });
        navItems.push({ href: '/quotes', label: 'Cotizaciones', IconComponent: ClipboardList });
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
        navItems.push({ href: '/production-control', label: 'Control de Producción', IconComponent: Warehouse });
        addFinanzasLink = true;
        addQualityLink = true;
        break;
        
      case 'EXECUTIVE':
        navItems.push({ href: '/prices', label: 'Precios', IconComponent: DollarSign });
        navItems.push({ href: '/price-history', label: 'Historial', IconComponent: BarChart2 });
        navItems.push({ href: '/clients', label: 'Clientes', IconComponent: Users });
        navItems.push({ href: '/quotes', label: 'Cotizaciones', IconComponent: ClipboardList });
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
        navItems.push({ href: '/production-control', label: 'Control de Producción', IconComponent: Warehouse });
        addAdminLink = true;
        addFinanzasLink = true;
        addQualityLink = true;
        break;

      case 'ADMIN_OPERATIONS':
        // New administrative role with access to Production Control and Finanzas
        navItems.push({ href: '/production-control', label: 'Control de Producción', IconComponent: Warehouse });
        addFinanzasLink = true;
        break;
        
      case 'QUALITY_TEAM':
        // QUALITY_TEAM only has access to quality module, no other sections
        addQualityLink = true;
        break;
        
      default:
        break;
    }

    // Add Finanzas link if applicable
    if (addFinanzasLink) {
      navItems.push({ href: '/finanzas', label: 'Finanzas', IconComponent: DollarSign });
    }
    
    // Add Quality link if applicable
    if (addQualityLink) {
      navItems.push({ href: '/quality', label: 'Calidad', IconComponent: Beaker });
    }

    // Add Admin link if applicable
    if (addAdminLink) {
      navItems.push({ href: '/admin', label: 'Administración', IconComponent: UserCog });
    }

    // Remove top-level Recipes when Quality section exists to prevent duplication
    if (addQualityLink) {
      for (let i = navItems.length - 1; i >= 0; i--) {
        if (navItems[i].href === '/recipes') navItems.splice(i, 1);
      }
    }
  }

  // Define preferred items for mobile bottom navigation
  const preferredBottomNavOrder = ['/orders', '/clients', '/quotes', '/finanzas'];
  const mobileBottomNavItems = preferredBottomNavOrder
    .map(href => navItems.find(item => item.href === href))
    .filter(item => item !== undefined) as typeof navItems;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - collapsible */}
      <aside
        className={cn(
          "hidden md:flex flex-col bg-white shadow-md transition-all duration-300 ease-in-out",
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
              const isActive = isFinanzasMainLink
                ? isFinanzasRoute
                : isQualityMainLink
                ? isQualityRoute
                : item.href === '/admin'
                ? isAdminRoute
                : pathname === item.href;
              const Icon = item.IconComponent;

              return (
                <React.Fragment key={`nav-${index}`}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 py-2 px-3 rounded transition-colors w-full",
                      isActive ? "bg-green-500 text-white" : "text-gray-700 hover:bg-gray-100"
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
                              "flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-sm w-full",
                              pathname === subItem.href
                                ? "bg-gray-200 text-gray-900 font-medium"
                                : "text-gray-600 hover:bg-gray-100"
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
                              "flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-sm w-full",
                              pathname === subItem.href
                                ? "bg-gray-200 text-gray-900 font-medium"
                                : "text-gray-600 hover:bg-gray-100"
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
                              "flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-sm w-full",
                              pathname === subItem.href
                                ? "bg-gray-200 text-gray-900 font-medium"
                                : "text-gray-600 hover:bg-gray-100"
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
                            "flex items-center gap-2 py-1.5 px-3 rounded transition-colors text-sm w-full",
                            pathname === subItem.href
                              ? "bg-gray-200 text-gray-900 font-medium"
                              : "text-gray-600 hover:bg-gray-100"
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
                const isActive = isFinanzasMainLink
                  ? isFinanzasRoute
                  : isQualityMainLink
                  ? isQualityRoute
                  : isAdminMainLink
                  ? isAdminRoute
                  : pathname === item.href;
                const Icon = item.IconComponent;

                const renderCollapsedItem = (content?: React.ReactNode) => (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center py-2 rounded-md transition-colors",
                      isActive ? "bg-green-500 text-white" : "text-gray-700 hover:bg-gray-100"
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

      {/* Contenido principal */}
      <main className="flex-1 bg-gray-100 p-4 md:p-6 overflow-y-auto pb-24 md:pb-6">
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
        <div className="hidden md:flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {'Panel Principal'} {/* Temporarily using static title */}
          </h1>
          
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
          <SheetContent side="left" className="w-64 p-0">
            <div className="p-4 border-b">
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
            <div className="p-2">
              {navItems.map((item, index) => {
                const Icon = item.IconComponent;
                const isCurrentItemActive = item.href === '/finanzas'
                  ? isFinanzasRoute
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
                        "flex items-center py-2.5 px-3 rounded-md mb-1",
                        isCurrentItemActive ? "bg-green-500 text-white" : "text-gray-700 hover:bg-gray-100"
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
                                "flex items-center py-1.5 px-2 rounded-md text-sm",
                                isSubItemActive ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
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
                                "flex items-center py-1.5 px-2 rounded-md text-sm",
                                isSubItemActive ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
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
                                "flex items-center py-1.5 px-2 rounded-md text-sm",
                                isSubItemActive ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
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
                                "flex items-center py-1.5 px-2 rounded-md text-sm",
                                isSubItemActive ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
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

// Componente principal
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Use Inter font
  const fontClassName = inter.className;

  // We no longer need pathname or isLandingRoute check here

  return (
    <html lang="es" suppressHydrationWarning className={fontClassName}>
      <head>
        <title>DC Concretos - Sistema de Manejo de Plantas</title>
        <meta name="description" content="Sistema de manejo integral de plantas de concreto - DC Concretos" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/images/dcconcretos/favicon.svg" />
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
          </OrderPreferencesProvider>
        </PlantProvider>
      </body>
    </html>
  );
}