'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, RefreshCw, AlertTriangle, Package, Wrench,
  X, Save, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'
import type { PaqueteConInstrumentos } from '@/types/ema'

export default function PaquetesPage() {
  const { currentPlant, availablePlants } = usePlantContext()

  const [paquetes, setPaquetes] = useState<PaqueteConInstrumentos[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchPaquetes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (currentPlant?.id) params.set('plant_id', currentPlant.id)
      const res = await fetch(`/api/ema/paquetes?${params}`)
      if (!res.ok) throw new Error('Error cargando paquetes')
      const json = await res.json()
      setPaquetes(json.data ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id])

  useEffect(() => { fetchPaquetes() }, [fetchPaquetes])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este paquete?')) return
    await fetch(`/api/ema/paquetes/${id}`, { method: 'DELETE' })
    fetchPaquetes()
  }

  return (
    <div className="flex flex-col gap-4">
      <EmaBreadcrumb items={[{ label: 'Paquetes de equipo' }]} />

      {/* Header */}
      <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-stone-900">
              Paquetes de equipo
            </h1>
            <p className="mt-0.5 text-sm text-stone-500">
              Conjuntos predefinidos de instrumentos por tipo de prueba
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-stone-300 text-stone-700 gap-1.5"
              onClick={fetchPaquetes}
              disabled={loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </Button>
            <Button
              size="sm"
              className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo paquete
            </Button>
          </div>
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
        <PaquetesSkeleton />
      ) : paquetes.length === 0 ? (
        <PaquetesEmpty onCreate={() => setCreateOpen(true)} />
      ) : (
        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200 bg-stone-50/80">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-600">
              {paquetes.length} paquete{paquetes.length > 1 ? 's' : ''} configurado{paquetes.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-stone-100">
            {paquetes.map(p => (
              <PaqueteRow
                key={p.id}
                paquete={p}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                onDelete={() => handleDelete(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Create sheet */}
      <CreatePaqueteSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        availablePlants={availablePlants ?? []}
        onSuccess={() => { setCreateOpen(false); fetchPaquetes() }}
      />
    </div>
  )
}

// ─── Paquete row ──────────────────────────────────────────────────────────────

function PaqueteRow({
  paquete: p,
  expanded,
  onToggle,
  onDelete,
}: {
  paquete: PaqueteConInstrumentos
  expanded: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const instrumentos: any[] = (p as any).instrumentos ?? []
  const vencidos = instrumentos.filter(i => i.instrumento?.estado === 'vencido').length
  const proximos = instrumentos.filter(i => i.instrumento?.estado === 'proximo_vencer').length
  const isHealthy = vencidos === 0 && proximos === 0

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Health dot */}
        <div className={cn(
          'h-2 w-2 rounded-full shrink-0',
          vencidos > 0 ? 'bg-red-500' : proximos > 0 ? 'bg-amber-400' : 'bg-emerald-400'
        )} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-stone-900">{p.nombre}</span>
            {p.tipo_prueba && (
              <span className="font-mono text-[11px] text-stone-400">{p.tipo_prueba}</span>
            )}
            {vencidos > 0 && (
              <span className="rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-700">
                {vencidos} vencido{vencidos > 1 ? 's' : ''}
              </span>
            )}
            {proximos > 0 && (
              <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                {proximos} por vencer
              </span>
            )}
          </div>
          {p.descripcion && (
            <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">{p.descripcion}</p>
          )}
        </div>

        {/* Instrument count */}
        <div className="shrink-0 text-xs text-stone-400">
          {instrumentos.length} inst.
        </div>

        {/* Expand toggle */}
        <button
          onClick={onToggle}
          className="shrink-0 rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Delete */}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="shrink-0 rounded-md p-1 text-stone-300 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded instruments */}
      {expanded && (
        <div className="border-t border-stone-100 bg-stone-50/50 px-4 py-2 space-y-1.5">
          {instrumentos.length === 0 ? (
            <p className="text-xs text-stone-400 italic py-1">Sin instrumentos configurados</p>
          ) : (
            instrumentos.map((inst: any) => (
              <div key={inst.id} className="flex items-center gap-2">
                <Wrench className="h-3 w-3 text-stone-400 shrink-0" />
                <span className="font-mono text-xs text-stone-400">{inst.instrumento?.codigo}</span>
                <span className="text-xs text-stone-700 flex-1 truncate">{inst.instrumento?.nombre}</span>
                {inst.instrumento?.estado && (
                  <EmaEstadoBadge estado={inst.instrumento.estado} size="sm" />
                )}
                {inst.is_required && (
                  <span className="text-[10px] text-sky-600 font-medium shrink-0">req.</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Create sheet ─────────────────────────────────────────────────────────────

function CreatePaqueteSheet({
  open, onClose, availablePlants, onSuccess,
}: {
  open: boolean
  onClose: () => void
  availablePlants: any[]
  onSuccess: () => void
}) {
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    tipo_prueba: '',
    plant_id: '',
    instrumentos: [] as { instrumento_id: string; orden: number; is_required: boolean; _nombre: string; _codigo: string }[],
  })
  const [instrumentosBuscar, setInstrumentosBuscar] = useState<any[]>([])
  const [searchInst, setSearchInst] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (searchInst.length < 2) { setInstrumentosBuscar([]); return }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/ema/instrumentos?search=${encodeURIComponent(searchInst)}`)
      const j = await res.json()
      setInstrumentosBuscar(j.data ?? j ?? [])
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInst])

  const addInstrumento = (inst: any) => {
    if (form.instrumentos.some(i => i.instrumento_id === inst.id)) return
    setForm(f => ({
      ...f,
      instrumentos: [...f.instrumentos, {
        instrumento_id: inst.id,
        orden: f.instrumentos.length,
        is_required: true,
        _nombre: inst.nombre,
        _codigo: inst.codigo,
      }],
    }))
    setSearchInst('')
    setInstrumentosBuscar([])
  }

  const removeInstrumento = (id: string) =>
    setForm(f => ({ ...f, instrumentos: f.instrumentos.filter(i => i.instrumento_id !== id) }))

  const reset = () => {
    setForm({ nombre: '', descripcion: '', tipo_prueba: '', plant_id: '', instrumentos: [] })
    setSearchInst('')
    setInstrumentosBuscar([])
    setFormError(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const body = {
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        tipo_prueba: form.tipo_prueba || undefined,
        plant_id: form.plant_id || undefined,
        instrumentos: form.instrumentos.map(i => ({
          instrumento_id: i.instrumento_id,
          orden: i.orden,
          is_required: i.is_required,
        })),
      }
      const res = await fetch('/api/ema/paquetes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? 'Error creando paquete') }
      reset()
      onSuccess()
    } catch (e: any) {
      setFormError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { reset(); onClose() } }}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-stone-900">
            <Package className="h-4 w-4 text-stone-600" />
            Crear paquete de equipo
          </SheetTitle>
        </SheetHeader>
        <form onSubmit={handleCreate} className="mt-5 space-y-4">
          {formError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <SheetField label="Nombre *">
              <Input
                required
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="FC-Cilindros"
                className="h-8 text-sm border-stone-200"
              />
            </SheetField>
            <SheetField label="Tipo de prueba">
              <Input
                value={form.tipo_prueba}
                onChange={e => setForm(f => ({ ...f, tipo_prueba: e.target.value }))}
                placeholder="FC_cilindros"
                className="h-8 text-sm border-stone-200"
              />
            </SheetField>
          </div>
          <SheetField label="Descripción">
            <Textarea
              rows={2}
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              className="text-sm border-stone-200 resize-none"
            />
          </SheetField>
          {availablePlants.length > 0 && (
            <SheetField label="Planta (vacío = global)">
              <Select
                value={form.plant_id || 'global'}
                onValueChange={v => setForm(f => ({ ...f, plant_id: v === 'global' ? '' : v }))}
              >
                <SelectTrigger className="h-8 text-sm border-stone-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (todas las plantas)</SelectItem>
                  {availablePlants.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SheetField>
          )}

          {/* Instrument picker */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-stone-600">Instrumentos</Label>
            <div className="relative">
              <Input
                placeholder="Buscar por código o nombre…"
                value={searchInst}
                onChange={e => setSearchInst(e.target.value)}
                className="h-8 text-sm border-stone-200"
              />
              {instrumentosBuscar.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {instrumentosBuscar.map(i => (
                    <div
                      key={i.id}
                      onClick={() => addInstrumento(i)}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-stone-50 text-sm"
                    >
                      <span className="font-mono text-xs text-stone-400">{i.codigo}</span>
                      <span className="text-stone-800">{i.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {form.instrumentos.length > 0 && (
              <div className="space-y-1 mt-2">
                {form.instrumentos.map(inst => (
                  <div key={inst.instrumento_id} className="flex items-center gap-2 rounded-md bg-stone-50 border border-stone-200 px-2.5 py-1.5">
                    <Wrench className="h-3 w-3 text-stone-400 shrink-0" />
                    <span className="font-mono text-[11px] text-stone-400">{inst._codigo}</span>
                    <span className="flex-1 text-xs text-stone-700 truncate">{inst._nombre}</span>
                    <label className="flex items-center gap-1 text-[11px] text-stone-500 shrink-0">
                      <input
                        type="checkbox"
                        checked={inst.is_required}
                        onChange={e => setForm(f => ({
                          ...f,
                          instrumentos: f.instrumentos.map(i =>
                            i.instrumento_id === inst.instrumento_id
                              ? { ...i, is_required: e.target.checked }
                              : i
                          ),
                        }))}
                        className="rounded border-stone-300"
                      />
                      Req.
                    </label>
                    <button
                      type="button"
                      onClick={() => removeInstrumento(inst.instrumento_id)}
                      className="text-stone-300 hover:text-red-500 transition-colors shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" className="border-stone-300" onClick={() => { reset(); onClose() }}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="bg-stone-900 hover:bg-stone-800 text-white" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Guardando…</>
              ) : (
                <><Save className="h-3.5 w-3.5 mr-1.5" />Crear paquete</>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ─── Skeletons / empty ────────────────────────────────────────────────────────

function PaquetesSkeleton() {
  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden animate-pulse">
      <div className="h-10 bg-stone-100 border-b border-stone-200" />
      <div className="divide-y divide-stone-100">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-3 px-4 py-3">
            <div className="h-2 w-2 rounded-full bg-stone-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-40 bg-stone-200 rounded" />
              <div className="h-2.5 w-28 bg-stone-100 rounded" />
            </div>
            <div className="h-4 w-12 bg-stone-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function PaquetesEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-12 flex flex-col items-center text-center gap-4">
      <div className="h-12 w-12 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center">
        <Package className="h-6 w-6 text-stone-400" />
      </div>
      <div>
        <div className="text-sm font-medium text-stone-900">Sin paquetes configurados</div>
        <div className="mt-1 text-xs text-stone-500">
          Crea un paquete para agrupar instrumentos por tipo de prueba.
        </div>
      </div>
      <Button size="sm" className="bg-stone-900 hover:bg-stone-800 text-white gap-1.5" onClick={onCreate}>
        <Plus className="h-3.5 w-3.5" />
        Crear primer paquete
      </Button>
    </div>
  )
}

function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-stone-600">{label}</Label>
      {children}
    </div>
  )
}
