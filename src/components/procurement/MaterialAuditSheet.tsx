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
import { cn } from '@/lib/utils'
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

  const [tab, setTab] = useState<'movements' | 'mismatch' | 'variances'>('movements')
  const [sinceCutover, setSinceCutover] = useState(false)
  const [startDate, setStartDate] = useState('2026-04-01')
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))

  const [activeMaterial, setActiveMaterial] = useState<{ id: string; name: string } | null>(null)

  const [ledger, setLedger] = useState<MaterialLedgerResponse | null>(null)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerError, setLedgerError] = useState<string | null>(null)

  const [variances, setVariances] = useState<MaterialLedgerVarianceRow[]>([])
  const [variancesLoading, setVariancesLoading] = useState(false)

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
      const rows = (json.variances ?? []) as MaterialLedgerVarianceRow[]
      setVariances(rows)
      const alignableIds = rows
        .filter(
          (v) =>
            v.theoretical_final_kg != null &&
            v.stock_vs_theoretical != null &&
            Math.abs(v.stock_vs_theoretical) > EPS,
        )
        .map((v) => v.material_id)
      setSyncSelectedIds(new Set(alignableIds))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error de varianzas')
      setVariances([])
      setSyncSelectedIds(new Set())
    } finally {
      setVariancesLoading(false)
    }
  }, [plantId, startDate, endDate])

  useEffect(() => {
    if (open && tab === 'variances') void loadVariances()
  }, [open, tab, loadVariances])

  const effectiveLedgerRange = useMemo(() => {
    if (
      ledger &&
      activeMaterial?.id &&
      ledger.material.id === activeMaterial.id &&
      ledger.date_range
    ) {
      return {
        start: ledger.date_range.start,
        end: ledger.date_range.end,
      }
    }
    return { start: startDate, end: endDate }
  }, [ledger, activeMaterial?.id, startDate, endDate])

  const syncQueryParams = useCallback(
    (range?: { start: string; end: string }) => {
      const r = range ?? effectiveLedgerRange
      const params = new URLSearchParams({
        plant_id: plantId,
        start_date: r.start,
        end_date: r.end,
      })
      return params
    },
    [plantId, effectiveLedgerRange],
  )

  const loadLedger = useCallback(async () => {
    if (!plantId || !activeMaterial?.id) {
      setLedger(null)
      return
    }
    const materialIdRequested = activeMaterial.id
    const gen = ++ledgerFetchGenRef.current
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
    async (
      materialIds?: string[],
      opts?: {
        explicitTargets?: Array<{
          material_id: string
          target_stock_kg: number
          material_name?: string
        }>
        dateRange?: { start: string; end: string }
      },
    ) => {
      if (!plantId) return
      const range = opts?.dateRange ?? effectiveLedgerRange
      setSyncApplying(true)
      const pendingToast = toast.loading('Alineando inventario vivo al teórico…')
      try {
        const res = await fetch(`/api/inventory/sync-dosificador?${syncQueryParams(range)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plant_id: plantId,
            start_date: range.start,
            end_date: range.end,
            material_ids: materialIds,
            explicit_targets: opts?.explicitTargets,
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || 'No se pudo aplicar la alineación')
        }
        const updated = (json.updated ?? []) as DosificadorSyncAnalysis['items']
        const failed = (json.failed ?? []) as Array<{ material_name: string; error: string }>
        toast.dismiss(pendingToast)
        if (updated.length > 0) {
          const row = updated[0]
          toast.success(
            row
              ? `Inventario vivo: ${fmtKg(row.live_stock_kg)} → ${fmtKg(row.target_stock_kg)} kg`
              : `Inventario vivo actualizado en ${updated.length} material(es)`,
          )
        } else if (failed.length === 0) {
          toast.message('Sin cambios: el servidor no detectó diferencia aplicable.')
        }
        if (failed.length > 0) {
          toast.error(`Falló en ${failed.length}: ${failed[0]?.material_name} — ${failed[0]?.error}`)
        }
        await Promise.all([loadVariances(), loadLedger()])
      } catch (e) {
        toast.dismiss(pendingToast)
        toast.error(e instanceof Error ? e.message : 'Error al aplicar')
      } finally {
        setSyncApplying(false)
        setSyncConfirmOpen(false)
      }
    },
    [plantId, effectiveLedgerRange, syncQueryParams, loadVariances, loadLedger],
  )

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

  const alignActiveMaterialToTheoretical = useCallback(async () => {
    if (!activeMaterial?.id || !ledgerForView) return
    const target =
      ledgerForView.flow?.theoretical_final_stock ?? ledgerForView.reconciliation.theoretical_final_kg
    const live = ledgerForView.reconciliation.dosificador_stock_kg
    if (!Number.isFinite(target)) {
      toast.error('No hay saldo teórico aritmético para este material en el rango.')
      return
    }
    if (Math.abs(target - live) <= EPS) {
      toast.message('El inventario vivo ya coincide con el teórico aritmético del periodo.')
      return
    }
    await applySync([activeMaterial.id], {
      dateRange: {
        start: ledgerForView.date_range.start,
        end: ledgerForView.date_range.end,
      },
      explicitTargets: [
        {
          material_id: activeMaterial.id,
          material_name: activeMaterial.name,
          target_stock_kg: target,
        },
      ],
    })
  }, [activeMaterial, ledgerForView, applySync])

  const alignableVariances = useMemo(
    () =>
      variances.filter(
        (v) =>
          v.theoretical_final_kg != null &&
          v.stock_vs_theoretical != null &&
          Math.abs(v.stock_vs_theoretical) > EPS,
      ),
    [variances],
  )

  const toggleAllAlignable = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSyncSelectedIds(new Set(alignableVariances.map((v) => v.material_id)))
      } else {
        setSyncSelectedIds(new Set())
      }
    },
    [alignableVariances],
  )

  const applyBulkAlignment = useCallback(async () => {
    const selected = alignableVariances.filter((v) => syncSelectedIds.has(v.material_id))
    if (selected.length === 0) {
      toast.error('Seleccione al menos un material con varianza aritmética (vivo ≠ teórico).')
      return
    }
    await applySync(
      selected.map((v) => v.material_id),
      {
        dateRange: { start: startDate, end: endDate },
        explicitTargets: selected.map((v) => ({
          material_id: v.material_id,
          material_name: v.material_name,
          target_stock_kg: v.theoretical_final_kg!,
        })),
      },
    )
  }, [alignableVariances, syncSelectedIds, applySync, startDate, endDate])

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
  const theoreticalKg =
    flow?.theoretical_final_stock ?? reconciliation?.theoretical_final_kg ?? null
  const liveKg = reconciliation?.dosificador_stock_kg ?? null
  const varianceKg = reconciliation?.deltas.stock_vs_theoretical ?? null
  const varianceIsBad = varianceKg != null && Math.abs(varianceKg) > EPS

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
              Comprueba que el inventario vivo en planta coincida con el saldo teórico aritmético del
              periodo (apertura, entradas, consumos, ajustes). Rango acotado a 90 días salvo “desde
              conteo inicial”.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {!activeMaterial && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 flex gap-2 items-start">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Elija un material en la pestaña <strong>Alineación masiva</strong> o cierre y
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
              <div className="space-y-3">
                <div
                  className={cn(
                    'rounded-lg border bg-white p-4',
                    varianceIsBad ? 'border-amber-300 bg-amber-50/40' : 'border-stone-200',
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                    Conciliación aritmética
                  </p>
                  <p className="text-[11px] text-stone-600 mt-1 mb-3">
                    El inventario vivo debe igualar el saldo teórico calculado por movimientos en el
                    rango (no es el rol dosificador ni un reporte de compras).
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-stone-500">Inventario vivo</p>
                      <p className="text-2xl font-mono font-semibold text-stone-900">
                        {liveKg != null ? `${fmtKg(liveKg)} kg` : '—'}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        Stock operativo en planta (<code className="text-[10px]">material_inventory</code>
                        )
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-stone-500">Teórico aritmético (fin de periodo)</p>
                      <p className="text-2xl font-mono font-semibold text-stone-900">
                        {theoreticalKg != null ? `${fmtKg(theoreticalKg)} kg` : '—'}
                      </p>
                      <p className="text-[11px] text-stone-500 mt-1">
                        Apertura + entradas + ajustes − consumos − desperdicio
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200/80 pt-3">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-stone-600">Varianza (vivo − teórico):</span>
                      {deltaBadge(varianceKg)}
                      {!varianceIsBad && varianceKg != null && (
                        <span className="text-[11px] text-emerald-800">Coincide</span>
                      )}
                    </div>
                    {canApplyDosificadorSync && varianceIsBad && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-amber-400 bg-white"
                        disabled={syncApplying}
                        onClick={() => void alignActiveMaterialToTheoretical()}
                      >
                        {syncApplying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Wrench className="h-3.5 w-3.5 mr-1" />
                        )}
                        Alinear inventario vivo al teórico
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-stone-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-stone-500">Capas FIFO restantes</p>
                    <p className="text-2xl font-mono font-semibold">{fmtKg(reconciliation.fifo_remaining_kg)} kg</p>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Suma de <code className="text-[10px]">remaining_quantity_kg</code> en entradas
                      activas para costeo.
                    </p>
                    <p className="text-[11px] text-stone-500">
                      Excluidos FIFO: {reconciliation.fifo_excluded_count} · Asignaciones a consumo:{' '}
                      {reconciliation.fifo_allocation_rows}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <span className="text-stone-600">Vivo − FIFO:</span>
                      {deltaBadge(reconciliation.deltas.stock_vs_fifo)}
                    </div>
                  </div>

                  <div className="rounded-lg border border-stone-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-stone-500">
                      Recepciones del período (compras)
                    </p>
                    <p className="text-lg font-mono font-semibold">
                      {fmtKg(reconciliation.accounting_received_kg)} kg
                    </p>
                    <p className="text-[11px] text-stone-600 mt-1 leading-relaxed">
                      Suma de kg en <strong>entradas de material</strong> registradas entre las fechas del
                      rango. Es volumen recibido en el periodo,{' '}
                      <strong>no es saldo de inventario</strong> ni debe compararse con el inventario vivo.
                    </p>
                    {!hideMoney && (
                      <>
                        <p className="text-sm text-stone-700 mt-2">
                          {fmtMx(reconciliation.accounting_total_mxn)} ligados a CXP (partida material)
                        </p>
                        <p className="text-[11px] text-stone-500">
                          Entradas sin precio revisado: {reconciliation.pending_pricing_entries}
                        </p>
                      </>
                    )}
                    {hideMoney && (
                      <p className="text-[11px] text-stone-500 mt-2">
                        Montos (MXN) y CXP no se muestran para su rol.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="bg-stone-100/80">
                <TabsTrigger value="movements" disabled={!activeMaterial}>
                  Movimientos
                </TabsTrigger>
                <TabsTrigger value="mismatch" disabled={!activeMaterial}>
                  Entradas con desfase
                </TabsTrigger>
                <TabsTrigger value="variances">Alineación masiva</TabsTrigger>
              </TabsList>

              <TabsContent value="movements" className="mt-3 space-y-3">
                {ledgerLoading && activeMaterial && !ledgerForView && (
                  <Skeleton className="h-40 w-full" />
                )}
                {ledgerForView && activeMaterial && (
                  <InventoryMovementsTable
                    movements={ledgerForView.movements ?? []}
                    singleMaterial
                    ledgerMode={!hideMoney}
                    consumptionDetails={ledgerForView.consumption_details ?? []}
                    hideConsumptionMoney={hideMoney}
                    resetFiltersKey={`${activeMaterial.id}:${ledgerForView.date_range.start}:${ledgerForView.date_range.end}`}
                    onConsumptionNavigate={(remisionDate) => {
                      const href = `/production-control/remisiones?fecha=${encodeURIComponent(movementDateToFechaParam(remisionDate))}`
                      onOpenChange(false)
                      window.setTimeout(() => router.push(href), 200)
                    }}
                    renderRowActions={(m) => renderMovementActions(m)}
                  />
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
                <div className="rounded-lg border border-stone-200 bg-white p-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                      Alineación masiva
                    </p>
                    <p className="text-[11px] text-stone-600 mt-1">
                      Misma aritmética que la conciliación por material: inventario vivo vs teórico del
                      periodo. Seleccione filas con Δ vivo/teórico y aplique en lote (sin crear ajustes).
                    </p>
                  </div>
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
                    {canApplyDosificadorSync && alignableVariances.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={syncApplying || syncSelectedIds.size === 0}
                        onClick={() => setSyncConfirmOpen(true)}
                      >
                        {syncApplying ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Wrench className="h-4 w-4 mr-1" />
                        )}
                        Alinear seleccionados ({syncSelectedIds.size})
                      </Button>
                    )}
                  </div>
                  {!canApplyDosificadorSync && alignableVariances.length > 0 && (
                    <p className="text-[11px] text-amber-900">
                      Solo gerencia de planta u operaciones puede aplicar alineación masiva.
                    </p>
                  )}
                  {alignableVariances.length > 0 && (
                    <p className="text-xs text-stone-700">
                      <strong>{alignableVariances.length}</strong> material(es) con inventario vivo ≠ teórico
                      aritmético en este rango.
                    </p>
                  )}
                </div>
                {variancesLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : variances.length === 0 ? (
                  <p className="text-sm text-stone-600">
                    No hay materiales fuera de tolerancia en este rango (vivo, FIFO o precios pendientes).
                  </p>
                ) : (
                  <div className="border border-stone-200 rounded-lg overflow-hidden bg-white max-h-[420px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {canApplyDosificadorSync && (
                            <TableHead className="w-8">
                              <Checkbox
                                checked={
                                  alignableVariances.length > 0 &&
                                  alignableVariances.every((v) => syncSelectedIds.has(v.material_id))
                                }
                                onCheckedChange={(checked) => toggleAllAlignable(Boolean(checked))}
                                aria-label="Seleccionar todos los alineables"
                                disabled={alignableVariances.length === 0}
                              />
                            </TableHead>
                          )}
                          <TableHead>Material</TableHead>
                          <TableHead className="text-right">Inventario vivo</TableHead>
                          <TableHead className="text-right">Teórico</TableHead>
                          <TableHead className="text-right">Δ vivo/teórico</TableHead>
                          <TableHead className="text-right">Δ FIFO</TableHead>
                          {!hideMoney && (
                            <TableHead className="text-right">Pend. precio</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {variances.map((v) => {
                          const isAlignable =
                            v.theoretical_final_kg != null &&
                            v.stock_vs_theoretical != null &&
                            Math.abs(v.stock_vs_theoretical) > EPS
                          return (
                            <TableRow
                              key={v.material_id}
                              className={cn(
                                'hover:bg-stone-50',
                                isAlignable ? 'bg-amber-50/30' : undefined,
                              )}
                            >
                              {canApplyDosificadorSync && (
                                <TableCell
                                  onClick={(e) => e.stopPropagation()}
                                  className="align-middle"
                                >
                                  {isAlignable ? (
                                    <Checkbox
                                      checked={syncSelectedIds.has(v.material_id)}
                                      onCheckedChange={(checked) => {
                                        setSyncSelectedIds((prev) => {
                                          const next = new Set(prev)
                                          if (checked) next.add(v.material_id)
                                          else next.delete(v.material_id)
                                          return next
                                        })
                                      }}
                                      aria-label={`Seleccionar ${v.material_name}`}
                                    />
                                  ) : null}
                                </TableCell>
                              )}
                              <TableCell
                                className="font-medium cursor-pointer"
                                onClick={() => {
                                  setActiveMaterial({ id: v.material_id, name: v.material_name })
                                  setTab('movements')
                                }}
                              >
                                {v.material_name}
                              </TableCell>
                              <TableCell
                                className="text-right font-mono cursor-pointer"
                                onClick={() => {
                                  setActiveMaterial({ id: v.material_id, name: v.material_name })
                                  setTab('movements')
                                }}
                              >
                                {fmtKg(v.dosificador_stock_kg)}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {v.theoretical_final_kg != null ? fmtKg(v.theoretical_final_kg) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {v.stock_vs_theoretical != null ? (
                                  deltaBadge(v.stock_vs_theoretical)
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {v.fifo_vs_stock != null ? fmtKg(v.fifo_vs_stock) : '—'}
                              </TableCell>
                              {!hideMoney && (
                                <TableCell className="text-right">{v.pending_pricing_count}</TableCell>
                              )}
                            </TableRow>
                          )
                        })}
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
            <AlertDialogTitle>Alinear inventario vivo al teórico</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará <code>material_inventory.current_stock</code> en{' '}
              {syncSelectedIds.size} material(es) para igualar el teórico aritmético del rango (
              {startDate} — {endDate}). No se crearán filas de ajuste de inventario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncApplying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={syncApplying}
              onClick={(e) => {
                e.preventDefault()
                void applyBulkAlignment()
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
