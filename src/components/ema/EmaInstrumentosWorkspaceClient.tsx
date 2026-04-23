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
import {
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  X,
  LayoutGrid,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { EmaWorkspaceShell } from '@/components/ema/EmaWorkspaceShell'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { EMA_VIRTUAL_ROW_HEIGHT, useEmaTableVirtualizer } from '@/components/ema/useEmaTableVirtualizer'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { EMA_INSTRUMENT_UPDATE_ROLES } from '@/lib/ema/emaWorkspaceRoles'
import { cn } from '@/lib/utils'
import type {
  ConjuntoHerramientas,
  EstadoInstrumento,
  InstrumentoCard,
  InstrumentoDetalle,
  TipoInstrumento,
  UpdateInstrumentoInput,
} from '@/types/ema'

const ESTADOS: EstadoInstrumento[] = [
  'vigente',
  'proximo_vencer',
  'vencido',
  'en_revision',
  'inactivo',
]
const TIPOS: TipoInstrumento[] = ['A', 'B', 'C']

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

export function EmaInstrumentosWorkspaceClient() {
  const { currentPlant } = usePlantContext()
  const { hasRole } = useAuthSelectors()
  const canWrite = hasRole(EMA_INSTRUMENT_UPDATE_ROLES)
  const isMdUp = useMediaQueryMdUp()

  const [rows, setRows] = useState<InstrumentoCard[]>([])
  const [conjuntos, setConjuntos] = useState<ConjuntoHerramientas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** Búsqueda en borrador; el filtrado usa `deferredSearch` para no bloquear la UI. */
  const [searchDraft, setSearchDraft] = useState('')
  const deferredSearch = useDeferredValue(searchDraft)
  const [conjuntoId, setConjuntoId] = useState<string>('')
  const [estadoFilter, setEstadoFilter] = useState<EstadoInstrumento | ''>('')
  const [tipoFilter, setTipoFilter] = useState<TipoInstrumento | ''>('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const [detail, setDetail] = useState<InstrumentoDetalle | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [maestros, setMaestros] = useState<InstrumentoCard[]>([])

  const [batchOpen, setBatchOpen] = useState<'fecha' | 'notas' | 'ubicacion' | 'tipo' | null>(null)
  const [batchFecha, setBatchFecha] = useState('')
  const [batchNotas, setBatchNotas] = useState('')
  const [batchUbicacion, setBatchUbicacion] = useState('')
  const [batchTipo, setBatchTipo] = useState<TipoInstrumento>('A')
  const [batchMaestroIds, setBatchMaestroIds] = useState<string[]>([])
  const [batchSubmitting, setBatchSubmitting] = useState(false)

  const [form, setForm] = useState<Partial<UpdateInstrumentoInput>>({})
  const [saveBusy, setSaveBusy] = useState(false)

  const detailAbortRef = useRef<AbortController | null>(null)
  const tableScrollRef = useRef<HTMLDivElement>(null)

  const plantId = currentPlant?.id

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (plantId) params.set('plant_id', plantId)
      params.set('limit', '500')
      const res = await fetch(`/api/ema/instrumentos?${params}`)
      if (!res.ok) throw new Error('No se pudo cargar la lista')
      const j = await res.json()
      setRows(j.data ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [plantId])

  const loadConjuntos = useCallback(async () => {
    try {
      const res = await fetch('/api/ema/conjuntos')
      if (!res.ok) return
      const j = await res.json()
      setConjuntos(j.data ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])
  useEffect(() => {
    loadConjuntos()
  }, [loadConjuntos])

  const loadMaestros = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('tipo', 'A')
      params.set('limit', '200')
      if (plantId) params.set('plant_id', plantId)
      const res = await fetch(`/api/ema/instrumentos?${params}`)
      if (!res.ok) return
      const j = await res.json()
      setMaestros(j.data ?? [])
    } catch {
      setMaestros([])
    }
  }, [plantId])

  useEffect(() => {
    if (batchOpen === 'tipo' && batchTipo === 'C') loadMaestros()
  }, [batchOpen, batchTipo, loadMaestros])

  const loadDetail = useCallback(async (id: string) => {
    detailAbortRef.current?.abort()
    const ac = new AbortController()
    detailAbortRef.current = ac
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/ema/instrumentos/${id}`, { signal: ac.signal })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      const d: InstrumentoDetalle = j.data ?? j
      setDetail(d)
      setForm({
        nombre: d.nombre,
        tipo: d.tipo,
        instrumento_maestro_ids: [...(d.instrumento_maestro_ids ?? [])],
        mes_inicio_servicio_override: d.mes_inicio_servicio_override,
        mes_fin_servicio_override: d.mes_fin_servicio_override,
        ubicacion_dentro_planta: d.ubicacion_dentro_planta,
        fecha_proximo_evento: d.fecha_proximo_evento,
        notas: d.notas,
        marca: d.marca,
        modelo_comercial: d.modelo_comercial,
        numero_serie: d.numero_serie,
      })
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setDetail(null)
    } finally {
      if (detailAbortRef.current === ac) setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!activeRowId || selectedIds.size > 0) {
      setDetail(null)
      return
    }
    loadDetail(activeRowId)
  }, [activeRowId, selectedIds.size, loadDetail])

  useEffect(() => {
    if (detail?.tipo === 'C') loadMaestros()
  }, [detail?.tipo, loadMaestros])

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    return rows.filter((r) => {
      if (conjuntoId && r.conjunto_id !== conjuntoId) return false
      if (estadoFilter && r.estado !== estadoFilter) return false
      if (tipoFilter && r.tipo !== tipoFilter) return false
      if (q && !r.nombre.toLowerCase().includes(q) && !r.codigo.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, deferredSearch, conjuntoId, estadoFilter, tipoFilter])

  const virtualizer = useEmaTableVirtualizer(filtered.length, tableScrollRef)

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

  const selectVisiblePage = () => {
    setSelectedIds(new Set(filtered.map((r) => r.id)))
    setActiveRowId(null)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const onRowClick = (id: string) => {
    setSelectedIds(new Set())
    setActiveRowId(id)
    if (!isMdUp) setSheetOpen(true)
  }

  const runBatch = async (patch: UpdateInstrumentoInput) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setBatchSubmitting(true)
    try {
      const res = await fetch('/api/ema/instrumentos/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, patch }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      const { summary, results } = j as {
        summary: { success: number; failed: number; total?: number }
        results: { id: string; success: boolean; error?: string }[]
      }
      const total = summary.total ?? results.length
      if (summary.failed > 0) {
        toast.message(
          `Actualizados ${summary.success} de ${total}. ${summary.failed} con error — revise la consola de resultados.`,
        )
      } else {
        toast.success(`Se actualizaron ${summary.success} instrumento(s).`)
      }
      const failedIds = new Set(results.filter((r) => !r.success).map((r) => r.id))
      setSelectedIds(failedIds)
      setBatchOpen(null)
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
      const res = await fetch(`/api/ema/instrumentos/${activeRowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error')
      toast.success('Instrumento guardado.')
      await loadList()
      await loadDetail(activeRowId)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaveBusy(false)
    }
  }

  const tableCaptionId = 'ema-inst-workspace-caption'

  const toolbar = (
    <div className="flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <EmaBreadcrumb items={[{ label: 'Gestión tabular' }]} />
        <Button type="button" variant="outline" size="sm" onClick={loadList} disabled={loading}>
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </Button>
      </div>
      <p className="text-xs text-stone-600 leading-relaxed">
        En la columna <strong className="font-medium text-stone-800">Próx. evento</strong> aparece la fecha del
        siguiente vencimiento o cita del <strong className="font-medium text-stone-800">programa EMA</strong>
        (próxima calibración externa en tipos A/B, o próxima verificación interna en tipo C). Editarla aquí
        actualiza el catálogo; <strong className="font-medium text-stone-800">no sustituye</strong> registrar el
        certificado PDF ni la verificación en la ficha del instrumento.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <Label className="text-xs text-stone-500">Buscar</Label>
          <div className="relative mt-0.5">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <Input
              className="pl-8 h-9"
              placeholder="Código o nombre…"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
            />
          </div>
        </div>
        <div className="w-[200px]">
          <Label className="text-xs text-stone-500">Conjunto</Label>
          <Select
            value={conjuntoId || '__all'}
            onValueChange={(v) => startTransition(() => setConjuntoId(v === '__all' ? '' : v))}
          >
            <SelectTrigger className="h-9 mt-0.5">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {conjuntos.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.codigo_conjunto} — {c.nombre_conjunto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[140px]">
          <Label className="text-xs text-stone-500">Estado</Label>
          <Select
            value={estadoFilter || '__all'}
            onValueChange={(v) =>
              startTransition(() => setEstadoFilter((v === '__all' ? '' : v) as EstadoInstrumento | ''))
            }
          >
            <SelectTrigger className="h-9 mt-0.5">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e} value={e}>
                  {e}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[120px]">
          <Label className="text-xs text-stone-500">Tipo</Label>
          <Select
            value={tipoFilter || '__all'}
            onValueChange={(v) =>
              startTransition(() => setTipoFilter((v === '__all' ? '' : v) as TipoInstrumento | ''))
            }
          >
            <SelectTrigger className="h-9 mt-0.5">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos</SelectItem>
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-stone-500">
        Mostrando <span className="font-mono tabular-nums">{filtered.length}</span> de{' '}
        <span className="font-mono tabular-nums">{rows.length}</span> cargados.
        <button
          type="button"
          className="ml-2 underline text-stone-700"
          onClick={selectFilteredAll}
        >
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 min-h-[44px]"
              title="Fecha del siguiente evento del programa: calibración (A/B) o verificación interna (C). Ver texto arriba en la barra de filtros."
              onClick={() => setBatchOpen('fecha')}
            >
              Próx. evento (programa)
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px]" onClick={() => setBatchOpen('notas')}>
              Notas
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px]" onClick={() => setBatchOpen('ubicacion')}>
              Ubicación
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9 min-h-[44px]" onClick={() => {
              setBatchTipo('A')
              setBatchMaestroIds([])
              setBatchOpen('tipo')
            }}>
              Cambiar tipo
            </Button>
          </>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-9 ml-auto min-h-[44px]" onClick={clearSelection}>
          <X className="h-4 w-4 mr-1" />
          Limpiar
        </Button>
      </div>
    ) : null

  const tableRegion = (
    <div className="flex flex-col min-h-[320px]">
      {error && (
        <div className="p-4 text-sm text-red-700 border-b border-red-100 bg-red-50">{error}</div>
      )}
      {loading ? (
        <div className="flex flex-1 items-center justify-center p-12 text-stone-500 gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-stone-500">Sin instrumentos con los filtros actuales.</div>
      ) : (
        (() => {
          const virtualItems = virtualizer.getVirtualItems()
          const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
          const paddingBottom =
            virtualItems.length > 0
              ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
              : 0
          const colSpan = 9
          return (
        <Table
          scrollContainerRef={tableScrollRef}
          scrollContainerClassName="max-h-[calc(100vh-14rem)] overflow-auto min-h-[240px]"
          className="w-full"
          aria-labelledby={tableCaptionId}
        >
          <TableCaption id={tableCaptionId} className="sr-only">
            Instrumentos EMA — tabla de gestión
          </TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-stone-50/90 sticky top-0 z-10">
              <TableHead className="w-10 pl-3">
                <Checkbox
                  checked={filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))}
                  onCheckedChange={(v) => {
                    if (v === true) selectVisiblePage()
                    else clearSelection()
                  }}
                  aria-label="Seleccionar visibles"
                />
              </TableHead>
              <TableHead scope="col" className="font-mono text-xs">
                Código
              </TableHead>
              <TableHead scope="col">Nombre</TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Conjunto
              </TableHead>
              <TableHead scope="col">Tipo</TableHead>
              <TableHead scope="col">Estado</TableHead>
              <TableHead
                scope="col"
                className="text-right"
                title="Próxima fecha de calibración o verificación según programa EMA (campo fecha_proximo_evento)."
              >
                Próx. evento
              </TableHead>
              <TableHead scope="col" className="hidden md:table-cell text-right text-xs text-stone-500">
                Marca / modelo
              </TableHead>
              <TableHead scope="col" className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody className="bg-white/60 [&_tr]:border-b [&_tr]:border-white/40">
            {paddingTop > 0 ? (
              <tr aria-hidden="true">
                <td colSpan={colSpan} style={{ height: paddingTop, padding: 0, border: 'none' }} />
              </tr>
            ) : null}
            {virtualItems.map((virtualRow) => {
              const r = filtered[virtualRow.index]
              return (
                <TableRow
                  key={r.id}
                  data-state={activeRowId === r.id && selectedIds.size === 0 ? 'selected' : undefined}
                  className={cn(
                    'cursor-pointer hover:bg-white/30',
                    activeRowId === r.id && selectedIds.size === 0 && 'bg-amber-50/80',
                  )}
                  style={{
                    height: EMA_VIRTUAL_ROW_HEIGHT,
                    minHeight: EMA_VIRTUAL_ROW_HEIGHT,
                  }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('input[type=checkbox],button,a,[role=checkbox]')) return
                    onRowClick(r.id)
                  }}
                >
                  <TableCell className="py-2 pl-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(r.id)}
                      onCheckedChange={(v) => toggleSelect(r.id, v === true)}
                      aria-label={`Seleccionar ${r.codigo}`}
                    />
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs whitespace-nowrap">{r.codigo}</TableCell>
                  <TableCell className="py-2 text-sm max-w-[200px] truncate" title={r.nombre}>
                    {r.nombre}
                  </TableCell>
                  <TableCell className="py-2 hidden lg:table-cell text-xs text-stone-600">
                    <span className="font-mono">{r.conjunto_codigo}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <EmaTipoBadge tipo={r.tipo} />
                  </TableCell>
                  <TableCell className="py-2">
                    <EmaEstadoBadge estado={r.estado} size="sm" />
                  </TableCell>
                  <TableCell className="py-2 text-right font-mono text-xs tabular-nums">
                    {r.fecha_proximo_evento ?? '—'}
                  </TableCell>
                  <TableCell className="py-2 hidden md:table-cell text-right text-xs text-stone-500 max-w-[140px] truncate">
                    {[r.marca, r.modelo_comercial].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/quality/instrumentos/${r.id}`}
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

  const batchPreviewIds = Array.from(selectedIds)
  const batchPanel =
    selectedIds.size > 0 ? (
      <div className="flex flex-col h-full min-h-0 p-4 gap-3">
        <h2 className="text-sm font-semibold text-stone-900">Acciones en lote</h2>
        <p className="text-xs text-stone-600">
          {batchPreviewIds.slice(0, 8).map((id) => rows.find((x) => x.id === id)?.codigo ?? id).join(', ')}
          {batchPreviewIds.length > 8 ? ` … y ${batchPreviewIds.length - 8} más` : ''}
        </p>
        {!canWrite && <p className="text-xs text-amber-800">Sin permiso de edición.</p>}
        <p className="text-xs text-stone-500">
          Use la barra superior: <strong>Próx. evento</strong> ajusta la fecha del programa en catálogo; notas,
          ubicación y tipo son otros campos.
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
              <div className="font-mono text-xs text-stone-500">{detail.codigo}</div>
              <div className="text-base font-semibold text-stone-900">{detail.nombre}</div>
              <div className="flex gap-2 mt-1">
                <EmaEstadoBadge estado={detail.estado} size="sm" />
                <EmaTipoBadge tipo={detail.tipo} showLabel />
              </div>
            </>
          ) : (
            <p className="text-sm text-stone-500">No se pudo cargar el detalle.</p>
          )}
        </div>
        {detail && canWrite && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm">
            <div>
              <Label>Nombre</Label>
              <Input
                className="mt-1"
                value={form.nombre ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.tipo ?? detail.tipo}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    tipo: v as TipoInstrumento,
                    instrumento_maestro_ids:
                      v === 'C' ? (f.instrumento_maestro_ids ?? detail.instrumento_maestro_ids ?? []) : [],
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(form.tipo ?? detail.tipo) === 'C' && (
              <div>
                <Label>Instrumentos patrón (Tipo A)</Label>
                <div className="mt-1 border border-stone-200 rounded-md p-2 max-h-[220px] overflow-y-auto space-y-2">
                  {maestros.length === 0 ? (
                    <p className="text-xs text-stone-500">No hay instrumentos tipo A en esta planta.</p>
                  ) : (
                    maestros.map((m) => {
                      const selected =
                        form.instrumento_maestro_ids ?? detail.instrumento_maestro_ids ?? []
                      const on = selected.includes(m.id)
                      return (
                        <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                          <Checkbox
                            checked={on}
                            onCheckedChange={(checked) => {
                              const cur = new Set(form.instrumento_maestro_ids ?? detail.instrumento_maestro_ids ?? [])
                              if (checked) cur.add(m.id)
                              else cur.delete(m.id)
                              setForm((f) => ({ ...f, instrumento_maestro_ids: Array.from(cur) }))
                            }}
                          />
                          <span>
                            {m.codigo} — {m.nombre}
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mes inicio override</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  className="mt-1"
                  value={form.mes_inicio_servicio_override ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      mes_inicio_servicio_override: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <Label>Mes fin override</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  className="mt-1"
                  value={form.mes_fin_servicio_override ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      mes_fin_servicio_override: e.target.value === '' ? null : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>
            <div>
              <Label>Ubicación en planta</Label>
              <Input
                className="mt-1"
                value={form.ubicacion_dentro_planta ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ubicacion_dentro_planta: e.target.value || null }))}
              />
            </div>
            <div>
              <Label>Próximo evento del programa (fecha)</Label>
              <p className="text-[11px] text-stone-500 mt-1 leading-snug">
                Misma semántica que la columna de la tabla: vencimiento / cita de calibración o verificación. Tras
                guardar, el estado del instrumento puede recalcularse según reglas del sistema.
              </p>
              <Input
                type="date"
                className="mt-1"
                value={(form.fecha_proximo_evento ?? '').slice(0, 10)}
                onChange={(e) => setForm((f) => ({ ...f, fecha_proximo_evento: e.target.value || null }))}
              />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                className="mt-1 min-h-[72px]"
                value={form.notas ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value || null }))}
              />
            </div>
            <div className="flex gap-2 pt-2 border-t border-stone-200">
              <Button type="button" size="sm" onClick={saveDetail} disabled={saveBusy}>
                {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => detail && loadDetail(detail.id)}>
                Revertir
              </Button>
              <Link href={`/quality/instrumentos/${activeRowId}`} className="ml-auto text-xs text-stone-600 underline self-center">
                Abrir ficha completa
              </Link>
            </div>
            <p className="text-[11px] text-stone-500 pt-2">
              Actualizado: {detail.updated_at?.slice(0, 19) ?? '—'} — los cambios de catálogo no sustituyen registrar verificaciones o certificados.
            </p>
          </div>
        )}
        {detail && !canWrite && (
          <div className="p-4 text-xs text-stone-600">Solo lectura. Solicite permisos de calidad o laboratorio para editar.</div>
        )}
      </div>
    ) : null

  const emptyPanel = (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6 text-center text-sm text-stone-500">
      <LayoutGrid className="h-8 w-8 text-stone-300 mb-2" />
      Seleccione un instrumento en la tabla o use los checkboxes para acciones en lote.
    </div>
  )

  const sideContent = batchPanel ?? singlePanel ?? emptyPanel

  return (
    <div className="space-y-3">
      <EmaWorkspaceShell
        toolbar={toolbar}
        batchBar={batchBar}
        table={tableRegion}
        sidePanel={sideContent}
        mobileSheetOpen={sheetOpen}
        onMobileSheetOpenChange={setSheetOpen}
        mobileSheetTitle="Instrumento"
        sheetContentClassName="sm:max-w-md"
      />

      <Dialog open={batchOpen === 'fecha'} onOpenChange={(o) => !o && setBatchOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Próximo evento del programa — {selectedIds.size} instrumento(s)</DialogTitle>
            <DialogDescription className="text-left">
              Se actualiza el campo <span className="font-mono">fecha_proximo_evento</span>: la fecha en que vence o
              está programada la próxima <strong>calibración externa</strong> (instrumentos A/B) o la próxima{' '}
              <strong>verificación interna</strong> (tipo C). No registra certificado ni hoja de verificación; use la
              ficha del instrumento para el trámite formal.
            </DialogDescription>
          </DialogHeader>
          <Label>Nueva fecha (aplica a todos los seleccionados)</Label>
          <Input type="date" className="mt-1" value={batchFecha} onChange={(e) => setBatchFecha(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!batchFecha || batchSubmitting}
              onClick={() => runBatch({ fecha_proximo_evento: batchFecha })}
            >
              {batchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen === 'notas'} onOpenChange={(o) => !o && setBatchOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notas — {selectedIds.size} instrumento(s)</DialogTitle>
            <DialogDescription>
              Reemplaza el texto de notas en cada instrumento seleccionado por el valor indicado.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={batchNotas} onChange={(e) => setBatchNotas(e.target.value)} rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(null)}>
              Cancelar
            </Button>
            <Button disabled={batchSubmitting} onClick={() => runBatch({ notas: batchNotas || null })}>
              {batchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen === 'ubicacion'} onOpenChange={(o) => !o && setBatchOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubicación en planta — {selectedIds.size} instrumento(s)</DialogTitle>
            <DialogDescription>
              Mismo valor de ubicación para todos los seleccionados (texto libre en catálogo).
            </DialogDescription>
          </DialogHeader>
          <Input value={batchUbicacion} onChange={(e) => setBatchUbicacion(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(null)}>
              Cancelar
            </Button>
            <Button disabled={batchSubmitting} onClick={() => runBatch({ ubicacion_dentro_planta: batchUbicacion || null })}>
              {batchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchOpen === 'tipo'} onOpenChange={(o) => !o && setBatchOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cambiar tipo — {selectedIds.size} instrumento(s)</DialogTitle>
            <DialogDescription>
              Tipo C exige maestro tipo A. Los tipos A/B quitan el maestro. Revise filas con error tras aplicar.
            </DialogDescription>
          </DialogHeader>
          <Label>Nuevo tipo</Label>
          <Select value={batchTipo} onValueChange={(v) => setBatchTipo(v as TipoInstrumento)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {batchTipo === 'C' && (
            <div className="mt-3 space-y-2">
              <Label>Instrumentos patrón (Tipo A)</Label>
              <div className="border border-stone-200 rounded-md p-2 max-h-[200px] overflow-y-auto space-y-2">
                {maestros.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={batchMaestroIds.includes(m.id)}
                      onCheckedChange={(checked) => {
                        setBatchMaestroIds((prev) => {
                          const s = new Set(prev)
                          if (checked) s.add(m.id)
                          else s.delete(m.id)
                          return Array.from(s)
                        })
                      }}
                    />
                    <span>
                      {m.codigo} — {m.nombre}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-stone-500 mt-2">
            Revise la validación por fila: los instrumentos que fallen quedarán seleccionados tras aplicar.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchOpen(null)}>
              Cancelar
            </Button>
            <Button
              disabled={
                batchSubmitting ||
                (batchTipo === 'C' && batchMaestroIds.length === 0) ||
                !canWrite
              }
              onClick={() => {
                const patch: UpdateInstrumentoInput =
                  batchTipo === 'C'
                    ? { tipo: batchTipo, instrumento_maestro_ids: batchMaestroIds }
                    : { tipo: batchTipo }
                runBatch(patch)
              }}
            >
              {batchSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aplicar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
