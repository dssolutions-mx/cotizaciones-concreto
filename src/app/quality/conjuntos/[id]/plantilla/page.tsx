'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Save, BookOpen, CheckCircle2,
  AlertTriangle, Loader2, ChevronDown, ChevronRight, GripVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { cn } from '@/lib/utils'
import type {
  VerificacionTemplateDetalle,
  VerificacionTemplateSection,
  VerificacionTemplateItem,
  TipoItemVerificacion,
} from '@/types/ema'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoItemVerificacion, string> = {
  medicion: 'Medición',
  booleano: '¿Cumple?',
  numero: 'Número libre',
  texto: 'Texto libre',
  calculado: 'Calculado',
  referencia_equipo: 'Equipo ref.',
}

const TIPO_COLOR: Record<TipoItemVerificacion, string> = {
  medicion: 'bg-sky-50 text-sky-700 border-sky-200',
  booleano: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  numero: 'bg-violet-50 text-violet-700 border-violet-200',
  texto: 'bg-stone-50 text-stone-600 border-stone-200',
  calculado: 'bg-amber-50 text-amber-700 border-amber-200',
  referencia_equipo: 'bg-cyan-50 text-cyan-700 border-cyan-200',
}

function TipoBadge({ tipo }: { tipo: TipoItemVerificacion }) {
  return (
    <span className={cn(
      'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
      TIPO_COLOR[tipo],
    )}>
      {TIPO_LABEL[tipo]}
    </span>
  )
}

// ─── Item Form ─────────────────────────────────────────────────────────────────

interface ItemFormState {
  tipo: TipoItemVerificacion
  punto: string
  valor_esperado: string
  tolerancia: string
  tolerancia_tipo: 'absoluta' | 'porcentual' | 'rango'
  tolerancia_min: string
  tolerancia_max: string
  unidad: string
  formula: string
  observacion_prompt: string
  requerido: boolean
}

const emptyItemForm = (): ItemFormState => ({
  tipo: 'medicion',
  punto: '',
  valor_esperado: '',
  tolerancia: '',
  tolerancia_tipo: 'absoluta',
  tolerancia_min: '',
  tolerancia_max: '',
  unidad: '',
  formula: '',
  observacion_prompt: '',
  requerido: true,
})

function itemFormToPayload(f: ItemFormState) {
  return {
    tipo: f.tipo,
    punto: f.punto.trim(),
    valor_esperado: f.valor_esperado !== '' ? parseFloat(f.valor_esperado) : null,
    tolerancia: f.tolerancia !== '' ? parseFloat(f.tolerancia) : null,
    tolerancia_tipo: f.tolerancia_tipo,
    tolerancia_min: f.tolerancia_min !== '' ? parseFloat(f.tolerancia_min) : null,
    tolerancia_max: f.tolerancia_max !== '' ? parseFloat(f.tolerancia_max) : null,
    unidad: f.unidad.trim() || null,
    formula: f.formula.trim() || null,
    observacion_prompt: f.observacion_prompt.trim() || null,
    requerido: f.requerido,
  }
}

function itemToForm(item: VerificacionTemplateItem): ItemFormState {
  return {
    tipo: item.tipo,
    punto: item.punto,
    valor_esperado: item.valor_esperado != null ? String(item.valor_esperado) : '',
    tolerancia: item.tolerancia != null ? String(item.tolerancia) : '',
    tolerancia_tipo: item.tolerancia_tipo,
    tolerancia_min: item.tolerancia_min != null ? String(item.tolerancia_min) : '',
    tolerancia_max: item.tolerancia_max != null ? String(item.tolerancia_max) : '',
    unidad: item.unidad ?? '',
    formula: item.formula ?? '',
    observacion_prompt: item.observacion_prompt ?? '',
    requerido: item.requerido,
  }
}

function ItemForm({
  form, onChange,
}: { form: ItemFormState; onChange: (f: ItemFormState) => void }) {
  const set = (k: keyof ItemFormState, v: any) => onChange({ ...form, [k]: v })
  const isMedicion = form.tipo === 'medicion'
  const isRango = form.tolerancia_tipo === 'rango'
  const isCalculado = form.tipo === 'calculado'

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1 col-span-2">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Tipo</Label>
        <select
          value={form.tipo}
          onChange={e => set('tipo', e.target.value)}
          className="w-full rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {(Object.keys(TIPO_LABEL) as TipoItemVerificacion[]).map(t => (
            <option key={t} value={t}>{TIPO_LABEL[t]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1 col-span-2">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Punto de verificación *</Label>
        <Input
          value={form.punto}
          onChange={e => set('punto', e.target.value)}
          placeholder="Ej. Longitud, Diámetro superior, ¿Cono completo?"
          className="border-stone-200 text-sm"
        />
      </div>

      {isMedicion && (
        <>
          <div className="space-y-1">
            <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Valor esperado</Label>
            <Input type="number" step="any" value={form.valor_esperado}
              onChange={e => set('valor_esperado', e.target.value)}
              placeholder="0" className="border-stone-200 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Unidad</Label>
            <Input value={form.unidad} onChange={e => set('unidad', e.target.value)}
              placeholder="mm, gr, kg…" className="border-stone-200 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Tipo tolerancia</Label>
            <select value={form.tolerancia_tipo}
              onChange={e => set('tolerancia_tipo', e.target.value)}
              className="w-full rounded-md border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none">
              <option value="absoluta">Absoluta (±)</option>
              <option value="porcentual">Porcentual (%)</option>
              <option value="rango">Rango (mín–máx)</option>
            </select>
          </div>
          {!isRango ? (
            <div className="space-y-1">
              <Label className="text-[10px] text-stone-500 uppercase tracking-wide">
                Tolerancia {form.tolerancia_tipo === 'porcentual' ? '(%)' : `(${form.unidad || 'unidad'})`}
              </Label>
              <Input type="number" step="any" value={form.tolerancia}
                onChange={e => set('tolerancia', e.target.value)}
                placeholder="0" className="border-stone-200 text-sm font-mono" />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Mínimo</Label>
                <Input type="number" step="any" value={form.tolerancia_min}
                  onChange={e => set('tolerancia_min', e.target.value)}
                  placeholder="0" className="border-stone-200 text-sm font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Máximo</Label>
                <Input type="number" step="any" value={form.tolerancia_max}
                  onChange={e => set('tolerancia_max', e.target.value)}
                  placeholder="0" className="border-stone-200 text-sm font-mono" />
              </div>
            </>
          )}
        </>
      )}

      {isCalculado && (
        <div className="space-y-1 col-span-2">
          <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Fórmula</Label>
          <Input value={form.formula}
            onChange={e => set('formula', e.target.value)}
            placeholder="masa_agua / masa_volumetrica_agua"
            className="border-stone-200 text-sm font-mono" />
        </div>
      )}

      <div className="space-y-1 col-span-2">
        <Label className="text-[10px] text-stone-500 uppercase tracking-wide">Instrucción / prompt (opcional)</Label>
        <Input value={form.observacion_prompt}
          onChange={e => set('observacion_prompt', e.target.value)}
          placeholder="Ej. Medir en el punto central, en mm"
          className="border-stone-200 text-sm" />
      </div>

      <div className="col-span-2 flex items-center gap-2">
        <input type="checkbox" id="req-chk" checked={form.requerido}
          onChange={e => set('requerido', e.target.checked)} className="h-3.5 w-3.5" />
        <label htmlFor="req-chk" className="text-xs text-stone-600">Requerido</label>
      </div>
    </div>
  )
}

// ─── Section Card ──────────────────────────────────────────────────────────────

function SectionCard({
  section, templateId, onUpdated, onDeleted,
}: {
  section: VerificacionTemplateSection & { items: VerificacionTemplateItem[] }
  templateId: string
  onUpdated: (s: VerificacionTemplateSection & { items: VerificacionTemplateItem[] }) => void
  onDeleted: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const [addingItem, setAddingItem] = useState(false)
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm())
  const [savingItem, setSavingItem] = useState(false)
  const [itemErr, setItemErr] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<ItemFormState>(emptyItemForm())

  async function handleAddItem() {
    if (!itemForm.punto.trim()) { setItemErr('El punto es requerido'); return }
    setSavingItem(true)
    setItemErr(null)
    try {
      const res = await fetch(`/api/ema/templates/${templateId}/sections/${section.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemFormToPayload(itemForm)),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.error) }
      const j = await res.json()
      onUpdated({ ...section, items: [...section.items, j.data] })
      setItemForm(emptyItemForm())
      setAddingItem(false)
    } catch (e: any) { setItemErr(e.message) }
    finally { setSavingItem(false) }
  }

  async function handleDeleteItem(itemId: string) {
    if (!confirm('¿Eliminar este punto de verificación?')) return
    const res = await fetch(
      `/api/ema/templates/${templateId}/sections/${section.id}/items/${itemId}`,
      { method: 'DELETE' }
    )
    if (res.ok) onUpdated({ ...section, items: section.items.filter(i => i.id !== itemId) })
  }

  async function handleSaveItem(itemId: string) {
    if (!editForm.punto.trim()) return
    setSavingItem(true)
    try {
      const res = await fetch(
        `/api/ema/templates/${templateId}/sections/${section.id}/items/${itemId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(itemFormToPayload(editForm)) }
      )
      if (!res.ok) throw new Error((await res.json()).error)
      const j = await res.json()
      onUpdated({ ...section, items: section.items.map(i => i.id === itemId ? j.data : i) })
      setEditingItem(null)
    } catch (e: any) { setItemErr(e.message) }
    finally { setSavingItem(false) }
  }

  async function handleDeleteSection() {
    if (!confirm(`¿Eliminar la sección "${section.titulo}" y todos sus puntos?`)) return
    const res = await fetch(`/api/ema/templates/${templateId}/sections/${section.id}`, { method: 'DELETE' })
    if (res.ok) onDeleted(section.id)
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200">
        <GripVertical className="h-4 w-4 text-stone-300 shrink-0" />
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-stone-400 shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-stone-400 shrink-0" />
          }
          <span className="text-sm font-semibold text-stone-700">{section.titulo}</span>
          {section.repetible && (
            <span className="rounded-full bg-violet-50 border border-violet-200 text-violet-700 px-2 py-0.5 text-[10px] font-medium">
              ×{section.repeticiones_default}
            </span>
          )}
          <span className="ml-auto text-xs text-stone-400">{section.items.length} punto{section.items.length !== 1 ? 's' : ''}</span>
        </button>
        <button
          type="button"
          onClick={handleDeleteSection}
          className="p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="Eliminar sección"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="divide-y divide-stone-50">
          {/* Items table */}
          {section.items.length > 0 && (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/40">
                  <th className="text-left px-4 py-2 font-semibold text-stone-400 uppercase tracking-wide w-6">#</th>
                  <th className="text-left px-4 py-2 font-semibold text-stone-400 uppercase tracking-wide">Punto</th>
                  <th className="text-left px-4 py-2 font-semibold text-stone-400 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-2 font-semibold text-stone-400 uppercase tracking-wide">Esperado / Tolerancia</th>
                  <th className="w-16 px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {section.items.map((item, idx) => (
                  editingItem === item.id ? (
                    <tr key={item.id}>
                      <td colSpan={5} className="px-4 py-3">
                        <div className="space-y-3">
                          <ItemForm form={editForm} onChange={setEditForm} />
                          {itemErr && <p className="text-xs text-red-600">{itemErr}</p>}
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={() => { setEditingItem(null); setItemErr(null) }}>
                              Cancelar
                            </Button>
                            <Button size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                              onClick={() => handleSaveItem(item.id)} disabled={savingItem}>
                              {savingItem ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                              Guardar
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className="hover:bg-stone-50/50 cursor-pointer"
                      onClick={() => { setEditingItem(item.id); setEditForm(itemToForm(item)); setItemErr(null) }}>
                      <td className="px-4 py-2 text-stone-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-2 text-stone-700 font-medium">{item.punto}</td>
                      <td className="px-4 py-2"><TipoBadge tipo={item.tipo} /></td>
                      <td className="px-4 py-2 font-mono text-stone-500">
                        {item.tipo === 'medicion' && item.valor_esperado != null
                          ? `${item.valor_esperado}${item.unidad ? ` ${item.unidad}` : ''}${item.tolerancia != null ? ` ± ${item.tolerancia}` : ''}${item.tolerancia_tipo === 'rango' ? ` [${item.tolerancia_min ?? '?'}–${item.tolerancia_max ?? '?'}]` : ''}`
                          : item.tipo === 'calculado' && item.formula
                          ? item.formula
                          : '—'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button type="button"
                          onClick={e => { e.stopPropagation(); handleDeleteItem(item.id) }}
                          className="p-1 rounded text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}

          {/* Add item form */}
          {addingItem ? (
            <div className="px-4 py-4 bg-emerald-50/30 space-y-3">
              <p className="text-xs font-semibold text-stone-600">Nuevo punto de verificación</p>
              <ItemForm form={itemForm} onChange={setItemForm} />
              {itemErr && <p className="text-xs text-red-600">{itemErr}</p>}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => { setAddingItem(false); setItemErr(null); setItemForm(emptyItemForm()) }}>
                  Cancelar
                </Button>
                <Button size="sm" className="h-7 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                  onClick={handleAddItem} disabled={savingItem}>
                  {savingItem ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Agregar punto
                </Button>
              </div>
            </div>
          ) : (
            <div className="px-4 py-2">
              <button
                type="button"
                onClick={() => setAddingItem(true)}
                className="flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 font-medium py-1"
              >
                <Plus className="h-3 w-3" /> Agregar punto de verificación
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PlantillaPage() {
  const { id: conjuntoId } = useParams<{ id: string }>()

  const [template, setTemplate] = useState<VerificacionTemplateDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conjuntoNombre, setConjuntoNombre] = useState('Conjunto')

  // Create template form (when none exists)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ codigo: '', nombre: '', norma_referencia: '' })
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [createSaving, setCreateSaving] = useState(false)

  // Add section form
  const [addingSection, setAddingSection] = useState(false)
  const [sectionForm, setSectionForm] = useState({ titulo: '', descripcion: '', repetible: false, repeticiones_default: 1 })
  const [sectionErr, setSectionErr] = useState<string | null>(null)
  const [sectionSaving, setSectionSaving] = useState(false)

  // Publish
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Load conjunto name
      const cRes = await fetch(`/api/ema/conjuntos/${conjuntoId}`)
      if (cRes.ok) {
        const cj = (await cRes.json()).data
        setConjuntoNombre(cj?.nombre_conjunto ?? 'Conjunto')
        // Count existing templates to auto-generate next sequential code
        const countRes = await fetch(`/api/ema/conjuntos/${conjuntoId}/templates`)
        const countJ = await countRes.json()
        if (!countJ.data) {
          // No template yet — query total templates for next number
          const allRes = await fetch('/api/ema/templates/count')
          const total = (await allRes.json().catch(() => ({ count: 6 }))).count ?? 6
          const nextNum = String(total + 1).padStart(2, '0')
          setCreateForm(f => ({ ...f, codigo: `DC-LC-6.4-${nextNum}`, nombre: cj?.nombre_conjunto ?? '' }))
        }
      }

      // Load template
      const tRes = await fetch(`/api/ema/conjuntos/${conjuntoId}/templates`)
      const tj = await tRes.json()
      if (!tj.data) { setTemplate(null); setLoading(false); return }

      // Load full detail
      const dRes = await fetch(`/api/ema/templates/${tj.data.id}`)
      const dj = await dRes.json()
      setTemplate(dj.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [conjuntoId])

  useEffect(() => { load() }, [load])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.nombre.trim()) { setCreateErr('El nombre es requerido'); return }
    setCreateSaving(true)
    setCreateErr(null)
    try {
      const res = await fetch(`/api/ema/conjuntos/${conjuntoId}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: createForm.codigo.trim(),
          nombre: createForm.nombre.trim(),
          norma_referencia: createForm.norma_referencia.trim() || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      await load()
    } catch (e: any) { setCreateErr(e.message) }
    finally { setCreateSaving(false) }
  }

  async function handleAddSection() {
    if (!template) return
    if (!sectionForm.titulo.trim()) { setSectionErr('El título es requerido'); return }
    setSectionSaving(true)
    setSectionErr(null)
    try {
      const res = await fetch(`/api/ema/templates/${template.id}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: sectionForm.titulo.trim(),
          descripcion: sectionForm.descripcion.trim() || null,
          repetible: sectionForm.repetible,
          repeticiones_default: sectionForm.repeticiones_default,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const j = await res.json()
      setTemplate(t => t ? { ...t, sections: [...t.sections, j.data] } : t)
      setSectionForm({ titulo: '', descripcion: '', repetible: false, repeticiones_default: 1 })
      setAddingSection(false)
    } catch (e: any) { setSectionErr(e.message) }
    finally { setSectionSaving(false) }
  }

  async function handlePublish() {
    if (!template) return
    setPublishing(true)
    setPublishMsg(null)
    try {
      const res = await fetch(`/api/ema/templates/${template.id}/publish`, { method: 'POST' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error)
      setPublishMsg(`Versión ${j.data.version.version_number} publicada correctamente`)
      await load()
    } catch (e: any) { setPublishMsg(`Error: ${e.message}`) }
    finally { setPublishing(false) }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 max-w-4xl">
        <div className="h-4 w-48 bg-stone-200 rounded animate-pulse" />
        <div className="h-96 rounded-lg bg-stone-100 animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
    )
  }

  // ── No template yet — create form
  if (!template) {
    return (
      <div className="flex flex-col gap-5 max-w-xl">
        <EmaBreadcrumb items={[
          { label: 'Conjuntos', href: '/quality/conjuntos' },
          { label: conjuntoNombre, href: `/quality/conjuntos/${conjuntoId}` },
          { label: 'Plantilla de verificación' },
        ]} />

        <div className="flex items-center gap-3">
          <Link href={`/quality/conjuntos/${conjuntoId}`}
            className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-stone-900">Crear plantilla de verificación</h1>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-5">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-stone-600">Código del documento</Label>
                <span className="text-[10px] text-stone-400 italic">Generado automáticamente · No editable</span>
              </div>
              <div className="flex items-center rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <span className="font-mono text-sm text-stone-700 flex-1">{createForm.codigo || '—'}</span>
              </div>
              <p className="text-[10px] text-stone-400">Código de control documental (DC-LC-6.4-NN). Se asigna automáticamente en secuencia.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Nombre *</Label>
              <Input value={createForm.nombre}
                onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Verificación de flexómetros" className="border-stone-200 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Norma de referencia</Label>
              <Input value={createForm.norma_referencia}
                onChange={e => setCreateForm(f => ({ ...f, norma_referencia: e.target.value }))}
                placeholder="NMX-C-083, NOM-008-SCFI-2002…" className="border-stone-200 text-sm" />
            </div>
            {createErr && <p className="text-xs text-red-600">{createErr}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={createSaving}
                className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5">
                {createSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear plantilla
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ── Template exists — editor
  const totalItems = template.sections.reduce((acc, s) => acc + s.items.length, 0)

  return (
    <div className="flex flex-col gap-5 max-w-4xl pb-10">
      <EmaBreadcrumb items={[
        { label: 'Conjuntos', href: '/quality/conjuntos' },
        { label: conjuntoNombre, href: `/quality/conjuntos/${conjuntoId}` },
        { label: 'Plantilla de verificación' },
      ]} />

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/quality/conjuntos/${conjuntoId}`}
          className="rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold tracking-tight text-stone-900">{template.nombre}</h1>
            <span className={cn(
              'rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              template.estado === 'publicado'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : template.estado === 'archivado'
                ? 'bg-stone-100 text-stone-500 border-stone-200'
                : 'bg-amber-50 text-amber-700 border-amber-200',
            )}>
              {template.estado}
            </span>
          </div>
          <p className="text-xs text-stone-500 font-mono mt-0.5">
            {template.codigo}
            {template.norma_referencia && ` · ${template.norma_referencia}`}
            {template.active_version && ` · v${template.active_version.version_number} activa`}
          </p>
        </div>
        <Button
          onClick={handlePublish}
          disabled={publishing || template.sections.length === 0}
          className="shrink-0 bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
          title={template.sections.length === 0 ? 'Agrega al menos una sección antes de publicar' : ''}
        >
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
          Publicar versión
        </Button>
      </div>

      {publishMsg && (
        <div className={cn(
          'rounded-lg border px-4 py-3 text-sm flex items-center gap-2',
          publishMsg.startsWith('Error')
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800',
        )}>
          {publishMsg.startsWith('Error')
            ? <AlertTriangle className="h-4 w-4 shrink-0" />
            : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {publishMsg}
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 rounded-lg border border-stone-200 bg-white divide-x divide-stone-100">
        {[
          { label: 'Secciones', value: template.sections.length },
          { label: 'Puntos de verificación', value: totalItems },
          { label: 'Versión activa', value: template.active_version ? `v${template.active_version.version_number}` : 'Ninguna' },
        ].map(s => (
          <div key={s.label} className="px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{s.label}</p>
            <p className="text-sm font-medium text-stone-800 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-3">
        {template.sections.map(section => (
          <SectionCard
            key={section.id}
            section={section}
            templateId={template.id}
            onUpdated={updated => setTemplate(t => t ? {
              ...t, sections: t.sections.map(s => s.id === updated.id ? updated : s)
            } : t)}
            onDeleted={sid => setTemplate(t => t ? {
              ...t, sections: t.sections.filter(s => s.id !== sid)
            } : t)}
          />
        ))}

        {/* Add section */}
        {addingSection ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
            <p className="text-sm font-semibold text-stone-700">Nueva sección</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-stone-600">Título *</Label>
                <Input value={sectionForm.titulo}
                  onChange={e => setSectionForm(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ej. Verificación del cono, Equipos utilizados"
                  className="border-stone-200 text-sm" />
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-stone-600">Descripción</Label>
                <Textarea value={sectionForm.descripcion}
                  onChange={e => setSectionForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Instrucciones o contexto para esta sección…"
                  rows={2} className="border-stone-200 text-sm resize-none" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="rep-chk" checked={sectionForm.repetible}
                  onChange={e => setSectionForm(f => ({ ...f, repetible: e.target.checked }))}
                  className="h-3.5 w-3.5" />
                <label htmlFor="rep-chk" className="text-xs text-stone-600">Sección repetible</label>
              </div>
              {sectionForm.repetible && (
                <div className="space-y-1">
                  <Label className="text-xs text-stone-600">N° repeticiones</Label>
                  <Input type="number" min={1} max={10}
                    value={sectionForm.repeticiones_default}
                    onChange={e => setSectionForm(f => ({ ...f, repeticiones_default: parseInt(e.target.value) || 1 }))}
                    className="border-stone-200 text-sm font-mono" />
                </div>
              )}
            </div>
            {sectionErr && <p className="text-xs text-red-600">{sectionErr}</p>}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-8 text-xs"
                onClick={() => { setAddingSection(false); setSectionErr(null) }}>
                Cancelar
              </Button>
              <Button size="sm" className="h-8 text-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                onClick={handleAddSection} disabled={sectionSaving}>
                {sectionSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Agregar sección
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddingSection(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50/50 py-3 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Agregar sección
          </button>
        )}
      </div>

      {template.sections.length === 0 && !addingSection && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <span>La plantilla no tiene secciones. Agrega al menos una sección con puntos de verificación para poder publicarla.</span>
        </div>
      )}
    </div>
  )
}
