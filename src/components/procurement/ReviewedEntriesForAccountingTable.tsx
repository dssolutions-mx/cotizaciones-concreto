'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronLeft, ChevronRight, Factory, KeyRound, MoreHorizontal, Package, Pencil, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { buildProcurementUrl, productionEntriesUrl } from '@/lib/procurement/navigation'
import { MaterialEntry } from '@/types/inventory'
import {
  formatReceivedQuantity,
  formatReceptionAssignedDay,
  formatEntrySavedShortFor,
} from '@/lib/inventory/entryReceivedDisplay'

function formatReviewedAt(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    const d = parseISO(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return format(d, 'dd MMM yyyy HH:mm', { locale: es })
  } catch {
    return '—'
  }
}

function reviewerShort(e: MaterialEntry): string {
  const u = e.reviewed_by_user
  if (!u) return '—'
  const name = `${u.first_name || ''} ${u.last_name || ''}`.trim()
  if (name) return name.length > 18 ? `${name.slice(0, 16)}…` : name
  return u.email ? (u.email.length > 20 ? `${u.email.slice(0, 18)}…` : u.email) : '—'
}

function MaterialCellClaveErp({
  entry,
  canEdit,
  onSaved,
}: {
  entry: MaterialEntry
  canEdit: boolean
  onSaved?: (materialId: string, code: string | null) => void
}) {
  const materialId = entry.material_id
  const initial = entry.material?.accounting_code?.trim() || ''
  const [open, setOpen] = useState(false)
  const [val, setVal] = useState(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setVal(entry.material?.accounting_code?.trim() || '')
  }, [entry.material?.accounting_code])

  const hasCode = Boolean(initial)
  if (!canEdit) {
    return (
      <div className="min-w-0 max-w-[7rem]">
        <div
          className={`font-mono text-[11px] leading-tight break-all ${!hasCode ? 'text-amber-800' : 'text-stone-800'}`}
        >
          {hasCode ? initial : '—'}
        </div>
        {!hasCode && <span className="text-[9px] text-amber-700">Sin clave</span>}
      </div>
    )
  }

  const save = async () => {
    if (!materialId) {
      toast.error('Material no disponible en esta fila')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/materials/${materialId}/accounting-code`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounting_code: val }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error al guardar')
      const next = (json.material?.accounting_code as string | null | undefined) ?? null
      const trimmed = next?.trim() ? next.trim() : null
      onSaved?.(materialId, trimmed)
      toast.success('Clave contable actualizada')
      setOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-start gap-0.5 min-w-0 max-w-[8rem]">
      <div className="min-w-0 flex-1">
        <div
          className={`font-mono text-[11px] leading-tight break-all ${
            !hasCode ? 'text-amber-800' : 'text-stone-800'
          }`}
        >
          {hasCode ? initial : '—'}
        </div>
        {!hasCode && <span className="text-[9px] text-amber-700">Sin clave</span>}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 -mt-0.5"
            title="Editar clave ERP"
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-3"
          align="end"
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-medium text-stone-800 mb-2 flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5" />
            Clave de producto
          </p>
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="h-8 text-xs font-mono mb-2"
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save()
            }}
            placeholder="Ej. 03ALTI"
          />
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button type="button" size="sm" className="h-7 text-xs" onClick={() => void save()} disabled={saving}>
              {saving ? '…' : 'Guardar'}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

type Props = {
  entries: MaterialEntry[]
  entryIdFromUrl?: string
  effectivePlantId?: string
  mxn: Intl.NumberFormat
  loading?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  /** Barra superior (exportes, filtros contables) — si se omite, no se muestra acción de Excel aquí. */
  toolbar?: React.ReactNode
  onInspect: (e: MaterialEntry) => void
  onEditPricing: (e: MaterialEntry) => void
  canEditMaterialAccountingCode?: boolean
  onMaterialAccountingCodeSaved?: (materialId: string, code: string | null) => void
}

export default function ReviewedEntriesForAccountingTable({
  entries,
  entryIdFromUrl,
  effectivePlantId,
  mxn,
  loading = false,
  hasMore = false,
  onLoadMore,
  toolbar,
  onInspect,
  onEditPricing,
  canEditMaterialAccountingCode = false,
  onMaterialAccountingCodeSaved,
}: Props) {
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const [scrollEdges, setScrollEdges] = useState({ atStart: true, atEnd: true })

  const refreshScrollEdges = useCallback(() => {
    const el = tableScrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const max = Math.max(0, scrollWidth - clientWidth)
    if (max <= 1) {
      setScrollEdges({ atStart: true, atEnd: true })
      return
    }
    setScrollEdges({
      atStart: scrollLeft <= 1,
      atEnd: scrollLeft >= max - 1,
    })
  }, [])

  useEffect(() => {
    const el = tableScrollRef.current
    if (!el) return
    refreshScrollEdges()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => refreshScrollEdges()) : null
    ro?.observe(el)
    el.addEventListener('scroll', refreshScrollEdges, { passive: true })
    return () => {
      ro?.disconnect()
      el.removeEventListener('scroll', refreshScrollEdges)
    }
  }, [entries.length, refreshScrollEdges])

  const scrollTableBy = useCallback((delta: number) => {
    const el = tableScrollRef.current
    if (!el) return
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }, [])

  const onTableScrollKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        scrollTableBy(-120)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        scrollTableBy(120)
      }
    },
    [scrollTableBy]
  )

  const sums = useMemo(() => {
    let totalMaterial = 0
    let totalFleet = 0
    let nMat = 0
    let nFleet = 0
    for (const e of entries) {
      if (e.total_cost != null && !Number.isNaN(Number(e.total_cost))) {
        totalMaterial += Number(e.total_cost)
        nMat += 1
      }
      if (e.fleet_cost != null && !Number.isNaN(Number(e.fleet_cost))) {
        totalFleet += Number(e.fleet_cost)
        nFleet += 1
      }
    }
    return { totalMaterial, totalFleet, nMat, nFleet }
  }, [entries])

  if (loading && entries.length === 0) {
    return (
      <div className="py-12 text-center text-stone-500 text-sm">Cargando entradas revisadas…</div>
    )
  }

  if (!loading && entries.length === 0) {
    return (
      <div className="py-12 text-center text-stone-500 text-sm">
        No hay entradas revisadas en este período.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 px-1">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-[11px] text-stone-500">
            Suma en pantalla: material{' '}
            <span className="font-semibold tabular-nums text-stone-800">
              {sums.nMat ? mxn.format(sums.totalMaterial) : '—'}
            </span>
            {sums.nFleet > 0 && (
              <>
                {' '}
                · flota{' '}
                <span className="font-semibold tabular-nums text-stone-800">
                  {mxn.format(sums.totalFleet)}
                </span>
              </>
            )}
            <span className="text-stone-400"> ({entries.length} fila{entries.length !== 1 ? 's' : ''})</span>
          </p>
          {toolbar ? <div className="flex flex-wrap items-center gap-2 justify-end">{toolbar}</div> : null}
        </div>
      </div>

      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 rounded-md border border-stone-200/90 bg-stone-50/80 px-2 py-1.5">
          <p className="text-[11px] text-stone-600 leading-snug order-2 sm:order-1 min-w-0">
            Tabla ancha: use la <span className="font-medium text-stone-700">barra de desplazamiento inferior</span>, los botones
            ◀ ▶, o en el teclado tabulador hasta la tabla y luego <span className="font-medium text-stone-700">← →</span>. En
            trackpad, deslice con dos dedos.
          </p>
          <div className="flex items-center justify-end gap-1 shrink-0 order-1 sm:order-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Desplazar tabla a la izquierda"
              disabled={scrollEdges.atStart}
              onClick={() => scrollTableBy(-300)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              title="Desplazar tabla a la derecha"
              disabled={scrollEdges.atEnd}
              onClick={() => scrollTableBy(300)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Table
          className="min-w-[76rem] max-w-none"
          scrollContainerRef={tableScrollRef}
          scrollContainerClassName="max-w-full scroll-smooth touch-pan-x overscroll-x-contain rounded-md border border-stone-200/60 bg-white shadow-inner shadow-stone-200/40 [-webkit-overflow-scrolling:touch] outline-none focus-visible:ring-2 focus-visible:ring-stone-400/50 focus-visible:ring-offset-1"
          scrollContainerProps={{
            tabIndex: 0,
            onKeyDown: onTableScrollKeyDown,
            role: 'region',
            'aria-label': 'Entradas revisadas, desplazamiento horizontal con flechas o barra',
          }}
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="whitespace-nowrap text-xs">Entrada</TableHead>
              <TableHead className="whitespace-nowrap text-xs min-w-[7.5rem]" title="Momento en que se marcó revisada">
                Revisada
              </TableHead>
              <TableHead className="whitespace-nowrap text-xs min-w-[7rem]">Recepción</TableHead>
              <TableHead className="text-xs min-w-[8rem]">Material</TableHead>
              <TableHead className="text-xs min-w-[6.5rem] whitespace-nowrap" title="Clave de producto (ERP)">
                Clave ERP
              </TableHead>
              <TableHead className="text-xs min-w-[5rem]">OC</TableHead>
              <TableHead className="text-xs min-w-[6rem]">Proveedor</TableHead>
              <TableHead className="text-xs min-w-[5rem]">Fact. / rem.</TableHead>
              <TableHead className="whitespace-nowrap text-xs">Venc. mat.</TableHead>
              <TableHead className="whitespace-nowrap text-xs">Venc. flota</TableHead>
              <TableHead className="text-right text-xs whitespace-nowrap">Cantidad</TableHead>
              <TableHead className="text-right text-xs whitespace-nowrap">P. unit.</TableHead>
              <TableHead className="text-right text-xs whitespace-nowrap">Total</TableHead>
              <TableHead className="text-right text-xs whitespace-nowrap">Flota</TableHead>
              <TableHead className="text-right text-xs whitespace-nowrap" title="Costo en tierra por kg">
                Landed/kg
              </TableHead>
              <TableHead className="text-center text-xs whitespace-nowrap">Docs</TableHead>
              <TableHead className="text-xs min-w-[5rem]">Revisó</TableHead>
              <TableHead className="text-right w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => {
              const poRef = e.po || e.fleet_po
              const poLabel = poRef?.po_number || (e.po_id || e.fleet_po_id)?.slice(0, 8) || '—'
              const poLinkId = e.po_id || e.fleet_po_id
              const supplierLabel =
                e.supplier?.name ||
                (e.supplier?.provider_number ? `#${e.supplier.provider_number}` : null) ||
                '—'
              const highlight = entryIdFromUrl === e.id

              return (
                <TableRow
                  key={e.id}
                  id={`proc-entry-row-${e.id}`}
                  className={cn(
                    'cursor-pointer',
                    highlight && 'bg-sky-50 ring-2 ring-sky-400/60'
                  )}
                  title="Doble clic para inspeccionar"
                  onDoubleClick={() => onInspect(e)}
                >
                  <TableCell className="font-mono text-[11px] text-stone-800 py-2">
                    {e.entry_number || e.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-[11px] text-stone-700 tabular-nums py-2 whitespace-nowrap">
                    {formatReviewedAt(e.reviewed_at)}
                  </TableCell>
                  <TableCell className="text-[11px] align-top py-2 whitespace-nowrap">
                    <div className="leading-tight">
                      <div>{formatReceptionAssignedDay(e)}</div>
                      <div className="text-[10px] text-stone-500 tabular-nums">
                        Reg. {formatEntrySavedShortFor(e)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[140px] py-2">
                    <div className="font-medium text-stone-900 truncate text-xs">
                      {e.material?.material_name || e.material_id}
                    </div>
                    <div className="text-[10px] text-stone-500 truncate">
                      {e.material?.material_code ? (
                        <span className="font-mono text-stone-600">{e.material.material_code}</span>
                      ) : null}
                      {e.material?.material_code && e.material?.category ? ' · ' : null}
                      {e.material?.category}
                    </div>
                  </TableCell>
                  <TableCell
                    className="py-2 align-top"
                    onDoubleClick={(ev) => ev.stopPropagation()}
                  >
                    <MaterialCellClaveErp
                      entry={e}
                      canEdit={canEditMaterialAccountingCode}
                      onSaved={onMaterialAccountingCodeSaved}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[11px] py-2">{poLabel}</TableCell>
                  <TableCell className="max-w-[120px] py-2">
                    <div className="text-xs text-stone-700 truncate" title={supplierLabel}>
                      {supplierLabel}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[10px] py-2 max-w-[100px] truncate" title={e.supplier_invoice || ''}>
                    {e.supplier_invoice || '—'}
                  </TableCell>
                  <TableCell className="text-[11px] tabular-nums py-2 whitespace-nowrap">
                    {e.ap_due_date_material || '—'}
                  </TableCell>
                  <TableCell className="text-[11px] tabular-nums py-2 whitespace-nowrap">
                    {e.fleet_cost != null && e.fleet_cost > 0 ? e.ap_due_date_fleet || '—' : '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums py-2 whitespace-nowrap">
                    {formatReceivedQuantity(e)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums py-2 whitespace-nowrap">
                    {e.unit_price != null ? mxn.format(e.unit_price) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums py-2 whitespace-nowrap">
                    {e.total_cost != null ? mxn.format(e.total_cost) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums py-2 whitespace-nowrap">
                    {e.fleet_cost != null ? mxn.format(e.fleet_cost) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums py-2 whitespace-nowrap">
                    {e.landed_unit_price != null ? mxn.format(e.landed_unit_price) : '—'}
                  </TableCell>
                  <TableCell className="text-center text-xs tabular-nums py-2">
                    {e.document_count ?? 0}
                  </TableCell>
                  <TableCell className="text-[11px] text-stone-600 py-2" title={reviewerShort(e)}>
                    {reviewerShort(e)}
                  </TableCell>
                  <TableCell
                    className="text-right py-2"
                    onDoubleClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onInspect(e)}>
                            <Search className="h-3.5 w-3.5 mr-2" />
                            Inspeccionar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditPricing(e)}>
                            Editar precios
                          </DropdownMenuItem>
                          {poLinkId && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={buildProcurementUrl('/finanzas/procurement', {
                                  plantId: effectivePlantId,
                                  tab: 'po',
                                  poId: poLinkId,
                                })}
                              >
                                <Package className="h-3.5 w-3.5 mr-2" />
                                Ver OC
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link
                              href={productionEntriesUrl({
                                plantId: e.plant_id,
                                poId: poLinkId || undefined,
                                entryId: e.id,
                              })}
                            >
                              <Factory className="h-3.5 w-3.5 mr-2" />
                              Ficha planta
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {hasMore && onLoadMore && (
        <div className="flex justify-center pb-3">
          <Button type="button" variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
            {loading ? 'Cargando…' : 'Cargar más'}
          </Button>
        </div>
      )}
    </div>
  )
}
