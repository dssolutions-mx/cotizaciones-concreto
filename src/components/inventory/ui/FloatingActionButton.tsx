'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface FloatingActionButtonProps {
  icon: LucideIcon
  label: string
  onClick: () => void
  className?: string
  variant?: 'default' | 'secondary' | 'destructive'
  size?: 'default' | 'sm' | 'lg'
}

export default function FloatingActionButton({
  icon: Icon,
  label,
  onClick,
  className,
  variant = 'default',
  size = 'lg'
}: FloatingActionButtonProps) {
  return (
    <>
      {/* Desktop: Regular button */}
      <Button
        onClick={onClick}
        variant={variant}
        size={size}
        className={cn('hidden md:flex items-center gap-2', className)}
      >
        <Icon className="h-5 w-5" />
        {label}
      </Button>

      {/* Mobile: Floating Action Button */}
      <button
        onClick={onClick}
        className={cn(
          'fixed bottom-6 right-6 z-50 md:hidden',
          'h-16 w-16 rounded-full shadow-lg',
          'flex items-center justify-center',
          'bg-primary text-primary-foreground',
          'hover:bg-primary/90',
          'active:scale-95 transition-transform',
          'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
          className
        )}
        aria-label={label}
      >
        <Icon className="h-6 w-6" />
      </button>
    </>
  )
}
