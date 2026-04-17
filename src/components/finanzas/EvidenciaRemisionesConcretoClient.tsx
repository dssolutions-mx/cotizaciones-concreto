'use client'

import React, { useCallback, useEffect, useMemo, useState, startTransition } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Search,
  RefreshCw,
  ArrowDownToLine,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import ConcreteEvidenceHelpSheet from '@/components/finanzas/ConcreteEvidenceHelpSheet'
import ConcreteEvidenceOrderDetailPanel, {
  type OrderSummary,
} from '@/components/finanzas/ConcreteEvidenceOrderDetailPanel'

type EvidenceFile = {
  id: string
  created_at: string
  updated_at: string
  original_name: string
  uploaded_by: string | null
  uploaded_by_name: string | null
  file_path: string
}

type Row = {
  order_id: string
  order_number: string
  delivery_date: string
  construction_site: string | null
  plant_id: string | null
  plant_code: string | null
  plant_name: string | null
  client_name: string | null
  concrete_remisiones_count: number
  has_evidence: boolean
  evidence_count: number
  evidence_files: EvidenceFile[]
  evidence_last_at: string | null
  evidence_last_uploader_name: string | null
}

const STATUS_BADGE = {
  ok: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  missing: 'bg-amber-50 text-amber-800 border-amber-200',
  na: 'bg-muted text-muted-foreground border-border',
} as const

function rowToSummary(r: Row): OrderSummary {
  return {
    order_id: r.order_id,
    order_number: r.order_number,
    delivery_date: r.delivery_date,
    construction_site: r.construction_site,
    plant_id: r.plant_id,
    plant_code: r.plant_code,
    plant_name: r.plant_name,
    client_name: r.client_name,
    concrete_remisiones_count: r.concrete_remisiones_count,
    has_evidence: r.has_evidence,
    evidence_count: r.evidence_count,
  }
}

export default function EvidenciaRemisionesConcretoClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { availablePlants, currentPlant } = usePlantContext()
  const { profile } = useAuthSelectors()

  const isPlantManager = profile?.role === 'PLANT_MANAGER'
  const plantList = useMemo(
    () => (availablePlants?.length ? availablePlants : currentPlant ? [currentPlant] : []),
    [availablePlants, currentPlant]
  )

  const [from, setFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [plantId, setPlantId] = useState<string>('')
  const [missingOnly, setMissingOnly] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false)

  const pushUrl = useCallback(
    (orderIdOverride?: string | null) => {
      const oid = orderIdOverride !== undefined ? orderIdOverride : selectedOrderId
      const p = new URLSearchParams()
      p.set('date_from', from)
      p.set('date_to', to)
      const effectivePid = isPlantManager ? currentPlant?.id : plantId || null
      if (effectivePid) p.set('plant_id', effectivePid)
      if (missingOnly) p.set('missing_only', '1')
      if (oid) p.set('order_id', oid)
      const q = p.toString()
      startTransition(() => {
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
      })
    },
    [from, to, plantId, missingOnly, selectedOrderId, pathname, router, isPlantManager, currentPlant?.id]
  )

  useEffect(() => {
    const df = searchParams.get('date_from')
    const dt = searchParams.get('date_to')
    const pid = searchParams.get('plant_id')
    const mo = searchParams.get('missing_only')
    const oid = searchParams.get('order_id')
    if (df) setFrom(df)
    if (dt) setTo(dt)
    if (pid && !isPlantManager) setPlantId(pid)
    if (mo === '1' || mo === 'true') setMissingOnly(true)
    if (oid) setSelectedOrderId(oid)
    setHydratedFromUrl(true)
  }, [searchParams, isPlantManager])

  useEffect(() => {
    if (isPlantManager && currentPlant?.id) {
      setPlantId(currentPlant.id)
    }
  }, [isPlantManager, currentPlant?.id])

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true)
      try {
        const sp = new URLSearchParams({
          date_from: from,
          date_to: to,
          missing_only: missingOnly ? 'true' : 'false',
          limit: '100',
          offset: String(offset),
        })
        const effectivePid = isPlantManager ? currentPlant?.id : plantId || null
        if (effectivePid) sp.set('plant_id', effectivePid)

        const res = await fetch(`/api/finanzas/concrete-evidence?${sp.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error')
        const nextRows: Row[] = json.data?.rows || []
        const t = typeof json.data?.total === 'number' ? json.data.total : nextRows.length
        const tr = Boolean(json.data?.truncated)
        if (append) {
          setRows((prev) => [...prev, ...nextRows])
        } else {
          setRows(nextRows)
        }
        setTotal(t)
        setTruncated(tr)
      } catch (e) {
        console.error(e)
        toast.error(e instanceof Error ? e.message : 'Error al cargar')
      } finally {
        setLoading(false)
      }
    },
    [from, to, missingOnly, plantId, isPlantManager, currentPlant?.id]
  )

  useEffect(() => {
    if (!hydratedFromUrl) return
    void fetchPage(0, false)
  }, [from, to, missingOnly, plantId, hydratedFromUrl, isPlantManager, currentPlant?.id, fetchPage])

  const selectedRow = useMemo(
    () => rows.find((r) => r.order_id === selectedOrderId) || null,
    [rows, selectedOrderId]
  )

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const num = (r.order_number || '').toLowerCase()
      const site = (r.construction_site || '').toLowerCase()
      const client = (r.client_name || '').toLowerCase()
      const plant = [r.plant_code, r.plant_name].filter(Boolean).join(' ').toLowerCase()
      return num.includes(q) || site.includes(q) || client.includes(q) || plant.includes(q)
    })
  }, [rows, search])

  const exportCsv = () => {
    const list = filteredRows
    const headers = [
      'pedido',
      'fecha_entrega',
      'cliente',
      'obra',
      'planta_codigo',
      'planta_nombre',
      'remisiones_concreto',
      'tiene_evidencia',
      'archivos_count',
      'ultima_carga',
      'subidor',
      'archivos_paths',
    ]
    const lines = [
      headers.join(','),
      ...list.map((r) => {
        const paths = r.evidence_files.map((f) => f.file_path).join(';')
        const last = r.evidence_last_at
          ? format(new Date(r.evidence_last_at), 'yyyy-MM-dd HH:mm')
          : ''
        return [
          escapeCsv(r.order_number),
          escapeCsv(r.delivery_date?.slice(0, 10) || ''),
          escapeCsv(r.client_name || ''),
          escapeCsv(r.construction_site || ''),
          escapeCsv(r.plant_code || ''),
          escapeCsv(r.plant_name || ''),
          String(r.concrete_remisiones_count),
          r.has_evidence ? 'si' : 'no',
          String(r.evidence_count),
          escapeCsv(last),
          escapeCsv(r.evidence_last_uploader_name || ''),
          escapeCsv(paths),
        ].join(',')
      }),
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `evidencia-concreto-${from}-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV generado')
  }

  const selectRow = (r: Row) => {
    setSelectedOrderId(r.order_id)
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileSheetOpen(true)
    }
    pushUrl(r.order_id)
  }

  const handleRefresh = () => {
    void fetchPage(0, false)
    pushUrl()
  }

  const canLoadMore = rows.length < total && total > 0

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <div className="border-b border-stone-200/80 bg-stone-50/50">
        <div className="container mx-auto px-4 py-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                Evidencia remisiones (concreto)
              </h1>
              <ConcreteEvidenceHelpSheet />
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Verificación de archivos por pedido; inspección con remisiones de concreto y descarga para
              auditoría.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading || filteredRows.length === 0}
              onClick={exportCsv}
            >
              <ArrowDownToLine className="h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Card className="rounded-none border-x-0 border-t-0 shadow-none border-b border-stone-200/80">
            <CardHeader className="pb-3 space-y-0">
              <CardTitle className="text-base">Filtros</CardTitle>
              <CardDescription>Rango por fecha de entrega del pedido</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ev-from">Desde</Label>
                <Input
                  id="ev-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="min-h-10 w-[160px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-to">Hasta</Label>
                <Input
                  id="ev-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="min-h-10 w-[160px]"
                />
              </div>
              <div className="space-y-1.5 min-w-[200px]">
                <Label>Planta</Label>
                <Select
                  value={isPlantManager ? currentPlant?.id || '_all' : plantId || '_all'}
                  onValueChange={(v) => setPlantId(v === '_all' ? '' : v)}
                  disabled={isPlantManager}
                >
                  <SelectTrigger className="min-h-10">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Todas las plantas</SelectItem>
                    {plantList.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code ? `${p.code} — ${p.name}` : p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer min-h-10 pb-0.5">
                <Checkbox
                  checked={missingOnly}
                  onCheckedChange={(v) => setMissingOnly(v === true)}
                />
                Solo con remisiones y sin evidencia
              </label>
              <Button type="button" onClick={handleRefresh} disabled={loading} className="min-h-10 gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Actualizar
              </Button>
            </CardContent>
          </Card>

          <div className="px-4 py-3 flex flex-wrap items-center gap-3 border-b border-stone-200/80 bg-stone-50/30">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido, cliente, obra, planta…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredRows.length} de {rows.length} filas
              {total > 0 && ` · ${total} en total`}
              {truncated && ' (resultado truncado: acote fechas)'}
            </p>
          </div>

          <div className="flex-1 overflow-auto">
            {loading && rows.length === 0 ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Pedido</TableHead>
                    <TableHead>Planta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead className="text-right">Rem.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última carga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        Sin resultados
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => {
                      const status =
                        r.has_evidence ? 'ok' : r.concrete_remisiones_count > 0 ? 'missing' : 'na'
                      const label = r.has_evidence
                        ? 'Con evidencia'
                        : r.concrete_remisiones_count > 0
                          ? 'Falta evidencia'
                          : 'Sin remisiones'
                      return (
                        <TableRow
                          key={r.order_id}
                          data-state={selectedOrderId === r.order_id ? 'selected' : undefined}
                          className={cn(
                            'cursor-pointer',
                            selectedOrderId === r.order_id && 'bg-sky-50/80 ring-1 ring-inset ring-sky-200'
                          )}
                          onClick={() => selectRow(r)}
                        >
                          <TableCell className="font-medium">{r.order_number}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                            {r.plant_code || r.plant_name || '—'}
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate">{r.client_name || '—'}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{r.construction_site || '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.concrete_remisiones_count}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn('text-xs font-normal', STATUS_BADGE[status])}>
                              {r.has_evidence ? (
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> {label}
                                </span>
                              ) : r.concrete_remisiones_count > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <XCircle className="h-3 w-3" /> {label}
                                </span>
                              ) : (
                                label
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {r.evidence_last_at
                              ? format(new Date(r.evidence_last_at), 'dd/MM/yyyy HH:mm', { locale: es })
                              : '—'}
                            {r.evidence_last_uploader_name && (
                              <span className="block text-[11px] truncate max-w-[140px]">
                                {r.evidence_last_uploader_name}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            )}
            {canLoadMore && (
              <div className="p-4 flex justify-center border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => fetchPage(rows.length, true)}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cargar más ({rows.length} / {total})
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:flex flex-col border-l border-border/60 shrink-0">
          <ConcreteEvidenceOrderDetailPanel
            orderId={selectedOrderId}
            summary={selectedRow ? rowToSummary(selectedRow) : null}
            onClose={() => {
              setSelectedOrderId(null)
              pushUrl(null)
            }}
          />
        </div>
      </div>

      <Sheet
        open={mobileSheetOpen}
        onOpenChange={(open) => {
          setMobileSheetOpen(open)
          if (!open) {
            setSelectedOrderId(null)
            pushUrl(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Detalle del pedido</SheetTitle>
          </SheetHeader>
          <ConcreteEvidenceOrderDetailPanel
            orderId={selectedOrderId}
            summary={selectedRow ? rowToSummary(selectedRow) : null}
            onClose={() => {
              setMobileSheetOpen(false)
              setSelectedOrderId(null)
              pushUrl(null)
            }}
            className="border-l-0 max-h-full"
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

function escapeCsv(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
