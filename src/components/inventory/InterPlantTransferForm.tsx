'use client'

import React, { useEffect, useState } from 'react'
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
import { Truck } from 'lucide-react'

type PlantRow = { id: string; name: string | null }

export default function InterPlantTransferForm() {
  const { currentPlant } = usePlantContext()
  const [plants, setPlants] = useState<PlantRow[]>([])
  const [fromPlantId, setFromPlantId] = useState('')
  const [toPlantId, setToPlantId] = useState('')
  const [materialId, setMaterialId] = useState('')
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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = parseFloat(quantity.replace(',', '.'))
    if (!fromPlantId || !toPlantId || !materialId || !Number.isFinite(q) || q <= 0) {
      toast.error('Complete origen, destino, material y cantidad válida')
      return
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-stone-200 max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-stone-900">
          <Truck className="h-5 w-5 text-violet-700" />
          Transferencia entre plantas
        </CardTitle>
        <CardDescription>
          Registra la salida en origen y la entrada en destino. Requiere inventario suficiente en la planta de
          origen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Planta origen</Label>
              <Select value={fromPlantId} onValueChange={setFromPlantId}>
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
              <Select value={toPlantId} onValueChange={setToPlantId}>
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
          <div className="space-y-2">
            <Label>Material</Label>
            <MaterialSelect
              value={materialId}
              onChange={(v) => setMaterialId(v)}
              plantId={fromPlantId || currentPlant?.id}
              disabled={!fromPlantId}
            />
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
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? 'Guardando…' : 'Registrar transferencia'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
