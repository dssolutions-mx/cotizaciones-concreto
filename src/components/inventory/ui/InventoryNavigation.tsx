'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Package, 
  TrendingDown, 
  FileText, 
  BarChart3,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import GlobalSearch from './GlobalSearch'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
}

const navItems: NavItem[] = [
  {
    href: '/production-control/entries',
    label: 'Entradas',
    icon: Package,
  },
  {
    href: '/production-control/adjustments',
    label: 'Ajustes',
    icon: TrendingDown,
  },
  {
    href: '/production-control/daily-log',
    label: 'Bitácora Diaria',
    icon: FileText,
  },
  {
    href: '/production-control/advanced-dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    roles: ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS']
  },
]

export default function InventoryNavigation() {
  const pathname = usePathname()
  const { profile } = useAuthSelectors()
  
  // Filter nav items based on role
  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true
    return profile?.role && item.roles.includes(profile.role)
  })

  const isActive = (href: string) => {
    if (href === '/production-control/advanced-dashboard') {
      return pathname === href || pathname?.startsWith('/production-control/advanced-dashboard')
    }
    return pathname === href
  }

  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors rounded-md",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active 
                    ? "bg-accent text-accent-foreground" 
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Search and Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Global Search */}
          <GlobalSearch />
          
          {/* Quick Entry Button */}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="hidden md:flex"
          >
            <Link href="/production-control/entries?tab=new">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Entrada
            </Link>
          </Button>
          
          {/* Quick Adjustment Button */}
          <Button
            variant="outline"
            size="sm"
            asChild
            className="hidden md:flex"
          >
            <Link href="/production-control/adjustments">
              <TrendingDown className="h-4 w-4 mr-2" />
              Nuevo Ajuste
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
