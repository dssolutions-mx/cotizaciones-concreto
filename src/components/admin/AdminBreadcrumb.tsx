'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function AdminBreadcrumb() {
  const pathname = usePathname();
  
  // Build breadcrumb items from pathname
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    if (!pathname) return [];
    
    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Inicio', href: '/' },
    ];

    // Add admin root
    if (segments[0] === 'admin') {
      breadcrumbs.push({ label: 'Administración', href: '/admin' });
      
      // Map admin routes to Spanish labels
      const routeLabels: Record<string, string> = {
        'users': 'Usuarios',
        'plants': 'Plantas',
        'client-portal-users': 'Usuarios Portal',
        'roles': 'Roles',
        'create': 'Crear',
        'invite': 'Invitar',
      };

      let currentPath = '/admin';
      for (let i = 1; i < segments.length; i++) {
        const segment = segments[i];
        currentPath += `/${segment}`;
        
        const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
        breadcrumbs.push({
          label,
          href: i < segments.length - 1 ? currentPath : undefined, // Last item is not a link
        });
      }
    }

    return breadcrumbs;
  };

  const breadcrumbs = buildBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-2 text-sm mb-6" aria-label="Breadcrumb">
      {breadcrumbs.map((item, index) => {
        const isLast = index === breadcrumbs.length - 1;
        
        return (
          <React.Fragment key={item.href || item.label}>
            {index === 0 ? (
              <Link
                href={item.href || '#'}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <Home className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <ChevronRight className="h-4 w-4 text-gray-400" />
                {isLast ? (
                  <span className="text-gray-900 font-medium">{item.label}</span>
                ) : (
                  <Link
                    href={item.href || '#'}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {item.label}
                  </Link>
                )}
              </>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

