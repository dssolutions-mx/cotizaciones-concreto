'use client'

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { EmaWorkspaceShell } from '@/components/ema/EmaWorkspaceShell'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { EMA_VIRTUAL_ROW_HEIGHT, useEmaTableVirtualizer } from '@/components/ema/useEmaTableVirtualizer'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { EMA_CONJUNTO_UPDATE_ROLES } from '@/lib/ema/emaWorkspaceRoles'
import { cn } from '@/lib/utils'
import type { ConjuntoHerramientas, ConjuntoHerramientasListRow, TipoServicio, UpdateConjuntoInput } from '@/types/ema'

const MESES = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: String(i + 1) }))

function useMediaQueryMdUp() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const fn = () => setM(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return m
}

export function EmaConjuntosWorkspaceClient() {
  const { hasRole } = useAuthSelectors()
  const canWrite = hasRole(EMA_CONJUNTO_UPDATE_ROLES)
  const isMdUp = useMediaQueryMdUp()

  const [rows, setRows] = useState<ConjuntoHerramientasListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const deferredSearch = useDeferredValue(searchDraft)
  /** '' = todos, 'active' | 'inactive' */
  const [activoFilter, setActivoFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [tipoServicioFilter, setTipoServicioFilter] = useState<TipoServicio | ''>('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [detail, setDetail] = useState<ConjuntoHerramientas | null>(null)
  const [listRow, setListRow] = useState<ConjuntoHerramientasListRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [form, setForm] = useState<Partial<UpdateConjuntoInput>>({})
  const [saveBusy, setSaveBusy] = useState(false)

  const [batchOpen, setBatchOpen] = useState<'cadencia' | 'activo' | 'norma' | null>(null)
  const [batchCadencia, setBatchCadencia] = useState('12')
  const [batchActivo, setBatchActivo] = useState(true)
  const [batchNorma, setBatchNorma] = useState('')
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const detailAbortRef = useRef<AbortController | null>(null)
  const activeRowIdRef = useRef<string | null>(null)
  const selectedIdsRef = useRef<Set<string>>(new Set())
  const rowsRef = useRef<ConjuntoHerramientasListRow[]>([])
  const tableScrollRef = useRef<HTMLDivElement>(null)

  activeRowIdRef.current = activeRowId
  selectedIdsRef.current = selectedIds
  rowsRef.current = rows

  const loadDetail = useCallback(async (id: string, row: ConjuntoHerramientasListRow | null) => {
    detailAbortRef.current?.abort()
    const ac = new AbortController()
    detailAbortRef.current = ac
    setDetailLoading(true)
    setListRow(row)
    try {
      const res = await fetch(`/api/ema/conjuntos/${id}`, { signal: ac.signal })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      const d: ConjuntoHerramientas = j.data ?? j
      setDetail(d)
      setForm({
        nombre_conjunto: d.nombre_conjunto,
        categoria: d.categoria,
        tipo_defecto: d.tipo_defecto,
        tipo_servicio: d.tipo_servicio,
        mes_inicio_servicio: d.mes_inicio_servicio,
        mes_fin_servicio: d.mes_fin_servicio,
        cadencia_meses: d.cadencia_meses,
        norma_referencia: d.norma_referencia,
        unidad_medicion: d.unidad_medicion,
        rango_medicion_tipico: d.rango_medicion_tipico,
        descripcion: d.descripcion,
        is_active: d.is_active,
      })
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setDetail(null)
    } finally {
      if (detailAbortRef.current === ac) setDetailLoading(false)
    }
  }, [])

  const loadList = useCallback(async (): Promise<ConjuntoHerramientasListRow[]> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ema/conjuntos?with_counts=1')
      if (!res.ok) throw new Error('No se pudo cargar conjuntos')
      const j = await res.json()
      const list = (j.data ?? []) as ConjuntoHerramientasListRow[]
      setRows(list)
      const aid = activeRowIdRef.current
      if (aid && selectedIdsRef.current.size === 0) {
        const row = list.find((r) => r.id === aid) ?? null
        await loadDetail(aid, row)
      }
      return list
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      return []
    } finally {
      setLoading(false)
    }
  }, [loadDetail])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    if (!activeRowId || selectedIds.size > 0) {
      setDetail(null)
      setListRow(null)
      return
    }
    const row = rowsRef.current.find((r) => r.id === activeRowId) ?? null
    void loadDetail(activeRowId, row)
  }, [activeRowId, selectedIds.size, loadDetail])

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    const codeQ = deferredSearch.trim()
    return rows.filter((r) => {
      if (activoFilter === 'active' && !r.is_active) return false
      if (activoFilter === 'inactive' && r.is_active) return false
      if (tipoServicioFilter && r.tipo_servicio !== tipoServicioFilter) return false
      if (
        q &&
        !r.codigo_conjunto.includes(codeQ) &&
        !r.nombre_conjunto.toLowerCase().includes(q) &&
        !(r.norma_referencia ?? '').toLowerCase().includes(q) &&
        !(r.categoria ?? '').toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [rows, deferredSearch, activoFilter, tipoServicioFilter])

  const virtualizer = useEmaTableVirtualizer(filtered.length, tableScrollRef)

  const mergePanelAfterInlineSave = useCallback((id: string, patch: Partial<UpdateConjuntoInput>) => {
    setForm((f) => ({ ...f, ...patch }))
    setDetail((d) => (d && d.id === id ? { ...d, ...patch } as ConjuntoHerramientas : d))
    setListRow((lr) => (lr && lr.id === id ? { ...lr, ...patch } as ConjuntoHerramientasListRow : lr))
  }, [])

  const updateRowField = useCallback((id: string, patch: Partial<ConjuntoHerramientasListRow>) => {
    setRows((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }, [])

  const debouncedInlinePut = useDebouncedCallback(
    async (id: string, patch: Partial<UpdateConjuntoInput>) => {
      try {
        const res = await fetch(`/api/ema/conjuntos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error ?? 'Error')
        mergePanelAfterInlineSave(id, patch)
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Error')
        await loadList()
      }
    },
    500,
  )

  const onInlineActiveChange = useCallback(
    async (id: string, next: boolean) => {
      const prevActive = rowsRef.current.find((x) => x.id === id)?.is_active ?? false
      updateRowField(id, { is_active: next })
      try {
        const res = await fetch(`/api/ema/conjuntos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: next }),
        })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error ?? 'Error')
        mergePanelAfterInlineSave(id, { is_active: next })
      } catch (e: unknown) {
        updateRowField(id, { is_active: prevActive })
        toast.error(e instanceof Error ? e.message : 'Error')
      }
    },
    [mergePanelAfterInlineSave, updateRowField],
  )

  const structuralLocked = (listRow?.instrument_count ?? 0) > 0

  const toggleSelect = (id: string, on: boolean) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  }

  const selectFilteredAll = () => {
    setSelectedIds(new Set(filtered.map((r) => r.id)))
    setActiveRowId(null)
    if (!isMdUp) setSheetOpen(true)
  }

  const clearSelection = () => setSelectedIds(new Set())

  const onRowClick = (id: string) => {
    setSelectedIds(new Set())
    setActiveRowId(id)
    if (!isMdUp) setSheetOpen(true)
  }

  const runBatch = async (patch: UpdateConjuntoInput) => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBatchSubmitting(true)
    try {
      const res = await fetch('/api/ema/conjuntos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, patch }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      const { summary } = j as { summary: { success: number; failed: number; total: number } }
      if (summary.failed > 0) {
        toast.message(`Actualizados ${summary.success} de ${summary.total}. Revise selección para reintentar fallidos.`)
      } else {
        toast.success(`Se actualizaron ${summary.success} conjunto(s).`)
      }
      setBatchOpen(null)
      clearSelection()
      await loadList()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setBatchSubmitting(false)
    }
  }

  const saveDetail = async () => {
    if (!activeRowId || !detail) return
    setSaveBusy(true)
    try {
      const res = await fetch(`/api/ema/conjuntos/${activeRowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      toast.success('Conjunto guardado.')
      await loadList()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaveBusy(false)
    }
  }

  const ventanaLabel = (r: ConjuntoHerramientasListRow) => {
    if (r.tipo_servicio === 'ninguno') return '—'
    const a = r.mes_inicio_servicio ?? '—'
    const b = r.mes_fin_servicio ?? '—'
    return `${a}–${b}`
  }

  const toolbar = (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <EmaBreadcrumb items={[{ label: 'Gestión tabular — conjuntos' }]} />
          <h1 className="mt-2 text-lg font-semibold text-stone-900 tracking-tight">
            Conjuntos de herramientas — edición tabular
          </h1>
          <p className="mt-1 text-xs text-stone-600 leading-relaxed max-w-3xl">
            Misma idea que en instrumentos: tabla a la izquierda, panel de edición a la derecha (o hoja en móvil),
            selección múltiple y acciones en lote. La{' '}
            <strong className="font-medium text-stone-800">norma de referencia</strong> describe el estándar del{' '}
            <em>conjunto</em> (familia DC-CC); no reemplaza el certificado de calibración de cada instrumento.
            <Link href="/quality/conjuntos" className="ml-1 underline text-stone-800">
              Ver listado clásico
            </Link>
            .
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadList()} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Label className="text-xs text-stone-500">Buscar</Label>
          <div className="relative mt-0.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <Input
              className="pl-8 h-9"
              placeholder="Código, nombre, categoría o norma…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>
        </div>
        <div className="w-[150px]">
          <Label className="text-xs text-stone-500">Catálogo</Label>
          <Select
            value={activoFilter}
            onValueChange={(v) =>
              startTransition(() => setActivoFilter(v as 'all' | 'active' | 'inactive'))
            }
          >
            <SelectTrigger className="h-9 mt-0.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Solo activos</SelectItem>
              <SelectItem value="inactive">Solo inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Label className="text-xs text-stone-500">Tipo servicio</Label>
          <Select
            value={tipoServicioFilter || '__all'}
            onValueChange={(v) =>
              startTransition(() => setTipoServicioFilter((v === '__all' ? '' : v) as TipoServicio | ''))
            }
          >
            <SelectTrigger className="h-9 mt-0.5">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              <SelectItem value="calibracion">Calibración</SelectItem>
              <SelectItem value="verificacion">Verificación</SelectItem>
              <SelectItem value="ninguno">Ninguno</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-stone-500">
        Mostrando <span className="font-mono tabular-nums">{filtered.length}</span> de{' '}
        <span className="font-mono tabular-nums">{rows.length}</span> conjuntos.
        <button type="button" className="ml-2 underline text-stone-700" onClick={selectFilteredAll}>
          Seleccionar filtrados ({filtered.length})
        </button>
      </p>
    </div>
  )

  const batchBar =
    selectedIds.size > 0 ? (
      <div
        role="region"
        aria-live="polite"
        aria-atomic="true"
        className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-stone-100/95 px-3 py-2.5 shadow-sm"
      >
        <span className="text-sm font-medium text-stone-900 tabular-nums">
          {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
        </span>
        {canWrite && (
          <>
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px]" onClick={() => setBatchOpen('cadencia')}>
              Cadencia (meses)
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px]" onClick={() => setBatchOpen('activo')}>
              Activo / inactivo
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px]" onClick={() => setBatchOpen('norma')}>
              Norma de referencia
            </Button>
          </>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-9 ml-auto min-h-[44px]" onClick={clearSelection}>
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      </div>
    ) : null

  const tableCaptionId = 'ema-conj-workspace-caption'

  const tableRegion = (
    <div className="flex flex-col min-h-[320px]">
      {error && <div className="p-4 text-sm text-red-700 border-b bg-red-50">{error}</div>}
      {loading ? (
        <div className="flex flex-1 items-center justify-center p-12 text-stone-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-stone-500">Sin conjuntos.</div>
      ) : (
        (() => {
          const virtualItems = virtualizer.getVirtualItems()
          const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
          const paddingBottom =
            virtualItems.length > 0
              ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
              : 0
          const colSpan = 13
          return (
        <Table
          scrollContainerRef={tableScrollRef}
          scrollContainerClassName="max-h-[calc(100vh-14rem)] overflow-auto min-h-[240px]"
          className="w-full"
          aria-labelledby={tableCaptionId}
        >
          <TableCaption id={tableCaptionId} className="sr-only">
            Conjuntos EMA — tabla de gestión
          </TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-stone-50/90 sticky top-0 z-10">
              <TableHead className="w-10 pl-3">
                <Checkbox
                  checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
                  onCheckedChange={(v) => {
                    if (v === true) setSelectedIds(new Set(filtered.map((r) => r.id)))
                    else clearSelection()
                  }}
                  aria-label="Seleccionar visibles"
                />
              </TableHead>
              <TableHead scope="col" className="font-mono text-xs">
                DC-CC
              </TableHead>
              <TableHead scope="col">Nombre</TableHead>
              <TableHead scope="col" className="hidden xl:table-cell max-w-[120px]">
                Categoría
              </TableHead>
              <TableHead
                scope="col"
                className="hidden lg:table-cell max-w-[160px]"
                title="Norma o documento de referencia del conjunto (no es el certificado del instrumento)."
              >
                Norma ref.
              </TableHead>
              <TableHead scope="col" className="text-center tabular-nums text-xs">
                Cad.
              </TableHead>
              <TableHead scope="col">Tipo defecto</TableHead>
              <TableHead scope="col" className="hidden md:table-cell">
                Servicio
              </TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Ventana (mes)
              </TableHead>
              <TableHead scope="col" className="text-right tabular-nums">
                Inst.
              </TableHead>
              <TableHead scope="col" className="text-right tabular-nums hidden sm:table-cell">
                Plant.
              </TableHead>
              <TableHead scope="col">Activo</TableHead>
              <TableHead scope="col" className="w-10" />
            </TableRow>
          </TableHeader>
          {/* Virtualized tbody: padding-rows keep native table column layout (TanStack Virtual pattern). */}
          <TableBody className="bg-white/60 [&_tr]:border-b [&_tr]:border-white/40">
            {paddingTop > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 'none' }} />
              </tr>
            ) : null}
            {virtualItems.map((virtualRow) => {
              const r = filtered[virtualRow.index]
              const cadenciaVal = Math.max(1, r.cadencia_meses ?? 12)
              return (
                <TableRow
                  key={r.id}
                  className={cn(
                    'cursor-pointer hover:bg-white/30',
                    activeRowId === r.id && selectedIds.size === 0 && 'bg-amber-50/80',
                  )}
                  style={{
                    height: EMA_VIRTUAL_ROW_HEIGHT,
                    minHeight: EMA_VIRTUAL_ROW_HEIGHT,
                  }}
                  onClick={(e) => {
                    if (
                      (e.target as HTMLElement).closest(
                        'input,a,button,[role=checkbox],[role=switch],label,[data-inline-edit]',
                      )
                    ) {
                      return
                    }
                    onRowClick(r.id)
                  }}
                >
                  <TableCell className="py-2 pl-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={(v) => toggleSelect(r.id, v === true)}
                      aria-label={`Seleccionar conjunto ${r.codigo_conjunto}`}
                    />
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs">{r.codigo_conjunto}</TableCell>
                  <TableCell className="py-2 text-sm max-w-[200px] truncate">{r.nombre_conjunto}</TableCell>
                  <TableCell className="py-2 hidden xl:table-cell text-xs text-stone-600 max-w-[120px] truncate" title={r.categoria}>
                    {r.categoria}
                  </TableCell>
                  <TableCell className="py-2 hidden lg:table-cell text-xs font-mono text-stone-600 max-w-[160px]">
                    {canWrite ? (
                      <div data-inline-edit className="min-w-0">
                        <Input
                          className="h-8 text-xs py-1 font-mono"
                          value={r.norma_referencia ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            const norm = v.trim() ? v : null
                            updateRowField(r.id, { norma_referencia: norm })
                            debouncedInlinePut(r.id, { norma_referencia: norm })
                          }}
                          aria-label={`Norma referencia ${r.codigo_conjunto}`}
                        />
                      </div>
                    ) : (
                      <span className="truncate block max-w-[160px]" title={r.norma_referencia ?? ''}>
                        {r.norma_referencia ?? '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2 text-center">
                    {canWrite ? (
                      <div data-inline-edit className="inline-flex justify-center">
                        <Input
                          type="number"
                          min={1}
                          className="h-8 w-14 text-center text-xs tabular-nums py-1 px-1"
                          value={cadenciaVal}
                          onChange={(e) => {
                            const n = Math.max(1, Number(e.target.value) || 1)
                            updateRowField(r.id, { cadencia_meses: n })
                            debouncedInlinePut(r.id, { cadencia_meses: n })
                          }}
                          aria-label={`Cadencia meses ${r.codigo_conjunto}`}
                        />
                      </div>
                    ) : (
                      <span className="text-xs tabular-nums text-stone-700">{r.cadencia_meses}</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2">
                    <EmaTipoBadge tipo={r.tipo_defecto} />
                  </TableCell>
                  <TableCell className="py-2 hidden md:table-cell text-xs text-stone-600">{r.tipo_servicio}</TableCell>
                  <TableCell className="py-2 hidden lg:table-cell text-xs font-mono">{ventanaLabel(r)}</TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums">{r.instrument_count}</TableCell>
                  <TableCell className="py-2 text-right text-xs tabular-nums hidden sm:table-cell">
                    {r.template_count}
                  </TableCell>
                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                    {canWrite ? (
                      <div data-inline-edit className="flex items-center justify-start">
                        <Switch
                          checked={r.is_active}
                          onCheckedChange={(v) => onInlineActiveChange(r.id, v)}
                          aria-label={`Activo catálogo ${r.codigo_conjunto}`}
                          className="scale-90"
                        />
                      </div>
                    ) : (
                      <span className={cn('text-xs font-medium', r.is_active ? 'text-emerald-700' : 'text-stone-400')}>
                        {r.is_active ? 'Sí' : 'No'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/quality/conjuntos/${r.id}`}
                      className="inline-flex p-1.5 rounded hover:bg-stone-100 text-stone-500"
                      title="Ficha completa"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
            {paddingBottom > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: paddingBottom, padding: 0, border: 'none' }} />
              </tr>
            ) : null}
          </TableBody>
        </Table>
          )
        })()
      )}
    </div>
  )

  const batchPanel =
    selectedIds.size > 0 ? (
      <div className="flex flex-col h-full min-h-0 p-4 gap-3">
        <h2 className="text-sm font-semibold text-stone-900">Acciones en lote</h2>
        <p className="text-xs text-stone-600">
          {[...selectedIds]
            .slice(0, 8)
            .map((id) => rows.find((x) => x.id === id)?.codigo_conjunto ?? id)
            .join(', ')}
          {selectedIds.size > 8 ? ` … y ${selectedIds.size - 8} más` : ''}
        </p>
        {!canWrite && <p className="text-xs text-amber-800">Sin permiso de edición.</p>}
        <p className="text-xs text-stone-500">
          Use la barra: cadencia, activo/inactivo o norma de referencia (texto común del conjunto, p. ej. NMX).
        </p>
      </div>
    ) : null

  const singlePanel =
    selectedIds.size === 0 && activeRowId ? (
      <div className="flex flex-col h-full min-h-0">
        <div className="border-b border-stone-200 bg-white px-4 py-3 shrink-0">
          {detailLoading ? (
            <div className="flex items-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando…
            </div>
          ) : detail ? (
            <>
              <div className="font-mono text-xs text-stone-500">{detail.codigo_conjunto}</div>
              <div className="text-base font-semibold text-stone-900">{detail.nombre_conjunto}</div>
              <div className="text-xs text-stone-500 mt-1">
                {listRow?.instrument_count ?? 0} instrumento(s) · {listRow?.template_count ?? 0} plantilla(s)
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-500">No se pudo cargar.</p>
          )}
        </div>
        {detail && canWrite && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {structuralLocked && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
                Hay instrumentos asignados: no puede cambiar categoría, tipo de servicio ni ventana desde aquí.
              </p>
            )}
            <div>
              <Label>Nombre</Label>
              <Input
                className="mt-1"
                value={form.nombre_conjunto ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, nombre_conjunto: e.target.value }))}
              />
            </div>
            <div>
              <Label>Categoría</Label>
              <Input
                className="mt-1"
                disabled={structuralLocked}
                value={form.categoria ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo defecto (nuevos instrumentos)</Label>
              <Select
                disabled={structuralLocked}
                value={form.tipo_defecto ?? detail.tipo_defecto}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo_defecto: v as 'A' | 'B' | 'C' }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo servicio</Label>
              <Select
                disabled={structuralLocked}
                value={(form.tipo_servicio ?? detail.tipo_servicio) as TipoServicio}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, tipo_servicio: v as TipoServicio }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calibracion">Calibración</SelectItem>
                  <SelectItem value="verificacion">Verificación</SelectItem>
                  <SelectItem value="ninguno">Ninguno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.tipo_servicio ?? detail.tipo_servicio) !== 'ninguno' && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Mes inicio</Label>
                  <Select
                    disabled={structuralLocked}
                    value={String(form.mes_inicio_servicio ?? detail.mes_inicio_servicio ?? '')}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, mes_inicio_servicio: v ? Number(v) : null }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((m) => (
                        <SelectItem key={m.v} value={String(m.v)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mes fin</Label>
                  <Select
                    disabled={structuralLocked}
                    value={String(form.mes_fin_servicio ?? detail.mes_fin_servicio ?? '')}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, mes_fin_servicio: v ? Number(v) : null }))
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESES.map((m) => (
                        <SelectItem key={m.v} value={String(m.v)}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div>
              <Label>Cadencia (meses)</Label>
              <Input
                type="number"
                min={1}
                className="mt-1"
                value={form.cadencia_meses ?? detail.cadencia_meses}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cadencia_meses: Number(e.target.value) || 12 }))
                }
              />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-stone-200 px-3 py-2">
              <Label htmlFor="active-switch">Activo en catálogo</Label>
              <Switch
                id="active-switch"
                checked={form.is_active ?? detail.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
            <div>
              <Label>Norma de referencia (conjunto)</Label>
              <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                Estándar o norma mexicana asociada a esta <strong>familia</strong> de equipos (p. ej. NMX-C-083-ONNCCE-2014).
                Sirve como referencia en catálogo y plantillas; <strong>no</strong> sustituye el certificado de calibración
                emitido por el laboratorio para cada instrumento A/B.
              </p>
              <Input
                className="mt-1"
                value={form.norma_referencia ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, norma_referencia: e.target.value || null }))}
              />
            </div>
            <div>
              <Label>Unidad de medición típica</Label>
              <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                Unidad habitual del rango del conjunto (p. ej. kN, °C, MPa). Texto libre corto.
              </p>
              <Input
                className="mt-1"
                value={form.unidad_medicion ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, unidad_medicion: e.target.value || null }))}
              />
            </div>
            <div>
              <Label>Rango de medición típico</Label>
              <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                Descripción legible del rango declarado para la familia (p. ej. 0–2000 kN). No valida numéricamente
                contra ensayos.
              </p>
              <Input
                className="mt-1"
                value={form.rango_medicion_tipico ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, rango_medicion_tipico: e.target.value || null }))}
              />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea
                className="mt-1 min-h-[64px]"
                value={form.descripcion ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value || null }))}
              />
            </div>
            <div className="flex gap-2 pt-2 border-t">
              <Button type="button" size="sm" onClick={saveDetail} disabled={saveBusy}>
                {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!detail) return
                  await loadList()
                }}
              >
                Revertir
              </Button>
              <Link href={`/quality/conjuntos/${activeRowId}`} className="ml-auto text-xs text-stone-600 underline self-center">
                Ficha completa
              </Link>
            </div>
          </div>
        )}
        {detail && !canWrite && <div className="p-4 text-xs text-stone-600">Solo lectura.</div>}
      </div>
    ) : null

  const emptyPanel = (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6 text-center text-sm text-stone-500">
      Seleccione un conjunto en la tabla o use los checkboxes para acciones en lote.
    </div>
  )

  return (
    <div className="space-y-3">
      <EmaWorkspaceShell
        toolbar={toolbar}
        batchBar={batchBar}
        table={tableRegion}
        sidePanel={batchPanel ?? singlePanel ?? emptyPanel}
        mobileSheetOpen={sheetOpen}
        onMobileSheetOpenChange={setSheetOpen}
        mobileSheetTitle="Conjunto"
        sheetContentClassName="sm:max-w-md"
      />

      <Dialog open={batchOpen === 'cadencia'} onOpenChange={(o) => !o && setBatchOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadencia (meses) — {selectedIds.size} conjunto(s)</DialogTitle>
            <DialogDescription>
              Meses entre eventos de servicio del conjunto (calibración o verificación según configuración). Valor
              numérico entero ≥ 1.
            </DialogDescription>
          </DialogHeader>
          <Input type="number" min={1} value={batchCadencia} onChange={(e) => setBatchCadencia(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(null)}>
              Cancelar
            </Button>
            <Button
              disabled={batchSubmitting}
              onClick={() => runBatch({ cadencia_meses: Number(batchCadencia) || 12 })}
            >
              {batchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen === 'activo'} onOpenChange={(o) => !o && setBatchOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estado activo — {selectedIds.size} conjunto(s)</DialogTitle>
            <DialogDescription>
              Activa o desactiva el conjunto en catálogo para todos los seleccionados. No elimina instrumentos
              existentes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Switch checked={batchActivo} onCheckedChange={setBatchActivo} id="batch-activo" />
            <Label htmlFor="batch-activo">{batchActivo ? 'Activo' : 'Inactivo'}</Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(null)}>
              Cancelar
            </Button>
            <Button disabled={batchSubmitting} onClick={() => runBatch({ is_active: batchActivo })}>
              {batchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen === 'norma'} onOpenChange={(o) => !o && setBatchOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Norma de referencia — {selectedIds.size} conjunto(s)</DialogTitle>
            <DialogDescription className="text-left">
              Mismo texto de <span className="font-mono">norma_referencia</span> para cada conjunto seleccionado (p. ej.
              clave NMX). Es metadato del <strong>conjunto</strong>, no un certificado de laboratorio.
            </DialogDescription>
          </DialogHeader>
          <Label>Texto de la norma</Label>
          <Input
            className="mt-1"
            placeholder="Ej. NMX-C-083-ONNCCE-2014"
            value={batchNorma}
            onChange={(e) => setBatchNorma(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(null)}>
              Cancelar
            </Button>
            <Button
              disabled={batchSubmitting || !batchNorma.trim()}
              onClick={() => runBatch({ norma_referencia: batchNorma.trim() })}
            >
              {batchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
