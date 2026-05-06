'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'
import PlantInventoryReviewPanel from '@/components/inventory/PlantInventoryReviewPanel'
import PlantConsumosAccountingExport from '@/components/inventory/PlantConsumosAccountingExport'
import { usePlantContext } from '@/contexts/PlantContext'
import { Badge } from '@/components/ui/badge'
import type { DashboardSummaryResponse } from '@/types/inventoryDashboard'

export default function ProductionInventarioPage() {
  const { currentPlant, availablePlants, isGlobalAdmin, isLoading } = usePlantContext()
  const plantOptions = useMemo(
    () => availablePlants.map((p) => ({ id: p.id, name: p.name, code: p.code ?? undefined })),
    [availablePlants]
  )
  const workspacePlantId = currentPlant?.id ?? ''

  const [alertHints, setAlertHints] = useState(0)

  useEffect(() => {
    if (!currentPlant?.id) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/inventory/dashboard-summary?plant_id=${encodeURIComponent(currentPlant.id)}`
        )
        const json = (await res.json()) as DashboardSummaryResponse & { success?: boolean }
        if (cancelled || !json.success || !json.materials) return
        let n = 0
        for (const m of json.materials) {
          for (const a of m.active_alerts ?? []) {
            if (a.status === 'pending_confirmation') n++
          }
        }
        setAlertHints(n)
      } catch {
        /* optional badge */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [currentPlant?.id])

  if (isLoading) {
    return <div className="text-sm text-stone-500 py-8">Cargando…</div>
  }

  if (isGlobalAdmin && !currentPlant) {
    return (
      <div className="space-y-4">
        <InventoryBreadcrumb />
        <p className="text-stone-700">
          Seleccione una planta en el selector superior para revisar inventario y exportar consumos.
        </p>
      </div>
    )
  }

  if (!currentPlant) {
    return (
      <div className="space-y-4">
        <InventoryBreadcrumb />
        <p className="text-stone-700">No hay planta asignada a su perfil.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <InventoryBreadcrumb />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Revisión de inventario</h1>
          <p className="text-sm text-stone-600 mt-1 max-w-2xl">
            Concilie existencias con movimientos y libro de material; exporte el mismo Excel contable que Compras →
            Consumos.
          </p>
        </div>
        <Link
          href="/production-control/alerts"
          className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 self-start"
        >
          <Bell className="h-4 w-4 text-stone-600" aria-hidden />
          Alertas de material
          {alertHints > 0 ? (
            <Badge variant="destructive" className="tabular-nums">
              {alertHints}
            </Badge>
          ) : null}
        </Link>
      </div>

      <PlantInventoryReviewPanel
        workspacePlantId={workspacePlantId}
        availablePlants={plantOptions}
        listDescription="Stock actual y punto de reorden (kg). Clic en un material para auditoría, libro de movimientos y conciliación."
      />

      <PlantConsumosAccountingExport plantId={currentPlant.id} />
    </div>
  )
}
