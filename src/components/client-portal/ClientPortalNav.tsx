'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, Package, DollarSign, Beaker, LogOut, Menu, X, Users, CheckCircle } from 'lucide-react';
import { Branding } from '@/components/ui/Branding';
import { ClientLogo } from '@/components/ui/ClientLogo';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useUserPermissions } from '@/hooks/client-portal/useUserPermissions';
import { usePendingApprovals } from '@/hooks/client-portal/usePendingApprovals';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';

export default function ClientPortalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthBridge();
  const { isExecutive, isLoading: permissionsLoading } = useUserPermissions();
  const { count: pendingCount } = usePendingApprovals();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Build navigation items dynamically based on user permissions
  const navItems = useMemo(() => {
    const baseItems = [
      { href: '/client-portal', label: 'Dashboard', icon: Home },
      { href: '/client-portal/orders', label: 'Pedidos', icon: Package },
      { href: '/client-portal/balance', label: 'Balance', icon: DollarSign },
      { href: '/client-portal/quality', label: 'Calidad', icon: Beaker },
    ];

    // Add executive-only items
    if (!permissionsLoading && isExecutive) {
      baseItems.push(
        { href: '/client-portal/approvals', label: 'Aprobaciones', icon: CheckCircle, badge: pendingCount || 0 },
        { href: '/client-portal/team', label: 'Equipo', icon: Users }
      );
    }

    return baseItems;
  }, [isExecutive, permissionsLoading, pendingCount]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="sticky top-0 z-50 glass-base border-b border-white/20"
      >
        <div className="max-w-screen-2xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Branding row: Company | Client logo, then title */}
            <Link href="/client-portal" className="flex items-center gap-4 group">
              <div className="flex items-center gap-3">
                <Branding variant="client-portal" size="md" className="h-8 w-auto" />
                <div className="w-px h-6 bg-slate-300" />
                <ClientLogo size="md" className="h-8 w-auto" />
              </div>
              <h1 className="hidden md:block text-title-2 font-bold text-label-primary">
                Portal de Cliente
              </h1>
            </Link>

            {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href ||
                  (item.href !== '/client-portal' && pathname.startsWith(item.href));
                const hasBadge = 'badge' in item && item.badge && item.badge > 0;

                return (
                  <Link key={item.href} href={item.href}>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-2xl transition-all duration-300 relative',
                        isActive
                          ? 'glass-thick text-slate-900 font-semibold shadow-sm border border-slate-200'
                          : 'text-gray-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute inset-0 bg-slate-100/50 rounded-2xl"
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                        />
                      )}
                      <Icon className="w-5 h-5 relative z-10" />
                      <span className="relative z-10 text-callout">{item.label}</span>
                      {hasBadge && (
                        <span className="relative z-10 ml-1 px-2 py-0.5 text-xs font-semibold bg-amber-500 text-white rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-100 text-gray-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-callout font-medium">Salir</span>
              </motion.button>

              {/* Mobile Menu Button */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl glass-interactive"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6 text-gray-700" />
                ) : (
                  <Menu className="w-6 h-6 text-gray-700" />
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden glass-thick border-b border-white/30"
        >
          <div className="max-w-screen-2xl mx-auto px-6 py-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href ||
                (item.href !== '/client-portal' && pathname.startsWith(item.href));
              const hasBadge = 'badge' in item && item.badge && item.badge > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-2xl transition-all',
                      isActive
                        ? 'glass-thick text-blue-600 font-semibold'
                        : 'text-gray-600 hover:glass-thin'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span className="text-body">{item.label}</span>
                    </div>
                    {hasBadge && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-amber-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </motion.div>
                </Link>
              );
            })}
            
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl glass-interactive text-red-600"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-body font-medium">Cerrar Sesión</span>
            </motion.button>
          </div>
        </motion.div>
      )}
    </>
  );
}