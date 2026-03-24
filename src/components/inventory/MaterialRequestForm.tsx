'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertCircle, ArrowLeft, Send, Package, CheckCircle2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { usePlantContext } from '@/contexts/PlantContext'
import MaterialSelect from '@/components/inventory/MaterialSelect'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'
import type { DashboardMaterialSummary, DashboardSummaryResponse } from '@/types/inventoryDashboard'
import { cn } from '@/lib/utils'

interface MaterialRequestFormProps {
  embedded?: boolean
}

function fmtKg(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function barWidth(m: DashboardMaterialSummary) {
  if (m.reorder_point_kg && m.reorder_point_kg > 0) {
    return Math.min(100, (m.current_stock_kg / m.reorder_point_kg) * 100)
  }
  return 40
}

function barColor(m: DashboardMaterialSummary) {
  if (m.health === 'healthy') return 'bg-emerald-500'
  if (m.health === 'warning') return 'bg-amber-500'
  if (m.health === 'critical') return 'bg-red-500'
  return 'bg-stone-400'
}

function healthLabel(m: DashboardMaterialSummary) {
  if (m.health === 'healthy') return 'Saludable'
  if (m.health === 'warning') return 'Atención'
  if (m.health === 'critical') return 'Crítico'
  return 'Sin punto de reorden'
}

export default function MaterialRequestForm({ embedded = false }: MaterialRequestFormProps) {
  const { currentPlant } = usePlantContext()
  const searchParams = useSearchParams()
  const prefillMaterialId = searchParams.get('material_id') || ''

  const [materialId, setMaterialId] = useState(prefillMaterialId)
  const [estimatedKg, setEstimatedKg] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [materialContext, setMaterialContext] = useState<DashboardMaterialSummary | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ alert_number: string } | null>(null)

  useEffect(() => {
    if (prefillMaterialId) setMaterialId(prefillMaterialId)
  }, [prefillMaterialId])

  const loadMaterialContext = useCallback(async () => {
    if (!currentPlant?.id || !materialId) {
      setMaterialContext(null)
      return
    }
    setContextLoading(true)
    try {
      const res = await fetch(`/api/inventory/dashboard-summary?plant_id=${currentPlant.id}`)
      const json = (await res.json()) as DashboardSummaryResponse & { error?: string }
      if (!res.ok || !json.success || !json.materials) {
        setMaterialContext(null)
        return
      }
      const row = json.materials.find((m) => m.material_id === materialId) ?? null
      setMaterialContext(row)
    } catch {
      setMaterialContext(null)
    } finally {
      setContextLoading(false)
    }
  }, [currentPlant?.id, materialId])

  useEffect(() => {
    loadMaterialContext()
  }, [loadMaterialContext])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessInfo(null)
    if (!currentPlant?.id) {
      toast.error('Seleccione una planta')
      return
    }
    if (!materialId) {
      toast.error('Seleccione un material')
      return
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        plant_id: currentPlant.id,
        material_id: materialId,
        notes: notes.trim() || undefined,
      }
      const est = parseFloat(estimatedKg)
      if (!Number.isNaN(est) && est > 0) {
        body.estimated_need_kg = est
      }

      const res = await fetch('/api/alerts/material', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.success) {
        const num = json.data?.alert_number as string | undefined
        toast.success(num ? `Solicitud ${num} registrada` : 'Solicitud registrada')
        setSuccessInfo({ alert_number: num || '—' })
        setNotes('')
        setEstimatedKg('')
        if (!prefillMaterialId) setMaterialId('')
        await loadMaterialContext()
      } else {
        toast.error(json.error || 'No se pudo enviar la solicitud')
      }
    } catch {
      toast.error('Error de red')
    } finally {
      setSubmitting(false)
    }
  }

  const shellClass = embedded ? '' : 'max-w-2xl mx-auto space-y-6 w-full'

  if (!currentPlant?.id) {
    return (
      <div className={cn(shellClass, !embedded && 'max-w-lg')}>
        {!embedded && <InventoryBreadcrumb />}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>Seleccione una planta en el encabezado para solicitar material.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={shellClass}>
      {!embedded && (
        <>
          <InventoryBreadcrumb />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">Solicitar material</h1>
              <p className="text-sm text-stone-600 mt-0.5">
                Genera una alerta en <span className="font-medium text-stone-800">pendiente de validación</span>. El
                Jefe de Planta revisará la necesidad y la orden de compra.
              </p>
            </div>
            <Button variant="ghost" size="sm" asChild className="shrink-0 -ml-2 sm:ml-0 w-fit">
              <Link href="/production-control">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Centro de materiales
              </Link>
            </Button>
          </div>
        </>
      )}

      {successInfo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-950">Solicitud enviada</p>
            <p className="text-sm text-emerald-900/90 mt-0.5">
              Folio{' '}
              <span className="font-mono font-semibold tabular-nums">{successInfo.alert_number}</span>. El Jefe de
              Planta la validará cuando corresponda.
            </p>
          </div>
          <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-900 shrink-0" asChild>
            <Link href="/production-control/alerts">
              Ver alertas
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <Card className="border-stone-200 bg-white shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg border border-stone-200 bg-stone-50 flex items-center justify-center">
                <Package className="h-4 w-4 text-stone-600" />
              </div>
              <div>
                <CardTitle className="text-base text-stone-900">Material</CardTitle>
                <CardDescription className="text-stone-600">Qué necesitas en planta</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-stone-800">Material *</Label>
              <MaterialSelect
                value={materialId}
                onChange={(id) => {
                  setMaterialId(id)
                  setSuccessInfo(null)
                }}
                required
                plantId={currentPlant.id}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 bg-white shadow-none min-h-[180px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-stone-900">Inventario en planta</CardTitle>
            <CardDescription className="text-stone-600">
              Contexto antes de solicitar (mismo dato que el centro de materiales)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!materialId ? (
              <p className="text-sm text-stone-500 py-4 text-center">Seleccione un material para ver existencias.</p>
            ) : contextLoading ? (
              <div className="space-y-3 py-2">
                <div className="h-4 w-[70%] max-w-[200px] rounded bg-stone-100 animate-pulse" />
                <div className="h-2 rounded-full bg-stone-100 animate-pulse" />
                <div className="h-6 w-[45%] rounded bg-stone-100 animate-pulse" />
              </div>
            ) : !materialContext ? (
              <p className="text-sm text-stone-500 py-2">No hay registro de inventario para este material en esta planta.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-stone-800 line-clamp-2">{materialContext.material_name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'font-normal shrink-0',
                      materialContext.health === 'healthy' && 'border-emerald-300 text-emerald-900',
                      materialContext.health === 'warning' && 'border-amber-300 text-amber-900',
                      materialContext.health === 'critical' && 'border-red-300 text-red-900',
                      materialContext.health === 'unknown' && 'border-stone-300 text-stone-700'
                    )}
                  >
                    {healthLabel(materialContext)}
                  </Badge>
                </div>
                <div className="h-2 rounded-full bg-stone-200 overflow-hidden border border-stone-200/80">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor(materialContext))}
                    style={{ width: `${barWidth(materialContext)}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-stone-500">Stock sistema</p>
                    <p className="font-mono font-semibold tabular-nums text-stone-900">{fmtKg(materialContext.current_stock_kg)} kg</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-stone-500">Punto de reorden</p>
                    <p className="font-mono font-semibold tabular-nums text-stone-700">
                      {materialContext.reorder_point_kg != null ? `${fmtKg(materialContext.reorder_point_kg)} kg` : '—'}
                    </p>
                  </div>
                </div>

                {materialContext.active_alerts.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 space-y-2">
                    <p className="text-xs font-semibold text-amber-950">Alertas activas para este material</p>
                    <ul className="space-y-1.5">
                      {materialContext.active_alerts.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs text-amber-900">
                          <span className="font-mono font-medium">{a.alert_number}</span>
                          <Badge variant="secondary" className="text-[10px] h-5 bg-amber-100 text-amber-950">
                            {a.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-amber-800/90">
                      Si ya hay un pedido en curso, evite duplicar salvo que sea necesario. Puede revisar en Alertas.
                    </p>
                    <Button variant="outline" size="sm" className="w-full border-amber-300 text-amber-950" asChild>
                      <Link href="/production-control/alerts">Ir a alertas de material</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-stone-200 bg-white shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-stone-900">Detalle de la solicitud</CardTitle>
          <CardDescription className="text-stone-600">
            Opcional pero recomendado: cantidad estimada y notas para el Jefe de Planta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="est-kg" className="text-stone-800">
                Necesidad estimada (kg)
              </Label>
              <Input
                id="est-kg"
                type="number"
                min="0"
                step="0.001"
                placeholder="Ej. 20 000"
                value={estimatedKg}
                onChange={(e) => setEstimatedKg(e.target.value)}
                className="font-mono border-stone-200 bg-white"
              />
              <p className="text-xs text-stone-500">Ayuda a dimensionar el pedido y la OC.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-notes" className="text-stone-800">
                Notas
              </Label>
              <Textarea
                id="req-notes"
                rows={4}
                placeholder="Urgencia, silo, proveedor preferido, comentarios del turno…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="border-stone-200 bg-white resize-y min-h-[100px]"
              />
            </div>
            <Separator className="bg-stone-200" />
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="border-stone-300 order-2 sm:order-1"
                onClick={() => {
                  setNotes('')
                  setEstimatedKg('')
                  setSuccessInfo(null)
                  if (!prefillMaterialId) setMaterialId('')
                }}
              >
                Limpiar
              </Button>
              <Button
                type="submit"
                variant="solid"
                className="order-1 sm:order-2 min-h-11 w-full sm:w-auto bg-sky-800 hover:bg-sky-900 text-white shadow-none"
                disabled={submitting}
              >
                <Send className="h-4 w-4 mr-2" />
                {submitting ? 'Enviando…' : 'Enviar solicitud'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
