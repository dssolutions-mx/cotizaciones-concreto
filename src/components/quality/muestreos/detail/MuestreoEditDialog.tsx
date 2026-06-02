'use client'

import React, { useEffect, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { supabase } from '@/lib/supabase'
import type { MuestreoWithRelations } from '@/types/quality'

type PlantOption = { id: string; code: string; name: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  muestreo: MuestreoWithRelations
  onSaved: () => void
}

export default function MuestreoEditDialog({ open, onOpenChange, muestreo, onSaved }: Props) {
  const { toast } = useToast()
  const [plants, setPlants] = useState<PlantOption[]>([])
  const [plantsLoading, setPlantsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [plantId, setPlantId] = useState(muestreo.plant_id ?? '')
  const [fechaMuestreo, setFechaMuestreo] = useState(muestreo.fecha_muestreo ?? '')
  const [horaMuestreo, setHoraMuestreo] = useState(
    (muestreo.hora_muestreo ?? '12:00:00').slice(0, 5)
  )
  const [manualReference, setManualReference] = useState(muestreo.manual_reference ?? '')
  const [samplingNotes, setSamplingNotes] = useState(muestreo.sampling_notes ?? '')

  const isManual = !muestreo.remision_id

  useEffect(() => {
    if (!open) return
    const byId = muestreo.plant_id ?? ''
    const byCode =
      !byId && muestreo.planta ? plants.find((p) => p.code === muestreo.planta)?.id ?? '' : ''
    setPlantId(byId || byCode)
    setFechaMuestreo(muestreo.fecha_muestreo ?? '')
    setHoraMuestreo((muestreo.hora_muestreo ?? '12:00:00').slice(0, 5))
    setManualReference(muestreo.manual_reference ?? '')
    setSamplingNotes(muestreo.sampling_notes ?? '')
  }, [open, muestreo, plants])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const loadPlants = async () => {
      setPlantsLoading(true)
      try {
        const { data, error } = await supabase
          .from('plants')
          .select('id, code, name')
          .eq('is_active', true)
          .order('code')
        if (error) throw error
        if (!cancelled) setPlants(data ?? [])
      } catch {
        if (!cancelled) {
          toast({
            title: 'No se pudieron cargar las plantas',
            variant: 'destructive',
          })
        }
      } finally {
        if (!cancelled) setPlantsLoading(false)
      }
    }
    void loadPlants()
    return () => {
      cancelled = true
    }
  }, [open, toast])

  const save = async () => {
    if (!plantId) {
      toast({ title: 'Selecciona una planta', variant: 'destructive' })
      return
    }
    if (!fechaMuestreo) {
      toast({ title: 'La fecha de muestreo es obligatoria', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const hora = horaMuestreo.length === 5 ? `${horaMuestreo}:00` : horaMuestreo
      const res = await fetch(`/api/quality/muestreos/${muestreo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: plantId,
          fecha_muestreo: fechaMuestreo,
          hora_muestreo: hora,
          manual_reference: isManual ? manualReference.trim() || null : undefined,
          sampling_notes: samplingNotes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'No se pudo guardar')
      }
      toast({ title: 'Muestreo actualizado' })
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : 'Error al guardar',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            Editar muestreo #{muestreo.numero_muestreo}
          </DialogTitle>
          <DialogDescription>
            Corrige planta, fecha u observaciones. Los ensayos y muestras heredan la planta
            seleccionada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="edit-planta">Planta</Label>
            {plantsLoading ? (
              <div className="flex items-center gap-2 text-sm text-stone-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando plantas…
              </div>
            ) : (
              <Select value={plantId} onValueChange={setPlantId}>
                <SelectTrigger id="edit-planta">
                  <SelectValue placeholder="Seleccionar planta" />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {muestreo.planta && plantId !== muestreo.plant_id && (
              <p className="text-xs text-amber-800">
                Actual: {muestreo.planta}. Al guardar se actualizará en muestreo, muestras y ensayos.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-fecha">Fecha muestreo</Label>
              <Input
                id="edit-fecha"
                type="date"
                value={fechaMuestreo}
                onChange={(e) => setFechaMuestreo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hora">Hora</Label>
              <Input
                id="edit-hora"
                type="time"
                value={horaMuestreo}
                onChange={(e) => setHoraMuestreo(e.target.value)}
              />
            </div>
          </div>

          {isManual && (
            <div className="space-y-2">
              <Label htmlFor="edit-ref">Referencia manual</Label>
              <Input
                id="edit-ref"
                value={manualReference}
                onChange={(e) => setManualReference(e.target.value)}
                placeholder="Ej. remisión o folio externo"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notas de muestreo</Label>
            <Textarea
              id="edit-notes"
              value={samplingNotes}
              onChange={(e) => setSamplingNotes(e.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving || plantsLoading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
