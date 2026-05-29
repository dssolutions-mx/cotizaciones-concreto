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
import { Home, Package, Inbox, Settings, BarChart3, Calendar, Truck, FileUp, ArrowLeftRight, ClipboardPlus, FileText } from 'lucide-react'

interface BreadcrumbRouteItem {
  label: string
  href: string
  icon?: React.ElementType
}

/** Extra segments after the matched inventory route (e.g. closure period + wizard step). */
export type InventoryBreadcrumbTailItem = {
  label: string
  href?: string
}

export type InventoryBreadcrumbProps = {
  tailItems?: InventoryBreadcrumbTailItem[]
}

const inventoryRoutes: Record<string, BreadcrumbRouteItem[]> = {
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
  '/production-control/transfer-between-plants': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Transferencia entre plantas', href: '/production-control/transfer-between-plants', icon: Truck }
  ],
  '/production-control/inventario': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Inventario y conciliación', href: '/production-control/inventario', icon: BarChart3 }
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
  '/production-control/evidencia-concreto': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Evidencia de remisiones (concreto)', href: '/production-control/evidencia-concreto', icon: FileText }
  ],
  '/production-control/cross-plant': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Producción Cruzada', href: '/production-control/cross-plant', icon: ArrowLeftRight }
  ],
  '/production-control/alerts': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Alertas de Material', href: '/production-control/alerts', icon: Package }
  ],
  '/production-control/material-request': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Solicitar material', href: '/production-control/material-request', icon: ClipboardPlus }
  ],
  '/production-control/lots': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Lotes de Material', href: '/production-control/lots', icon: Package }
  ],
  '/production-control/reorder-config': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Puntos de Reorden', href: '/production-control/reorder-config', icon: Settings }
  ],
  '/production-control/inventory-closure': [
    { label: 'Control de Producción', href: '/production-control', icon: Home },
    { label: 'Cierre de inventario', href: '/production-control/inventory-closure', icon: ClipboardPlus }
  ],
}

type RenderedBreadcrumbItem = {
  label: string
  href?: string
  icon?: React.ElementType
}

export default function InventoryBreadcrumb({ tailItems = [] }: InventoryBreadcrumbProps) {
  const pathname = usePathname()

  // Exact match first; then fall back to prefix match for dynamic routes
  let baseItems = inventoryRoutes[pathname] || []
  if (baseItems.length === 0) {
    const matchedKey = Object.keys(inventoryRoutes).find(
      (key) => pathname.startsWith(key + '/') && key !== '/production-control',
    )
    if (matchedKey) baseItems = inventoryRoutes[matchedKey]
  }

  if (baseItems.length === 0) {
    return null
  }

  const breadcrumbItems: RenderedBreadcrumbItem[] = [
    ...baseItems.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
    })),
    ...tailItems.map((item) => ({
      label: item.label,
      href: item.href,
    })),
  ]

  return (
    <div className="mb-6">
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbItems.map((item, index) => {
            const isLast = index === breadcrumbItems.length - 1
            const IconComponent = item.icon

            return (
              <React.Fragment key={`${item.href ?? item.label}-${index}`}>
                <BreadcrumbItem>
                  {isLast || !item.href ? (
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
