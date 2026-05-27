'use client'

import React, { useState } from 'react'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateMuestreo } from '@/services/qualityMuestreoService'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { qualityHubOutlineNeutralClass, qualityHubPrimaryButtonClass } from '../../qualityHubUi'

type Props = {
  muestreoId: string
  valueCm: number | null | undefined
  onSaved: () => void
}

export default function MuestreoRevenimientoInline({ muestreoId, valueCm, onSaved }: Props) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setDraft(
      typeof valueCm === 'number' && !Number.isNaN(valueCm) ? String(valueCm) : ''
    )
    setEditing(true)
  }

  const cancel = () => {
    setEditing(false)
    setDraft('')
  }

  const save = async () => {
    const revenimiento = parseFloat(draft)
    if (Number.isNaN(revenimiento) || revenimiento < 0 || revenimiento > 30) {
      toast({
        title: 'Error de validación',
        description: 'El revenimiento debe ser un número entre 0 y 30',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      await updateMuestreo(muestreoId, { revenimiento_sitio: revenimiento })
      toast({
        title: 'Revenimiento actualizado',
        description: 'El revenimiento se ha actualizado correctamente',
        variant: 'default',
      })
      setEditing(false)
      onSaved()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'No se pudo actualizar el revenimiento'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const display =
    typeof valueCm === 'number' && !Number.isNaN(valueCm) ? `${valueCm}` : '—'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-stone-500">Revenimiento en Sitio</p>
        {!editing ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startEdit}
            className="h-8 w-8 p-0 text-stone-500 hover:text-sky-700 hover:bg-sky-50"
            aria-label="Editar revenimiento"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {!editing ? (
        <div className="text-2xl font-bold text-stone-900">
          {display}
          {display !== '—' ? (
            <span className="text-sm font-normal text-stone-500 ml-1">cm</span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min={0}
            max={30}
            step={0.1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-9 w-28 font-mono"
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
              if (e.key === 'Escape') cancel()
            }}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            className={cn(qualityHubPrimaryButtonClass, 'h-9')}
            onClick={() => void save()}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(qualityHubOutlineNeutralClass, 'h-9')}
            onClick={cancel}
            disabled={saving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
