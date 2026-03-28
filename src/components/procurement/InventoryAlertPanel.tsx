'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CrossPlantInventorySummary from '@/components/procurement/CrossPlantInventorySummary'
import ProcurementInventoryDetail from '@/components/procurement/ProcurementInventoryDetail'
import type { MaterialAlert, AlertStatus } from '@/types/alerts'
import { productionEntriesUrl } from '@/lib/procurement/navigation'

const STATUS_LABEL: Partial<Record<AlertStatus, string>> = {
  pending_po: 'Requiere OC',
  po_linked: 'OC vinculada',
  delivery_scheduled: 'Entrega programada',
  validated: 'Validada',
  pending_validation: 'Pendiente validación',
}

export default function InventoryAlertPanel({
  workspacePlantId,
  availablePlants,
  canCreatePO = false,
  onCreatePOFromAlert,
}: {
  workspacePlantId: string
  availablePlants: Array<{ id: string; name: string; code?: string }>
  canCreatePO?: boolean
  onCreatePOFromAlert?: (alert: MaterialAlert) => void
}) {
  const [alerts, setAlerts] = useState<MaterialAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<any[]>([])
  const [entriesLoading, setEntriesLoading] = useState(true)

  const plantIdsForSummary = useMemo(
    () =>
      workspacePlantId === ''
        ? availablePlants
        : availablePlants.filter((p) => p.id === workspacePlantId),
    [workspacePlantId, availablePlants]
  )

  const fetchAlerts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (workspacePlantId) params.set('plant_id', workspacePlantId)
      params.set('active', 'true')
      const res = await fetch(`/api/alerts/material?${params}`)
      const json = await res.json()
      if (json.success) {
        const all = (json.data || []) as MaterialAlert[]
        const mine = all.filter((a) =>
          ['pending_po', 'po_linked', 'validated', 'delivery_scheduled'].includes(a.status)
        )
        setAlerts(mine.slice(0, 40))
      } else setAlerts([])
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [workspacePlantId])

  const fetchEntries = useCallback(async () => {
    setEntriesLoading(true)
    try {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 30)
      const params = new URLSearchParams({
        limit: '10',
        offset: '0',
        date_from: from.toISOString().slice(0, 10),
        date_to: to.toISOString().slice(0, 10),
      })
      if (workspacePlantId) params.set('plant_id', workspacePlantId)
      const res = await fetch(`/api/inventory/entries?${params}`)
      const json = await res.json()
      setEntries(json.data || json.entries || [])
    } catch {
      setEntries([])
    } finally {
      setEntriesLoading(false)
    }
  }, [workspacePlantId])

  useEffect(() => {
    void fetchAlerts()
    void fetchEntries()
  }, [fetchAlerts, fetchEntries])

  const actionable = alerts.filter((a) =>
    ['pending_po', 'po_linked', 'validated', 'delivery_scheduled'].includes(a.status)
  )

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600 max-w-3xl">
        Resumen por planta, luego <strong className="font-medium text-stone-800">existencias por material</strong>{' '}
        (qué queda en stock). Más abajo: alertas y entradas. Para vincular OC o programar entregas use{' '}
        <strong className="font-medium text-stone-800">Gestionar alertas</strong>.
      </p>
      <CrossPlantInventorySummary
        plantIds={plantIdsForSummary}
        plantLabel={workspacePlantId ? 'planta seleccionada' : 'todas las plantas'}
      />

      <ProcurementInventoryDetail
        workspacePlantId={workspacePlantId}
        availablePlants={availablePlants}
      />

      <Card className="rounded-lg border border-stone-200 bg-white">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
              Alertas y coordinación
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild className="border-stone-300">
                <Link
                  href={
                    workspacePlantId
                      ? `/production-control/alerts?plant_id=${encodeURIComponent(workspacePlantId)}`
                      : '/production-control/alerts'
                  }
                >
                  Gestionar alertas
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32 w-full rounded-lg" />
          ) : actionable.length === 0 ? (
            <p className="text-sm text-stone-500">No hay alertas activas en este filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
                    <th className="py-2 pr-2">Alerta</th>
                    <th className="py-2 pr-2">Material</th>
                    <th className="py-2 pr-2">Planta</th>
                    <th className="py-2">Estado</th>
                    {canCreatePO && onCreatePOFromAlert ? <th className="py-2 text-right">Acción</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {actionable.map((a) => (
                    <tr key={a.id} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 pr-2 font-mono text-xs text-stone-700">{a.alert_number}</td>
                      <td className="py-2 pr-2 text-stone-800">
                        {(a.material as { material_name?: string })?.material_name ?? '—'}
                      </td>
                      <td className="py-2 pr-2 text-stone-600">
                        {(a.plant as { code?: string })?.code ?? '—'}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline" className="text-[10px] border-stone-300">
                          {STATUS_LABEL[a.status] ?? a.status}
                        </Badge>
                      </td>
                      {canCreatePO && onCreatePOFromAlert ? (
                        <td className="py-2 text-right">
                          {a.status === 'pending_po' ? (
                            <Button
                              type="button"
                              size="sm"
                              className="bg-sky-700 hover:bg-sky-800 text-white h-8"
                              onClick={() => onCreatePOFromAlert(a)}
                            >
                              Crear OC
                            </Button>
                          ) : (
                            <span className="text-xs text-stone-400">—</span>
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg border border-stone-200 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
            Entradas recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entriesLoading ? (
            <Skeleton className="h-24 w-full rounded-lg" />
          ) : entries.length === 0 ? (
            <p className="text-sm text-stone-500">Sin entradas recientes.</p>
          ) : (
            <ul className="space-y-2">
              {entries.slice(0, 10).map((e: any) => (
                <li
                  key={e.id}
                  className="flex flex-wrap justify-between gap-2 border-b border-stone-100 pb-2 last:border-0 text-sm"
                >
                  <span className="font-mono text-xs text-stone-600">{e.entry_number}</span>
                  <span className="text-stone-800">{e.material?.material_name ?? 'Material'}</span>
                  <span className="text-xs text-stone-500">{e.entry_date}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="link" className="mt-2 h-auto p-0 text-sky-800" asChild>
            <Link href={productionEntriesUrl({ plantId: workspacePlantId || undefined })}>
              Ver todas las entradas
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
