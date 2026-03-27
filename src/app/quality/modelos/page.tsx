'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, AlertTriangle, BookOpen, Search, X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import type { ModeloInstrumento } from '@/types/ema'

export default function ModelosPage() {
  const router = useRouter()
  const [modelos, setModelos] = useState<ModeloInstrumento[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchModelos = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ema/modelos')
      if (!res.ok) throw new Error('Error cargando modelos')
      const json = await res.json()
      setModelos(json.data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchModelos() }, [])

  const filtered = useMemo(() =>
    modelos.filter(m =>
      !search ||
      m.nombre_modelo.toLowerCase().includes(search.toLowerCase()) ||
      m.categoria.toLowerCase().includes(search.toLowerCase())
    ), [modelos, search])

  // Group by categoria
  const grouped = useMemo(() => {
    const map = new Map<string, ModeloInstrumento[]>()
    for (const m of filtered) {
      if (!map.has(m.categoria)) map.set(m.categoria, [])
      map.get(m.categoria)!.push(m)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="flex flex-col gap-4">
      <EmaBreadcrumb items={[{ label: 'Modelos de instrumento' }]} />

      {/* Header */}
      <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Modelos de instrumento
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Catálogo de plantillas — define tipo y período de calibración
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-stone-300 text-stone-700 gap-1.5"
              onClick={fetchModelos}
              disabled={loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
              onClick={() => router.push('/quality/modelos/nuevo')}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo modelo
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
          <Input
            placeholder="Buscar por nombre o categoría…"
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

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <ModelosSkeleton />
      ) : filtered.length === 0 ? (
        <ModelosEmpty onCreateNew={() => router.push('/quality/modelos/nuevo')} hasSearch={search.length > 0} />
      ) : (
        <div className="space-y-4">
          {grouped.map(([categoria, items]) => (
            <div key={categoria} className="rounded-lg border border-stone-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50/80">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">
                  {categoria}
                </span>
                <span className="text-xs text-stone-400">{items.length} modelo{items.length > 1 ? 's' : ''}</span>
              </div>
              <div className="divide-y divide-stone-100">
                {items.map(m => (
                  <button
                    key={m.id}
                    onClick={() => router.push(`/quality/modelos/${m.id}`)}
                    className="group w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-stone-900">{m.nombre_modelo}</span>
                        <EmaTipoBadge tipo={m.tipo_defecto} showLabel />
                        {!m.is_active && (
                          <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] text-stone-400">
                            Inactivo
                          </span>
                        )}
                      </div>
                      {m.descripcion && (
                        <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{m.descripcion}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-xs text-stone-500">
                        c/{m.periodo_calibracion_dias}d
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModelosSkeleton() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden animate-pulse">
      <div className="h-10 bg-stone-100 border-b border-stone-200" />
      <div className="divide-y divide-stone-100">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-48 bg-stone-200 rounded" />
              <div className="h-2.5 w-32 bg-stone-100 rounded" />
            </div>
            <div className="h-5 w-12 bg-stone-100 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ModelosEmpty({ onCreateNew, hasSearch }: { onCreateNew: () => void; hasSearch: boolean }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-12 flex flex-col items-center text-center gap-4">
      <div className="h-12 w-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
        <BookOpen className="h-6 w-6 text-stone-400" />
      </div>
      <div>
        <div className="text-sm font-medium text-stone-900">
          {hasSearch ? 'Sin resultados' : 'Sin modelos registrados'}
        </div>
        <div className="mt-1 text-xs text-stone-500">
          {hasSearch
            ? 'No hay modelos que coincidan con la búsqueda.'
            : 'Crea el primer modelo para comenzar a registrar instrumentos.'}
        </div>
      </div>
      {!hasSearch && (
        <Button size="sm" className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5" onClick={onCreateNew}>
          <Plus className="h-3.5 w-3.5" />
          Crear primer modelo
        </Button>
      )}
    </div>
  )
}
