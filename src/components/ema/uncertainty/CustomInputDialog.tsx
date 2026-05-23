'use client'

import React, { useState, useCallback } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { StudyCustomInput, CreateCustomInputBody } from '@/types/ema-uncertainty'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mean(vals: number[]) {
  return vals.reduce((s, v) => s + v, 0) / vals.length
}
function stdDev(vals: number[]) {
  const mu = mean(vals)
  return Math.sqrt(vals.reduce((s, v) => s + (v - mu) ** 2, 0) / (vals.length - 1))
}

const B_SUBTIPO_LABEL: Record<string, string> = {
  resolucion: 'Resolución del instrumento',
  rectangular: 'Rectangular',
  triangular: 'Triangular',
  normal: 'Normal (calibración)',
  'u-shaped': 'U-shaped',
}

const B_SUBTIPO_DIVISOR: Record<string, string> = {
  rectangular: '√3',
  triangular: '√6',
  'u-shaped': '√2',
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="mt-0.5 text-[11px] text-red-600">{msg}</p>
}

// ---------------------------------------------------------------------------
// Type A tab
// ---------------------------------------------------------------------------

function TypeAFields({
  replicaValues,
  onReplicaChange,
  normaRef,
  onNormaRefChange,
  descripcion,
  onDescripcionChange,
}: {
  replicaValues: string[]
  onReplicaChange: (vals: string[]) => void
  normaRef: string
  onNormaRefChange: (v: string) => void
  descripcion: string
  onDescripcionChange: (v: string) => void
}) {
  const parsed = replicaValues.map((v) => parseFloat(v)).filter((v) => isFinite(v))
  const hasEnough = parsed.length >= 2
  const mu = hasEnough ? mean(parsed) : null
  const s = hasEnough && parsed.length >= 2 ? stdDev(parsed) : null
  const u = s !== null ? s / Math.sqrt(parsed.length) : null

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Réplicas (mínimo 2) <span className="text-red-500">*</span></Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onReplicaChange([...replicaValues, ''])}
          >
            <Plus className="mr-1 h-3 w-3" />
            Agregar
          </Button>
        </div>
        <div className="mt-1.5 space-y-1">
          {replicaValues.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-5 text-right text-[11px] text-stone-400">{i + 1}.</span>
              <Input
                type="number"
                step="any"
                value={v}
                placeholder="valor"
                className="h-7 flex-1 text-right text-sm"
                onChange={(e) => {
                  const next = [...replicaValues]
                  next[i] = e.target.value
                  onReplicaChange(next)
                }}
              />
              {replicaValues.length > 2 && (
                <button
                  type="button"
                  className="text-stone-400 hover:text-red-500"
                  onClick={() => {
                    const next = replicaValues.filter((_, j) => j !== i)
                    onReplicaChange(next)
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {!hasEnough && (
          <p className="mt-1 text-[11px] text-red-600">Se requieren al menos 2 réplicas con valores numéricos.</p>
        )}
      </div>

      {/* Live preview */}
      {hasEnough && mu !== null && s !== null && u !== null && (
        <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-600">
          <span className="font-medium">Vista previa: </span>
          n = {parsed.length} · mean = {mu.toFixed(4)} · s = {s.toFixed(4)} · u = s/√n = <span className="font-semibold text-stone-800">{u.toFixed(4)}</span>
        </div>
      )}

      <div>
        <Label htmlFor="ci-norma-a" className="text-xs">Norma de referencia <span className="text-stone-400">(opcional)</span></Label>
        <Input
          id="ci-norma-a"
          value={normaRef}
          onChange={(e) => onNormaRefChange(e.target.value)}
          placeholder="p. ej. NMX-C-156 §6.1"
          className="mt-1 h-7 text-sm"
        />
      </div>

      <div>
        <Label htmlFor="ci-desc-a" className="text-xs">Descripción <span className="text-stone-400">(opcional)</span></Label>
        <Input
          id="ci-desc-a"
          value={descripcion}
          onChange={(e) => onDescripcionChange(e.target.value)}
          placeholder="Explicación breve"
          className="mt-1 h-7 text-sm"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type B tab
// ---------------------------------------------------------------------------

function TypeBFields({
  bSubtipo,
  onBSubtipoChange,
  halfWidth,
  onHalfWidthChange,
  divMin,
  onDivMinChange,
  uCert,
  onUCertChange,
  kCert,
  onKCertChange,
  normaRef,
  onNormaRefChange,
  descripcion,
  onDescripcionChange,
  errors,
}: {
  bSubtipo: string
  onBSubtipoChange: (v: string) => void
  halfWidth: string
  onHalfWidthChange: (v: string) => void
  divMin: string
  onDivMinChange: (v: string) => void
  uCert: string
  onUCertChange: (v: string) => void
  kCert: string
  onKCertChange: (v: string) => void
  normaRef: string
  onNormaRefChange: (v: string) => void
  descripcion: string
  onDescripcionChange: (v: string) => void
  errors: Record<string, string>
}) {
  const normaRequired = bSubtipo !== 'resolucion'
  const divisorLabel = B_SUBTIPO_DIVISOR[bSubtipo]

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Tipo de distribución <span className="text-red-500">*</span></Label>
        <Select value={bSubtipo} onValueChange={onBSubtipoChange}>
          <SelectTrigger className="mt-1 h-8 text-sm">
            <SelectValue placeholder="Selecciona distribución" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(B_SUBTIPO_LABEL).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resolution */}
      {bSubtipo === 'resolucion' && (
        <div>
          <Label htmlFor="ci-divmin" className="text-xs">
            División mínima (div<sub>min</sub>) <span className="text-red-500">*</span>
          </Label>
          <p className="mb-1 text-[11px] text-stone-500">u = div<sub>min</sub> / (2√3). No requiere norma de referencia.</p>
          <Input
            id="ci-divmin"
            type="number"
            step="any"
            min="0"
            value={divMin}
            onChange={(e) => onDivMinChange(e.target.value)}
            placeholder="p. ej. 0.1"
            className="h-7 text-sm"
          />
          <FieldError msg={errors.div_min} />
        </div>
      )}

      {/* Rectangular / triangular / u-shaped */}
      {['rectangular', 'triangular', 'u-shaped'].includes(bSubtipo) && (
        <div>
          <Label htmlFor="ci-hw" className="text-xs">
            Semi-amplitud ±a <span className="text-red-500">*</span>
          </Label>
          {divisorLabel && (
            <p className="mb-1 text-[11px] text-stone-500">u = ±a / {divisorLabel}</p>
          )}
          <Input
            id="ci-hw"
            type="number"
            step="any"
            min="0"
            value={halfWidth}
            onChange={(e) => onHalfWidthChange(e.target.value)}
            placeholder="p. ej. 0.5"
            className="h-7 text-sm"
          />
          <FieldError msg={errors.half_width} />
        </div>
      )}

      {/* Normal */}
      {bSubtipo === 'normal' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ci-ucert" className="text-xs">U (incertidumbre expandida) <span className="text-red-500">*</span></Label>
            <Input
              id="ci-ucert"
              type="number"
              step="any"
              min="0"
              value={uCert}
              onChange={(e) => onUCertChange(e.target.value)}
              placeholder="p. ej. 0.02"
              className="mt-1 h-7 text-sm"
            />
            <FieldError msg={errors.u_cert} />
          </div>
          <div>
            <Label htmlFor="ci-kcert" className="text-xs">k (factor de cobertura) <span className="text-red-500">*</span></Label>
            <Input
              id="ci-kcert"
              type="number"
              step="any"
              min="1"
              value={kCert}
              onChange={(e) => onKCertChange(e.target.value)}
              placeholder="2"
              className="mt-1 h-7 text-sm"
            />
            <FieldError msg={errors.k_cert} />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="ci-norma-b" className="text-xs">
          Norma de referencia {normaRequired && <span className="text-red-500">*</span>}
          {!normaRequired && <span className="text-stone-400">(opcional)</span>}
        </Label>
        <Input
          id="ci-norma-b"
          value={normaRef}
          onChange={(e) => onNormaRefChange(e.target.value)}
          placeholder="p. ej. NMX-C-156 §6.3"
          className="mt-1 h-7 text-sm"
        />
        <FieldError msg={errors.norma_ref} />
      </div>

      <div>
        <Label htmlFor="ci-desc-b" className="text-xs">Descripción <span className="text-stone-400">(opcional)</span></Label>
        <Input
          id="ci-desc-b"
          value={descripcion}
          onChange={(e) => onDescripcionChange(e.target.value)}
          placeholder="Explicación breve"
          className="mt-1 h-7 text-sm"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Dialog
// ---------------------------------------------------------------------------

export interface CustomInputDialogProps {
  studyId: string
  /** If provided, the dialog is in edit mode for this item */
  editing?: StudyCustomInput
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (item: StudyCustomInput) => void
}

export function CustomInputDialog({
  studyId,
  editing,
  open,
  onOpenChange,
  onSaved,
}: CustomInputDialogProps) {
  const isEdit = Boolean(editing)
  const initialTab = editing?.tipo_ab === 'B' ? 'B' : 'A'

  const [tab, setTab] = useState<'A' | 'B'>(initialTab as 'A' | 'B')
  const [simbolo, setSimbolo] = useState(editing?.simbolo ?? '')
  const [nombre, setNombre] = useState(editing?.nombre_display ?? '')
  const [unidad, setUnidad] = useState(editing?.unidad ?? '')

  // Type A
  const [replicaValues, setReplicaValues] = useState<string[]>(
    editing?.replica_values_json?.map(String) ?? ['', ''],
  )
  const [normaRefA, setNormaRefA] = useState(editing?.norma_ref ?? '')
  const [descripcionA, setDescripcionA] = useState(editing?.descripcion ?? '')

  // Type B
  const [bSubtipo, setBSubtipo] = useState(editing?.b_subtipo ?? 'rectangular')
  const [halfWidth, setHalfWidth] = useState(editing?.half_width?.toString() ?? '')
  const [divMin, setDivMin] = useState(editing?.div_min?.toString() ?? '')
  const [uCert, setUCert] = useState(editing?.u_cert?.toString() ?? '')
  const [kCert, setKCert] = useState(editing?.k_cert?.toString() ?? '2')
  const [normaRefB, setNormaRefB] = useState(editing?.norma_ref ?? '')
  const [descripcionB, setDescripcionB] = useState(editing?.descripcion ?? '')

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const resetState = useCallback(() => {
    setTab('A')
    setSimbolo('')
    setNombre('')
    setUnidad('')
    setReplicaValues(['', ''])
    setNormaRefA('')
    setDescripcionA('')
    setBSubtipo('rectangular')
    setHalfWidth('')
    setDivMin('')
    setUCert('')
    setKCert('2')
    setNormaRefB('')
    setDescripcionB('')
    setErrors({})
  }, [])

  function validate(): CreateCustomInputBody | null {
    const errs: Record<string, string> = {}
    if (!simbolo.trim()) errs.simbolo = 'El símbolo es requerido'
    if (!nombre.trim()) errs.nombre = 'El nombre es requerido'

    if (tab === 'A') {
      const parsed = replicaValues.map((v) => parseFloat(v))
      const valid = parsed.filter((v) => isFinite(v))
      if (valid.length < 2) errs.replicas = 'Se requieren al menos 2 réplicas con valores numéricos'
      if (Object.keys(errs).length > 0) { setErrors(errs); return null }
      return {
        tipo_ab: 'A',
        simbolo: simbolo.trim(),
        nombre_display: nombre.trim(),
        unidad: unidad.trim(),
        replica_values_json: valid,
        norma_ref: normaRefA.trim() || undefined,
        descripcion: descripcionA.trim() || undefined,
      }
    }

    // Type B
    if (!bSubtipo) { errs.b_subtipo = 'Selecciona una distribución'; setErrors(errs); return null }
    if (bSubtipo !== 'resolucion' && !normaRefB.trim()) errs.norma_ref = 'La norma de referencia es requerida'

    if (bSubtipo === 'resolucion') {
      const v = parseFloat(divMin)
      if (!isFinite(v) || v <= 0) errs.div_min = 'Debe ser un número positivo'
    }
    if (['rectangular', 'triangular', 'u-shaped'].includes(bSubtipo)) {
      const v = parseFloat(halfWidth)
      if (!isFinite(v) || v <= 0) errs.half_width = 'Debe ser un número positivo'
    }
    if (bSubtipo === 'normal') {
      const vu = parseFloat(uCert)
      if (!isFinite(vu) || vu <= 0) errs.u_cert = 'Debe ser un número positivo'
      const vk = parseFloat(kCert)
      if (!isFinite(vk) || vk <= 0) errs.k_cert = 'Debe ser un número positivo'
    }

    if (Object.keys(errs).length > 0) { setErrors(errs); return null }

    const base = {
      tipo_ab: 'B' as const,
      simbolo: simbolo.trim(),
      nombre_display: nombre.trim(),
      unidad: unidad.trim(),
      b_subtipo: bSubtipo as CreateCustomInputBody['b_subtipo'],
      norma_ref: normaRefB.trim() || undefined,
      descripcion: descripcionB.trim() || undefined,
    }
    if (bSubtipo === 'resolucion') return { ...base, div_min: parseFloat(divMin) }
    if (['rectangular', 'triangular', 'u-shaped'].includes(bSubtipo)) return { ...base, half_width: parseFloat(halfWidth) }
    if (bSubtipo === 'normal') return { ...base, u_cert: parseFloat(uCert), k_cert: parseFloat(kCert) }
    return base
  }

  async function handleSave() {
    const body = validate()
    if (!body) return

    setSaving(true)
    try {
      const url = isEdit
        ? `/api/ema/uncertainty/studies/${studyId}/custom-inputs/${editing!.id}`
        : `/api/ema/uncertainty/studies/${studyId}/custom-inputs`
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const { error } = await res.json()
        setErrors({ _global: error ?? 'Error al guardar' })
        return
      }
      const item: StudyCustomInput = await res.json()
      onSaved(item)
      onOpenChange(false)
      if (!isEdit) resetState()
    } catch {
      setErrors({ _global: 'Error de red al guardar' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o && !isEdit) resetState() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">
            {isEdit ? 'Editar variable' : 'Agregar variable personalizada'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Common fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="ci-simbolo" className="text-xs">
                Símbolo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ci-simbolo"
                value={simbolo}
                onChange={(e) => setSimbolo(e.target.value)}
                placeholder="p. ej. R_flex"
                className="mt-1 h-7 font-mono text-sm"
                disabled={isEdit}
              />
              <FieldError msg={errors.simbolo} />
            </div>
            <div>
              <Label htmlFor="ci-unidad" className="text-xs">Unidad</Label>
              <Input
                id="ci-unidad"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="cm"
                className="mt-1 h-7 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="ci-nombre" className="text-xs">
                Nombre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ci-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Descripción de la variable"
                className="mt-1 h-7 text-sm"
              />
              <FieldError msg={errors.nombre} />
            </div>
          </div>

          {/* Tipo A / B tabs — only shown when creating; locked when editing */}
          {isEdit ? (
            <div>
              <p className="text-[11px] text-stone-500">
                Tipo: <span className="font-semibold text-stone-700">{editing!.tipo_ab === 'A' ? 'A (estadístico)' : `B — ${B_SUBTIPO_LABEL[editing!.b_subtipo ?? ''] ?? editing!.b_subtipo}`}</span>
              </p>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'A' | 'B')}>
              <TabsList className="h-8 text-xs">
                <TabsTrigger value="A" className="text-xs px-4">Tipo A — estadístico</TabsTrigger>
                <TabsTrigger value="B" className="text-xs px-4">Tipo B — norma</TabsTrigger>
              </TabsList>
              <TabsContent value="A" className="mt-3">
                <TypeAFields
                  replicaValues={replicaValues}
                  onReplicaChange={setReplicaValues}
                  normaRef={normaRefA}
                  onNormaRefChange={setNormaRefA}
                  descripcion={descripcionA}
                  onDescripcionChange={setDescripcionA}
                />
              </TabsContent>
              <TabsContent value="B" className="mt-3">
                <TypeBFields
                  bSubtipo={bSubtipo}
                  onBSubtipoChange={setBSubtipo}
                  halfWidth={halfWidth}
                  onHalfWidthChange={setHalfWidth}
                  divMin={divMin}
                  onDivMinChange={setDivMin}
                  uCert={uCert}
                  onUCertChange={setUCert}
                  kCert={kCert}
                  onKCertChange={setKCert}
                  normaRef={normaRefB}
                  onNormaRefChange={setNormaRefB}
                  descripcion={descripcionB}
                  onDescripcionChange={setDescripcionB}
                  errors={errors}
                />
              </TabsContent>
            </Tabs>
          )}

          {/* Edit mode: show the right fields */}
          {isEdit && editing?.tipo_ab === 'A' && (
            <TypeAFields
              replicaValues={replicaValues}
              onReplicaChange={setReplicaValues}
              normaRef={normaRefA}
              onNormaRefChange={setNormaRefA}
              descripcion={descripcionA}
              onDescripcionChange={setDescripcionA}
            />
          )}
          {isEdit && editing?.tipo_ab === 'B' && (
            <TypeBFields
              bSubtipo={bSubtipo}
              onBSubtipoChange={setBSubtipo}
              halfWidth={halfWidth}
              onHalfWidthChange={setHalfWidth}
              divMin={divMin}
              onDivMinChange={setDivMin}
              uCert={uCert}
              onUCertChange={setUCert}
              kCert={kCert}
              onKCertChange={setKCert}
              normaRef={normaRefB}
              onNormaRefChange={setNormaRefB}
              descripcion={descripcionB}
              onDescripcionChange={setDescripcionB}
              errors={errors}
            />
          )}

          {errors._global && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{errors._global}</p>
          )}

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { onOpenChange(false); if (!isEdit) resetState() }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Agregar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
