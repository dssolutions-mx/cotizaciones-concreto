'use client';

import React, { useState, ErrorInfo } from 'react';
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
  BarChart,
  CreditCard,
  Building2
} from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { PlantProvider } from '@/contexts/PlantContext';
import ProfileMenu from '@/components/auth/ProfileMenu';
import AuthStatusIndicator from '@/components/auth/AuthStatusIndicator';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { Inter } from 'next/font/google';
import { OrderPreferencesProvider } from '@/contexts/OrderPreferencesContext';
import { Toaster as SonnerToaster } from 'sonner';
import { cn } from '@/lib/utils';
import AuthInitializer from '@/components/auth/auth-initializer';

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
];

// Define quality submenu items (grouped for better UX)
type QualityNavItem = 
  | { title: string; href: string; IconComponent: React.ElementType }
  | { type: 'group'; title: string };

const qualitySubMenuItems: QualityNavItem[] = [
  { title: "Dashboard Calidad", href: "/quality", IconComponent: BarChart },
  { type: 'group', title: "Operación" },
  { title: "Muestreos", href: "/quality/muestreos", IconComponent: Beaker },
  { title: "Ensayos", href: "/quality/ensayos", IconComponent: FlaskConical },
  { title: "Reportes", href: "/quality/reportes", IconComponent: Clipboard },
  { type: 'group', title: "Gestión" },
  { title: "Recetas", href: "/quality/recipes", IconComponent: FileText },
  { title: "Materiales", href: "/quality/materials", IconComponent: Package },
  { title: "Proveedores", href: "/quality/suppliers", IconComponent: Users },
];

// Componente interno para navegación con soporte de roles
function Navigation({ children }: { children: React.ReactNode }) {
  const { profile } = useAuthBridge();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLandingRoute = pathname?.startsWith('/landing');
  const isFinanzasRoute = pathname?.startsWith('/finanzas');
  const isQualityRoute = pathname?.startsWith('/quality');

  // If it's a landing route, just render children without the main layout
  if (isLandingRoute) {
    return <>{children}</>;
  }

  // Determinar los elementos de navegación basados en el rol
  const navItems: Array<{ href: string; label: string; IconComponent: React.ElementType; }> = [];

  // Añadir elementos de menú basados en el rol
  if (profile) {
    const role = profile.role;
    
    // Elementos comunes para todos los roles
    navItems.push({ href: '/dashboard', label: 'Dashboard', IconComponent: Home });
    
    // Flag to check if Finanzas link should be added
    let addFinanzasLink = false;
    // Flag to check if Quality link should be added
    let addQualityLink = false;

    // Específicos por rol
    switch (role) {
      case 'DOSIFICADOR':
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
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
        navItems.push({ href: '/recipes', label: 'Recetas', IconComponent: FileText });
        navItems.push({ href: '/prices', label: 'Precios', IconComponent: DollarSign });
        navItems.push({ href: '/price-history', label: 'Historial', IconComponent: BarChart2 });
        navItems.push({ href: '/clients', label: 'Clientes', IconComponent: Users });
        navItems.push({ href: '/quotes', label: 'Cotizaciones', IconComponent: ClipboardList });
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
        addFinanzasLink = true;
        addQualityLink = true;
        break;
        
      case 'EXECUTIVE':
        navItems.push({ href: '/recipes', label: 'Recetas', IconComponent: FileText });
        navItems.push({ href: '/prices', label: 'Precios', IconComponent: DollarSign });
        navItems.push({ href: '/price-history', label: 'Historial', IconComponent: BarChart2 });
        navItems.push({ href: '/clients', label: 'Clientes', IconComponent: Users });
        navItems.push({ href: '/quotes', label: 'Cotizaciones', IconComponent: ClipboardList });
        navItems.push({ href: '/orders', label: 'Pedidos', IconComponent: Package });
        navItems.push({ href: '/admin/users', label: 'Gestión Usuarios', IconComponent: UserCog });
        navItems.push({ href: '/admin/plants', label: 'Gestión Plantas', IconComponent: Building2 });
        addFinanzasLink = true;
        addQualityLink = true;
        break;
        
      case 'QUALITY_TEAM':
        navItems.push({ href: '/recipes', label: 'Recetas', IconComponent: FileText });
        navItems.push({ href: '/prices', label: 'Precios', IconComponent: DollarSign });
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
    
    // EXECUTIVE puede gestionar usuarios
    if (role === 'EXECUTIVE') {
      navItems.push({ href: '/admin/users', label: 'Usuarios', IconComponent: UserCog });
    }
  }

  // Define preferred items for mobile bottom navigation
  const preferredBottomNavOrder = ['/orders', '/clients', '/quotes', '/finanzas'];
  const mobileBottomNavItems = preferredBottomNavOrder
    .map(href => navItems.find(item => item.href === href))
    .filter(item => item !== undefined) as typeof navItems;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - versión simple */}
      <aside className="w-64 bg-white shadow-md hidden md:block">
        <div className="p-6 border-b flex justify-between items-center">
          <Link href="/dashboard">
            <Image 
              src="/images/dcconcretos/logo-dark.svg" 
              alt="DC Concretos" 
              className="h-10 w-auto"
              width={120}
              height={40}
            />
          </Link>
        </div>
        <nav className="p-4 space-y-1">
          {navItems.map((item, index) => {
            const isFinanzasMainLink = item.href === '/finanzas';
            const isQualityMainLink = item.href === '/quality';
            const isActive = 
              isFinanzasMainLink ? isFinanzasRoute : 
              isQualityMainLink ? isQualityRoute :
              pathname === item.href;
            const Icon = item.IconComponent;

            return (
              <React.Fragment key={`nav-${index}`}>
                <Link 
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 py-2 px-4 rounded transition-colors w-full",
                    isActive 
                      ? "bg-green-500 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <span className="mr-2">
                    {Icon && <Icon size={18} />}
                  </span>
                  {item.label}
                </Link>
                {/* Render Finanzas submenu if active */}
                {isFinanzasMainLink && isFinanzasRoute && (
                  <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                    {finanzasSubMenuItems.map((subItem, subIndex) => {
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
                          <span className="mr-2">
                            {SubIcon && <SubIcon size={16} />}
                          </span>
                          {subItem.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
                
                {/* Render Quality submenu if active */}
                {isQualityMainLink && isQualityRoute && (
                  <div className="pl-6 mt-1 space-y-1 border-l border-gray-200 ml-3">
                    {qualitySubMenuItems.map((subItem, subIndex) => {
                      // Render group header
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
                          <span className="mr-2">
                            {SubIcon && <SubIcon size={16} />}
                          </span>
                          {subItem.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 bg-gray-100 p-4 md:p-6 overflow-y-auto pb-24 md:pb-6">
        {/* Header móvil */}
        <div className="md:hidden flex items-center justify-between mb-4">
          <Link href="/dashboard">
            <Image 
              src="/images/dcconcretos/logo-dark.svg" 
              alt="DC Concretos" 
              className="h-8 w-auto"
              width={96}
              height={32}
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
        
        {/* Menú móvil desplegable */}
        {mobileMenuOpen && (
          <div 
            id="mobile-menu"
            className="md:hidden fixed inset-0 z-50 bg-white pt-16 mobile-menu-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <div className="p-4">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 
                          hover:bg-gray-200 active:bg-gray-300 
                          focus:outline-hidden focus:ring-2 focus:ring-green-500
                          transition-all transform active:scale-95"
                aria-label="Cerrar menú"
              >
                <X className="w-6 h-6 text-gray-700" />
              </button>
              
              <div className="mt-6">
                {navItems.map((item, index) => {
                  const Icon = item.IconComponent;
                  const isCurrentItemActive = item.href === '/finanzas' 
                    ? isFinanzasRoute 
                    : item.href === '/quality'
                    ? isQualityRoute
                    : pathname === item.href;

                  return (
                    <React.Fragment key={`mobile-full-${index}`}>
                      <Link 
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center py-3 px-4 rounded-lg mb-1 ${
                          isCurrentItemActive 
                            ? "bg-green-500 text-white" 
                            : "bg-gray-100 text-gray-700 active:bg-gray-200"
                        }`}
                      >
                        <span className="text-xl mr-3">
                          {Icon && <Icon size={20} />}
                        </span>
                        <span className="text-lg">{item.label}</span>
                      </Link>
                      
                      {/* Render Finanzas submenu in mobile if active */}
                      {item.href === '/finanzas' && isFinanzasRoute && (
                        <div className="pl-8 mb-2 space-y-1">
                          {finanzasSubMenuItems.map((subItem, subIndex) => {
                            const SubIcon = subItem.IconComponent;
                            const isSubItemActive = pathname === subItem.href;
                            return (
                              <Link
                                key={`mobile-finanzas-sub-${subIndex}`}
                                href={subItem.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center py-2 px-3 rounded-md text-sm ${
                                  isSubItemActive
                                    ? "bg-green-400 text-white"
                                    : "bg-gray-50 text-gray-600 active:bg-gray-100"
                                }`}
                              >
                                <span className="mr-2.5">
                                  {SubIcon && <SubIcon size={16} />}
                                </span>
                                {subItem.title}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* Render Quality submenu in mobile if active */}
                      {item.href === '/quality' && isQualityRoute && (
                        <div className="pl-8 mb-2 space-y-1">
                          {qualitySubMenuItems.map((subItem, subIndex) => {
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
                          className={`flex items-center py-2 px-3 rounded-md text-sm ${
                            isSubItemActive
                              ? "bg-green-400 text-white"
                              : "bg-gray-50 text-gray-600 active:bg-gray-100"
                          }`}
                        >
                          <span className="mr-2.5">
                            {SubIcon && <SubIcon size={16} />}
                          </span>
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
            </div>
          </div>
        )}
        
        {/* Contenido de la página */}
        <div className="mt-4">
          {/* Children */}
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
        <title>DC Concretos - Sistema de Cotizaciones</title>
        <meta name="description" content="Sistema de cotizaciones para DC Concretos" />
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