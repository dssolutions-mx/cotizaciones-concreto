'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, RefreshCw, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ArkikConsumoRemisionComparisonResult } from '@/lib/inventory/arkikConsumoRemisionComparator'
import type {
  ArkikConsumoQtyUpdatePreviewRow,
  ArkikConsumoSyncApplyItem,
  ArkikConsumoSyncPreviewRow,
} from '@/lib/inventory/arkikConsumptionSync'

function fmtQty(n: number) {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 2 })
}

function syncStatusBadge(status: ArkikConsumoSyncPreviewRow['sync_status']) {
  switch (status) {
    case 'ready_insert':
      return (
        <Badge variant="outline" className="border-emerald-300 text-emerald-800">
          Registrar
        </Badge>
      )
    case 'missing_remision':
      return (
        <Badge variant="outline" className="border-rose-300 text-rose-800">
          Sin remisión
        </Badge>
      )
    case 'missing_material':
      return (
        <Badge variant="outline" className="border-amber-300 text-amber-900">
          Sin material
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          Existe
        </Badge>
      )
  }
}

type Props = {
  plantId: string
  dateFrom: string
  dateTo: string
  consumoRem: ArkikConsumoRemisionComparisonResult
  onApplied: () => void
}

export default function ArkikConsumptionSyncTool({
  plantId,
  dateFrom,
  dateTo,
  consumoRem,
  onApplied,
}: Props) {
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [applying, setApplying] = useState(false)
  const [insertPreview, setInsertPreview] = useState<ArkikConsumoSyncPreviewRow[]>([])
  const [qtyPreview, setQtyPreview] = useState<ArkikConsumoQtyUpdatePreviewRow[]>([])
  const [selectedInsert, setSelectedInsert] = useState<Set<string>>(new Set())
  const [selectedQty, setSelectedQty] = useState<Set<string>>(new Set())

  const qtyDiffRows = useMemo(
    () => consumoRem.matched.filter((r) => r.tiene_diferencia),
    [consumoRem.matched]
  )

  const insertKey = (r: ArkikConsumoSyncPreviewRow) =>
    `${r.material}-${r.remision}-${r.fecha ?? ''}-${r.cantidad}`
  const qtyKey = (r: ArkikConsumoQtyUpdatePreviewRow) => r.remision_material_id

  const loadPreview = useCallback(async () => {
    if (consumoRem.only_excel.length === 0 && qtyDiffRows.length === 0) {
      setInsertPreview([])
      setQtyPreview([])
      return
    }
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/production-control/arkik-consumption-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          plant_id: plantId,
          date_from: dateFrom,
          date_to: dateTo,
          only_excel: consumoRem.only_excel,
          qty_diff: qtyDiffRows.map((r) => ({
            material: r.material,
            remision: r.remision,
            remision_raw: r.remision_raw,
            cantidad_excel: r.cantidad_excel,
            unit_arkik: r.unit_arkik,
            cantidad_real_db: r.cantidad_real_db,
            diferencia: r.diferencia,
          })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al analizar')
      const inserts = (json.insert_preview ?? []) as ArkikConsumoSyncPreviewRow[]
      const qtys = (json.qty_update_preview ?? []) as ArkikConsumoQtyUpdatePreviewRow[]
      setInsertPreview(inserts)
      setQtyPreview(qtys)
      setSelectedInsert(
        new Set(inserts.filter((r) => r.sync_status === 'ready_insert').map(insertKey))
      )
      setSelectedQty(
        new Set(qtys.filter((r) => r.sync_status === 'ready_update').map(qtyKey))
      )
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al analizar sincronización')
    } finally {
      setLoadingPreview(false)
    }
  }, [plantId, dateFrom, dateTo, consumoRem.only_excel, qtyDiffRows])

  useEffect(() => {
    void loadPreview()
  }, [loadPreview])

  const readyInsertCount = insertPreview.filter((r) => r.sync_status === 'ready_insert').length
  const readyQtyCount = qtyPreview.filter((r) => r.sync_status === 'ready_update').length
  const missingRemisionCount = insertPreview.filter(
    (r) => r.sync_status === 'missing_remision'
  ).length

  const applySelected = async () => {
    const items: ArkikConsumoSyncApplyItem[] = []

    for (const row of insertPreview) {
      if (row.sync_status !== 'ready_insert') continue
      if (!selectedInsert.has(insertKey(row))) continue
      items.push({
        kind: 'insert',
        material_code: row.material,
        remision: row.remision,
        cantidad: row.cantidad,
        cantidad_teorica: row.cantidad,
      })
    }

    for (const row of qtyPreview) {
      if (row.sync_status !== 'ready_update') continue
      if (!selectedQty.has(qtyKey(row))) continue
      items.push({
        kind: 'update_qty',
        remision_material_id: row.remision_material_id,
        cantidad: row.cantidad_excel,
      })
    }

    if (items.length === 0) {
      toast.error('Seleccione al menos un registro')
      return
    }

    setApplying(true)
    try {
      const res = await fetch('/api/production-control/arkik-consumption-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply',
          plant_id: plantId,
          items,
          run_fifo: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al aplicar')

      const inserted = Number(json.inserted) || 0
      const updated = Number(json.updated) || 0
      const errCount = (json.errors ?? []).length
      toast.success(
        `Registrados: ${inserted} consumos · Actualizados: ${updated}${errCount > 0 ? ` · ${errCount} error(es)` : ''}`
      )
      onApplied()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al registrar consumos')
    } finally {
      setApplying(false)
    }
  }

  if (consumoRem.only_excel.length === 0 && qtyDiffRows.length === 0) {
    return null
  }

  return (
    <Card className="border-sky-200 bg-sky-50/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4 text-sky-800" />
          Alinear consumos con el sistema
        </CardTitle>
        <CardDescription>
          Registre en <strong>remision_materiales</strong> los consumos que Arkik reporta y faltan en
          el sistema (cuando la remisión ya existe). También puede corregir diferencias de cantidad.
          Se ejecuta FIFO en las remisiones afectadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="border-emerald-300 text-emerald-800">
            {readyInsertCount} listos para registrar
          </Badge>
          <Badge variant="outline" className="border-amber-300 text-amber-900">
            {readyQtyCount} qty por corregir
          </Badge>
          {missingRemisionCount > 0 ? (
            <Badge variant="outline" className="border-rose-300 text-rose-800">
              {missingRemisionCount} sin remisión en sistema
            </Badge>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-8"
            onClick={() => void loadPreview()}
            disabled={loadingPreview}
          >
            {loadingPreview ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-1">Actualizar análisis</span>
          </Button>
        </div>

        {loadingPreview ? (
          <p className="text-sm text-stone-500 py-4">Analizando remisiones y materiales…</p>
        ) : (
          <>
            {readyInsertCount > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-stone-800">
                    Consumos en Arkik — registrar en remisión existente
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      const keys = insertPreview
                        .filter((r) => r.sync_status === 'ready_insert')
                        .map(insertKey)
                      setSelectedInsert(new Set(keys))
                    }}
                  >
                    Seleccionar todos registrables
                  </Button>
                </div>
                <div className="rounded-lg border border-stone-200 overflow-x-auto bg-white max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Material</TableHead>
                        <TableHead>Remisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insertPreview.map((row) => {
                        const key = insertKey(row)
                        const canSelect = row.sync_status === 'ready_insert'
                        return (
                          <TableRow key={key}>
                            <TableCell>
                              <Checkbox
                                checked={selectedInsert.has(key)}
                                disabled={!canSelect}
                                onCheckedChange={(checked) => {
                                  setSelectedInsert((prev) => {
                                    const next = new Set(prev)
                                    if (checked) next.add(key)
                                    else next.delete(key)
                                    return next
                                  })
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{row.material}</TableCell>
                            <TableCell className="font-mono text-sm">{row.remision}</TableCell>
                            <TableCell>{row.fecha ?? row.remision_fecha ?? '—'}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtQty(row.cantidad)} {row.unit_arkik}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                {syncStatusBadge(row.sync_status)}
                                <p className="text-[10px] text-stone-500 max-w-[200px] leading-snug">
                                  {row.sync_message}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {readyQtyCount > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-stone-800">
                  Diferencias de cantidad — actualizar cantidad_real
                </p>
                <div className="rounded-lg border border-stone-200 overflow-x-auto bg-white max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Material</TableHead>
                        <TableHead>Remisión</TableHead>
                        <TableHead className="text-right">Arkik</TableHead>
                        <TableHead className="text-right">Sistema</TableHead>
                        <TableHead className="text-right">Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {qtyPreview.map((row) => {
                        const key = qtyKey(row)
                        const canSelect = row.sync_status === 'ready_update'
                        return (
                          <TableRow key={key}>
                            <TableCell>
                              <Checkbox
                                checked={selectedQty.has(key)}
                                disabled={!canSelect}
                                onCheckedChange={(checked) => {
                                  setSelectedQty((prev) => {
                                    const next = new Set(prev)
                                    if (checked) next.add(key)
                                    else next.delete(key)
                                    return next
                                  })
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{row.material}</TableCell>
                            <TableCell className="font-mono text-sm">{row.remision}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtQty(row.cantidad_excel)} {row.unit_arkik}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtQty(row.cantidad_real_db)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-amber-800">
                              {fmtQty(row.diferencia)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            {missingRemisionCount > 0 ? (
              <p className="text-xs text-stone-600">
                {missingRemisionCount} filas requieren crear la remisión primero — use{' '}
                <Link href="/production-control/arkik-upload" className="text-sky-700 hover:underline">
                  Procesar Arkik
                </Link>{' '}
                o{' '}
                <Link href="/production-control/remisiones" className="text-sky-700 hover:underline">
                  Remisiones
                </Link>
                .
              </p>
            ) : null}

            <Button
              type="button"
              onClick={() => void applySelected()}
              disabled={applying || (selectedInsert.size === 0 && selectedQty.size === 0)}
              className="bg-sky-800 hover:bg-sky-900"
            >
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando…
                </>
              ) : (
                <>
                  Registrar seleccionados ({selectedInsert.size + selectedQty.size})
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
