'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { RefreshCw, AlertTriangle, Search, X, ClipboardList, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { cn } from '@/lib/utils'

type PlantillaRow = {
  id: string
  codigo: string
  nombre: string
  norma_referencia: string | null
  estado: 'borrador' | 'publicado' | 'archivado'
  conjunto_id: string
  conjunto_codigo: string | null
  conjunto_nombre: string | null
  active_version: { id: string; version_number: number; published_at: string } | null
  items_count: number
  updated_at: string
}

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  publicado: 'Publicada',
  archivado: 'Archivada',
}

export default function PlantillasIndexPage() {
  const router = useRouter()
  const [rows, setRows] = useState<PlantillaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [estadoFilter, setEstadoFilter] = useState<'all' | 'borrador' | 'publicado' | 'archivado'>('all')
  const [conjuntoFilter, setConjuntoFilter] = useState<string>('all')

  const fetchRows = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ema/plantillas')
      if (!res.ok) throw new Error('Error cargando plantillas')
      const json = await res.json()
      setRows(json.data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRows() }, [])

  const conjuntoOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows) {
      if (r.conjunto_id && !seen.has(r.conjunto_id))
        seen.set(r.conjunto_id, `DC-${r.conjunto_codigo ?? '??'} · ${r.conjunto_nombre ?? '—'}`)
    }
    return Array.from(seen.entries()).sort(([, a], [, b]) => a.localeCompare(b))
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows
      .filter(r => estadoFilter === 'all' || r.estado === estadoFilter)
      .filter(r => conjuntoFilter === 'all' || r.conjunto_id === conjuntoFilter)
      .filter(r => {
        if (!q) return true
        return (
          r.codigo.toLowerCase().includes(q) ||
          r.nombre.toLowerCase().includes(q) ||
          (r.conjunto_nombre ?? '').toLowerCase().includes(q) ||
          (r.norma_referencia ?? '').toLowerCase().includes(q)
        )
      })
  }, [rows, search, estadoFilter, conjuntoFilter])

  return (
    <div className="flex flex-col gap-4">
      <EmaBreadcrumb items={[{ label: 'Plantillas de verificación' }]} />

      <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Plantillas de verificación
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Catálogo global — un conjunto puede tener varias plantillas; el operador elige al ejecutar.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-stone-300 text-stone-700 gap-1.5"
              onClick={fetchRows}
              disabled={loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
              onClick={() => router.push('/quality/conjuntos')}
              title="Crea una nueva plantilla desde el conjunto al que pertenece"
            >
              <Plus className="h-3.5 w-3.5" />
              Nueva plantilla
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
            <Input
              placeholder="Buscar por código, nombre, conjunto, norma…"
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
          <select
            value={estadoFilter}
            onChange={e => setEstadoFilter(e.target.value as any)}
            className="h-9 rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-stone-700"
          >
            <option value="all">Todos los estados</option>
            <option value="publicado">Publicadas</option>
            <option value="borrador">Borrador</option>
            <option value="archivado">Archivadas</option>
          </select>
          <select
            value={conjuntoFilter}
            onChange={e => setConjuntoFilter(e.target.value)}
            className="h-9 rounded-md border border-stone-200 bg-stone-50 px-2 text-sm text-stone-700 max-w-[260px]"
          >
            <option value="all">Todos los conjuntos</option>
            {conjuntoOptions.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-stone-200 bg-white p-12 text-center text-sm text-stone-400">
          Cargando…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white p-12 flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
            <ClipboardList className="h-6 w-6 text-stone-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-stone-900">
              {search || estadoFilter !== 'all' || conjuntoFilter !== 'all'
                ? 'Sin resultados'
                : 'Sin plantillas registradas'}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {search || estadoFilter !== 'all' || conjuntoFilter !== 'all'
                ? 'Prueba ajustar los filtros.'
                : 'Crea una plantilla desde el conjunto al que pertenece.'}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-stone-50/60">
            <span className="text-xs text-stone-400">
              {filtered.length} plantilla{filtered.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {filtered.map(r => (
              <Link
                key={r.id}
                href={`/quality/conjuntos/${r.conjunto_id}/plantilla?template=${r.id}`}
                className="group flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors"
              >
                <span className="font-mono text-[11px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded shrink-0">
                  {r.codigo}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-900 truncate">
                      {r.nombre}
                    </span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        r.estado === 'publicado'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : r.estado === 'borrador'
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-stone-200 bg-stone-50 text-stone-500',
                      )}
                    >
                      {ESTADO_LABEL[r.estado]}
                    </span>
                    {r.active_version && (
                      <span className="font-mono text-[10px] text-stone-400">
                        v{r.active_version.version_number}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-stone-400">
                      DC-{r.conjunto_codigo ?? '??'}
                    </span>
                    <span>· {r.conjunto_nombre ?? '—'}</span>
                    {r.norma_referencia && <span>· {r.norma_referencia}</span>}
                    <span>· {r.items_count} ítems</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
