'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, AlertTriangle, BookOpen, Search, X, ChevronRight, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import type { ConjuntoHerramientas } from '@/types/ema'

const MESES_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const TIPO_SERVICIO_LABEL: Record<string, string> = {
  calibracion: 'Calibración',
  verificacion: 'Verificación',
  ninguno: 'Sin servicio',
}

export default function ConjuntosPage() {
  const router = useRouter()
  const [conjuntos, setConjuntos] = useState<ConjuntoHerramientas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchConjuntos = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ema/conjuntos')
      if (!res.ok) throw new Error('Error cargando conjuntos')
      const json = await res.json()
      setConjuntos(json.data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchConjuntos() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return conjuntos
      .filter(c =>
        !search ||
        c.codigo_conjunto.includes(search) ||
        c.nombre_conjunto.toLowerCase().includes(q)
      )
      .sort((a, b) => parseInt(a.codigo_conjunto) - parseInt(b.codigo_conjunto))
  }, [conjuntos, search])

  return (
    <div className="flex flex-col gap-4">
      <EmaBreadcrumb items={[{ label: 'Conjuntos de herramientas' }]} />

      <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Conjuntos de herramientas
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Catálogo maestro — define patrón de código <span className="font-mono">DC-CC-NN</span>, categoría y ventana de servicio
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-stone-300 text-stone-700 gap-1.5"
              onClick={fetchConjuntos}
              disabled={loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
              onClick={() => router.push('/quality/conjuntos/nuevo')}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo conjunto
            </Button>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
          <Input
            placeholder="Buscar por código, nombre o categoría…"
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-stone-200 bg-white p-12 text-center text-sm text-stone-400">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-stone-200 bg-white p-12 flex flex-col items-center text-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
            <BookOpen className="h-6 w-6 text-stone-400" />
          </div>
          <div>
            <div className="text-sm font-medium text-stone-900">
              {search ? 'Sin resultados' : 'Sin conjuntos registrados'}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {search
                ? 'No hay conjuntos que coincidan con la búsqueda.'
                : 'Crea el primer conjunto para comenzar.'}
            </div>
          </div>
          {!search && (
            <Button size="sm" className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5" onClick={() => router.push('/quality/conjuntos/nuevo')}>
              <Plus className="h-3.5 w-3.5" />
              Crear primer conjunto
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-stone-50/60">
            <span className="text-xs text-stone-400">{filtered.length} conjuntos</span>
          </div>
          <div className="divide-y divide-stone-100">
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/quality/conjuntos/${c.id}`)}
                className="group w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                <span className="font-mono text-[11px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded w-14 text-center shrink-0">
                  DC-{c.codigo_conjunto}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-900">{c.nombre_conjunto}</span>
                    <EmaTipoBadge tipo={c.tipo_defecto} showLabel />
                    {!c.is_active && (
                      <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] text-stone-400">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{TIPO_SERVICIO_LABEL[c.tipo_servicio] ?? c.tipo_servicio}</span>
                    {c.tipo_servicio !== 'ninguno' && c.mes_inicio_servicio && c.mes_fin_servicio && (
                      <span className="font-mono">
                        · {MESES_ABBR[c.mes_inicio_servicio - 1]}–{MESES_ABBR[c.mes_fin_servicio - 1]}
                      </span>
                    )}
                    {c.cadencia_meses !== 12 && <span>· cada {c.cadencia_meses}m</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs text-stone-400">#{c.secuencia_actual ?? 0} instr.</div>
                </div>
                {c.tipo_servicio === 'verificacion' && (
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/quality/conjuntos/${c.id}/plantilla`) }}
                    title="Editar plantilla de verificación"
                    className="shrink-0 p-1.5 rounded-md text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  >
                    <ClipboardList className="h-4 w-4" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
