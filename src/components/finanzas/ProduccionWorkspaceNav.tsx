'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, LineChart, Microscope } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  finanzasHubTabTriggerClass,
  finanzasHubTabsListClass,
} from '@/components/finanzas/finanzasHubUi'

const tabs = [
  { href: '/finanzas/produccion', label: 'Comparativa', icon: BarChart3, exact: true },
  { href: '/finanzas/produccion/detalle', label: 'Detalle', icon: LineChart, exact: false },
  { href: '/finanzas/produccion/analisis', label: 'Análisis', icon: Microscope, exact: false },
] as const

export default function ProduccionWorkspaceNav() {
  const pathname = usePathname()

  return (
    <nav
      className={cn(finanzasHubTabsListClass, 'min-w-[min(100%,20rem)] w-max sm:w-full grid-cols-3')}
      aria-label="Secciones de producción"
    >
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              finanzasHubTabTriggerClass,
              'inline-flex items-center justify-center rounded-md font-medium transition-colors',
              active ? 'bg-stone-900 text-white shadow-sm' : 'text-stone-700 hover:bg-white/80'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
