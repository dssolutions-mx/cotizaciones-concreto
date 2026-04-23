'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, AlertTriangle, BookOpen, Search, X, ChevronRight, ClipboardList, Trash2, Table2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { EMA_CATALOG_DELETE_ROLES } from '@/lib/ema/catalogDeleteRoles'
import type { ConjuntoHerramientas, EmaDeleteBlocker } from '@/types/ema'

const MESES_ABBR = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const TIPO_SERVICIO_LABEL: Record<string, string> = {
  calibracion: 'Calibración',
  verificacion: 'Verificación',
  ninguno: 'Sin servicio',
}

export default function ConjuntosPage() {
  const router = useRouter()
  const { hasRole } = useAuthSelectors()
  const [conjuntos, setConjuntos] = useState<ConjuntoHerramientas[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<ConjuntoHerramientas | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
  const [deleteBlockers, setDeleteBlockers] = useState<EmaDeleteBlocker[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState('')

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
    <>
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
            <Button variant="outline" size="sm" className="border-stone-300 text-stone-700 gap-1.5" asChild>
              <Link href="/quality/conjuntos/gestion">
                <Table2 className="h-3.5 w-3.5" />
                Vista de gestión
              </Link>
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
                    type="button"
                    onClick={e => { e.stopPropagation(); router.push(`/quality/conjuntos/${c.id}/plantilla`) }}
                    title="Editar plantilla de verificación"
                    className="shrink-0 p-1.5 rounded-md text-stone-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                  >
                    <ClipboardList className="h-4 w-4" />
                  </button>
                )}
                {hasRole(EMA_CATALOG_DELETE_ROLES) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(c)
                      setDeleteErr(null)
                      setDeleteBlockers([])
                      setDeleteConfirm('')
                    }}
                    title="Eliminar conjunto"
                    className="shrink-0 p-1.5 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    <AlertDialog
      open={!!deleteTarget}
      onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null)
          setDeleteErr(null)
          setDeleteBlockers([])
          setDeleteConfirm('')
        }
      }}
    >
      <AlertDialogContent className="border-stone-200">
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar conjunto</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-stone-600">
              {deleteTarget && (
                <>
                  <p>
                    ¿Eliminar <span className="font-mono font-medium text-stone-900">DC-{deleteTarget.codigo_conjunto}</span>
                    {' — '}
                    <span className="font-medium text-stone-900">{deleteTarget.nombre_conjunto}</span>?
                  </p>
                  <p className="text-xs text-stone-500">
                    Escriba <span className="font-mono font-semibold">ELIMINAR</span> para confirmar.
                  </p>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="ELIMINAR"
                    className="font-mono text-sm"
                    autoComplete="off"
                  />
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteErr && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {deleteErr}
            {deleteBlockers.length > 0 && (
              <ul className="mt-2 list-disc pl-4 space-y-1">
                {deleteBlockers.map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteBusy || deleteConfirm.trim() !== 'ELIMINAR' || !deleteTarget}
            className="bg-red-700 hover:bg-red-800 focus:ring-red-700"
            onClick={async (e) => {
              e.preventDefault()
              if (!deleteTarget) return
              setDeleteBusy(true)
              setDeleteErr(null)
              setDeleteBlockers([])
              try {
                const res = await fetch(`/api/ema/conjuntos/${deleteTarget.id}`, { method: 'DELETE' })
                const j = await res.json().catch(() => ({}))
                if (res.status === 409 && Array.isArray(j.blockers)) {
                  setDeleteBlockers(j.blockers)
                  setDeleteErr(j.error ?? 'No se puede eliminar.')
                  return
                }
                if (!res.ok) throw new Error(j.error ?? 'Error al eliminar')
                setDeleteTarget(null)
                await fetchConjuntos()
              } catch (err: any) {
                setDeleteErr(err.message ?? 'Error al eliminar')
              } finally {
                setDeleteBusy(false)
              }
            }}
          >
            {deleteBusy ? 'Eliminando…' : 'Eliminar definitivamente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
