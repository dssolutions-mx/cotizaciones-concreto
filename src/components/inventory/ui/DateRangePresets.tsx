'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format, subDays, startOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { es } from 'date-fns/locale'

export type DateRangePreset = 'today' | 'yesterday' | 'last7days' | 'last30days' | 'thisWeek' | 'thisMonth' | 'custom'

interface DateRangePresetsProps {
  selectedPreset?: DateRangePreset
  onPresetSelect: (preset: DateRangePreset, range: { from: Date; to: Date }) => void
  className?: string
}

const presets: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: 'yesterday', label: 'Ayer' },
  { value: 'last7days', label: 'Últimos 7 días' },
  { value: 'last30days', label: 'Últimos 30 días' },
  { value: 'thisWeek', label: 'Esta semana' },
  { value: 'thisMonth', label: 'Este mes' },
  { value: 'custom', label: 'Personalizado' }
]

export function getDateRangeForPreset(preset: DateRangePreset): { from: Date; to: Date } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      const yesterday = subDays(today, 1)
      return { from: yesterday, to: yesterday }
    case 'last7days':
      return { from: subDays(today, 6), to: today }
    case 'last30days':
      return { from: subDays(today, 29), to: today }
    case 'thisWeek':
      const weekStart = startOfWeek(today, { locale: es })
      return { from: weekStart, to: today }
    case 'thisMonth':
      const monthStart = startOfMonth(today)
      return { from: monthStart, to: today }
    default:
      return { from: today, to: today }
  }
}

export default function DateRangePresets({
  selectedPreset,
  onPresetSelect,
  className
}: DateRangePresetsProps) {
  const handlePresetClick = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      // Custom will be handled by the date picker
      return
    }
    const range = getDateRangeForPreset(preset)
    onPresetSelect(preset, range)
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {presets.map((preset) => (
        <Button
          key={preset.value}
          variant={selectedPreset === preset.value ? 'default' : 'outline'}
          size="sm"
          onClick={() => handlePresetClick(preset.value)}
          className={cn(
            'text-xs sm:text-sm',
            selectedPreset === preset.value && 'font-semibold'
          )}
        >
          {preset.value === 'custom' && <CalendarIcon className="h-3 w-3 mr-1" />}
          {preset.label}
        </Button>
      ))}
    </div>
  )
}
