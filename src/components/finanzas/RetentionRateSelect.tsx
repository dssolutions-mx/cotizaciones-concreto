'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  formatRetentionPct,
  initRetentionState,
  isPresetRate,
  retentionFromSelectValue,
} from '@/lib/ap/retentionRates'

type PresetOption = { value: string; label: string }

type Props = {
  label: React.ReactNode
  presets: readonly string[]
  presetOptions: PresetOption[]
  selectValue: string
  customDraft: string
  editingCustom: boolean
  onSelectValueChange: (selectValue: string) => void
  onCustomDraftChange: (draft: string) => void
  onEditingCustomChange: (editing: boolean) => void
  triggerClassName?: string
}

export function useRetentionRateState(initialRate: number, presets: readonly string[]) {
  const [selectValue, setSelectValue] = React.useState('0')
  const [customDraft, setCustomDraft] = React.useState('')
  const [editingCustom, setEditingCustom] = React.useState(false)

  const reset = React.useCallback((rate: number) => {
    const next = initRetentionState(rate, presets)
    setSelectValue(next.selectValue)
    setCustomDraft(next.customDraft)
    setEditingCustom(next.editingCustom)
  }, [presets])

  const rate = React.useMemo(() => {
    return retentionFromSelectValue(selectValue, customDraft, presets).rate
  }, [selectValue, customDraft, presets])

  return {
    selectValue,
    setSelectValue,
    customDraft,
    setCustomDraft,
    editingCustom,
    setEditingCustom,
    rate,
    reset,
  }
}

export default function RetentionRateSelect({
  label,
  presets,
  presetOptions,
  selectValue,
  customDraft,
  editingCustom,
  onSelectValueChange,
  onCustomDraftChange,
  onEditingCustomChange,
  triggerClassName,
}: Props) {
  const parsed = retentionFromSelectValue(selectValue, customDraft, presets)
  const showCustomInput = selectValue === 'custom' || editingCustom

  const displayLabel = React.useMemo(() => {
    if (selectValue === 'custom') {
      const r = parseFloat(customDraft)
      return r > 0 ? `Personalizado (${formatRetentionPct(r)})` : 'Personalizado…'
    }
    if (selectValue.startsWith('custom:')) {
      const r = parseFloat(selectValue.slice(7)) || 0
      return `Personalizado (${formatRetentionPct(r)})`
    }
    const preset = presetOptions.find(o => o.value === selectValue)
    return preset?.label ?? formatRetentionPct(parsed.rate)
  }, [selectValue, customDraft, presetOptions, parsed.rate])

  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center">{label}</Label>
      <Select
        value={selectValue}
        onValueChange={(v) => {
          onSelectValueChange(v)
          if (v === 'custom') {
            onEditingCustomChange(true)
            if (!customDraft) onCustomDraftChange('')
          } else {
            onEditingCustomChange(false)
          }
        }}
      >
        <SelectTrigger className={triggerClassName ?? 'bg-white'}>
          <SelectValue>{displayLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
          {parsed.rate > 0 && !isPresetRate(parsed.rate, presets) && selectValue.startsWith('custom:') && (
            <SelectItem value={selectValue}>
              Personalizado ({formatRetentionPct(parsed.rate)})
            </SelectItem>
          )}
          <SelectItem value="custom">Personalizado…</SelectItem>
        </SelectContent>
      </Select>
      {showCustomInput && (
        <Input
          type="number"
          min="0"
          step="0.001"
          value={customDraft}
          onChange={e => onCustomDraftChange(e.target.value)}
          placeholder="Tasa decimal, ej. 0.05"
          className="mt-1 bg-white text-xs h-7"
        />
      )}
    </div>
  )
}
