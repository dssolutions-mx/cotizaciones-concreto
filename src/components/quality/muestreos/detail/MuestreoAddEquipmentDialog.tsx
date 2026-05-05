'use client'

import React, { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  EquipoUtilizadoPicker,
  type EquipoUtilizadoPickerHandle,
} from '@/components/quality/muestreos/EquipoUtilizadoPicker'
import { useToast } from '@/components/ui/use-toast'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  muestreoId: string
  plantId: string | undefined | null
  onSaved: () => void
}

export default function MuestreoAddEquipmentDialog({
  open,
  onOpenChange,
  muestreoId,
  plantId,
  onSaved,
}: Props) {
  const pickerRef = useRef<EquipoUtilizadoPickerHandle>(null)
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const selected = pickerRef.current?.getSelected() ?? []
    if (selected.length === 0) {
      toast({
        title: 'Selecciona instrumentos',
        description: 'Elige al menos un instrumento para vincular al muestreo.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/ema/muestreos/${muestreoId}/instrumentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'partial',
          instrumentos: selected.map((s) => ({
            instrumento_id: s.instrumento_id,
            paquete_id: s.paquete_id ?? null,
            observaciones: null,
          })),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          title: 'No se guardó el equipo',
          description: typeof j.error === 'string' ? j.error : 'Error desconocido',
          variant: 'destructive',
        })
        return
      }
      const saved = j.data?.saved ?? 0
      const skipped = j.data?.skipped ?? []
      if (skipped.length > 0) {
        const codes = skipped.map((x: { codigo: string }) => x.codigo).join(', ')
        toast({
          title: saved > 0 ? 'Equipo guardado parcialmente' : 'Ningún instrumento aplicable',
          description:
            saved > 0
              ? `Se guardaron ${String(saved)}. Omitidos (EMA): ${codes}`
              : `No se pudo vincular ninguno: ${codes}`,
          variant: saved > 0 ? 'default' : 'destructive',
        })
      } else {
        toast({
          title: 'Equipo actualizado',
          description:
            saved > 0
              ? `Se vincularon ${String(saved)} instrumento(s).`
              : typeof j.data?.message === 'string'
                ? j.data.message
                : 'Sin cambios.',
        })
      }
      onOpenChange(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Agregar equipo al muestreo</DialogTitle>
          <DialogDescription>
            Vincula instrumentos EMA a este muestreo. Los que ya estén registrados no se duplican.
            {!plantId ? ' Si no ves instrumentos, verifica que el muestreo tenga planta asignada.' : null}
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <EquipoUtilizadoPicker
            key={open ? `equipo-${muestreoId}-open` : `equipo-${muestreoId}-closed`}
            ref={pickerRef}
            plantId={plantId ?? undefined}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              'Guardar equipo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
