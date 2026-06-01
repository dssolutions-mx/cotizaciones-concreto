'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronDown, ChevronRight, Download, FileText, Receipt, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePlantContext } from '@/contexts/PlantContext'
import type { CreditNoteReason, CreditNoteStatus } from '@/types/finance'
import ApplyCreditNoteDrawer from './ApplyCreditNoteDrawer'
import BulkCreditNoteDialog from './BulkCreditNoteDialog'

type CnInvoiceAllocation = {
  id: string
  invoice_id: string
  allocated_subtotal: number
  allocated_tax: number
  allocated_total: number | null
  invoice?: {
    id: string
    invoice_number: string
    total: number
    status: string
  } | null
}

type CreditNoteRow = {
  id: string
  supplier_group_id: string
  plant_id: string
  credit_number: string | null
  credit_date: string
  reason: CreditNoteReason
  amount: number
  tax_amount: number
  total: number
  status: CreditNoteStatus
  notes: string | null
  document_url?: string | null
  xml_url?: string | null
  cfdi_uuid?: string | null
  cfdi_estado_sat?: string | null
  cfdi_emisor_rfc?: string | null
  cfdi_relacionado_uuid?: string | null
  supplier_group?: { id: string; name: string; rfc?: string | null } | null
  invoice_allocations?: CnInvoiceAllocation[]
  allocated_total: number
  unapplied_total: number
}

const STATUS_LABELS: Record<CreditNoteStatus, string> = {
  open: 'Sin aplicar',
  partially_applied: 'Parcial',
  fully_applied: 'Aplicada',
  void: 'Anulada',
}

const STATUS_COLORS: Record<CreditNoteStatus, string> = {
  open: 'bg-amber-100 text-amber-800',
  partially_applied: 'bg-blue-100 text-blue-800',
  fully_applied: 'bg-emerald-100 text-emerald-800',
  void: 'bg-stone-100 text-stone-600',
}

const REASON_LABELS: Record<CreditNoteReason, string> = {
  price_adjustment: 'Ajuste de precio',
  return: 'Devolución',
  defect: 'Defecto',
  other: 'Otro',
}

interface Props {
  workspacePlantId?: string
  hidePlantFilter?: boolean
}

export default function CreditNotesPayablesTab({
  workspacePlantId = '',
  hidePlantFilter = false,
}: Props) {
  const { availablePlants } = usePlantContext()
  const [localPlantFilter, setLocalPlantFilter] = useState('')
  const plantFilter = hidePlantFilter ? workspacePlantId : (localPlantFilter || workspacePlantId)
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [creditNotes, setCreditNotes] = useState<CreditNoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [cnContext, setCnContext] = useState<{ groupId: string; plantId: string } | null>(null)
  const [bulkCnDialogOpen, setBulkCnDialogOpen] = useState(false)

  const mxn = useMemo(
    () => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }),
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        if (plantFilter) qs.set('plant_id', plantFilter)
        qs.set('limit', '300')
        const res = await fetch(`/api/ap/credit-notes?${qs}`, { signal: controller.signal })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const list: CreditNoteRow[] = data.credit_notes ?? []
        setCreditNotes(list)
        setExpandedGroups(new Set(list.map(cn => cn.supplier_group_id)))
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [plantFilter, reloadKey])

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const cn of creditNotes) {
      if (!map.has(cn.supplier_group_id)) {
        map.set(cn.supplier_group_id, cn.supplier_group?.name ?? cn.supplier_group_id)
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [creditNotes])

  const hasActiveFilter = !!supplierFilter || !!statusFilter

  const filteredNotes = useMemo(() => {
    return creditNotes.filter(cn => {
      if (supplierFilter && cn.supplier_group_id !== supplierFilter) return false
      if (statusFilter && cn.status !== statusFilter) return false
      return true
    })
  }, [creditNotes, supplierFilter, statusFilter])

  useEffect(() => {
    if (loading) return
    setExpandedGroups(new Set(filteredNotes.map(cn => cn.supplier_group_id)))
  }, [supplierFilter, statusFilter, loading, filteredNotes])

  const grouped = useMemo(() => {
    const map = new Map<string, { groupName: string; notes: CreditNoteRow[] }>()
    for (const cn of filteredNotes) {
      const gid = cn.supplier_group_id
      const gname = cn.supplier_group?.name ?? gid
      if (!map.has(gid)) map.set(gid, { groupName: gname, notes: [] })
      map.get(gid)!.notes.push(cn)
    }
    return map
  }, [filteredNotes])

  const exportExcel = async () => {
    if (filteredNotes.length === 0) return
    const XLSX = await import('xlsx')
    const rows = filteredNotes.map(cn => ({
      Proveedor: cn.supplier_group?.name ?? '',
      Nota: cn.credit_number ?? cn.id.slice(0, 8),
      Fecha: cn.credit_date,
      Motivo: REASON_LABELS[cn.reason] ?? cn.reason,
      Subtotal: cn.amount,
      IVA: cn.tax_amount,
      Total: cn.total,
      Aplicado: cn.allocated_total,
      Sin_aplicar: cn.unapplied_total,
      Estado: STATUS_LABELS[cn.status] ?? cn.status,
      UUID_CFDI: cn.cfdi_uuid ?? '',
      Facturas: (cn.invoice_allocations ?? [])
        .map(a => a.invoice?.invoice_number)
        .filter(Boolean)
        .join(', '),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Notas de crédito')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `notas_credito_cxp_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!hidePlantFilter && (
          <Select
            value={plantFilter || '__all__'}
            onValueChange={v => setLocalPlantFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[220px] bg-white border-stone-300">
              <SelectValue placeholder="Todas las plantas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las plantas</SelectItem>
              {availablePlants.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {supplierOptions.length > 0 && (
          <Select
            value={supplierFilter || '__all__'}
            onValueChange={v => setSupplierFilter(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[220px] bg-white border-stone-300">
              <SelectValue placeholder="Todos los proveedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los proveedores</SelectItem>
              {supplierOptions.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={statusFilter || '__all__'}
          onValueChange={v => setStatusFilter(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="w-[180px] bg-white border-stone-300">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los estados</SelectItem>
            {(Object.keys(STATUS_LABELS) as CreditNoteStatus[]).map(st => (
              <SelectItem key={st} value={st}>{STATUS_LABELS[st]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilter && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs gap-1 text-stone-500"
            onClick={() => {
              setSupplierFilter('')
              setStatusFilter('')
            }}
          >
            <X className="h-3.5 w-3.5" /> Limpiar filtros
          </Button>
        )}

        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1 border-violet-300 text-violet-800"
            onClick={() => setBulkCnDialogOpen(true)}
          >
            <Receipt className="h-3.5 w-3.5" /> NC masivas (ZIP/XML)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={() => void exportExcel()}
            disabled={filteredNotes.length === 0}
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
        </div>
      </div>

      {creditNotes.length === 0 ? (
        <div className="py-16 text-center text-stone-500">
          <Receipt className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-sm font-medium">No hay notas de crédito registradas</p>
          <p className="text-xs text-stone-400 mt-1">
            Aplícalas desde Facturas / CxP o importa CFDI tipo Egreso (E) con NC masivas.
          </p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="py-16 text-center text-stone-500">
          <Receipt className="h-10 w-10 mx-auto mb-3 text-stone-300" />
          <p className="text-sm font-medium">Ninguna nota coincide con los filtros</p>
          <p className="text-xs text-stone-400 mt-1">Prueba otro proveedor o estado, o usa Limpiar filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([groupId, { groupName, notes }]) => {
            const expanded = expandedGroups.has(groupId)
            const unappliedSum = notes.reduce((s, cn) => s + cn.unapplied_total, 0)
            const canApply = notes.some(
              cn => cn.status === 'open' || cn.status === 'partially_applied',
            )

            return (
              <div key={groupId} className="border border-stone-200 rounded-lg overflow-hidden bg-white">
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-stone-50 cursor-pointer hover:bg-stone-100 transition-colors"
                  onClick={() => {
                    setExpandedGroups(prev => {
                      const next = new Set(prev)
                      if (next.has(groupId)) next.delete(groupId)
                      else next.add(groupId)
                      return next
                    })
                  }}
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 text-stone-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-stone-500" />
                  )}
                  <span className="font-semibold text-sm text-stone-900 flex-1">{groupName}</span>
                  <span className="text-xs text-stone-500 mr-3">{notes.length} nota(s)</span>
                  {canApply && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 mr-2"
                      onClick={e => {
                        e.stopPropagation()
                        setCnContext({ groupId, plantId: notes[0]?.plant_id ?? plantFilter })
                      }}
                    >
                      <Receipt className="h-3 w-3" /> Aplicar NC
                    </Button>
                  )}
                  {unappliedSum > 0 && (
                    <span className="text-xs text-amber-700 tabular-nums mr-2">
                      Sin aplicar: {mxn.format(unappliedSum)}
                    </span>
                  )}
                </div>

                {expanded && (
                  <div className="divide-y divide-stone-100">
                    {notes.map(cn => {
                      const cnExpanded = expandedNotes.has(cn.id)
                      const allocs = cn.invoice_allocations ?? []

                      return (
                        <div key={cn.id}>
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition-colors"
                            onClick={() => {
                              setExpandedNotes(prev => {
                                const next = new Set(prev)
                                if (next.has(cn.id)) next.delete(cn.id)
                                else next.add(cn.id)
                                return next
                              })
                            }}
                          >
                            {cnExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
                            )}

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-semibold">
                                  {cn.credit_number ?? `NC-${cn.id.slice(0, 8)}`}
                                </span>
                                <span
                                  className={cn(
                                    'px-2 py-0.5 rounded-full text-xs font-medium',
                                    STATUS_COLORS[cn.status],
                                  )}
                                >
                                  {STATUS_LABELS[cn.status]}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                  {REASON_LABELS[cn.reason]}
                                </span>
                                {cn.cfdi_uuid ? (
                                  cn.cfdi_estado_sat === 'cancelado' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                                      Cancelado SAT
                                    </span>
                                  ) : (
                                    <span
                                      className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      title={cn.cfdi_uuid}
                                    >
                                      CFDI ✓
                                    </span>
                                  )
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-50 text-stone-400 border border-stone-200">
                                    Sin CFDI
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-stone-500">
                                <span>
                                  {format(new Date(cn.credit_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}
                                </span>
                                {allocs.length > 0 && (
                                  <span>
                                    {allocs.length} factura(s):{' '}
                                    {allocs
                                      .map(a => a.invoice?.invoice_number)
                                      .filter(Boolean)
                                      .join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0 space-y-0.5">
                              <div className="text-sm font-bold tabular-nums">{mxn.format(cn.total)}</div>
                              {cn.allocated_total > 0 && (
                                <div className="text-xs text-emerald-600 tabular-nums">
                                  Aplicado {mxn.format(cn.allocated_total)}
                                </div>
                              )}
                              {cn.unapplied_total > 0 && cn.status !== 'void' && (
                                <div className="text-xs text-amber-700 tabular-nums font-medium">
                                  Sin aplicar {mxn.format(cn.unapplied_total)}
                                </div>
                              )}
                            </div>
                          </div>

                          {cnExpanded && (
                            <div className="px-10 pb-4 bg-stone-50/50 border-t border-stone-100 space-y-3 pt-3">
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                                <span>Subtotal: <b>{mxn.format(cn.amount)}</b></span>
                                <span>IVA: <b>{mxn.format(cn.tax_amount)}</b></span>
                                <span className="font-semibold text-stone-900">
                                  Total: <b>{mxn.format(cn.total)}</b>
                                </span>
                              </div>
                              {cn.notes && (
                                <p className="text-xs text-stone-600">
                                  <span className="font-medium">Notas:</span> {cn.notes}
                                </p>
                              )}
                              {cn.cfdi_relacionado_uuid && (
                                <p className="text-xs text-stone-500 font-mono truncate" title={cn.cfdi_relacionado_uuid}>
                                  CFDI relacionado: {cn.cfdi_relacionado_uuid}
                                </p>
                              )}

                              <div>
                                <p className="text-xs font-semibold text-stone-700 mb-2">Aplicación a facturas</p>
                                {allocs.length === 0 ? (
                                  <p className="text-xs text-muted-foreground">Sin facturas vinculadas.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {allocs.map(alloc => (
                                      <div
                                        key={alloc.id}
                                        className="flex justify-between text-xs py-1.5 px-3 bg-white rounded border border-stone-100"
                                      >
                                        <span className="text-stone-600">
                                          <FileText className="h-3 w-3 inline mr-1 text-stone-400" />
                                          <span className="font-mono">
                                            {alloc.invoice?.invoice_number ?? alloc.invoice_id.slice(0, 8)}
                                          </span>
                                          {alloc.invoice?.status && (
                                            <span className="ml-2 text-stone-400">
                                              ({alloc.invoice.status})
                                            </span>
                                          )}
                                        </span>
                                        <span className="tabular-nums font-medium text-emerald-700">
                                          −{mxn.format(Number(alloc.allocated_total ?? alloc.allocated_subtotal))}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <BulkCreditNoteDialog
        open={bulkCnDialogOpen}
        onOpenChange={setBulkCnDialogOpen}
        workspacePlantId={plantFilter}
        onSuccess={() => setReloadKey(k => k + 1)}
      />

      <ApplyCreditNoteDrawer
        open={!!cnContext}
        onOpenChange={v => { if (!v) setCnContext(null) }}
        supplierGroupId={cnContext?.groupId ?? null}
        plantId={cnContext?.plantId ?? null}
        onSuccess={() => {
          setCnContext(null)
          setReloadKey(k => k + 1)
        }}
      />
    </div>
  )
}
