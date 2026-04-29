'use client'

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  useSyncExternalStore,
} from 'react'
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
  Shuffle,
  HelpCircle,
  Copy,
  FileText,
  FileStack,
  FileType2,
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
import {
  REMISION_DOCUMENTS_BUCKET,
  downloadStorageFileArrayBuffer,
} from '@/lib/supabase/storageDownload'
import { downloadBlobInBrowser } from '@/lib/browser/downloadBlob'
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
import { useFinanzasAuditCapabilities } from '@/hooks/finanzas/useFinanzasAuditCapabilities'
import ConcreteEvidenceOrderDetailPanel, {
  type OrderSummary,
} from '@/components/finanzas/ConcreteEvidenceOrderDetailPanel'
import type { ClientEnriched } from '@/app/api/clients/list-enriched/route'
import {
  buildConcreteEvidenceExcelArrayBuffer,
  type ConcreteEvidenceExportMeta,
} from '@/lib/finanzas/buildConcreteEvidenceExcel'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { fetchArkikReassignmentNotesByRemisionNumber } from '@/services/reportDataService'
import {
  formatRemisionesForAccounting,
  mergeAccountingTsvBlocks,
} from '@/lib/remisiones/accountingClipboard'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export const REPORTES_CLIENTES_PRESELECT_KEY = 'reportes_clientes.preselect'

type TriFilter = 'with' | 'without' | 'all'

type LegacyEvidenceStatus = 'all' | 'needs_evidence' | 'has_evidence' | 'no_remisiones'

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

function buildFilterExportLabel(he: TriFilter, hr: TriFilter): string {
  const ev =
    he === 'all' ? 'Cualquier evidencia' : he === 'with' ? 'Con evidencia' : 'Sin evidencia'
  const re =
    hr === 'all' ? 'Cualquier remisión' : hr === 'with' ? 'Con remisiones' : 'Sin remisiones'
  return `${ev} · ${re}`
}

function legacyToTriPair(
  s: LegacyEvidenceStatus
): { he: TriFilter; hr: TriFilter } {
  switch (s) {
    case 'needs_evidence':
      return { he: 'without', hr: 'with' }
    case 'has_evidence':
      return { he: 'with', hr: 'all' }
    case 'no_remisiones':
      return { he: 'all', hr: 'without' }
    default:
      return { he: 'all', hr: 'all' }
  }
}

function parseTriFromParams(params: URLSearchParams, key: string): TriFilter | null {
  const raw = (params.get(key) || '').trim().toLowerCase()
  if (raw === 'with' || raw === 'without' || raw === 'all') return raw
  return null
}

function parseFiltersFromUrl(params: URLSearchParams): { he: TriFilter; hr: TriFilter } {
  const he = parseTriFromParams(params, 'has_evidence')
  const hr = parseTriFromParams(params, 'has_remisiones')
  if (he !== null || hr !== null) {
    return { he: he ?? 'all', hr: hr ?? 'all' }
  }
  return legacyToTriPair(parseLegacyEvidenceStatusFromSearch(params))
}

function parseLegacyEvidenceStatusFromSearch(params: URLSearchParams): LegacyEvidenceStatus {
  const legacy =
    params.get('missing_only') === '1' || params.get('missing_only') === 'true'
  const raw = (params.get('evidence_status') || '').trim().toLowerCase()
  if (legacy) return 'needs_evidence'
  if (
    raw === 'needs_evidence' ||
    raw === 'has_evidence' ||
    raw === 'no_remisiones' ||
    raw === 'all'
  ) {
    return raw as LegacyEvidenceStatus
  }
  return 'all'
}

function parsePlantIdsFromUrl(params: URLSearchParams): string[] {
  const csv = params.get('plant_ids')
  const out: string[] = []
  if (csv) {
    for (const s of csv.split(',')) {
      const t = s.trim()
      if (t) out.push(t)
    }
  }
  const single = params.get('plant_id')?.trim()
  if (single) out.push(single)
  return [...new Set(out)]
}

const MAX_BULK_ZIP_ORDERS = 25
const MAX_BULK_ZIP_FILES = 200

function rowHasArkikReassignment(r: Row, m: Map<string, string>): boolean {
  for (const n of r.remision_numbers || []) {
    if (m.get(String(n).trim())) return true
  }
  return false
}

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

/** Desktop: docked detail panel; mobile: sheet (see Sheet below). */
function useMediaQueryMdUp() {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === 'undefined') return () => {}
      const mq = window.matchMedia('(min-width: 768px)')
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false),
    () => false
  )
}

export default function EvidenciaRemisionesConcretoClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { availablePlants, currentPlant } = usePlantContext()
  const { profile } = useAuthSelectors()
  const { canWrite: auditWriterPanel } = useFinanzasAuditCapabilities()

  const isPlantManager = profile?.role === 'PLANT_MANAGER'
  const plantList = useMemo(
    () => (availablePlants?.length ? availablePlants : currentPlant ? [currentPlant] : []),
    [availablePlants, currentPlant]
  )

  const [from, setFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  /** Empty = todas las plantas (no filtro). */
  const [selectedPlantIds, setSelectedPlantIds] = useState<string[]>([])
  const [plantPopoverOpen, setPlantPopoverOpen] = useState(false)
  const [clientId, setClientId] = useState<string>('')
  const [hasEvidenceFilter, setHasEvidenceFilter] = useState<TriFilter>('all')
  const [hasRemisionesFilter, setHasRemisionesFilter] = useState<TriFilter>('all')
  const [loading, setLoading] = useState(false)
  const [excelBusy, setExcelBusy] = useState(false)
  const [bulkZipBusy, setBulkZipBusy] = useState(false)
  const [bulkConcretePdfZipBusy, setBulkConcretePdfZipBusy] = useState(false)
  const [bulkPumpingPdfBusy, setBulkPumpingPdfBusy] = useState(false)
  const [accountingBusy, setAccountingBusy] = useState(false)
  const [reportNavBusy, setReportNavBusy] = useState(false)
  const [zipConfirmOpen, setZipConfirmOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => new Set())
  const [rows, setRows] = useState<Row[]>([])
  const [reassignmentByRemisionPage, setReassignmentByRemisionPage] = useState<Map<string, string>>(
    () => new Map()
  )
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [hydratedFromUrl, setHydratedFromUrl] = useState(false)
  const isMdUp = useMediaQueryMdUp()

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
      if (isPlantManager && currentPlant?.id) {
        p.set('plant_id', currentPlant.id)
      } else if (selectedPlantIds.length === 1) {
        p.set('plant_id', selectedPlantIds[0])
      } else if (selectedPlantIds.length > 1) {
        p.set('plant_ids', selectedPlantIds.join(','))
      }
      if (clientId) p.set('client_id', clientId)
      if (hasEvidenceFilter !== 'all') p.set('has_evidence', hasEvidenceFilter)
      if (hasRemisionesFilter !== 'all') p.set('has_remisiones', hasRemisionesFilter)
      if (oid) p.set('order_id', oid)
      const q = p.toString()
      startTransition(() => {
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
      })
    },
    [
      from,
      to,
      selectedPlantIds,
      clientId,
      hasEvidenceFilter,
      hasRemisionesFilter,
      selectedOrderId,
      pathname,
      router,
      isPlantManager,
      currentPlant?.id,
    ]
  )

  useEffect(() => {
    const df = searchParams.get('date_from')
    const dt = searchParams.get('date_to')
    const cid = searchParams.get('client_id')
    const oid = searchParams.get('order_id')
    if (df) setFrom(df)
    if (dt) setTo(dt)
    if (cid) setClientId(cid)
    const { he, hr } = parseFiltersFromUrl(searchParams)
    setHasEvidenceFilter(he)
    setHasRemisionesFilter(hr)
    if (!isPlantManager) {
      const pids = parsePlantIdsFromUrl(searchParams)
      setSelectedPlantIds(pids)
    }
    if (oid) {
      setSelectedOrderId(oid)
    }
    setHydratedFromUrl(true)
  }, [searchParams, isPlantManager])

  useEffect(() => {
    if (isPlantManager && currentPlant?.id) {
      setSelectedPlantIds([currentPlant.id])
    }
  }, [isPlantManager, currentPlant?.id])

  useEffect(() => {
    setSelectedOrderIds(new Set())
  }, [from, to, selectedPlantIds, clientId, hasEvidenceFilter, hasRemisionesFilter, isPlantManager, currentPlant?.id])

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true)
      try {
        const sp = new URLSearchParams({
          date_from: from,
          date_to: to,
          limit: '100',
          offset: String(offset),
          include_summary: 'false',
        })
        if (hasEvidenceFilter !== 'all') sp.set('has_evidence', hasEvidenceFilter)
        if (hasRemisionesFilter !== 'all') sp.set('has_remisiones', hasRemisionesFilter)
        if (isPlantManager && currentPlant?.id) {
          sp.set('plant_id', currentPlant.id)
        } else if (selectedPlantIds.length === 1) {
          sp.set('plant_id', selectedPlantIds[0])
        } else if (selectedPlantIds.length > 1) {
          sp.set('plant_ids', selectedPlantIds.join(','))
        }
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
    [
      from,
      to,
      hasEvidenceFilter,
      hasRemisionesFilter,
      selectedPlantIds,
      clientId,
      isPlantManager,
      currentPlant?.id,
    ]
  )

  useEffect(() => {
    if (!hydratedFromUrl) return
    void fetchPage(0, false)
  }, [
    from,
    to,
    hasEvidenceFilter,
    hasRemisionesFilter,
    selectedPlantIds,
    clientId,
    hydratedFromUrl,
    isPlantManager,
    currentPlant?.id,
    fetchPage,
  ])

  useEffect(() => {
    let cancelled = false
    const nums = Array.from(
      new Set(
        rows
          .flatMap((r) => r.remision_numbers || [])
          .map((n) => String(n).trim())
          .filter(Boolean),
      ),
    )
    if (!nums.length) {
      setReassignmentByRemisionPage(new Map())
      return
    }
    fetchArkikReassignmentNotesByRemisionNumber(nums).then((m) => {
      if (!cancelled) setReassignmentByRemisionPage(m)
    })
    return () => {
      cancelled = true
    }
  }, [rows])

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

  const selectableOnPage = useMemo(
    () => filteredRows.filter((r) => r.concrete_remisiones_count > 0),
    [filteredRows]
  )
  const allOnPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((r) => selectedOrderIds.has(r.order_id))
  const someOnPageSelected = selectableOnPage.some((r) => selectedOrderIds.has(r.order_id))

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev)
        for (const r of selectableOnPage) next.delete(r.order_id)
        return next
      })
    } else {
      setSelectedOrderIds((prev) => {
        const next = new Set(prev)
        for (const r of selectableOnPage) next.add(r.order_id)
        return next
      })
    }
  }

  const downloadBulkEvidenceZip = async () => {
    const ids = [...selectedOrderIds]
    if (ids.length === 0) {
      toast.error('Seleccione al menos un pedido')
      return
    }
    if (ids.length > MAX_BULK_ZIP_ORDERS) {
      toast.error(`Máximo ${MAX_BULK_ZIP_ORDERS} pedidos por ZIP`)
      return
    }
    const noEvidence = ids.filter((id) => {
      const row = rows.find((x) => x.order_id === id)
      return row && row.evidence_count === 0
    })
    if (noEvidence.length > 0) {
      setZipConfirmOpen(true)
      return
    }
    await runBulkZipDownload(ids)
  }

  const runBulkZipDownload = async (ids: string[]) => {
    setZipConfirmOpen(false)
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
            const buf = await downloadStorageFileArrayBuffer(REMISION_DOCUMENTS_BUCKET, ev.file_path)
            if (!buf) continue
            const rel = uniqueZipPath(
              `${folder}/${sanitizeZipPathSegment(ev.original_name, 'archivo')}`,
              usedPaths
            )
            zip.file(rel, buf)
            fileCount += 1
          }

          if (fileCount < MAX_BULK_ZIP_FILES) {
            const pumpRes = await fetch(`/api/orders/${orderId}/pumping-evidence`)
            const pumpJson = (await pumpRes.json()) as {
              data?: Array<{
                remision_number: string | number
                remision_documents?: Array<{
                  file_path: string
                  original_name: string
                  mime_type?: string | null
                }>
              }>
            }
            if (pumpRes.ok && Array.isArray(pumpJson.data)) {
              for (const pr of pumpJson.data) {
                if (fileCount >= MAX_BULK_ZIP_FILES) break
                const docs = Array.isArray(pr.remision_documents) ? pr.remision_documents : []
                const remNo = String(pr.remision_number ?? '').trim() || 'REM'
                for (const d of docs) {
                  if (fileCount >= MAX_BULK_ZIP_FILES) break
                  if (!isConcreteEvidenceFileZippable(d.mime_type ?? null, d.original_name || '')) {
                    continue
                  }
                  const buf = await downloadStorageFileArrayBuffer(
                    REMISION_DOCUMENTS_BUCKET,
                    d.file_path
                  )
                  if (!buf) continue
                  const baseName = sanitizeZipPathSegment(
                    `R${remNo}-${d.original_name || 'archivo'}`,
                    'archivo'
                  )
                  const rel = uniqueZipPath(`${folder}/bombeo/${baseName}`, usedPaths)
                  zip.file(rel, buf)
                  fileCount += 1
                }
              }
            }
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
      downloadBlobInBrowser(blob, `evidencia-multipedido-${from}-${to}-${stamp}.zip`)
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

  const runBulkConcreteOnePdfPerOrderZip = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error('Seleccione al menos un pedido')
      return
    }
    if (ids.length > MAX_BULK_ZIP_ORDERS) {
      toast.error(`Máximo ${MAX_BULK_ZIP_ORDERS} pedidos por descarga`)
      return
    }
    setBulkConcretePdfZipBusy(true)
    try {
      const { mergeEvidencePartsToPdf } = await import('@/lib/finanzas/mergeEvidenceToPdf')
      const JSZip = (await import('jszip')).default
      const zip = new JSZip()
      const usedPaths = new Set<string>()
      let added = 0
      for (const orderId of ids) {
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
          const zippable = evidence.filter((e) =>
            isConcreteEvidenceFileZippable(e.mime_type ?? null, e.original_name || '')
          )
          if (zippable.length === 0) continue
          const parts: Array<{ buffer: ArrayBuffer; mimeType: string; name: string }> = []
          for (const ev of zippable) {
            const buf = await downloadStorageFileArrayBuffer(
              REMISION_DOCUMENTS_BUCKET,
              ev.file_path
            )
            if (!buf) continue
            parts.push({
              buffer: buf,
              mimeType: ev.mime_type || '',
              name: ev.original_name || 'archivo',
            })
          }
          if (parts.length === 0) continue
          const pdfBytes = await mergeEvidencePartsToPdf(parts)
          const row = rows.find((x) => x.order_id === orderId)
          const orderNumber = row?.order_number || orderId.slice(0, 8)
          const folder = `${sanitizeZipPathSegment(String(orderNumber), 'pedido')}_${orderId.slice(0, 8)}`
          const safe = sanitizeZipPathSegment(String(orderNumber), 'pedido')
          const rel = uniqueZipPath(`${folder}/evidencia-concreto-${safe}.pdf`, usedPaths)
          zip.file(rel, pdfBytes)
          added += 1
        } catch {
          continue
        }
      }
      if (added === 0) {
        toast.error('Ningún pedido tenía PDF o imagen de evidencia concreta para unir')
        return
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const stamp = format(new Date(), 'yyyyMMdd-HHmm')
      downloadBlobInBrowser(
        blob,
        `evidencia-concreto-pdf-por-pedido-${from}-${to}-${stamp}.zip`
      )
      toast.success(`ZIP con ${added} PDF (1 por pedido, evidencia concreto)`)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el ZIP de PDFs')
    } finally {
      setBulkConcretePdfZipBusy(false)
    }
  }

  const runBulkPumpingAllOrdersOnePdf = async (ids: string[]) => {
    if (ids.length === 0) {
      toast.error('Seleccione al menos un pedido')
      return
    }
    if (ids.length > MAX_BULK_ZIP_ORDERS) {
      toast.error(`Máximo ${MAX_BULK_ZIP_ORDERS} pedidos por descarga`)
      return
    }
    setBulkPumpingPdfBusy(true)
    try {
      const { buildPumpingMultiOrderPdf } = await import('@/lib/finanzas/bulkOrderEvidencePdfs')
      const sections: Array<{
        orderNumber: string
        parts: Array<{ buffer: ArrayBuffer; mimeType: string; name: string }>
      }> = []
      for (const orderId of ids) {
        const row = rows.find((x) => x.order_id === orderId)
        const orderNumber = String(row?.order_number || orderId.slice(0, 8))
        const pumpRes = await fetch(`/api/orders/${orderId}/pumping-evidence`)
        const pumpJson = (await pumpRes.json()) as {
          data?: Array<{
            remision_number: string | number
            remision_documents?: Array<{
              file_path: string
              original_name: string
              mime_type?: string | null
            }>
          }>
        }
        const parts: Array<{ buffer: ArrayBuffer; mimeType: string; name: string }> = []
        if (pumpRes.ok && Array.isArray(pumpJson.data)) {
          for (const pr of pumpJson.data) {
            const docs = Array.isArray(pr.remision_documents) ? pr.remision_documents : []
            const remNo = String(pr.remision_number ?? '').trim() || 'REM'
            for (const d of docs) {
              if (!isConcreteEvidenceFileZippable(d.mime_type ?? null, d.original_name || '')) {
                continue
              }
              const buf = await downloadStorageFileArrayBuffer(
                REMISION_DOCUMENTS_BUCKET,
                d.file_path
              )
              if (!buf) continue
              parts.push({
                buffer: buf,
                mimeType: d.mime_type || '',
                name: `R${remNo}-${d.original_name || 'archivo'}`,
              })
            }
          }
        }
        sections.push({ orderNumber, parts })
      }
      const pdfBytes = await buildPumpingMultiOrderPdf(sections)
      const stamp = format(new Date(), 'yyyyMMdd-HHmm')
      downloadBlobInBrowser(
        new Blob([pdfBytes], { type: 'application/pdf' }),
        `evidencia-bombeo-todos-pedidos-${from}-${to}-${stamp}.pdf`
      )
      toast.success('PDF de bombeo: un solo archivo, portada por pedido y luego las pruebas')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF de bombeo')
    } finally {
      setBulkPumpingPdfBusy(false)
    }
  }

  const downloadBulkConcretePdfPerOrderZip = () => {
    void runBulkConcreteOnePdfPerOrderZip([...selectedOrderIds])
  }

  const downloadBulkPumpingOnePdf = () => {
    void runBulkPumpingAllOrdersOnePdf([...selectedOrderIds])
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
          limit: String(limit),
          offset: String(offset),
          include_summary: 'false',
        })
        if (hasEvidenceFilter !== 'all') sp.set('has_evidence', hasEvidenceFilter)
        if (hasRemisionesFilter !== 'all') sp.set('has_remisiones', hasRemisionesFilter)
        if (isPlantManager && currentPlant?.id) {
          sp.set('plant_id', currentPlant.id)
        } else if (selectedPlantIds.length === 1) {
          sp.set('plant_id', selectedPlantIds[0])
        } else if (selectedPlantIds.length > 1) {
          sp.set('plant_ids', selectedPlantIds.join(','))
        }
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

      const plantLabel = (() => {
        if (isPlantManager) {
          return currentPlant
            ? [currentPlant.code, currentPlant.name].filter(Boolean).join(' — ') || currentPlant.name
            : 'Planta (sesión)'
        }
        if (selectedPlantIds.length === 0) return 'Todas las plantas'
        if (selectedPlantIds.length === 1) {
          const p = plantList.find((x) => x.id === selectedPlantIds[0])
          return p ? [p.code, p.name].filter(Boolean).join(' — ') || p.name : selectedPlantIds[0]
        }
        return `${selectedPlantIds.length} plantas`
      })()

      const cappedAtMax = accumulated.length >= maxOrders && apiTotal > accumulated.length

      const meta: ConcreteEvidenceExportMeta = {
        generatedAtIso: new Date().toISOString(),
        dateFrom: from,
        dateTo: to,
        plantLabel,
        clientLabel: selectedClient?.business_name ?? 'Todos los clientes',
        evidenceStatusLabel: buildFilterExportLabel(hasEvidenceFilter, hasRemisionesFilter),
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

  const selectionStats = useMemo(() => {
    let m3 = 0
    let rems = 0
    for (const id of selectedOrderIds) {
      const r = rows.find((x) => x.order_id === id)
      if (r) {
        rems += r.concrete_remisiones_count
        m3 += r.concrete_volume_sum ?? 0
      }
    }
    return { orders: selectedOrderIds.size, m3, rems }
  }, [selectedOrderIds, rows])

  const handleCopyAccounting = useCallback(async () => {
    const ids = [...selectedOrderIds]
    if (ids.length === 0) {
      toast.error('Seleccione al menos un pedido')
      return
    }
    setAccountingBusy(true)
    try {
      const res = await fetch('/api/finanzas/accounting-clipboard-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: ids }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      const orders = json.data?.orders as Array<{
        order_id: string
        requires_invoice: boolean
        construction_site: string
        has_empty_truck_charge: boolean
        remisiones: any[]
        order_products: any[]
      }>
      if (!orders?.length) {
        toast.error('No se pudieron cargar datos de los pedidos')
        return
      }
      const blocks = orders.map((o) =>
        formatRemisionesForAccounting(
          o.remisiones,
          o.requires_invoice,
          o.construction_site,
          o.has_empty_truck_charge,
          o.order_products
        )
      )
      const merged = mergeAccountingTsvBlocks(blocks)
      if (!merged) {
        toast.error('No hay remisiones para copiar')
        return
      }
      await navigator.clipboard.writeText(merged)
      let remCount = 0
      for (const o of orders) {
        remCount += (o.remisiones || []).filter((r: any) => r.tipo_remision === 'CONCRETO' || r.tipo_remision === 'BOMBEO').length
      }
      toast.success(`Copiado: ${remCount} remisiones de ${orders.length} pedido(s)`)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al copiar')
    } finally {
      setAccountingBusy(false)
    }
  }, [selectedOrderIds])

  const handleReporteCliente = useCallback(async () => {
    const ids = [...selectedOrderIds]
    if (ids.length === 0) {
      toast.error('Seleccione al menos un pedido')
      return
    }
    setReportNavBusy(true)
    try {
      const sp = new URLSearchParams({ order_ids: ids.join(',') })
      const res = await fetch(`/api/finanzas/concrete-remision-ids?${sp.toString()}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error')
      const remisionIds: string[] = json.data?.remision_ids || []
      const plantIdsFromApi: string[] = Array.isArray(json.data?.plant_ids)
        ? json.data.plant_ids
        : []
      if (!remisionIds.length) {
        toast.error('No hay remisiones de concreto en los pedidos seleccionados')
        return
      }
      const selectedRows = rows.filter((r) => ids.includes(r.order_id))
      const plantsFromRows = [
        ...new Set(
          selectedRows
            .map((r) => r.plant_id)
            .filter((pid): pid is string => Boolean(pid && typeof pid === 'string')),
        ),
      ]
      const plantsFromOrders =
        plantsFromRows.length > 0 ? plantsFromRows : [...new Set(plantIdsFromApi)]
      // Report page filters hierarchical data by plant; must match the orders' plants, not only
      // currentPlant / UI filter (empty "todas las plantas" + wrong context plant broke preselect).
      let plantIdsForReport: string[]
      if (isPlantManager && currentPlant?.id) {
        plantIdsForReport = [currentPlant.id]
      } else if (plantsFromOrders.length > 0) {
        plantIdsForReport = plantsFromOrders
      } else if (selectedPlantIds.length > 0) {
        plantIdsForReport = [...selectedPlantIds]
      } else if (currentPlant?.id) {
        plantIdsForReport = [currentPlant.id]
      } else {
        plantIdsForReport = []
      }
      const payload = {
        source: 'evidencia' as const,
        dateRange: {
          from: new Date(from + 'T12:00:00').toISOString(),
          to: new Date(to + 'T12:00:00').toISOString(),
        },
        plantIds: plantIdsForReport,
        remisionIds,
        orderIds: ids,
      }
      sessionStorage.setItem(REPORTES_CLIENTES_PRESELECT_KEY, JSON.stringify(payload))
      router.push('/finanzas/reportes-clientes?from=evidencia&step=columns')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error al preparar reporte')
    } finally {
      setReportNavBusy(false)
    }
  }, [selectedOrderIds, from, to, isPlantManager, currentPlant?.id, selectedPlantIds, router, rows])

  const copyAccountingRef = useRef(handleCopyAccounting)
  const reportClienteRef = useRef(handleReporteCliente)
  const downloadZipRef = useRef<() => void>(() => {})
  const toggleAllRef = useRef<() => void>(() => {})
  copyAccountingRef.current = handleCopyAccounting
  reportClienteRef.current = handleReporteCliente
  downloadZipRef.current = () => void downloadBulkEvidenceZip()
  toggleAllRef.current = () => toggleSelectAllOnPage()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen((o) => !o)
        return
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        toggleAllRef.current()
      }
      if (e.key === 'c' || e.key === 'C') {
        if (e.metaKey || e.ctrlKey) return
        e.preventDefault()
        void copyAccountingRef.current()
      }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        void reportClienteRef.current()
      }
      if (e.key === 'z' || e.key === 'Z') {
        e.preventDefault()
        void downloadZipRef.current()
      }
      if (e.key === 'Escape') {
        setSelectedOrderIds(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const closeDetailPanel = useCallback(() => {
    setSelectedOrderId(null)
    pushUrl(null)
  }, [pushUrl])

  const selectRow = (r: Row) => {
    setSelectedOrderId(r.order_id)
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
    <TooltipProvider delayDuration={200}>
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#f5f3f0] text-[17px] text-stone-900">
      <header className="shrink-0 border-b border-stone-200/70 bg-[#f5f3f0]">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                Evidencia remisiones (concreto)
              </h1>
              <ConcreteEvidenceHelpSheet />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 border-stone-300 bg-white"
                aria-label="Atajos de teclado"
                onClick={() => setShortcutsOpen(true)}
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-base text-stone-700 mt-2 max-w-3xl leading-relaxed">
              Revise pedidos y evidencia; seleccione filas y use la barra inferior para Excel, ZIP, copiar a
              contabilidad o reporte de cliente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="lg" className="h-12 min-w-[44px] border-stone-300 bg-white text-base" asChild>
              <Link href="/finanzas">← Finanzas</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row md:items-stretch min-h-0 max-w-[1600px] mx-auto w-full pb-36">
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
              <div className="space-y-1.5 min-w-[220px] max-w-md">
                <Label>Plantas</Label>
                {isPlantManager ? (
                  <p className="text-base min-h-12 px-3 py-2 rounded-md border border-stone-300 bg-stone-50">
                    {currentPlant
                      ? [currentPlant.code, currentPlant.name].filter(Boolean).join(' — ') || currentPlant.name
                      : '—'}
                  </p>
                ) : (
                  <Popover open={plantPopoverOpen} onOpenChange={setPlantPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-12 w-full justify-between font-normal bg-white border-stone-300 text-base"
                      >
                        <span className="truncate text-left">
                          {selectedPlantIds.length === 0
                            ? 'Todas las plantas'
                            : `${selectedPlantIds.length} seleccionada(s)`}
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="border-b px-3 py-2 flex items-center gap-2">
                        <Checkbox
                          id="plant-all"
                          checked={selectedPlantIds.length === 0}
                          onCheckedChange={(c) => {
                            if (c === true) setSelectedPlantIds([])
                          }}
                          className="border-stone-400"
                        />
                        <label htmlFor="plant-all" className="text-base cursor-pointer">
                          Todas las plantas
                        </label>
                      </div>
                      <Command>
                        <CommandList className="max-h-56">
                          <CommandGroup>
                            {plantList.map((p) => {
                              const checked = selectedPlantIds.includes(p.id)
                              return (
                                <CommandItem
                                  key={p.id}
                                  value={p.id}
                                  onSelect={() => {
                                    setSelectedPlantIds((prev) => {
                                      const next = new Set(prev)
                                      if (next.has(p.id)) next.delete(p.id)
                                      else next.add(p.id)
                                      return [...next]
                                    })
                                  }}
                                  className="flex items-center gap-2 cursor-pointer"
                                >
                                  <Checkbox checked={checked} className="pointer-events-none" />
                                  <span className="text-base">
                                    {p.code ? `${p.code} — ${p.name}` : p.name}
                                  </span>
                                </CommandItem>
                              )
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
                {!isPlantManager && selectedPlantIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {selectedPlantIds.map((id) => {
                      const p = plantList.find((x) => x.id === id)
                      const label = p ? (p.code ? `${p.code} — ${p.name}` : p.name) : id.slice(0, 8)
                      return (
                        <button
                          key={id}
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-2 py-1 text-sm"
                          onClick={() => setSelectedPlantIds((prev) => prev.filter((x) => x !== id))}
                        >
                          {label}
                          <X className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      )
                    })}
                  </div>
                )}
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
              <div className="space-y-1.5 min-w-[200px]">
                <Label>Evidencia (archivos)</Label>
                <Select
                  value={hasEvidenceFilter}
                  onValueChange={(v) => setHasEvidenceFilter(v as TriFilter)}
                >
                  <SelectTrigger className="min-h-12 bg-white border-stone-300 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="with">Con evidencia</SelectItem>
                    <SelectItem value="without">Sin evidencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 min-w-[200px]">
                <Label>Remisiones de concreto</Label>
                <Select
                  value={hasRemisionesFilter}
                  onValueChange={(v) => setHasRemisionesFilter(v as TriFilter)}
                >
                  <SelectTrigger className="min-h-12 bg-white border-stone-300 text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="with">Con remisiones</SelectItem>
                    <SelectItem value="without">Sin remisiones</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleRefresh}
                disabled={loading}
                className="min-h-12 gap-2 border-stone-300 bg-white text-base"
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
                className="pl-10 h-12 text-base bg-white border-stone-300 focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
              />
            </div>
            <p className="text-sm text-stone-600">
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
                    <TableHead className="w-12 px-2">
                      <Checkbox
                        checked={
                          selectableOnPage.length === 0
                            ? false
                            : allOnPageSelected
                              ? true
                              : someOnPageSelected
                                ? 'indeterminate'
                                : false
                        }
                        onCheckedChange={() => toggleSelectAllOnPage()}
                        disabled={selectableOnPage.length === 0 || loading}
                        className="h-5 w-5 border-stone-500 data-[state=checked]:bg-stone-900 data-[state=checked]:border-stone-900"
                        aria-label="Seleccionar o quitar todos los pedidos con remisiones en esta vista"
                      />
                    </TableHead>
                    <TableHead className="text-base font-semibold text-stone-900">Fecha entrega</TableHead>
                    <TableHead className="text-base font-semibold text-stone-900">Pedido</TableHead>
                    <TableHead className="text-base font-semibold text-stone-900">Planta</TableHead>
                    <TableHead className="text-base font-semibold text-stone-900">Cliente</TableHead>
                    <TableHead className="text-base font-semibold text-stone-900">Obra</TableHead>
                    <TableHead className="text-right text-base font-semibold text-stone-900">Rem.</TableHead>
                    <TableHead className="text-right text-base font-semibold text-stone-900">m³</TableHead>
                    <TableHead className="text-right text-base font-semibold text-stone-900">Arch.</TableHead>
                    <TableHead className="text-base font-semibold text-stone-900">Estado</TableHead>
                    <TableHead className="text-base font-semibold text-stone-900">Última carga</TableHead>
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
                            'cursor-pointer h-14',
                            selectedOrderId === r.order_id &&
                              'bg-sky-50/80 ring-2 ring-inset ring-sky-300'
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
                            {r.concrete_remisiones_count > 0 ? (
                              <Checkbox
                                checked={selectedOrderIds.has(r.order_id)}
                                onCheckedChange={() => {
                                  setSelectedOrderIds((prev) => {
                                    const next = new Set(prev)
                                    if (next.has(r.order_id)) next.delete(r.order_id)
                                    else next.add(r.order_id)
                                    return next
                                  })
                                }}
                                className="h-5 w-5 border-stone-500 data-[state=checked]:bg-stone-900 data-[state=checked]:border-stone-900"
                                aria-label={`Seleccionar pedido ${r.order_number} de ${r.client_name || 'cliente'}`}
                              />
                            ) : (
                              <span className="inline-block w-5 h-5" aria-hidden />
                            )}
                          </TableCell>
                          <TableCell className="text-base whitespace-nowrap tabular-nums">{delivery}</TableCell>
                          <TableCell className="font-medium text-base font-mono">{r.order_number}</TableCell>
                          <TableCell className="font-mono text-sm text-stone-700 max-w-[100px] truncate">
                            {r.plant_code || r.plant_name || '—'}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate text-base">{r.client_name || '—'}</TableCell>
                          <TableCell className="max-w-[160px] truncate text-base">
                            {r.construction_site || '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="inline-flex items-center justify-end gap-1 w-full">
                              <span>{r.concrete_remisiones_count}</span>
                              {rowHasArkikReassignment(r, reassignmentByRemisionPage) ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex p-0 border-0 bg-transparent cursor-help shrink-0"
                                      aria-label="Reasignación Arkik"
                                      onClick={(e) => e.stopPropagation()}
                                      onKeyDown={(e) => e.stopPropagation()}
                                    >
                                      <Shuffle className="h-3.5 w-3.5 text-amber-600" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-sm text-xs">
                                    Hay reasignación de material Arkik en al menos una remisión de este pedido.
                                    Abra el pedido y revise la lista en el panel derecho (icono junto a cada remisión).
                                  </TooltipContent>
                                </Tooltip>
                              ) : null}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-base text-stone-700">
                            {r.concrete_volume_sum != null
                              ? r.concrete_volume_sum.toFixed(2)
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-base">{r.evidence_count}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn('text-sm font-medium border-2', STATUS_BADGE[status])}
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
                          <TableCell className="text-sm text-stone-700 whitespace-nowrap">
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

        {selectedOrderId && isMdUp && (
          <aside
            className={cn(
              'flex flex-col shrink-0 border-l border-stone-200/80 bg-card shadow-sm min-h-0 max-h-[calc(100vh-5rem)] sticky top-0 self-start',
              auditWriterPanel
                ? 'w-[min(720px,40vw)] xl:w-[min(800px,42vw)]'
                : 'w-[min(480px,34vw)] lg:w-[min(560px,36vw)] xl:w-[min(640px,38vw)]'
            )}
            aria-label="Detalle del pedido"
          >
            <ConcreteEvidenceOrderDetailPanel
              orderId={selectedOrderId}
              summary={selectedRow ? rowToSummary(selectedRow) : null}
              onClose={closeDetailPanel}
              className="border-l-0 flex-1 min-h-0 w-full max-w-none overflow-y-auto"
            />
          </aside>
        )}
      </div>

      <div
        role="region"
        aria-live="polite"
        aria-label="Acciones de pedidos seleccionados"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-[#f5f3f0]/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
      >
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-base font-medium text-stone-900 tabular-nums">
            {selectionStats.orders === 0 ? (
              <span>Ningún pedido seleccionado</span>
            ) : (
              <span>
                {selectionStats.orders} pedido{selectionStats.orders !== 1 ? 's' : ''} ·{' '}
                {selectionStats.rems} rem. · {selectionStats.m3.toFixed(2)} m³
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 text-base border-stone-300 bg-white min-h-[48px] focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
              disabled={loading || excelBusy || total === 0}
              onClick={() => void exportExcel()}
            >
              {excelBusy ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <FileSpreadsheet className="h-5 w-5 mr-2" />}
              Descargar Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 text-base border-stone-300 bg-white min-h-[48px] focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
              disabled={
                loading ||
                bulkZipBusy ||
                bulkConcretePdfZipBusy ||
                bulkPumpingPdfBusy ||
                selectedOrderIds.size === 0
              }
              onClick={() => void downloadBulkEvidenceZip()}
              title={`Hasta ${MAX_BULK_ZIP_ORDERS} pedidos y ${MAX_BULK_ZIP_FILES} archivos`}
            >
              {bulkZipBusy ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Archive className="h-5 w-5 mr-2" />}
              ZIP pedidos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 text-base border-stone-300 bg-white min-h-[48px] focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
              disabled={
                loading ||
                bulkZipBusy ||
                bulkConcretePdfZipBusy ||
                bulkPumpingPdfBusy ||
                selectedOrderIds.size === 0
              }
              onClick={() => void downloadBulkConcretePdfPerOrderZip()}
              title={`Un PDF unido por pedido (concreto). Hasta ${MAX_BULK_ZIP_ORDERS} pedidos.`}
            >
              {bulkConcretePdfZipBusy ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <FileStack className="h-5 w-5 mr-2" />
              )}
              PDF concreto (ZIP)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 text-base border-stone-300 bg-white min-h-[48px] focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
              disabled={
                loading ||
                bulkZipBusy ||
                bulkConcretePdfZipBusy ||
                bulkPumpingPdfBusy ||
                selectedOrderIds.size === 0
              }
              onClick={() => void downloadBulkPumpingOnePdf()}
              title="Un solo PDF: portada por pedido y luego evidencias de bombeo"
            >
              {bulkPumpingPdfBusy ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <FileType2 className="h-5 w-5 mr-2" />
              )}
              PDF bombeo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-12 text-base border-stone-300 bg-white min-h-[48px] focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
              disabled={
                loading ||
                accountingBusy ||
                bulkZipBusy ||
                bulkConcretePdfZipBusy ||
                bulkPumpingPdfBusy ||
                selectedOrderIds.size === 0
              }
              onClick={() => void handleCopyAccounting()}
            >
              {accountingBusy ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Copy className="h-5 w-5 mr-2" />}
              Copiar contabilidad
            </Button>
            <Button
              type="button"
              variant="solid"
              size="lg"
              className="h-12 text-base min-h-[48px] focus-visible:ring-2 focus-visible:ring-systemBlue focus-visible:ring-offset-2"
              disabled={
                loading ||
                reportNavBusy ||
                bulkZipBusy ||
                bulkConcretePdfZipBusy ||
                bulkPumpingPdfBusy ||
                selectedOrderIds.size === 0
              }
              onClick={() => void handleReporteCliente()}
            >
              {reportNavBusy ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <FileText className="h-5 w-5 mr-2" />}
              Reporte cliente
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="h-12 text-base text-stone-700 min-h-[48px]"
              disabled={selectedOrderIds.size === 0}
              onClick={() => setSelectedOrderIds(new Set())}
            >
              Limpiar
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={zipConfirmOpen} onOpenChange={setZipConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Pedidos sin archivos de evidencia</DialogTitle>
            <DialogDescription className="text-base text-stone-700">
              Algunos pedidos seleccionados no tienen PDF o imagen en evidencia. ¿Desea continuar con el ZIP? (solo se
              incluirán archivos existentes)
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setZipConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="solid"
              size="lg"
              onClick={() => void runBulkZipDownload([...selectedOrderIds])}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Atajos de teclado</DialogTitle>
            <DialogDescription asChild>
              <ul className="list-disc pl-5 space-y-2 text-base text-stone-800">
                <li>
                  <kbd className="font-mono bg-stone-100 px-1 rounded">A</kbd> — Seleccionar página
                </li>
                <li>
                  <kbd className="font-mono bg-stone-100 px-1 rounded">C</kbd> — Copiar contabilidad
                </li>
                <li>
                  <kbd className="font-mono bg-stone-100 px-1 rounded">R</kbd> — Reporte cliente
                </li>
                <li>
                  <kbd className="font-mono bg-stone-100 px-1 rounded">Z</kbd> — ZIP pedidos
                </li>
                <li>
                  <kbd className="font-mono bg-stone-100 px-1 rounded">Esc</kbd> — Limpiar selección
                </li>
                <li>
                  <kbd className="font-mono bg-stone-100 px-1 rounded">?</kbd> — Esta ayuda
                </li>
              </ul>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Sheet
        open={selectedOrderId != null && !isMdUp}
        onOpenChange={(open) => {
          if (!open) closeDetailPanel()
        }}
      >
        <SheetContent
          side="right"
          className={cn(
            'w-full p-0 flex flex-col overflow-hidden md:hidden',
            auditWriterPanel ? 'sm:max-w-6xl' : 'sm:max-w-5xl'
          )}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Detalle del pedido</SheetTitle>
          </SheetHeader>
          <ConcreteEvidenceOrderDetailPanel
            orderId={selectedOrderId}
            summary={selectedRow ? rowToSummary(selectedRow) : null}
            onClose={closeDetailPanel}
            className="border-l-0 max-h-full w-full max-w-none overflow-y-auto"
          />
        </SheetContent>
      </Sheet>
    </div>
    </TooltipProvider>
  )
}
