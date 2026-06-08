'use client'

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import InventoryMovementsTable from '@/components/inventory/InventoryMovementsTable'
import EntryPricingForm from '@/components/inventory/EntryPricingForm'
import MaterialAdjustmentForm from '@/components/inventory/MaterialAdjustmentForm'
import { toast } from 'sonner'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { canCompleteEntryPricingReview, canSyncDosificadorStock } from '@/lib/auth/inventoryRoles'
import type {
  DosificadorSyncAnalysis,
  MaterialLedgerResponse,
  MaterialLedgerVarianceRow,
} from '@/types/materialLedger'
import type { MaterialEntry, InventoryMovement } from '@/types/inventory'
import { MATERIAL_LEDGER_EPSILON_KG } from '@/types/materialLedger'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ClipboardCopy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  Wrench,
} from 'lucide-react'

const EPS = MATERIAL_LEDGER_EPSILON_KG

/** YYYY-MM-DD for remisiones log deep links from consumo rows */
function movementDateToFechaParam(movementDate: string): string {
  const t = movementDate.trim()
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(t)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return new Date().toISOString().slice(0, 10)
}

function fmtKg(n: number) {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 3 })
}

function fmtMx(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 })
}

function deltaBadge(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return null
  const abs = Math.abs(v)
  const bad = abs > EPS
  return (
    <Badge
      variant={bad ? 'destructive' : 'secondary'}
      className={bad ? '' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}
    >
      {v >= 0 ? '+' : ''}
      {fmtKg(v)} kg
    </Badge>
  )
}

export type MaterialAuditSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantId: string
  /** When null, user picks a material from the variances tab */
  seedMaterial: { id: string; name: string } | null
  /** Open directly on variances tab (e.g. top banner button) */
  startOnVariancesTab?: boolean
}

export default function MaterialAuditSheet({
  open,
  onOpenChange,
  plantId,
  seedMaterial,
  startOnVariancesTab = false,
}: MaterialAuditSheetProps) {
  const router = useRouter()
  const { profile } = useAuthSelectors()
  const canFinance = canCompleteEntryPricingReview(profile?.role)
  const canApplyDosificadorSync = canSyncDosificadorStock(profile?.role)
  /** Dosificador: movimientos y existencias, sin montos (MXN). */
  const hideMoney = profile?.role === 'DOSIFICADOR'

  const [tab, setTab] = useState<'movements' | 'consumos' | 'mismatch' | 'variances'>('movements')
  const [sinceCutover, setSinceCutover] = useState(false)
  const [startDate, setStartDate] = useState('2026-04-01')
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))

  const [activeMaterial, setActiveMaterial] = useState<{ id: string; name: string } | null>(null)

  const [ledger, setLedger] = useState<MaterialLedgerResponse | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)

  const [variances, setVariances] = useState<MaterialLedgerVarianceRow[]>([])
  const [variancesLoading, setVariancesLoading] = useState(false)

  const [syncAnalysis, setSyncAnalysis] = useState<DosificadorSyncAnalysis | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncApplying, setSyncApplying] = useState(false)
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false)
  const [syncSelectedIds, setSyncSelectedIds] = useState<Set<string>>(new Set())

  const [pricingEntry, setPricingEntry] = useState<MaterialEntry | null>(null)
  const [pricingLoading, setPricingLoading] = useState(false)
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)

  const ledgerFetchGenRef = useRef(0)

  useLayoutEffect(() => {
    if (!open) return
    setActiveMaterial(seedMaterial)
    setTab(startOnVariancesTab && !seedMaterial ? 'variances' : 'movements')
    setSinceCutover(false)
    setStartDate('2026-04-01')
    setEndDate(new Date().toISOString().slice(0, 10))
  }, [open, seedMaterial, startOnVariancesTab])

  const loadVariances = useCallback(async () => {
    if (!plantId) return
    setVariancesLoading(true)
    try {
      const params = new URLSearchParams({
        plant_id: plantId,
        start_date: startDate,
        end_date: endDate,
      })
      const res = await fetch(`/api/inventory/material-ledger/variances?${params}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudieron cargar las varianzas')
      }
      setVariances(json.variances ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de varianzas')
      setVariances([])
    } finally {
      setVariancesLoading(false)
    }
  }, [plantId, startDate, endDate])

  useEffect(() => {
    if (open && tab === 'variances') void loadVariances()
  }, [open, tab, loadVariances])

  const syncQueryParams = useCallback(() => {
    const params = new URLSearchParams({
      plant_id: plantId,
      start_date: startDate,
      end_date: endDate,
    })
    return params
  }, [plantId, startDate, endDate])

  const loadSyncAnalysis = useCallback(async () => {
    if (!plantId) return
    setSyncLoading(true)
    try {
      const res = await fetch(`/api/inventory/sync-dosificador?${syncQueryParams()}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo analizar la alineación')
      }
      const analysis = json as DosificadorSyncAnalysis & {
        can_apply?: boolean
        success: boolean
      }
      setSyncAnalysis({
        plant_id: analysis.plant_id,
        date_range: analysis.date_range,
        items: analysis.items ?? [],
        skipped: analysis.skipped ?? [],
        already_aligned_count: analysis.already_aligned_count ?? 0,
      })
      setSyncSelectedIds(new Set((analysis.items ?? []).map((i) => i.material_id)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al analizar')
      setSyncAnalysis(null)
      setSyncSelectedIds(new Set())
    } finally {
      setSyncLoading(false)
    }
  }, [plantId, syncQueryParams])

  const loadLedger = useCallback(async () => {
    if (!plantId || !activeMaterial?.id) {
      setLedger(null)
      return
    }
    const materialIdRequested = activeMaterial.id
    const gen = ++ledgerFetchGenRef.current
    setLedger(null)
    setLedgerError(null)
    setLedgerLoading(true)
    try {
      const params = new URLSearchParams({
        plant_id: plantId,
        material_id: activeMaterial.id,
      })
      if (sinceCutover) {
        params.set('since_cutover', 'true')
      } else {
        params.set('start_date', startDate)
        params.set('end_date', endDate)
      }
      const res = await fetch(`/api/inventory/material-ledger?${params}`)
      const json = (await res.json()) as MaterialLedgerResponse & { error?: string; success?: boolean }
      if (gen !== ledgerFetchGenRef.current) return
      if (!res.ok || json.success !== true) {
        throw new Error(json.error || 'No se pudo cargar el libro mayor')
      }
      if (json.material?.id !== materialIdRequested) return
      setLedger(json)
    } catch (e) {
      if (gen !== ledgerFetchGenRef.current) return
      setLedgerError(e instanceof Error ? e.message : 'Error')
      setLedger(null)
    } finally {
      if (gen === ledgerFetchGenRef.current) setLedgerLoading(false)
    }
  }, [plantId, activeMaterial?.id, sinceCutover, startDate, endDate])

  useEffect(() => {
    if (open && activeMaterial?.id) void loadLedger()
  }, [open, activeMaterial?.id, loadLedger])

  const applySync = useCallback(
    async (materialIds?: string[]) => {
      if (!plantId) return
      setSyncApplying(true)
      try {
        const res = await fetch(`/api/inventory/sync-dosificador?${syncQueryParams()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plant_id: plantId,
            start_date: startDate,
            end_date: endDate,
            material_ids: materialIds,
            items: syncAnalysis?.items,
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'No se pudo aplicar la alineación')
        }
        const updated = (json.updated ?? []) as DosificadorSyncAnalysis['items']
        const failed = (json.failed ?? []) as Array<{ material_name: string; error: string }>
        if (updated.length > 0) {
          toast.success(`Stock alineado en ${updated.length} material(es)`)
        }
        if (failed.length > 0) {
          toast.error(`Falló en ${failed.length}: ${failed[0]?.material_name}`)
        }
        await Promise.all([loadVariances(), loadSyncAnalysis(), loadLedger()])
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al aplicar')
      } finally {
        setSyncApplying(false)
        setSyncConfirmOpen(false)
      }
    },
    [
      plantId,
      startDate,
      endDate,
      syncQueryParams,
      syncAnalysis?.items,
      loadVariances,
      loadSyncAnalysis,
      loadLedger,
    ],
  )

  const alignActiveMaterialToTheoretical = useCallback(async () => {
    if (!activeMaterial?.id) return
    await applySync([activeMaterial.id])
  }, [activeMaterial?.id, applySync])

  /** Never show previous material’s ledger while another is selected or loading. */
  useLayoutEffect(() => {
    if (!open) return
    setLedger(null)
    setLedgerError(null)
  }, [open, activeMaterial?.id])

  const ledgerForView = useMemo(() => {
    if (!ledger || !activeMaterial?.id) return null
    if (ledger.material.id !== activeMaterial.id) return null
    return ledger
  }, [ledger, activeMaterial?.id])

  const mismatchRows = useMemo(() => {
    if (!ledgerForView) return []
    return ledgerForView.entry_rows.filter(
      (r) => r.pricing_status === 'pending' || !r.ap_amount_matches_total_cost
    )
  }, [ledgerForView])

  const reconciliation = ledgerForView?.reconciliation

  const fetchEntryForPricing = async (entryId: string) => {
    setPricingLoading(true)
    try {
      const params = new URLSearchParams({
        entry_id: entryId,
        plant_id: plantId,
        include: 'document_counts',
      })
      const res = await fetch(`/api/inventory/entries?${params}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo cargar la entrada')
      }
      const row = json.entries?.[0]
      if (!row) throw new Error('Entrada no encontrada')
      setPricingEntry(row as MaterialEntry)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setPricingLoading(false)
    }
  }

  const postResyncAccounting = async (entryId: string) => {
    try {
      const res = await fetch(`/api/inventory/entries/${entryId}/resync-accounting`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Resincronización fallida')
      }
      toast.success('Contabilidad resincronizada')
      if (json.warnings?.length) {
        for (const w of json.warnings) toast.message(w)
      }
      void loadLedger()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  const putExcludeFifo = async (entryId: string, excluded: boolean) => {
    try {
      const res = await fetch('/api/inventory/entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId, excluded_from_fifo: excluded }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No se pudo actualizar')
      }
      toast.success(excluded ? 'Marcado excluido de FIFO' : 'Incluido en FIFO de nuevo')
      void loadLedger()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  const renderMovementActions = (movement: InventoryMovement) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => {
              if (!activeMaterial?.id) {
                toast.error('Seleccione un material primero (p. ej. desde la tabla de inventario o varianzas).')
                return
              }
              setAdjustmentOpen(true)
            }}
          >
            Crear ajuste
          </DropdownMenuItem>
          {movement.movement_type === 'REMISION' && (
            <DropdownMenuItem
              onSelect={() => {
                const href = `/production-control/remisiones?fecha=${encodeURIComponent(movementDateToFechaParam(movement.movement_date))}`
                onOpenChange(false)
                window.setTimeout(() => {
                  router.push(href)
                }, 200)
              }}
            >
              Ver remisiones <ExternalLink className="inline h-3 w-3 ml-1" />
            </DropdownMenuItem>
          )}
          {canFinance && movement.entry_id && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pricingLoading}
                onClick={() => void fetchEntryForPricing(movement.entry_id!)}
              >
                Editar entrada / precios
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void postResyncAccounting(movement.entry_id!)}>
                <RefreshCw className="h-3.5 w-3.5 mr-2 inline" />
                Resincronizar contabilidad
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void putExcludeFifo(movement.entry_id!, true)
                }}
              >
                Excluir de FIFO
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              const payload =
                hideMoney
                  ? Object.fromEntries(
                      Object.entries(movement).filter(
                        ([k]) =>
                          !['unit_price_mxn', 'total_cost_mxn', 'landed_unit_price_mxn'].includes(k)
                      )
                    )
                  : movement
              void navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
              toast.message('Movimiento copiado al portapapeles')
            }}
          >
            <ClipboardCopy className="h-3.5 w-3.5 mr-2 inline" />
            Copiar JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const flow = ledgerForView?.flow

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-4xl overflow-y-auto border-stone-200 bg-[#faf9f7]"
        >
          <SheetHeader className="text-left space-y-1 pr-8">
            <SheetTitle className="text-stone-900">Auditoría de material</SheetTitle>
            <SheetDescription>
              Conciliación dosificador · contabilidad · FIFO. Rango acotado (90 días salvo “desde
              cutover”).
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {!activeMaterial && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 flex gap-2 items-start">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Elija un material en la pestaña <strong>Materiales con varianza</strong> o cierre y
                  abra desde una fila del inventario.
                </span>
              </div>
            )}

            {activeMaterial && (
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold text-stone-900">{activeMaterial.name}</p>
                  <p className="text-xs font-mono text-stone-500">{activeMaterial.id}</p>
                </div>
                <Badge variant="outline" className="border-stone-300">
                  Planta actual en consulta
                </Badge>
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2">
                <Switch
                  id="since-cutover"
                  checked={sinceCutover}
                  onCheckedChange={(v) => setSinceCutover(Boolean(v))}
                  disabled={!activeMaterial}
                />
                <Label htmlFor="since-cutover" className="text-sm cursor-pointer">
                  Desde conteo inicial (sin tope 90 días)
                </Label>
              </div>
              {!sinceCutover && (
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-stone-500">Desde</Label>
                  <input
                    type="date"
                    className="rounded border border-stone-300 px-2 py-1 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Label className="text-xs text-stone-500">Hasta</Label>
                  <input
                    type="date"
                    className="rounded border border-stone-300 px-2 py-1 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-stone-300"
                    disabled={!activeMaterial}
                    onClick={() => void loadLedger()}
                  >
                    Aplicar fechas
                  </Button>
                </div>
              )}
            </div>

            {ledgerForView?.opening && (
              <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
                  Línea base (cutover)
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-stone-500">Fecha conteo inicial:</span>{' '}
                    <span className="font-medium">{ledgerForView.opening.cutover_date ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">
                      Cantidad conteo inicial ({ledgerForView.material.unit_of_measure?.trim() || 'u'}):
                    </span>{' '}
                    <span className="font-mono">{fmtKg(ledgerForView.opening.initial_count_qty_kg ?? 0)}</span>
                  </div>
                  <div>
                    <span className="text-stone-500">Capa FIFO apertura:</span>{' '}
                    <span className="font-mono text-xs">{ledgerForView.opening.opening_fifo_entry_id ?? '—'}</span>
                  </div>
                  {!hideMoney && (
                    <div>
                      <span className="text-stone-500">Precio unitario apertura:</span>{' '}
                      <span className="font-mono">
                        {ledgerForView.opening.opening_unit_price != null
                          ? fmtMx(ledgerForView.opening.opening_unit_price)
                          : '—'}
                      </span>
                    </div>
                  )}
                </div>
                {ledgerForView.opening.initial_count_adjustment_id && (
                  <Button variant="ghost" className="h-auto px-0 pt-2 text-sky-800 underline-offset-2 hover:underline" asChild>
                    <Link href="/production-control/adjustments">Ver ajustes en planta</Link>
                  </Button>
                )}
              </div>
            )}

            {ledgerLoading && activeMaterial && (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            )}
            {ledgerError && activeMaterial && <p className="text-sm text-red-700">{ledgerError}</p>}

            {reconciliation && activeMaterial && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-stone-500">Dosificador</p>
                  <p className="text-2xl font-mono font-semibold">{fmtKg(reconciliation.dosificador_stock_kg)} kg</p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Stock actual en <code className="text-[10px]">material_inventory</code>
                  </p>
                  {deltaBadge(reconciliation.deltas.stock_vs_theoretical)}
                  {flow && (
                    <p className="text-[11px] text-stone-600 mt-2">
                      Teórico final período: {fmtKg(flow.theoretical_final_stock)} · Varianza flujo:{' '}
                      {fmtKg(Number(flow.variance))}
                    </p>
                  )}
                  {canApplyDosificadorSync &&
                    reconciliation.deltas.stock_vs_theoretical != null &&
                    Math.abs(reconciliation.deltas.stock_vs_theoretical) > EPS && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        disabled={syncApplying}
                        onClick={() => void alignActiveMaterialToTheoretical()}
                      >
                        {syncApplying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Wrench className="h-3.5 w-3.5 mr-1" />
                        )}
                        Alinear stock a aritmética
                      </Button>
                    )}
                </div>
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-stone-500">Contabilidad / entradas período</p>
                  <p className="text-lg font-mono">{fmtKg(reconciliation.accounting_received_kg)} kg</p>
                  {!hideMoney && (
                    <>
                      <p className="text-sm text-stone-700">
                        {fmtMx(reconciliation.accounting_total_mxn)} en CXP (material)
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        Pendientes precio: {reconciliation.pending_pricing_entries}
                      </p>
                    </>
                  )}
                  {hideMoney && (
                    <p className="text-[11px] text-stone-500 mt-1">Importes (MXN) no disponibles para su rol.</p>
                  )}
                  {deltaBadge(reconciliation.deltas.accounting_kg_vs_dosificador)}
                </div>
                <div className="rounded-lg border border-stone-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase text-stone-500">FIFO restante</p>
                  <p className="text-2xl font-mono font-semibold">{fmtKg(reconciliation.fifo_remaining_kg)} kg</p>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Excluidos FIFO: {reconciliation.fifo_excluded_count} · Asignaciones:{' '}
                    {reconciliation.fifo_allocation_rows}
                  </p>
                  {deltaBadge(reconciliation.deltas.stock_vs_fifo)}
                </div>
              </div>
            )}

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="bg-stone-100/80">
                <TabsTrigger value="movements" disabled={!activeMaterial}>
                  Movimientos
                </TabsTrigger>
                <TabsTrigger value="consumos" disabled={!activeMaterial}>
                  Consumos
                </TabsTrigger>
                <TabsTrigger value="mismatch" disabled={!activeMaterial}>
                  Entradas con desfase
                </TabsTrigger>
                <TabsTrigger value="variances">Materiales con varianza</TabsTrigger>
              </TabsList>

              <TabsContent value="movements" className="mt-3 space-y-3">
                {ledgerForView?.movements && activeMaterial && (
                  <InventoryMovementsTable
                    movements={ledgerForView.movements}
                    singleMaterial
                    ledgerMode={!hideMoney}
                    renderRowActions={(m) => renderMovementActions(m)}
                  />
                )}
              </TabsContent>

              <TabsContent value="consumos" className="mt-3">
                {ledgerLoading && activeMaterial ? (
                  <Skeleton className="h-40 w-full" />
                ) : !ledgerForView ? (
                  <p className="text-sm text-stone-500">Cargue un material primero.</p>
                ) : ledgerForView.consumption_details.length === 0 ? (
                  <p className="text-sm text-stone-600">Sin consumos por remisión en este rango.</p>
                ) : (
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-white max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Remisión</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Teórica</TableHead>
                          <TableHead className="text-right">Real</TableHead>
                          <TableHead className="text-right">Δ (real−teórica)</TableHead>
                          {!hideMoney && (
                            <>
                              <TableHead className="text-right">Costo unit.</TableHead>
                              <TableHead className="text-right">Costo FIFO</TableHead>
                            </>
                          )}
                          <TableHead className="w-[52px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerForView.consumption_details.map((c, i) => (
                          <TableRow key={`${c.remision_number}-${i}`}>
                            <TableCell className="font-mono text-xs">{c.remision_number}</TableCell>
                            <TableCell>{c.remision_date}</TableCell>
                            <TableCell className="text-right font-mono">{fmtKg(c.cantidad_teorica)}</TableCell>
                            <TableCell className="text-right font-mono">{fmtKg(c.cantidad_real)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{deltaBadge(c.variance)}</TableCell>
                            {!hideMoney && (
                              <>
                                <TableCell className="text-right font-mono">
                                  {c.unit_cost_weighted != null ? fmtMx(c.unit_cost_weighted) : '—'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {c.total_cost_fifo != null ? fmtMx(c.total_cost_fifo) : '—'}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                aria-label="Ver remisiones"
                                onClick={() => {
                                  const href = `/production-control/remisiones?fecha=${encodeURIComponent(movementDateToFechaParam(c.remision_date))}`
                                  onOpenChange(false)
                                  window.setTimeout(() => router.push(href), 200)
                                }}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex flex-wrap justify-end gap-4 border-t border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                      <span>
                        Teórica total:{' '}
                        <span className="font-mono">
                          {fmtKg(ledgerForView.consumption_details.reduce((s, c) => s + c.cantidad_teorica, 0))}
                        </span>
                      </span>
                      <span>
                        Real total:{' '}
                        <span className="font-mono">
                          {fmtKg(ledgerForView.consumption_details.reduce((s, c) => s + c.cantidad_real, 0))}
                        </span>
                      </span>
                      <span>{ledgerForView.consumption_details.length} remisiones</span>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="mismatch" className="mt-3">
                {ledgerLoading && activeMaterial ? (
                  <Skeleton className="h-40 w-full" />
                ) : !ledgerForView ? (
                  <p className="text-sm text-stone-500">Cargue un material primero.</p>
                ) : mismatchRows.length === 0 ? (
                  <p className="text-sm text-emerald-800">Sin entradas con desfase en este rango.</p>
                ) : (
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Entrada</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead className="text-right">Kg</TableHead>
                          {!hideMoney && (
                            <>
                              <TableHead className="text-right">Total MXN</TableHead>
                              <TableHead>Estado</TableHead>
                              <TableHead>AP vs total</TableHead>
                            </>
                          )}
                          <TableHead className="w-[120px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mismatchRows.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs">{r.entry_number}</TableCell>
                            <TableCell>{r.entry_date}</TableCell>
                            <TableCell className="text-right font-mono">
                              {fmtKg(
                                r.received_uom === 'l'
                                  ? Number(r.received_qty_entered ?? r.quantity_received ?? 0)
                                  : Number(r.received_qty_kg ?? r.quantity_received ?? 0)
                              )}
                            </TableCell>
                            {!hideMoney && (
                              <>
                                <TableCell className="text-right font-mono">
                                  {r.total_cost != null ? fmtMx(r.total_cost) : '—'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={r.pricing_status === 'pending' ? 'destructive' : 'outline'}>
                                    {r.pricing_status ?? '—'}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {r.ap_amount_matches_total_cost ? (
                                    <span className="text-emerald-700 text-sm">OK</span>
                                  ) : (
                                    <span className="text-amber-800 text-sm">Revisar</span>
                                  )}
                                </TableCell>
                              </>
                            )}
                            <TableCell className="text-right">
                              {canFinance && (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => void fetchEntryForPricing(r.id)}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs"
                                    onClick={() => void postResyncAccounting(r.id)}
                                  >
                                    Resincronizar
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="variances" className="mt-3 space-y-3">
                <div className="flex flex-wrap gap-2 items-center text-xs text-stone-600">
                  <span>Rango (máx. 90 días):</span>
                  <input
                    type="date"
                    className="rounded border border-stone-300 px-2 py-1"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span>—</span>
                  <input
                    type="date"
                    className="rounded border border-stone-300 px-2 py-1"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadVariances()}
                    disabled={variancesLoading}
                  >
                    {variancesLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Actualizar'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={syncLoading || !plantId}
                    onClick={() => void loadSyncAnalysis()}
                  >
                    {syncLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Wrench className="h-4 w-4 mr-1" />
                    )}
                    Analizar alineación
                  </Button>
                </div>
                {syncAnalysis && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2 text-xs text-stone-700">
                    <p>
                      <strong>{syncAnalysis.items.length}</strong> material(es) con stock dosificador distinto
                      del objetivo · <strong>{syncAnalysis.already_aligned_count}</strong> ya alineados
                      {syncAnalysis.skipped.length > 0 && (
                        <>
                          {' '}
                          · <strong>{syncAnalysis.skipped.length}</strong> omitidos (sin baseline)
                        </>
                      )}
                    </p>
                    <p className="text-[11px] text-stone-600">
                      Actualiza <code className="text-[10px]">material_inventory</code> directamente (sin
                      ajuste contable). Objetivo: saldo reconciliado post-corte o, si no hay apertura, teórico
                      aritmético del rango.
                    </p>
                    {syncAnalysis.items.length > 0 && (
                      <div className="border border-stone-200 rounded-md bg-white max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {canApplyDosificadorSync && <TableHead className="w-8" />}
                              <TableHead>Material</TableHead>
                              <TableHead className="text-right">Actual</TableHead>
                              <TableHead className="text-right">Objetivo</TableHead>
                              <TableHead className="text-right">Δ</TableHead>
                              <TableHead>Fuente</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {syncAnalysis.items.map((item) => (
                              <TableRow key={item.material_id}>
                                {canApplyDosificadorSync && (
                                  <TableCell>
                                    <Checkbox
                                      checked={syncSelectedIds.has(item.material_id)}
                                      onCheckedChange={(checked) => {
                                        setSyncSelectedIds((prev) => {
                                          const next = new Set(prev)
                                          if (checked) next.add(item.material_id)
                                          else next.delete(item.material_id)
                                          return next
                                        })
                                      }}
                                      aria-label={`Seleccionar ${item.material_name}`}
                                    />
                                  </TableCell>
                                )}
                                <TableCell className="font-medium">{item.material_name}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {fmtKg(item.live_stock_kg)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {fmtKg(item.target_stock_kg)}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {item.delta_kg >= 0 ? '+' : ''}
                                  {fmtKg(item.delta_kg)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px]">
                                    {item.target_source === 'reconciled' ? 'Reconciliado' : 'Teórico'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                    {canApplyDosificadorSync && syncAnalysis.items.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={syncApplying || syncSelectedIds.size === 0}
                        onClick={() => setSyncConfirmOpen(true)}
                      >
                        {syncApplying ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : null}
                        Aplicar alineación ({syncSelectedIds.size})
                      </Button>
                    )}
                    {!canApplyDosificadorSync && syncAnalysis.items.length > 0 && (
                      <p className="text-[11px] text-amber-900">
                        Solo gerencia de planta u operaciones puede aplicar cambios.
                      </p>
                    )}
                  </div>
                )}
                {variancesLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : variances.length === 0 ? (
                  <p className="text-sm text-stone-600">No hay materiales fuera de tolerancia en este rango.</p>
                ) : (
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-white max-h-[360px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                          <TableHead className="text-right">Teórico</TableHead>
                          <TableHead className="text-right">Δ stock/teórico</TableHead>
                          <TableHead className="text-right">Δ FIFO</TableHead>
                          {!hideMoney && (
                            <TableHead className="text-right">Pend. precio</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variances.map((v) => (
                          <TableRow
                            key={v.material_id}
                            className="cursor-pointer hover:bg-stone-50"
                            onClick={() => {
                              setActiveMaterial({ id: v.material_id, name: v.material_name })
                              setTab('movements')
                            }}
                          >
                            <TableCell className="font-medium">{v.material_name}</TableCell>
                            <TableCell className="text-right font-mono">{fmtKg(v.dosificador_stock_kg)}</TableCell>
                            <TableCell className="text-right font-mono">
                              {v.theoretical_final_kg != null ? fmtKg(v.theoretical_final_kg) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {v.stock_vs_theoretical != null ? fmtKg(v.stock_vs_theoretical) : '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">
                              {v.fifo_vs_stock != null ? fmtKg(v.fifo_vs_stock) : '—'}
                            </TableCell>
                            {!hideMoney && (
                              <TableCell className="text-right">{v.pending_pricing_count}</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!pricingEntry} onOpenChange={(o) => !o && setPricingEntry(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Entrada — revisión</SheetTitle>
            <SheetDescription>Precios, facturas y vínculo a OC.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {pricingEntry && (
              <EntryPricingForm
                key={pricingEntry.id}
                entry={pricingEntry}
                onCancel={() => setPricingEntry(null)}
                onSuccess={() => {
                  setPricingEntry(null)
                  void loadLedger()
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Nuevo ajuste de inventario</SheetTitle>
            <SheetDescription>Registra corrección o conteo para este material.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {adjustmentOpen && activeMaterial?.id ? (
              <MaterialAdjustmentForm
                initialData={{
                  material_id: activeMaterial.id,
                  adjustment_date: new Date().toISOString().slice(0, 10),
                }}
                onCancel={() => setAdjustmentOpen(false)}
                onSuccess={() => {
                  setAdjustmentOpen(false)
                  toast.success('Ajuste registrado')
                  void loadLedger()
                  void loadVariances()
                }}
              />
            ) : (
              <p className="text-sm text-stone-500">Seleccione un material en la auditoría para prefijar el ajuste.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={syncConfirmOpen} onOpenChange={setSyncConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alinear stock dosificador</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará <code>material_inventory.current_stock</code> en{' '}
              {syncSelectedIds.size} material(es) para igualar el saldo reconciliado o teórico del rango (
              {startDate} — {endDate}). No se crearán filas de ajuste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncApplying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={syncApplying}
              onClick={(e) => {
                e.preventDefault()
                void applySync([...syncSelectedIds])
              }}
            >
              {syncApplying ? 'Aplicando…' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
