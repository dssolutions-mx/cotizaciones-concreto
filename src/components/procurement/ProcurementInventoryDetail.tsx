'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { DashboardMaterialSummary, DashboardSummaryResponse } from '@/types/inventoryDashboard'

function fmtKg(n: number) {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 2 })
}

function healthLabel(h: string) {
  switch (h) {
    case 'critical':
      return 'Crítico'
    case 'warning':
      return 'Atención'
    case 'healthy':
      return 'OK'
    case 'unknown':
      return 'Sin reorden'
    default:
      return h
  }
}

export default function ProcurementInventoryDetail({
  workspacePlantId,
  availablePlants,
}: {
  workspacePlantId: string
  availablePlants: Array<{ id: string; name: string; code?: string }>
}) {
  const [plantId, setPlantId] = useState<string>('')
  const [rows, setRows] = useState<DashboardMaterialSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (workspacePlantId) {
      setPlantId(workspacePlantId)
      return
    }
    if (availablePlants.length === 0) return
    setPlantId((prev) => {
      if (prev && availablePlants.some((p) => p.id === prev)) return prev
      return availablePlants[0].id
    })
  }, [workspacePlantId, availablePlants])

  const load = useCallback(async () => {
    if (!plantId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/inventory/dashboard-summary?plant_id=${encodeURIComponent(plantId)}`
      )
      const json = (await res.json()) as DashboardSummaryResponse & { error?: string }
      if (!res.ok || !json.success) {
        setError(json.error || 'No se pudo cargar el inventario')
        setRows([])
        return
      }
      setRows(json.materials ?? [])
    } catch {
      setError('Error de red')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.material_name.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q))
    )
  }, [rows, search])

  const scopedByWorkspace = Boolean(workspacePlantId)
  const currentPlantName = availablePlants.find((p) => p.id === plantId)?.name

  if (availablePlants.length === 0) {
    return (
      <Card className="rounded-lg border border-stone-200 bg-white">
        <CardHeader>
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
            Existencias por material
          </CardTitle>
          <CardDescription className="text-sm text-amber-800">
            No hay plantas disponibles en su sesión. Verifique permisos o recargue la página.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="rounded-lg border border-stone-200 bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Existencias por material
        </CardTitle>
        <CardDescription className="text-xs text-stone-500">
          Stock actual y punto de reorden (kg). Mismos datos que ve dosificador en Control de producción.
        </CardDescription>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap sm:items-center">
          {scopedByWorkspace ? (
            <p className="text-sm text-stone-700">
              Planta: <span className="font-semibold">{currentPlantName ?? '—'}</span>
              <span className="text-stone-500 text-xs ml-2">(filtro del workspace arriba)</span>
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 uppercase tracking-wide">Planta</span>
              <Select value={plantId} onValueChange={setPlantId}>
                <SelectTrigger className="w-[min(100%,320px)] border-stone-300 bg-white">
                  <SelectValue placeholder="Elija planta" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlants.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.code ? ` (${p.code})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Input
            placeholder="Buscar material…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm border-stone-300 bg-white"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          <div className="overflow-x-auto max-h-[min(60vh,560px)] overflow-y-auto rounded-md border border-stone-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-[#faf9f7] border-b border-stone-200 text-left text-xs uppercase text-stone-500">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Material</th>
                  <th className="py-2.5 px-3 font-medium text-right">Stock actual</th>
                  <th className="py-2.5 px-3 font-medium text-right">Punto reorden</th>
                  <th className="py-2.5 px-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.material_id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/80">
                    <td className="py-2.5 px-3 text-stone-900">
                      <div className="font-medium leading-snug">{m.material_name}</div>
                      {m.category && (
                        <div className="text-[11px] text-stone-500 mt-0.5">{m.category}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-900">
                      {fmtKg(m.current_stock_kg)} kg
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-stone-600">
                      {m.reorder_point_kg != null ? `${fmtKg(m.reorder_point_kg)} kg` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge
                        variant="outline"
                        className={
                          m.health === 'critical'
                            ? 'border-red-300 text-red-900 bg-red-50'
                            : m.health === 'warning'
                              ? 'border-amber-300 text-amber-900 bg-amber-50'
                              : m.health === 'healthy'
                                ? 'border-emerald-300 text-emerald-900 bg-emerald-50'
                                : 'border-stone-300 text-stone-700 bg-stone-50'
                        }
                      >
                        {healthLabel(m.health)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && !loading && (
              <p className="p-4 text-sm text-stone-500 text-center">Sin materiales con ese filtro.</p>
            )}
          </div>
        )}
        <p className="text-[11px] text-stone-500 mt-3">
          {filtered.length} de {rows.length} materiales
          {plantId && currentPlantName ? ` · ${currentPlantName}` : ''}
        </p>
      </CardContent>
    </Card>
  )
}
