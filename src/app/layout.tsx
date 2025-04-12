'use client';

import React, { useState, ErrorInfo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import './globals.css';
import { Toaster } from 'react-hot-toast';
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
  Home
} from 'lucide-react';
import { AuthContextProvider, UserRole } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import ProfileMenu from '@/components/auth/ProfileMenu';
import AuthStatusIndicator from '@/components/auth/AuthStatusIndicator';
import { Inter } from 'next/font/google';
import { OrderPreferencesProvider } from '@/contexts/OrderPreferencesContext';

// Define navigation items for different roles
// const NAV_ITEMS = { ... }; // Removed as it's unused

const inter = Inter({ subsets: ['latin'] });

// Componente interno para navegación con soporte de roles
function Navigation({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLandingRoute = pathname?.includes('/landing');

  // Determinar los elementos de navegación basados en el rol
  const navItems = [];

  // Añadir elementos de menú basados en el rol
  if (profile) {
    const role = profile.role;
    
    // Elementos comunes para todos los roles
    navItems.push({ href: '/dashboard', label: 'Dashboard', icon: Home });
    
    // Específicos por rol
    switch (role) {
      case 'DOSIFICADOR':
        // Dosificador solo puede ver pedidos, no editarlos
        navItems.push({ href: '/orders', label: 'Pedidos', icon: Package });
        break;
        
      case 'CREDIT_VALIDATOR':
        // Validador de crédito puede ver clientes y pedidos
        navItems.push({ href: '/clients', label: 'Clientes', icon: Users });
        navItems.push({ href: '/orders', label: 'Pedidos', icon: Package });
        break;
        
      case 'SALES_AGENT':
        // Navegación existente para SALES_AGENT
        navItems.push({ href: '/recipes', label: 'Recetas', icon: FileText });
        navItems.push({ href: '/prices', label: 'Precios', icon: DollarSign });
        navItems.push({ href: '/clients', label: 'Clientes', icon: Users });
        navItems.push({ href: '/quotes', label: 'Cotizaciones', icon: ClipboardList });
        navItems.push({ href: '/orders', label: 'Pedidos', icon: Package });
        break;
        
      case 'PLANT_MANAGER':
      case 'EXECUTIVE':
        // Navegación para roles administrativos
        navItems.push({ href: '/recipes', label: 'Recetas', icon: FileText });
        navItems.push({ href: '/prices', label: 'Precios', icon: DollarSign });
        navItems.push({ href: '/price-history', label: 'Historial', icon: BarChart2 });
        navItems.push({ href: '/clients', label: 'Clientes', icon: Users });
        navItems.push({ href: '/quotes', label: 'Cotizaciones', icon: ClipboardList });
        navItems.push({ href: '/orders', label: 'Pedidos', icon: Package });
        break;
        
      case 'QUALITY_TEAM':
        // Navegación para equipo de calidad
        navItems.push({ href: '/recipes', label: 'Recetas', icon: FileText });
        navItems.push({ href: '/prices', label: 'Precios', icon: DollarSign });
        break;
        
      default:
        // Navegación predeterminada
        break;
    }
    
    // EXECUTIVE puede gestionar usuarios
    if (role === 'EXECUTIVE') {
      navItems.push({ href: '/admin/users', label: 'Usuarios', icon: UserCog });
    }
  }

  if (isLandingRoute) {
    return null; // No mostrar navegación en rutas de landing
  }

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
        <nav className="p-4">
          {navItems.map((item, index) => (
            <Link 
              key={`nav-${index}`}
              href={item.href}
              className={pathname === item.href 
                ? "flex items-center gap-2 py-2 px-4 rounded transition-colors bg-green-500 text-white"
                : "flex items-center gap-2 py-2 px-4 rounded transition-colors text-gray-700 hover:bg-gray-100"
              }
            >
              <span className="mr-2">{React.createElement(item.icon, { size: 18 })}</span>
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Contenido principal */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto pb-16 md:pb-6">
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
            <ProfileMenu />
            
            {/* Botón de menú móvil */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 
                         focus:outline-none focus:ring-2 focus:ring-green-500 transition-all
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
            {/* Título dinámico según la ruta */}
            {navItems.find(item => item.href === pathname)?.label || 'Panel principal'}
          </h1>
          
          <ProfileMenu />
        </div>
        
        {/* Añadir el indicador de estado de autenticación */}
        <AuthStatusIndicator />
        
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
                          focus:outline-none focus:ring-2 focus:ring-green-500
                          transition-all transform active:scale-95"
                aria-label="Cerrar menú"
              >
                <X className="w-6 h-6 text-gray-700" />
              </button>
              
              <div className="mt-6">
                {navItems.map((item, index) => (
                  <Link 
                    key={`mobile-full-${index}`}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center py-3 px-4 rounded-lg mb-2 ${
                      pathname === item.href 
                        ? "bg-green-500 text-white" 
                        : "bg-gray-100 text-gray-700 active:bg-gray-200"
                    }`}
                  >
                    <span className="text-xl mr-3">
                      {React.createElement(item.icon, { size: 20 })}
                    </span>
                    <span className="text-lg">{item.label}</span>
                  </Link>
                ))}
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
          {navItems.slice(0, 5).map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={`mobile-nav-${index}`}
                href={item.href}
                className={`flex flex-col items-center py-2 px-1 relative mobile-nav-item ${
                  isActive 
                    ? "text-green-500 active" 
                    : "text-gray-600 hover:text-gray-800 active:text-green-400"
                }`}
                aria-label={item.label}
              >
                {isActive && (
                  <span className="absolute top-0 left-0 right-0 h-0.5 bg-green-500 mobile-nav-indicator" />
                )}
                <span className="text-xl mb-0.5 transform transition-transform active:scale-90">
                  {React.createElement(item.icon, { size: 22 })}
                </span>
                <span className={`text-xs ${isActive ? "font-medium" : ""}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-green-500 rounded-full mobile-nav-indicator" />
                )}
              </Link>
            );
          })}
        </div>
        {/* Botón de acción flotante - Crear nueva cotización */}
        <div className="fixed right-4 bottom-16 md:hidden">
          <Link href="/quotes/new">
            <button 
              className="bg-green-500 hover:bg-green-600 active:bg-green-700 
                        text-white rounded-full p-3 shadow-lg transform 
                        transition-transform active:scale-95 focus:outline-none 
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
      // You can render any custom fallback UI
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-50">
          <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-md">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Algo salió mal</h2>
            <p className="text-gray-700 mb-6">
              Hubo un error inesperado en la aplicación. Por favor, intente recargar la página.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
            >
              Recargar Página
            </button>
            {this.state.error && (
              <pre className="mt-4 text-xs text-gray-500 text-left overflow-auto max-h-40">
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Componente principal
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingRoute = pathname?.includes('/landing');

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <title>DC Concretos - Sistema de Cotizaciones</title>
        <meta name="description" content="Sistema de cotizaciones para DC Concretos" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="icon" href="/images/dcconcretos/favicon.svg" />
      </head>
      <body className={isLandingRoute ? 'bg-white' : 'bg-gray-100'} suppressHydrationWarning>
        <AuthContextProvider>
          <OrderPreferencesProvider>
            <ErrorBoundary>
              <Toaster position="top-right" />
              
              {isLandingRoute ? (
                <>{children}</>
              ) : (
                <Navigation>
                  {children}
                </Navigation>
              )}
            </ErrorBoundary>
          </OrderPreferencesProvider>
        </AuthContextProvider>
      </body>
    </html>
  );
} 