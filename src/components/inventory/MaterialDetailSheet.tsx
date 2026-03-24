'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Package, Inbox, ClipboardPlus, Layers, ExternalLink } from 'lucide-react'
import type { DashboardMaterialSummary } from '@/types/inventoryDashboard'
import type { MaterialLot } from '@/types/lots'

function fmtKg(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

interface MaterialDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantId: string | null
  material: DashboardMaterialSummary | null
}

export default function MaterialDetailSheet({
  open,
  onOpenChange,
  plantId,
  material,
}: MaterialDetailSheetProps) {
  const [lots, setLots] = useState<MaterialLot[]>([])
  const [loadingLots, setLoadingLots] = useState(false)

  const fetchLots = useCallback(async () => {
    if (!plantId || !material?.material_id) return
    setLoadingLots(true)
    try {
      const params = new URLSearchParams({
        plant_id: plantId,
        material_id: material.material_id,
        limit: '5',
        offset: '0',
        has_remaining: 'true',
      })
      const res = await fetch(`/api/inventory/lots?${params}`)
      const json = await res.json()
      if (json.success) {
        setLots(json.data || [])
      }
    } catch {
      setLots([])
    } finally {
      setLoadingLots(false)
    }
  }, [plantId, material?.material_id])

  useEffect(() => {
    if (open && material) fetchLots()
  }, [open, material, fetchLots])

  if (!material) return null

  const barPct =
    material.reorder_point_kg && material.reorder_point_kg > 0
      ? Math.min(100, (material.current_stock_kg / material.reorder_point_kg) * 100)
      : 50

  const healthLabel =
    material.health === 'healthy'
      ? 'En rango'
      : material.health === 'warning'
        ? 'Atención'
        : material.health === 'critical'
          ? 'Crítico'
          : 'Sin punto de reorden'

  const healthClass =
    material.health === 'healthy'
      ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
      : material.health === 'warning'
        ? 'bg-amber-100 text-amber-900 border-amber-200'
        : material.health === 'critical'
          ? 'bg-red-100 text-red-900 border-red-200'
          : 'bg-stone-100 text-stone-700 border-stone-200'

  const entriesHref = `/production-control/entries?tab=new&material_id=${material.material_id}`
  const lotsHref = `/production-control/lots?material_id=${material.material_id}`
  const requestHref = `/production-control/material-request?material_id=${material.material_id}`

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-l border-stone-200 bg-[#f5f3f0] overflow-y-auto"
      >
        <SheetHeader className="text-left space-y-1 pr-8">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-stone-900">
            <Package className="h-5 w-5 text-sky-700" />
            {material.material_name}
          </SheetTitle>
          <SheetDescription className="text-stone-600">
            {material.category || 'Material'} · Inventario en planta
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-medium uppercase tracking-wide text-stone-500">Estado</span>
              <Badge variant="outline" className={healthClass}>
                {healthLabel}
              </Badge>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden border border-stone-200">
              <div
                className={
                  material.health === 'healthy'
                    ? 'h-full bg-emerald-500 rounded-full transition-all'
                    : material.health === 'warning'
                      ? 'h-full bg-amber-500 rounded-full transition-all'
                      : material.health === 'critical'
                        ? 'h-full bg-red-500 rounded-full transition-all'
                        : 'h-full bg-stone-400 rounded-full transition-all'
                }
                style={{ width: `${barPct}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-stone-500 text-xs">Stock actual</p>
                <p className="font-mono text-lg font-semibold text-stone-900 tabular-nums">
                  {fmtKg(material.current_stock_kg)} kg
                </p>
              </div>
              <div>
                <p className="text-stone-500 text-xs">Punto de reorden</p>
                <p className="font-mono text-lg font-semibold text-stone-800 tabular-nums">
                  {material.reorder_point_kg != null ? `${fmtKg(material.reorder_point_kg)} kg` : '—'}
                </p>
              </div>
            </div>
          </div>

          {material.active_alerts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">
                Alertas activas
              </p>
              <ul className="space-y-2">
                {material.active_alerts.map((a) => (
                  <li key={a.id} className="text-sm text-amber-950">
                    <span className="font-mono text-xs">{a.alert_number}</span>
                    <span className="text-amber-800"> · {a.status.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" className="mt-3 w-full border-amber-300" asChild>
                <Link href="/production-control/alerts">Ver alertas</Link>
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              variant="solid"
              className="w-full justify-start gap-2 bg-sky-800 hover:bg-sky-900 shadow-none"
              asChild
            >
              <Link href={entriesHref}>
                <Inbox className="h-4 w-4" />
                Registrar entrada de este material
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-stone-300" asChild>
              <Link href={requestHref}>
                <ClipboardPlus className="h-4 w-4" />
                Solicitar material
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 border-stone-300" asChild>
              <Link href={lotsHref}>
                <Layers className="h-4 w-4" />
                Ver lotes con saldo
                <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-60" />
              </Link>
            </Button>
          </div>

          <Separator className="bg-stone-200" />

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
              Lotes recientes (con saldo)
            </h4>
            {loadingLots ? (
              <p className="text-sm text-stone-500">Cargando…</p>
            ) : lots.length === 0 ? (
              <p className="text-sm text-stone-500">No hay lotes con inventario restante.</p>
            ) : (
              <ul className="space-y-2">
                {lots.map((lot) => (
                  <li
                    key={lot.id}
                    className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  >
                    <div className="font-mono text-xs text-stone-600">{lot.lot_number}</div>
                    <div className="flex justify-between mt-1 text-stone-800">
                      <span>Restante</span>
                      <span className="font-mono tabular-nums">
                        {fmtKg(Number(lot.remaining_quantity_kg ?? 0))} kg
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
