'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Activity, ArrowLeft, Factory, Package, Scale } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'

/** Keep in sync with API `MAX_RANGE_DAYS` */
const MAX_RANGE_DAYS = 366

const fmtKg = (n: number) =>
  new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n)

function monthBounds(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function lastNDays(n: number) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - (n - 1))
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

type MaterialRow = {
  material_key: string
  material_id: string | null
  material_name: string
  consumption_kg: number
  entries_kg: number
  adjustments_kg: number
}

type DailyPoint = { fecha: string; consumption_kg: number }

type ApiPayload = {
  plant_id: string
  plant_name: string
  date_from: string
  date_to: string
  max_range_days: number
  summary: {
    total_consumption_kg: number
    total_entries_kg: number
    total_adjustments_kg: number
    remision_count: number
    material_rows: number
  }
  materials: MaterialRow[]
  daily_series: DailyPoint[]
}

export default function ConsumosPeriodoView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { availablePlants, currentPlant } = usePlantContext()
  const { profile } = useAuthSelectors()

  const lockedPlantId = profile?.role === 'PLANT_MANAGER' && profile.plant_id ? profile.plant_id : null

  const plantList = useMemo(
    () => (availablePlants?.length ? availablePlants : currentPlant ? [currentPlant] : []),
    [availablePlants, currentPlant]
  )

  const [plantId, setPlantId] = useState<string>(() => {
    const q = searchParams.get('plant_id')
    if (q) return q
    if (lockedPlantId) return lockedPlantId
    return ''
  })

  const [dateFrom, setDateFrom] = useState(() => {
    const q = searchParams.get('date_from')
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q
    return monthBounds(new Date()).from
  })

  const [dateTo, setDateTo] = useState(() => {
    const q = searchParams.get('date_to')
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q
    return new Date().toISOString().slice(0, 10)
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiPayload | null>(null)

  useEffect(() => {
    if (lockedPlantId) setPlantId(lockedPlantId)
  }, [lockedPlantId])

  const load = useCallback(async () => {
    if (!plantId) {
      setError('Seleccione una planta')
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams({
        plant_id: plantId,
        date_from: dateFrom,
        date_to: dateTo,
      })
      const res = await fetch(`/api/procurement/consumos/rango?${p}`)
      const json = await res.json()
      if (!res.ok) {
        setData(null)
        setError(json.error || 'No se pudo cargar')
        return
      }
      if (json.success && json.data) {
        setData(json.data as ApiPayload)
        const next = new URLSearchParams()
        next.set('plant_id', plantId)
        next.set('date_from', dateFrom)
        next.set('date_to', dateTo)
        router.replace(`/finanzas/procurement/consumos-periodo?${next.toString()}`, { scroll: false })
      } else {
        setData(null)
        setError('Respuesta inválida')
      }
    } catch {
      setData(null)
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }, [plantId, dateFrom, dateTo, router])

  useEffect(() => {
    const hasFullUrl =
      searchParams.get('plant_id') &&
      searchParams.get('date_from') &&
      searchParams.get('date_to')
    if (hasFullUrl && plantId) {
      void load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate from URL once
  }, [])

  const maxDaily = useMemo(
    () => (data?.daily_series?.length ? Math.max(...data.daily_series.map((d) => d.consumption_kg), 1e-6) : 1),
    [data]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/finanzas/procurement?tab=consumos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-800 hover:text-sky-950 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Consumo diario
          </Link>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
            Consumo por período
          </h1>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Totales por material en un rango de fechas (una planta). Máximo {MAX_RANGE_DAYS} días por consulta.
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row flex-wrap gap-4 items-end rounded-lg border border-stone-200 bg-white p-4">
        <div className="space-y-2 min-w-[200px]">
          <Label className="text-stone-700">Planta</Label>
          {lockedPlantId ? (
            <p className="text-sm font-medium text-stone-900 py-2">
              {plantList.find((p) => p.id === lockedPlantId)?.name || 'Su planta'}
            </p>
          ) : (
            <Select value={plantId || 'none'} onValueChange={(v) => setPlantId(v === 'none' ? '' : v)}>
              <SelectTrigger className="w-[260px] border-stone-300 bg-white">
                <SelectValue placeholder="Seleccione planta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccione planta</SelectItem>
                {plantList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-from" className="text-stone-700">
            Desde
          </Label>
          <Input
            id="cp-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[160px] border-stone-300 bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-to" className="text-stone-700">
            Hasta
          </Label>
          <Input
            id="cp-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[160px] border-stone-300 bg-white"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="border-stone-300" onClick={() => {
            const b = monthBounds(new Date())
            setDateFrom(b.from)
            setDateTo(b.to)
          }}>
            Mes actual
          </Button>
          <Button type="button" variant="outline" size="sm" className="border-stone-300" onClick={() => {
            const b = lastNDays(30)
            setDateFrom(b.from)
            setDateTo(b.to)
          }}>
            Últimos 30 días
          </Button>
          <Button
            type="button"
            className="bg-sky-700 hover:bg-sky-800 text-white"
            onClick={() => void load()}
            disabled={loading || !plantId}
          >
            Consultar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-lg" />
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="pt-6 text-sm text-red-800">{error}</CardContent>
        </Card>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="border-stone-200 bg-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
                  <Scale className="h-3.5 w-3.5" />
                  Consumo (remisiones)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
                  {fmtKg(data.summary.total_consumption_kg)} kg
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  Entradas
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
                  {fmtKg(data.summary.total_entries_kg)} kg
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Ajustes (abs.)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
                  {fmtKg(data.summary.total_adjustments_kg)} kg
                </p>
              </CardContent>
            </Card>
            <Card className="border-stone-200 bg-white">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-stone-500 flex items-center gap-1.5">
                  <Factory className="h-3.5 w-3.5" />
                  Remisiones
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl font-mono font-semibold tabular-nums text-stone-900">
                  {data.summary.remision_count}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-stone-800 mb-3">
              Consumo por remisiones por día (kg)
            </h2>
            {data.daily_series.length === 0 ? (
              <p className="text-sm text-stone-500">Sin datos en el período.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {data.daily_series.map((d) => (
                  <div key={d.fecha} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 font-mono text-stone-600">{d.fecha}</span>
                    <div className="flex-1 h-6 rounded bg-stone-100 overflow-hidden min-w-0">
                      <div
                        className="h-full bg-sky-600/80 rounded"
                        style={{ width: `${(d.consumption_kg / maxDaily) * 100}%` }}
                        title={`${fmtKg(d.consumption_kg)} kg`}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right font-mono tabular-nums text-stone-900">
                      {fmtKg(d.consumption_kg)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-100">
              <h2 className="text-sm font-semibold text-stone-800">Totales por material (período)</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                {data.plant_name} · {data.date_from} → {data.date_to}
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-stone-50">
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Consumo remisiones (kg)</TableHead>
                  <TableHead className="text-right">Entradas (kg)</TableHead>
                  <TableHead className="text-right">Ajustes (kg)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.materials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-stone-500 py-8">
                      Sin movimientos en el rango seleccionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.materials.map((m) => (
                    <TableRow key={m.material_key}>
                      <TableCell className="font-medium text-stone-900">{m.material_name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtKg(m.consumption_kg)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtKg(m.entries_kg)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtKg(m.adjustments_kg)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <p className="px-4 py-2 text-[11px] text-stone-500 border-t border-stone-100 bg-stone-50/50">
              Si el mismo nombre aparece en dos filas, suele haber dos registros distintos en el catálogo de
              materiales (IDs distintos). El consumo se agrupa por ID de material.
            </p>
          </div>
        </>
      ) : !plantId ? (
        <p className="text-sm text-stone-500">Seleccione una planta y pulse Consultar.</p>
      ) : null}
    </div>
  )
}
