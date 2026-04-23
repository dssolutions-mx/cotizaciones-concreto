'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  Plus,
  SlidersHorizontal,
  X,
  Gauge,
  ChevronRight,
  Package,
  Table2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'
import type { InstrumentoCard, EstadoInstrumento, TipoInstrumento } from '@/types/ema'

// ─── Filter pill helpers ──────────────────────────────────────────────────────

const ESTADO_OPTIONS: { value: EstadoInstrumento; label: string }[] = [
  { value: 'vigente', label: 'Vigente' },
  { value: 'proximo_vencer', label: 'Por vencer' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'inactivo', label: 'Inactivo' },
]

const TIPO_OPTIONS: { value: TipoInstrumento; label: string }[] = [
  { value: 'A', label: 'Tipo A — Maestro' },
  { value: 'B', label: 'Tipo B — Externo' },
  { value: 'C', label: 'Tipo C — Trabajo' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CatalogoInstrumentosPage() {
  const router = useRouter()
  const { currentPlant } = usePlantContext()
  const plantId = currentPlant?.id

  const [instrumentos, setInstrumentos] = useState<InstrumentoCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [selectedEstados, setSelectedEstados] = useState<Set<EstadoInstrumento>>(new Set())
  const [selectedTipos, setSelectedTipos] = useState<Set<TipoInstrumento>>(new Set())
  const [selectedCategorias, setSelectedCategorias] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)

  const fetchInstrumentos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (plantId) params.set('plant_id', plantId)
      params.set('limit', '500')
      const res = await fetch(`/api/ema/instrumentos?${params}`)
      if (!res.ok) throw new Error('Error al cargar instrumentos')
      const json = await res.json()
      setInstrumentos(json.data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [plantId])

  useEffect(() => { fetchInstrumentos() }, [fetchInstrumentos])

  // Derived categories from data
  const categorias = useMemo(() => {
    const cats = new Set<string>()
    instrumentos.forEach(i => { if (i.categoria) cats.add(i.categoria) })
    return Array.from(cats).sort()
  }, [instrumentos])

  // Filtered instruments
  const filtered = useMemo(() => {
    return instrumentos.filter(i => {
      if (search) {
        const q = search.toLowerCase()
        if (!i.nombre.toLowerCase().includes(q) && !i.codigo.toLowerCase().includes(q)) return false
      }
      if (selectedEstados.size > 0 && !selectedEstados.has(i.estado)) return false
      if (selectedTipos.size > 0 && !selectedTipos.has(i.tipo)) return false
      if (selectedCategorias.size > 0 && !selectedCategorias.has(i.categoria)) return false
      return true
    })
  }, [instrumentos, search, selectedEstados, selectedTipos, selectedCategorias])

  // Grouped by category
  const grouped = useMemo(() => {
    const map = new Map<string, InstrumentoCard[]>()
    for (const inst of filtered) {
      const cat = inst.categoria || 'Sin categoría'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(inst)
    }
    // Sort categories; put 'Sin categoría' last
    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Sin categoría') return 1
      if (b === 'Sin categoría') return -1
      return a.localeCompare(b)
    })
    return entries
  }, [filtered])

  const activeFilterCount =
    selectedEstados.size + selectedTipos.size + selectedCategorias.size

  function toggleEstado(e: EstadoInstrumento) {
    setSelectedEstados(prev => {
      const next = new Set(prev)
      next.has(e) ? next.delete(e) : next.add(e)
      return next
    })
  }

  function toggleTipo(t: TipoInstrumento) {
    setSelectedTipos(prev => {
      const next = new Set(prev)
      next.has(t) ? next.delete(t) : next.add(t)
      return next
    })
  }

  function toggleCategoria(c: string) {
    setSelectedCategorias(prev => {
      const next = new Set(prev)
      next.has(c) ? next.delete(c) : next.add(c)
      return next
    })
  }

  function clearFilters() {
    setSelectedEstados(new Set())
    setSelectedTipos(new Set())
    setSelectedCategorias(new Set())
    setSearch('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <EmaBreadcrumb items={[{ label: 'Catálogo' }]} />

      {/* Header */}
      <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Catálogo de instrumentos
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              {loading
                ? 'Cargando…'
                : `${filtered.length} de ${instrumentos.length} instrumentos`}
              {currentPlant && (
                <span className="ml-1 text-stone-400">— {currentPlant.name}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-stone-300 text-stone-700 gap-1.5"
              onClick={() => setShowFilters(v => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-stone-900 text-[10px] font-medium text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
            <Button variant="outline" size="sm" className="border-stone-300 text-stone-700 gap-1.5" asChild>
              <Link href="/quality/instrumentos/gestion">
                <Table2 className="h-3.5 w-3.5" />
                Vista de gestión
              </Link>
            </Button>
            <Button
              size="sm"
              className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
              asChild
            >
              <Link href="/quality/instrumentos/nuevo">
                <Plus className="h-3.5 w-3.5" />
                Nuevo instrumento
              </Link>
            </Button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
          <Input
            placeholder="Buscar por nombre o código…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 border-stone-200 bg-stone-50 text-sm placeholder:text-stone-400 focus-visible:bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="rounded-lg border border-stone-200 bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Filtros activos
            </span>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
              >
                <X className="h-3 w-3" />
                Limpiar todo
              </button>
            )}
          </div>

          {/* Estado pills */}
          <div>
            <div className="mb-2 text-xs text-stone-500 font-medium">Estado</div>
            <div className="flex flex-wrap gap-1.5">
              {ESTADO_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleEstado(opt.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selectedEstados.has(opt.value)
                      ? 'border-stone-800 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tipo pills */}
          <div>
            <div className="mb-2 text-xs text-stone-500 font-medium">Tipo</div>
            <div className="flex flex-wrap gap-1.5">
              {TIPO_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => toggleTipo(opt.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    selectedTipos.has(opt.value)
                      ? 'border-stone-800 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categoría pills */}
          {categorias.length > 0 && (
            <div>
              <div className="mb-2 text-xs text-stone-500 font-medium">Categoría</div>
              <div className="flex flex-wrap gap-1.5">
                {categorias.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategoria(cat)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      selectedCategorias.has(cat)
                        ? 'border-stone-800 bg-stone-900 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchInstrumentos} />
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={activeFilterCount > 0 || search.length > 0} onClear={clearFilters} />
      ) : (
        <div className="space-y-6">
          {grouped.map(([category, items]) => (
            <CategorySection key={category} category={category} items={items} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({ category, items }: { category: string; items: InstrumentoCard[] }) {
  const vencidos = items.filter(i => i.estado === 'vencido').length
  const proximos = items.filter(i => i.estado === 'proximo_vencer').length

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">
            {category}
          </span>
          <span className="text-xs text-stone-400">({items.length})</span>
        </div>
        {(vencidos > 0 || proximos > 0) && (
          <div className="flex items-center gap-1.5">
            {vencidos > 0 && (
              <span className="rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-700">
                {vencidos} vencido{vencidos > 1 ? 's' : ''}
              </span>
            )}
            {proximos > 0 && (
              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                {proximos} por vencer
              </span>
            )}
          </div>
        )}
      </div>

      {/* Instrument list */}
      <div className="divide-y divide-stone-100">
        {items.map(inst => (
          <InstrumentRow key={inst.id} instrumento={inst} />
        ))}
      </div>
    </div>
  )
}

// ─── Instrument row ────────────────────────────────────────────────────────────

function InstrumentRow({ instrumento: inst }: { instrumento: InstrumentoCard }) {
  const daysUntil = inst.fecha_proximo_evento
    ? Math.ceil((new Date(inst.fecha_proximo_evento).getTime() - Date.now()) / 86_400_000)
    : null

  const urgencyColor =
    inst.estado === 'vencido'
      ? 'text-red-600'
      : inst.estado === 'proximo_vencer'
      ? 'text-amber-600'
      : 'text-stone-500'

  return (
    <Link
      href={`/quality/instrumentos/${inst.id}`}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors"
    >
      {/* Estado accent bar */}
      <div
        className={cn(
          'w-1 self-stretch rounded-full shrink-0',
          inst.estado === 'vigente' && 'bg-emerald-400',
          inst.estado === 'proximo_vencer' && 'bg-amber-400',
          inst.estado === 'vencido' && 'bg-red-400',
          inst.estado === 'en_revision' && 'bg-sky-400',
          inst.estado === 'inactivo' && 'bg-stone-300',
        )}
      />

      {/* Name & code */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-stone-900 truncate">
            {inst.nombre}
          </span>
          <EmaTipoBadge tipo={inst.tipo} />
        </div>
        <span className="font-mono text-xs text-stone-500">{inst.codigo}</span>
        {inst.conjunto_codigo ? (
          <span className="block text-[11px] text-stone-400 mt-0.5">
            Conjunto <span className="font-mono">{inst.conjunto_codigo}</span>
          </span>
        ) : null}
      </div>

      {/* Marca / modelo */}
      {(inst.marca || inst.modelo_comercial) && (
        <div className="hidden md:block text-xs text-stone-400 shrink-0">
          {[inst.marca, inst.modelo_comercial].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Next event */}
      <div className={cn('shrink-0 text-right', urgencyColor)}>
        {inst.fecha_proximo_evento ? (
          <>
            <div className="font-mono text-xs tabular-nums">
              {inst.fecha_proximo_evento}
            </div>
            {daysUntil !== null && (
              <div className="text-[11px]">
                {daysUntil < 0
                  ? `${Math.abs(daysUntil)}d vencido`
                  : daysUntil === 0
                  ? 'Hoy'
                  : `en ${daysUntil}d`}
              </div>
            )}
          </>
        ) : (
          <span className="text-xs text-stone-400">—</span>
        )}
      </div>

      {/* Estado badge */}
      <div className="shrink-0">
        <EmaEstadoBadge estado={inst.estado} size="sm" />
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
    </Link>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(n => (
        <div key={n} className="rounded-lg border border-stone-200 bg-white overflow-hidden animate-pulse">
          <div className="h-10 bg-stone-100 border-b border-stone-200" />
          <div className="divide-y divide-stone-100">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-1 h-8 rounded-full bg-stone-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-48 bg-stone-200 rounded" />
                  <div className="h-2.5 w-24 bg-stone-100 rounded" />
                </div>
                <div className="h-5 w-16 bg-stone-100 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-12 flex flex-col items-center text-center gap-4">
      <div className="h-12 w-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
        <Gauge className="h-6 w-6 text-stone-400" />
      </div>
      <div>
        <div className="text-sm font-medium text-stone-900">
          {hasFilters ? 'Sin resultados' : 'Sin instrumentos registrados'}
        </div>
        <div className="mt-1 text-xs text-stone-500 max-w-xs">
          {hasFilters
            ? 'No hay instrumentos que coincidan con los filtros aplicados.'
            : 'Registra el primer instrumento para comenzar a gestionar la trazabilidad EMA.'}
        </div>
      </div>
      {hasFilters ? (
        <button
          onClick={onClear}
          className="text-xs text-stone-600 underline underline-offset-2 hover:text-stone-900"
        >
          Limpiar filtros
        </button>
      ) : (
        <Button size="sm" className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5" asChild>
          <Link href="/quality/instrumentos/nuevo">
            <Plus className="h-3.5 w-3.5" />
            Nuevo instrumento
          </Link>
        </Button>
      )}
    </div>
  )
}

// ─── Error state ──────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-6 flex flex-col items-center text-center gap-3">
      <div className="text-sm font-medium text-red-700">Error al cargar instrumentos</div>
      <div className="text-xs text-red-600">{message}</div>
      <Button
        variant="outline"
        size="sm"
        className="border-red-300 text-red-700 hover:bg-red-100"
        onClick={onRetry}
      >
        Reintentar
      </Button>
    </div>
  )
}
