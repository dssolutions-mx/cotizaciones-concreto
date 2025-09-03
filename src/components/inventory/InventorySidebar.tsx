'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Home, 
  Package, 
  TrendingDown, 
  Upload,
  FileText,
  BarChart3,
  TrendingUp
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/inventory',
    icon: Home,
    description: 'Vista general del inventario'
  },
  {
    name: 'Dashboard Avanzado',
    href: '/inventory/advanced-dashboard',
    icon: TrendingUp,
    description: 'Análisis integral de inventario'
  },
  {
    name: 'Prueba Dashboard',
    href: '/inventory/advanced-dashboard/test',
    icon: TrendingUp,
    description: 'Página de prueba del dashboard'
  },
  {
    name: 'Entradas de Material',
    href: '/inventory/entries',
    icon: Package,
    description: 'Registro de recepción de materiales'
  },
  {
    name: 'Ajustes de Inventario',
    href: '/inventory/adjustments',
    icon: TrendingDown,
    description: 'Ajustes manuales y correcciones'
  },
  {
    name: 'Carga Arkik',
    href: '/inventory/arkik-upload',
    icon: Upload,
    description: 'Subir archivos de consumo Arkik'
  },
  {
    name: 'Bitácora Diaria',
    href: '/inventory/daily-log',
    icon: FileText,
    description: 'Resumen de actividades diarias'
  },
  {
    name: 'Reportes',
    href: '/inventory/reports',
    icon: BarChart3,
    description: 'Reportes de inventario'
  }
]

export default function InventorySidebar() {
  const pathname = usePathname()

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 shadow-lg border-r">
        <div className="flex h-16 shrink-0 items-center">
          <h1 className="text-xl font-bold text-gray-900">
            Control de Inventario
          </h1>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={cn(
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50',
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-medium'
                        )}
                      >
                        <item.icon
                          className={cn(
                            isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-700',
                            'h-6 w-6 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        <div className="flex flex-col">
                          <span>{item.name}</span>
                          <span className="text-xs text-gray-500 group-hover:text-gray-600">
                            {item.description}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
