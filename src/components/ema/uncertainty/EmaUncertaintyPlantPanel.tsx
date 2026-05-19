'use client'

import { useEffect, useState } from 'react'
import { Building2, Loader2 } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { UncertaintyStudy } from '@/types/ema-uncertainty'

export function EmaUncertaintyPlantPanel({
  study,
  isLocked,
  onPlantUpdated,
}: {
  study: UncertaintyStudy
  isLocked: boolean
  onPlantUpdated: (next: UncertaintyStudy) => void
}) {
  const { currentPlant, availablePlants, isLoading: plantsLoading } = usePlantContext()
  const plants = availablePlants ?? []
  const assigned = plants.find((p) => p.id === study.plant_id)
  const [selectedId, setSelectedId] = useState(study.plant_id ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedId(study.plant_id ?? '')
  }, [study.plant_id])

  async function savePlant(plantId: string | null) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/ema/uncertainty/studies/${study.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plant_id: plantId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'No se pudo guardar la planta')
      }
      const updated = (await res.json()) as UncertaintyStudy
      onPlantUpdated(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (isLocked) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-4 py-3">
        <Building2 className="h-4 w-4 shrink-0 text-stone-400" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Planta del estudio
          </p>
          <p className="text-sm font-medium text-stone-800">
            {assigned?.name ?? (study.plant_id ? 'Planta asignada' : 'Sin planta')}
          </p>
        </div>
      </div>
    )
  }

  if (!study.plant_id) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-950">Asigne la planta del estudio</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                Los instrumentos en <strong>Lecturas</strong> se filtran por la planta guardada en
                este estudio (no solo por el selector global del encabezado). Sin planta verá
                instrumentos de todas las plantas.
              </p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
            {plants.length > 0 ? (
              <Select
                value={selectedId || undefined}
                onValueChange={setSelectedId}
                disabled={plantsLoading || saving}
              >
                <SelectTrigger className="h-9 border-amber-200 bg-white">
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
              <p className="text-xs text-amber-800">No hay plantas disponibles para su perfil.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="bg-amber-900 hover:bg-amber-950"
                disabled={!selectedId || saving}
                onClick={() => savePlant(selectedId)}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Guardando…
                  </>
                ) : (
                  'Guardar planta'
                )}
              </Button>
              {currentPlant && currentPlant.id !== selectedId && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-300 bg-white"
                  disabled={saving}
                  onClick={() => {
                    setSelectedId(currentPlant.id)
                    void savePlant(currentPlant.id)
                  }}
                >
                  Usar: {currentPlant.name}
                </Button>
              )}
            </div>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 min-w-0">
        <Building2 className="h-4 w-4 shrink-0 text-stone-400" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
            Planta del estudio
          </p>
          <p className="truncate text-sm font-medium text-stone-900">
            {assigned?.name ?? study.plant_id}
          </p>
          <p className="text-[11px] text-stone-500">Instrumentos en Lecturas filtrados por esta planta</p>
        </div>
      </div>
      {plants.length > 1 && (
        <div className="flex items-center gap-2 sm:shrink-0">
          <Select
            value={selectedId}
            onValueChange={(id) => {
              setSelectedId(id)
              void savePlant(id)
            }}
            disabled={saving || plantsLoading}
          >
            <SelectTrigger className="h-9 w-full min-w-[200px] border-stone-300 sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plants.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
        </div>
      )}
      {error && <p className="text-xs text-red-600 sm:w-full">{error}</p>}
    </div>
  )
}
