'use client'

import React, { useCallback, useEffect, useMemo, useState, startTransition } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  CheckCircle2,
  Loader2,
  XCircle,
  Search,
  RefreshCw,
  ChevronDown,
  X,
  FileSpreadsheet,
  Archive,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { useSignedUrls } from '@/hooks/useSignedUrls'
import { parseJsonResponse } from '@/lib/http/safeJsonResponse'
import {
  isConcreteEvidenceFileZippable,
  sanitizeZipPathSegment,
  uniqueZipPath,
} from '@/lib/finanzas/concreteEvidenceZipUtils'
import { formatPostgresDateEs } from '@/lib/dates/postgresDate'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import ConcreteEvidenceHelpSheet from '@/components/finanzas/ConcreteEvidenceHelpSheet'
import ConcreteEvidenceOrderDetailPanel, {
  type OrderSummary,
} from '@/components/finanzas/ConcreteEvidenceOrderDetailPanel'
import type { ClientEnriched } from '@/app/api/clients/list-enriched/route'
import {
  buildConcreteEvidenceExcelArrayBuffer,
  type ConcreteEvidenceExportMeta,
} from '@/lib/finanzas/buildConcreteEvidenceExcel'

type EvidenceStatus = 'all' | 'needs_evidence' | 'has_evidence' | 'no_remisiones'

type EvidenceFile = {
  id: string
  created_at: string
  updated_at: string
  original_name: string
  uploaded_by: string | null
  uploaded_by_name: string | null
  file_path: string
  mime_type: string | null
}

type Row = {
  order_id: string
  order_number: string
  delivery_date: string
  construction_site: string | null
  plant_id: string | null
  plant_code: string | null
  plant_name: string | null
  client_id: string | null
  client_name: string | null
  concrete_remisiones_count: number
  concrete_volume_sum: number | null
  remision_numbers: string[]
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

/** Max pedidos per Excel (evita miles de requests y archivos enormes). */
const CONCRETE_EVIDENCE_EXPORT_MAX_ORDERS = 8000

const EVIDENCE_STATUS_EXPORT_LABEL: Record<EvidenceStatus, string> = {
  all: 'Todos',
  needs_evidence: 'Con remisiones y sin evidencia',
  has_evidence: 'Con remisiones y con evidencia',
  no_remisiones: 'Sin remisiones de concreto',
}

const MAX_BULK_ZIP_ORDERS = 25
const MAX_BULK_ZIP_FILES = 200

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

function parseEvidenceStatusFromSearch(params: URLSearchParams): EvidenceStatus {
  const legacy =
    params.get('missing_only') === '1' || params.get('missing_only') === 'true'
  const raw = (params.get('evidence_status') || '').trim().toLowerCase()
  if (legacy) return 'needs_evidence'
  if (raw === 'needs_evidence' || raw === 'has_evidence' || raw === 'no_remisiones' || raw === 'all') {
    return raw as EvidenceStatus
  }
  return 'all'
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
  const [clientId, setClientId] = useState<string>('')
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus>('all')
  const [loading, setLoading] = useState(false)
  const [excelBusy, setExcelBusy] = useState(false)
  const [bulkZipBusy, setBulkZipBusy] = useState(false)
  const [zipOrderSelection, setZipOrderSelection] = useState<Set<string>>(() => new Set())
  const { getSignedUrl } = useSignedUrls('remision-documents', 3600)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false)

  const [clients, setClients] = useState<ClientEnriched[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false)
  const [clientSearchTerm, setClientSearchTerm] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setClientsLoading(true)
      try {
        const res = await fetch('/api/clients/list-enriched')
        const json = await res.json()
        if (!cancelled && res.ok && Array.isArray(json.clients)) {
          setClients(json.clients as ClientEnriched[])
        }
      } catch {
        if (!cancelled) toast.error('No se pudieron cargar clientes')
      } finally {
        if (!cancelled) setClientsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId]
  )

  const pushUrl = useCallback(
    (orderIdOverride?: string | null) => {
      const oid = orderIdOverride !== undefined ? orderIdOverride : selectedOrderId
      const p = new URLSearchParams()
      p.set('date_from', from)
      p.set('date_to', to)
      const effectivePid = isPlantManager ? currentPlant?.id : plantId || null
      if (effectivePid) p.set('plant_id', effectivePid)
      if (clientId) p.set('client_id', clientId)
      if (evidenceStatus !== 'all') p.set('evidence_status', evidenceStatus)
      if (oid) p.set('order_id', oid)
      const q = p.toString()
      startTransition(() => {
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
      })
    },
    [from, to, plantId, clientId, evidenceStatus, selectedOrderId, pathname, router, isPlantManager, currentPlant?.id]
  )

  useEffect(() => {
    const df = searchParams.get('date_from')
    const dt = searchParams.get('date_to')
    const pid = searchParams.get('plant_id')
    const cid = searchParams.get('client_id')
    const oid = searchParams.get('order_id')
    if (df) setFrom(df)
    if (dt) setTo(dt)
    if (pid && !isPlantManager) setPlantId(pid)
    if (cid) setClientId(cid)
    setEvidenceStatus(parseEvidenceStatusFromSearch(searchParams))
    if (oid) setSelectedOrderId(oid)
    setHydratedFromUrl(true)
  }, [searchParams, isPlantManager])

  useEffect(() => {
    if (isPlantManager && currentPlant?.id) {
      setPlantId(currentPlant.id)
    }
  }, [isPlantManager, currentPlant?.id])

  useEffect(() => {
    setZipOrderSelection(new Set())
  }, [from, to, plantId, clientId, evidenceStatus, isPlantManager, currentPlant?.id])

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true)
      try {
        const sp = new URLSearchParams({
          date_from: from,
          date_to: to,
          evidence_status: evidenceStatus,
          limit: '100',
          offset: String(offset),
          include_summary: 'false',
        })
        const effectivePid = isPlantManager ? currentPlant?.id : plantId || null
        if (effectivePid) sp.set('plant_id', effectivePid)
        if (clientId) sp.set('client_id', clientId)

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
    [from, to, evidenceStatus, plantId, clientId, isPlantManager, currentPlant?.id]
  )

  useEffect(() => {
    if (!hydratedFromUrl) return
    void fetchPage(0, false)
  }, [from, to, evidenceStatus, plantId, clientId, hydratedFromUrl, isPlantManager, currentPlant?.id, fetchPage])

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
      const rems = (r.remision_numbers || []).join(' ').toLowerCase()
      return (
        num.includes(q) ||
        site.includes(q) ||
        client.includes(q) ||
        plant.includes(q) ||
        rems.includes(q)
      )
    })
  }, [rows, search])

  const zipSelectableOnPage = useMemo(
    () => filteredRows.filter((r) => r.evidence_count > 0),
    [filteredRows]
  )
  const zipAllOnPageSelected =
    zipSelectableOnPage.length > 0 && zipSelectableOnPage.every((r) => zipOrderSelection.has(r.order_id))
  const zipSomeOnPageSelected = zipSelectableOnPage.some((r) => zipOrderSelection.has(r.order_id))

  const toggleZipSelectAllOnPage = () => {
    if (zipAllOnPageSelected) {
      setZipOrderSelection((prev) => {
        const next = new Set(prev)
        for (const r of zipSelectableOnPage) next.delete(r.order_id)
        return next
      })
    } else {
      setZipOrderSelection((prev) => {
        const next = new Set(prev)
        for (const r of zipSelectableOnPage) next.add(r.order_id)
        return next
      })
    }
  }

  const downloadBulkEvidenceZip = async () => {
    const ids = [...zipOrderSelection]
    if (ids.length === 0) {
      toast.error('Seleccione pedidos con evidencia (casilla en la tabla)')
      return
    }
    if (ids.length > MAX_BULK_ZIP_ORDERS) {
      toast.error(`Máximo ${MAX_BULK_ZIP_ORDERS} pedidos por ZIP`)
      return
    }
    setBulkZipBusy(true)
    let fileCount = 0
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const usedPaths = new Set<string>()

      for (const orderId of ids) {
        if (fileCount >= MAX_BULK_ZIP_FILES) break
        try {
          const res = await fetch(`/api/orders/${orderId}/concrete-evidence`)
          const json = await parseJsonResponse<{
            data?: {
              evidence?: Array<{ file_path: string; original_name: string; mime_type?: string | null }>
            }
            error?: string
          }>(res)
          if (!res.ok) continue

          const evidence = Array.isArray(json.data?.evidence) ? json.data!.evidence! : []
          const row = rows.find((x) => x.order_id === orderId)
          const orderNumber = row?.order_number || orderId.slice(0, 8)
          const folder = `${sanitizeZipPathSegment(orderNumber, 'pedido')}_${orderId.slice(0, 8)}`
          const zippable = evidence.filter((e) =>
            isConcreteEvidenceFileZippable(e.mime_type ?? null, e.original_name || '')
          )
          for (const ev of zippable) {
            if (fileCount >= MAX_BULK_ZIP_FILES) break
            const url = await getSignedUrl(ev.file_path)
            if (!url) continue
            const fileRes = await fetch(url)
            if (!fileRes.ok) continue
            const buf = await fileRes.arrayBuffer()
            const rel = uniqueZipPath(
              `${folder}/${sanitizeZipPathSegment(ev.original_name, 'archivo')}`,
              usedPaths
            )
            zip.file(rel, buf)
            fileCount += 1
          }
        } catch {
          continue
        }
      }

      if (fileCount === 0) {
        toast.error('No se agregó ningún PDF o imagen al ZIP')
        return
      }

      const blob = await zip.generateAsync({ type: 'blob' })
      const stamp = format(new Date(), 'yyyyMMdd-HHmm')
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `evidencia-multipedido-${from}-${to}-${stamp}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
      const capped = fileCount >= MAX_BULK_ZIP_FILES
      toast.success(
        capped
          ? `ZIP con ${fileCount} archivo(s) (límite ${MAX_BULK_ZIP_FILES}); reduzca pedidos o descargue por tandas`
          : `ZIP con ${fileCount} archivo(s) de ${ids.length} pedido(s)`
      )
    } catch (e) {
      console.error(e)
      toast.error('No se pudo crear el ZIP')
    } finally {
      setBulkZipBusy(false)
    }
  }

  const exportExcel = async () => {
    setExcelBusy(true)
    try {
      const limit = 200
      const maxOrders = CONCRETE_EVIDENCE_EXPORT_MAX_ORDERS
      const accumulated: Row[] = []
      let apiTotal = 0
      let apiTruncated = false
      let offset = 0

      while (accumulated.length < maxOrders) {
        const sp = new URLSearchParams({
          date_from: from,
          date_to: to,
          evidence_status: evidenceStatus,
          limit: String(limit),
          offset: String(offset),
          include_summary: 'false',
        })
        const effectivePid = isPlantManager ? currentPlant?.id : plantId || null
        if (effectivePid) sp.set('plant_id', effectivePid)
        if (clientId) sp.set('client_id', clientId)

        const res = await fetch(`/api/finanzas/concrete-evidence?${sp.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Error al cargar')

        const chunk: Row[] = json.data?.rows || []
        if (offset === 0) {
          apiTotal = typeof json.data?.total === 'number' ? json.data.total : chunk.length
        }
        apiTruncated = apiTruncated || Boolean(json.data?.truncated)

        const room = maxOrders - accumulated.length
        if (chunk.length <= room) {
          accumulated.push(...chunk)
          offset += limit
          if (chunk.length < limit) break
          if (accumulated.length >= apiTotal) break
        } else {
          accumulated.push(...chunk.slice(0, room))
          break
        }
      }

      if (accumulated.length === 0) {
        toast.error('No hay pedidos para exportar con los filtros actuales')
        return
      }

      const q = search.trim().toLowerCase()
      const list = !q
        ? accumulated
        : accumulated.filter((r) => {
            const num = (r.order_number || '').toLowerCase()
            const site = (r.construction_site || '').toLowerCase()
            const client = (r.client_name || '').toLowerCase()
            const plant = [r.plant_code, r.plant_name].filter(Boolean).join(' ').toLowerCase()
            const rems = (r.remision_numbers || []).join(' ').toLowerCase()
            return (
              num.includes(q) ||
              site.includes(q) ||
              client.includes(q) ||
              plant.includes(q) ||
              rems.includes(q)
            )
          })

      if (list.length === 0) {
        toast.error(
          'Ningún pedido coincide con la búsqueda. Quite el texto de búsqueda o amplíe criterios.'
        )
        return
      }

      const plantLabel = isPlantManager
        ? currentPlant
          ? [currentPlant.code, currentPlant.name].filter(Boolean).join(' — ') || currentPlant.name
          : 'Planta (sesión)'
        : plantId
          ? (() => {
              const p = plantList.find((x) => x.id === plantId)
              return p ? [p.code, p.name].filter(Boolean).join(' — ') || p.name : plantId
            })()
          : 'Todas las plantas'

      const cappedAtMax = accumulated.length >= maxOrders && apiTotal > accumulated.length

      const meta: ConcreteEvidenceExportMeta = {
        generatedAtIso: new Date().toISOString(),
        dateFrom: from,
        dateTo: to,
        plantLabel,
        clientLabel: selectedClient?.business_name ?? 'Todos los clientes',
        evidenceStatusLabel: EVIDENCE_STATUS_EXPORT_LABEL[evidenceStatus],
        searchText: search.trim(),
        totalMatchingFilters: apiTotal,
        rowsInFile: list.length,
        cappedAtMax,
        apiReportedTruncated: apiTruncated,
      }

      const buf = await buildConcreteEvidenceExcelArrayBuffer(
        list.map((r) => ({
          order_id: r.order_id,
          order_number: r.order_number,
          delivery_date: r.delivery_date,
          client_name: r.client_name,
          construction_site: r.construction_site,
          plant_code: r.plant_code,
          plant_name: r.plant_name,
          concrete_remisiones_count: r.concrete_remisiones_count,
          remision_numbers: r.remision_numbers || [],
          concrete_volume_sum: r.concrete_volume_sum,
          has_evidence: r.has_evidence,
          evidence_count: r.evidence_count,
          evidence_files: r.evidence_files.map((f) => ({
            id: f.id,
            created_at: f.created_at,
            updated_at: f.updated_at,
            original_name: f.original_name,
            uploaded_by_name: f.uploaded_by_name,
            file_path: f.file_path,
            mime_type: f.mime_type,
          })),
          evidence_last_at: r.evidence_last_at,
          evidence_last_uploader_name: r.evidence_last_uploader_name,
        })),
        meta
      )
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `evidencia-concreto-${from}-${to}.xlsx`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success(
        cappedAtMax
          ? `Excel generado (${list.length} pedidos; límite ${maxOrders} — acote filtros si faltan datos)`
          : `Excel generado (${list.length} pedidos)`
      )
    } catch (e) {
      console.error(e)
      toast.error('No se pudo generar el Excel')
    } finally {
      setExcelBusy(false)
    }
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

  const filteredClients = useMemo(() => {
    if (!clientSearchTerm.trim()) return clients
    const s = clientSearchTerm.toLowerCase()
    return clients.filter(
      (c) =>
        (c.business_name || '').toLowerCase().includes(s) ||
        (c.client_code || '').toLowerCase().includes(s)
    )
  }, [clients, clientSearchTerm])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#f5f3f0]">
      <header className="shrink-0 border-b border-stone-200/70 bg-[#f5f3f0]">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold tracking-tight text-stone-900">
                Evidencia remisiones (concreto)
              </h1>
              <ConcreteEvidenceHelpSheet />
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Revise pedidos, remisiones de concreto y archivos de respaldo; el panel derecho permanece
              visible al desplazar la tabla.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8 border-stone-300 bg-white" asChild>
              <Link href="/finanzas">← Finanzas</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-stone-300 bg-white"
              disabled={loading || excelBusy || total === 0}
              onClick={() => void exportExcel()}
            >
              {excelBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Descargar Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-stone-300 bg-white"
              disabled={loading || bulkZipBusy || zipOrderSelection.size === 0}
              onClick={() => void downloadBulkEvidenceZip()}
              title={`Hasta ${MAX_BULK_ZIP_ORDERS} pedidos y ${MAX_BULK_ZIP_FILES} archivos PDF/imagen`}
            >
              {bulkZipBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              ZIP pedidos ({zipOrderSelection.size})
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row lg:items-start min-h-0 max-w-[1600px] mx-auto w-full">
        <div className="flex-1 min-w-0 flex flex-col min-h-0 px-4 md:px-6 pb-4 pt-4">
          <Card className="border-stone-200/80 shadow-sm shrink-0">
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
                  className="min-h-10 w-[160px] bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ev-to">Hasta</Label>
                <Input
                  id="ev-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="min-h-10 w-[160px] bg-white"
                />
              </div>
              <div className="space-y-1.5 min-w-[200px]">
                <Label>Planta</Label>
                <Select
                  value={isPlantManager ? currentPlant?.id || '_all' : plantId || '_all'}
                  onValueChange={(v) => setPlantId(v === '_all' ? '' : v)}
                  disabled={isPlantManager}
                >
                  <SelectTrigger className="min-h-10 bg-white border-stone-300">
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
              <div className="space-y-1.5 min-w-[220px]">
                <Label>Cliente</Label>
                <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="min-h-10 w-full justify-between font-normal bg-white border-stone-300"
                      disabled={clientsLoading}
                    >
                      {clientsLoading ? (
                        <span className="text-muted-foreground">Cargando…</span>
                      ) : selectedClient ? (
                        <span className="truncate">{selectedClient.business_name}</span>
                      ) : (
                        <span className="text-muted-foreground">Todos los clientes</span>
                      )}
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-80" align="start">
                    <div className="flex items-center border-b px-2">
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Buscar…"
                        className="border-0 focus-visible:ring-0 h-9"
                        value={clientSearchTerm}
                        onChange={(e) => setClientSearchTerm(e.target.value)}
                      />
                    </div>
                    <Command>
                      <CommandList className="max-h-56">
                        <CommandEmpty>Sin coincidencias</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="_clear"
                            onSelect={() => {
                              setClientId('')
                              setClientPopoverOpen(false)
                            }}
                          >
                            Todos los clientes
                          </CommandItem>
                          {filteredClients.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.id}
                              onSelect={() => {
                                setClientId(c.id)
                                setClientPopoverOpen(false)
                              }}
                            >
                              <span className="truncate">{c.business_name}</span>
                              {c.client_code && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({c.client_code})
                                </span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {clientId && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground hover:text-stone-700 flex items-center gap-0.5"
                    onClick={() => setClientId('')}
                  >
                    <X className="h-3 w-3" /> Limpiar cliente
                  </button>
                )}
              </div>
              <div className="space-y-1.5 min-w-[240px]">
                <Label>Estado evidencia</Label>
                <Select
                  value={evidenceStatus}
                  onValueChange={(v) => setEvidenceStatus(v as EvidenceStatus)}
                >
                  <SelectTrigger className="min-h-10 bg-white border-stone-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="needs_evidence">Con remisiones y sin evidencia</SelectItem>
                    <SelectItem value="has_evidence">Con remisiones y con evidencia</SelectItem>
                    <SelectItem value="no_remisiones">Sin remisiones de concreto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                disabled={loading}
                className="min-h-10 gap-2 border-stone-300 bg-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Actualizar
              </Button>
            </CardContent>
          </Card>

          <div className="mt-3 flex flex-wrap items-center gap-3 shrink-0">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar pedido, cliente, obra, planta, remisión…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 bg-white border-stone-300"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredRows.length} de {rows.length} en página
              {total > 0 && ` · ${total} total`}
              {truncated && ' · acote fechas si falta data'}
            </p>
          </div>

          <div className="flex-1 min-h-0 overflow-auto mt-2 rounded-lg border border-stone-200/80 bg-white">
            {loading && rows.length === 0 ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-stone-50/80 sticky top-0 z-10">
                    <TableHead className="w-10 px-2">
                      <Checkbox
                        checked={
                          zipSelectableOnPage.length === 0
                            ? false
                            : zipAllOnPageSelected
                              ? true
                              : zipSomeOnPageSelected
                                ? 'indeterminate'
                                : false
                        }
                        onCheckedChange={() => toggleZipSelectAllOnPage()}
                        disabled={zipSelectableOnPage.length === 0 || loading}
                        className="border-stone-400 data-[state=checked]:bg-stone-800 data-[state=checked]:border-stone-800"
                        aria-label="Seleccionar o quitar todos los pedidos con evidencia en esta vista"
                      />
                    </TableHead>
                    <TableHead>Fecha entrega</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Planta</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead className="text-right">Rem.</TableHead>
                    <TableHead className="text-right">m³</TableHead>
                    <TableHead className="text-right">Arch.</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última carga</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-12">
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
                      const delivery = formatPostgresDateEs(r.delivery_date)
                      return (
                        <TableRow
                          key={r.order_id}
                          data-state={selectedOrderId === r.order_id ? 'selected' : undefined}
                          className={cn(
                            'cursor-pointer',
                            selectedOrderId === r.order_id &&
                              'bg-sky-50/80 ring-1 ring-inset ring-sky-200'
                          )}
                          onClick={() => selectRow(r)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              selectRow(r)
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          aria-label={`Inspeccionar pedido ${r.order_number}`}
                        >
                          <TableCell
                            className="w-10 px-2 align-middle"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            {r.evidence_count > 0 ? (
                              <Checkbox
                                checked={zipOrderSelection.has(r.order_id)}
                                onCheckedChange={() => {
                                  setZipOrderSelection((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(r.order_id)) next.delete(r.order_id)
                                    else next.add(r.order_id)
                                    return next
                                  })
                                }}
                                className="border-stone-400 data-[state=checked]:bg-stone-800 data-[state=checked]:border-stone-800"
                                aria-label={`Incluir pedido ${r.order_number} en ZIP múltiple`}
                              />
                            ) : (
                              <span className="inline-block w-4 h-4" aria-hidden />
                            )}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{delivery}</TableCell>
                          <TableCell className="font-medium">{r.order_number}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground max-w-[100px] truncate">
                            {r.plant_code || r.plant_name || '—'}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate">{r.client_name || '—'}</TableCell>
                          <TableCell className="max-w-[160px] truncate">
                            {r.construction_site || '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.concrete_remisiones_count}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                            {r.concrete_volume_sum != null
                              ? r.concrete_volume_sum.toFixed(2)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.evidence_count}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('text-xs font-normal', STATUS_BADGE[status])}
                            >
                              {r.has_evidence ? (
                                <span className="inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" aria-hidden /> {label}
                                </span>
                              ) : r.concrete_remisiones_count > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                  <XCircle className="h-3 w-3" aria-hidden /> {label}
                                </span>
                              ) : (
                                label
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {r.evidence_last_at
                              ? format(new Date(r.evidence_last_at), 'dd/MM/yyyy HH:mm', {
                                  locale: es,
                                })
                              : '—'}
                            {r.evidence_last_uploader_name && (
                              <span className="block text-[11px] truncate max-w-[120px]">
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
              <div className="p-4 flex justify-center border-t border-border/60 bg-stone-50/50">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => fetchPage(rows.length, true)}
                  className="border-stone-300"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Cargar más ({rows.length} / {total})
                </Button>
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            'hidden lg:block shrink-0 w-[420px] xl:w-[480px]',
            'border-l border-stone-200/80 bg-card',
            'lg:sticky lg:top-16 lg:self-start',
            'lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto'
          )}
        >
          <ConcreteEvidenceOrderDetailPanel
            orderId={selectedOrderId}
            summary={selectedRow ? rowToSummary(selectedRow) : null}
            onClose={() => {
              setSelectedOrderId(null)
              pushUrl(null)
            }}
            className="border-l-0 w-full"
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
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
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
            className="border-l-0 max-h-full w-full max-w-none"
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
