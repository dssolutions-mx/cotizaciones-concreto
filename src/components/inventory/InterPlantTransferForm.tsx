'use client'

import React, { useCallback, useEffect, useState } from 'react'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePlantContext } from '@/contexts/PlantContext'
import MaterialSelect from './MaterialSelect'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { AlertCircle, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

type PlantRow = { id: string; name: string | null }

type SuggestResponse = {
  suggested_id: string | null
  match_reason: 'accounting_code' | 'material_code' | 'none' | 'ambiguous'
  candidates: { id: string; material_name: string; material_code: string }[]
  source?: { accounting_code?: string | null }
}

function destMatchHint(data: SuggestResponse | null, destMaterialId: string): string | null {
  if (!data) return null
  if (data.match_reason === 'accounting_code' && data.suggested_id === destMaterialId) {
    const ac = data.source?.accounting_code?.trim()
    return ac ? `Sugerido por clave contable ${ac}` : 'Sugerido por clave contable'
  }
  if (data.match_reason === 'material_code' && data.suggested_id === destMaterialId) {
    return 'Sugerido por código de material'
  }
  if (data.match_reason === 'ambiguous') {
    return `Varios materiales coinciden (${data.candidates.length}) — confirme el de destino`
  }
  if (data.match_reason === 'none' && !destMaterialId) {
    return 'Sin equivalente automático — seleccione el material en la planta destino'
  }
  return null
}

export default function InterPlantTransferForm() {
  const { currentPlant } = usePlantContext()
  const [plants, setPlants] = useState<PlantRow[]>([])
  const [fromPlantId, setFromPlantId] = useState('')
  const [toPlantId, setToPlantId] = useState('')
  const [materialId, setMaterialId] = useState('')
  const [destMaterialId, setDestMaterialId] = useState('')
  const [suggest, setSuggest] = useState<SuggestResponse | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.from('plants').select('id, name').eq('is_active', true).order('name')
      if (error) {
        toast.error('No se pudo cargar plantas')
        return
      }
      setPlants((data as PlantRow[]) || [])
    })()
  }, [])

  useEffect(() => {
    if (currentPlant?.id && !fromPlantId) {
      setFromPlantId(currentPlant.id)
    }
  }, [currentPlant?.id, fromPlantId])

  const fetchSuggest = useCallback(async (sourceId: string, destPlantId: string) => {
    setSuggestLoading(true)
    setSuggest(null)
    try {
      const qs = new URLSearchParams({
        source_material_id: sourceId,
        to_plant_id: destPlantId,
      })
      const res = await fetch(`/api/inventory/inter-plant-transfers/suggest-dest?${qs}`)
      const json = (await res.json()) as SuggestResponse & { error?: string }
      if (!res.ok) {
        throw new Error(json.error || 'No se pudo sugerir material de destino')
      }
      setSuggest(json)
      if (json.suggested_id) {
        setDestMaterialId(json.suggested_id)
      } else {
        setDestMaterialId('')
      }
    } catch (err) {
      setDestMaterialId('')
      toast.error(err instanceof Error ? err.message : 'Error al buscar material de destino')
    } finally {
      setSuggestLoading(false)
    }
  }, [])

  useEffect(() => {
    setDestMaterialId('')
    setSuggest(null)
    if (!materialId || !toPlantId) return
    void fetchSuggest(materialId, toPlantId)
  }, [materialId, toPlantId, fetchSuggest])

  const hint = destMatchHint(suggest, destMaterialId)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = parseFloat(quantity.replace(',', '.'))
    if (!fromPlantId || !toPlantId || !materialId || !destMaterialId || !Number.isFinite(q) || q <= 0) {
      toast.error('Complete origen, destino, ambos materiales y cantidad válida')
      return
    }
    if (suggest?.match_reason === 'ambiguous' && destMaterialId !== suggest.suggested_id) {
      const ok = suggest.candidates.some((c) => c.id === destMaterialId)
      if (!ok) {
        toast.error('Seleccione uno de los materiales candidatos en destino')
        return
      }
    }
    setLoading(true)
    try {
      const res = await fetch('/api/inventory/inter-plant-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_plant_id: fromPlantId,
          to_plant_id: toPlantId,
          material_id: materialId,
          dest_material_id: destMaterialId,
          quantity_kg: q,
          transfer_date: date,
          notes: notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Error al registrar')
      }
      toast.success('Transferencia registrada. Se notificó por correo (si SendGrid está configurado).')
      setNotes('')
      setQuantity('')
      setMaterialId('')
      setDestMaterialId('')
      setSuggest(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-stone-200 max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-stone-900">
          <Truck className="h-5 w-5 text-violet-700" />
          Transferencia entre plantas
        </CardTitle>
        <CardDescription>
          Registra la salida en origen y la entrada en destino, cada una con el material de su catálogo
          (clave contable ERP cuando aplique).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Planta origen</Label>
              <Select
                value={fromPlantId}
                onValueChange={(v) => {
                  setFromPlantId(v)
                  setMaterialId('')
                  setDestMaterialId('')
                  setSuggest(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Planta destino</Label>
              <Select
                value={toPlantId}
                onValueChange={(v) => {
                  setToPlantId(v)
                  setDestMaterialId('')
                  setSuggest(null)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione" />
                </SelectTrigger>
                <SelectContent>
                  {plants
                    .filter((p) => p.id !== fromPlantId)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name || p.id}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Material (origen)</Label>
              <MaterialSelect
                value={materialId}
                onChange={(v) => setMaterialId(v)}
                plantId={fromPlantId || currentPlant?.id}
                disabled={!fromPlantId}
              />
            </div>
            <div className="space-y-2">
              <Label>Material (destino)</Label>
              <MaterialSelect
                value={destMaterialId}
                onChange={(v) => setDestMaterialId(v)}
                plantId={toPlantId}
                disabled={!toPlantId || !materialId || suggestLoading}
              />
              {hint && (
                <p
                  className={cn(
                    'text-xs flex items-start gap-1.5',
                    suggest?.match_reason === 'none' || suggest?.match_reason === 'ambiguous'
                      ? 'text-amber-800'
                      : 'text-stone-600'
                  )}
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {hint}
                </p>
              )}
              {suggestLoading && (
                <p className="text-xs text-stone-500">Buscando equivalente en destino…</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="qty-ipt">Cantidad (kg)</Label>
              <Input
                id="qty-ipt"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-ipt">Fecha</Label>
              <Input id="date-ipt" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <Button type="submit" disabled={loading || suggestLoading} className="w-full sm:w-auto">
            {loading ? 'Guardando…' : 'Registrar transferencia'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
