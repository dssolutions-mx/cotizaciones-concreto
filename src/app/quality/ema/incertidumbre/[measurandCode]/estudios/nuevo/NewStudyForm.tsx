'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlantContext } from '@/contexts/PlantContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmaUncertaintyMeasurandPanel } from '@/components/ema/uncertainty/EmaUncertaintyMeasurandPanel'
import type { UncertaintyMeasurand } from '@/types/ema-uncertainty'

export function NewStudyForm({
  measurand,
  cuboVariant,
}: {
  measurand: UncertaintyMeasurand
  cuboVariant?: UncertaintyMeasurand
}) {
  const router = useRouter()
  const { currentPlant, availablePlants, isLoading: plantsLoading } = usePlantContext()
  const plants = availablePlants ?? []
  const [plantId, setPlantId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Geometry selector — only shown when a cubo variant is available (i.e. measuring FC)
  const [geometria, setGeometria] = useState<'cilindro' | 'cubo'>('cilindro')
  const activeMeasurand = cuboVariant && geometria === 'cubo' ? cuboVariant : measurand

  useEffect(() => {
    if (!plantId && currentPlant?.id) {
      setPlantId(currentPlant.id)
    }
  }, [currentPlant?.id, plantId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!plantId) {
      setError('Seleccione la planta del estudio antes de continuar.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ema/uncertainty/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          measurand_id: activeMeasurand.id,
          plant_id: plantId,
          fecha_estudio: date,
          notas: notas || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Error al crear estudio')
      }
      const study = await res.json()
      router.push(
        `/quality/ema/incertidumbre/${activeMeasurand.codigo}/estudios/${study.id}?tab=lecturas`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <p className="font-medium">Flujo del estudio (4 pasos)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-blue-900/90">
          <li>Crear — fecha y planta (esta pantalla)</li>
          <li>Configuración — revisar modelo y variables</li>
          <li>Lecturas — operador, instrumento y valores por réplica</li>
          <li>Presupuesto y publicar — calcular U y declarar vigencia</li>
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <EmaUncertaintyMeasurandPanel measurand={activeMeasurand} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 lg:col-span-2 lg:self-start"
        >
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Datos del estudio</h2>
            <p className="mt-1 text-xs text-stone-500">
              La planta queda guardada en el estudio y filtra los instrumentos en Lecturas.
            </p>
          </div>

          {cuboVariant && (
            <div>
              <Label>Geometría del espécimen</Label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setGeometria('cilindro')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    geometria === 'cilindro'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Cilindro
                </button>
                <button
                  type="button"
                  onClick={() => setGeometria('cubo')}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    geometria === 'cubo'
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Cubo
                </button>
              </div>
              <p className="mt-1 text-[11px] text-stone-400">
                {geometria === 'cubo'
                  ? 'Área = L₁ × L₂ — instrumento: flexómetro o vernier'
                  : 'Área = π(d/2)² — instrumento: prensa hidráulica'}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="study-plant">Planta del estudio</Label>
            {plants.length > 0 ? (
              <Select
                value={plantId || undefined}
                onValueChange={setPlantId}
                disabled={plantsLoading || loading}
              >
                <SelectTrigger id="study-plant" className="mt-1">
                  <SelectValue placeholder="Seleccionar planta…" />
                </SelectTrigger>
                <SelectContent>
                  {plants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                No hay plantas disponibles para su perfil. Use el selector global del encabezado o
                contacte al administrador.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="fecha_estudio">Fecha del estudio</Label>
            <Input
              id="fecha_estudio"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="notas">Notas (opcional)</Label>
            <Textarea
              id="notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Condiciones del estudio, lote de referencia…"
              className="mt-1"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading || !plantId}
            className="w-full bg-stone-900 hover:bg-stone-800"
          >
            {loading ? 'Creando…' : 'Crear y abrir Lecturas'}
          </Button>
        </form>
      </div>
    </div>
  )
}
