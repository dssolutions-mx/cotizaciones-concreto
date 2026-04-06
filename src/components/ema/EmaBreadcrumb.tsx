import React from 'react'
import Link from 'next/link'
import { ChevronRight, Gauge } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface EmaBreadcrumbProps {
  items?: BreadcrumbItem[]
  className?: string
}

export function EmaBreadcrumb({ items = [], className }: EmaBreadcrumbProps) {
  const all: BreadcrumbItem[] = [
    { label: 'Calidad', href: '/quality' },
    { label: 'Centro EMA', href: '/quality/instrumentos' },
    ...items,
  ]

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center gap-1 text-xs text-stone-500', className)}
    >
      <Gauge className="h-3.5 w-3.5 text-stone-400 shrink-0" />
      {all.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight className="h-3 w-3 text-stone-300 shrink-0" />}
          {item.href && idx < all.length - 1 ? (
            <Link href={item.href} className="hover:text-stone-700 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className={idx === all.length - 1 ? 'text-stone-700 font-medium' : ''}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  )
}
