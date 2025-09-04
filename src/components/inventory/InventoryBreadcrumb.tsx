'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Home, Package, Inbox, Settings, BarChart3, Calendar, Truck, FileUp } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href: string
  icon?: React.ElementType
}

const inventoryRoutes: Record<string, BreadcrumbItem[]> = {
  '/production-control': [
    { label: 'Control de Producción', href: '/production-control', icon: Home }
  ],
  '/production-control/entries': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Entradas de Material', href: '/production-control/entries', icon: Inbox }
  ],
  '/production-control/adjustments': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Ajustes de Inventario', href: '/production-control/adjustments', icon: Settings }
  ],
  '/production-control/advanced-dashboard': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Reportes de Materiales', href: '/production-control/advanced-dashboard', icon: BarChart3 }
  ],
  '/production-control/daily-log': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Bitácora Diaria', href: '/production-control/daily-log', icon: Calendar }
  ],
  '/production-control/pumping-service': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Servicio de Bombeo', href: '/production-control/pumping-service', icon: Truck }
  ],
  '/production-control/arkik-upload': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Procesador Arkik', href: '/production-control/arkik-upload', icon: FileUp }
  ],
}

export default function InventoryBreadcrumb() {
  const pathname = usePathname()
  const breadcrumbItems = inventoryRoutes[pathname] || []

  if (breadcrumbItems.length === 0) {
    return null
  }

  return (
    <div className="mb-6">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1
            const IconComponent = item.icon

            return (
              <React.Fragment key={item.href}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="flex items-center gap-2">
                      {IconComponent && <IconComponent className="h-4 w-4" />}
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={item.href} className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="h-4 w-4" />}
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
