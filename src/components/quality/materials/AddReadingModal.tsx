'use client'

import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Upload, FileText, X, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { qualityHubPrimaryButtonClass, qualityHubOutlineNeutralClass } from '@/components/quality/qualityHubUi'

interface AddReadingModalProps {
  open: boolean
  onClose: () => void
  materialId: string
  materialName: string
  category: string
  plantId?: string
  onSuccess: () => void
}

interface Field {
  key: string
  label: string
  unit: string
  type: 'number' | 'integer'
  required?: boolean
  step?: string
}

const FIELDS_BY_CATEGORY: Record<string, Field[]> = {
  cemento: [
    { key: 'resistencia_compresion', label: 'Resistencia a la compresión', unit: 'kg/cm²', type: 'number', required: true, step: '0.1' },
    { key: 'tiempo_fraguado_inicial', label: 'Tiempo de fraguado inicial', unit: 'min', type: 'integer' },
    { key: 'tiempo_fraguado_final', label: 'Tiempo de fraguado final', unit: 'min', type: 'integer' },
  ],
  aditivo: [
    { key: 'ph', label: 'pH', unit: '', type: 'number', required: true, step: '0.01' },
    { key: 'densidad_aditivo', label: 'Densidad', unit: 'g/cm³', type: 'number', step: '0.001' },
  ],
  agregado: [
    { key: 'peso_volumetrico_suelto', label: 'Peso volumétrico suelto', unit: 'kg/m³', type: 'number', step: '1' },
    { key: 'peso_volumetrico_compactado', label: 'Peso volumétrico compactado', unit: 'kg/m³', type: 'number', step: '1' },
    { key: 'densidad_agregado', label: 'Densidad (masa específica)', unit: 'g/cm³', type: 'number', step: '0.001' },
    { key: 'absorcion', label: 'Absorción', unit: '%', type: 'number', step: '0.01' },
    { key: 'modulo_finura', label: 'Módulo de finura', unit: '', type: 'number', step: '0.01' },
    { key: 'perdida_lavado', label: 'Pérdida por lavado', unit: '%', type: 'number', step: '0.1' },
  ],
}

function getCategoryFields(category: string): Field[] {
  if (category === 'cemento') return FIELDS_BY_CATEGORY.cemento
  if (category === 'aditivo') return FIELDS_BY_CATEGORY.aditivo
  return FIELDS_BY_CATEGORY.agregado
}

function requiresCertificate(category: string) {
  return ['cemento', 'aditivo'].includes(category)
}

export default function AddReadingModal({
  open, onClose, materialId, materialName, category, plantId, onSuccess,
}: AddReadingModalProps) {
  const today = new Date().toISOString().split('T')[0]
  const [readingDate, setReadingDate] = useState(today)
  const [lote, setLote] = useState('')
  const [tecnico, setTecnico] = useState('')
  const [notes, setNotes] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fields = getCategoryFields(category)
  const needsCert = requiresCertificate(category)
  const isAgregado = !['cemento', 'aditivo'].includes(category)

  function handleFile(f: File) {
    if (f.type !== 'application/pdf') { toast.error('Solo se permiten archivos PDF'); return }
    if (f.size > 10 * 1024 * 1024) { toast.error('El archivo excede 10MB'); return }
    setFile(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function reset() {
    setReadingDate(today); setLote(''); setTecnico(''); setNotes('')
    setValues({}); setFile(null); setIsSubmitting(false)
  }

  function handleClose() { reset(); onClose() }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (needsCert && !file) { toast.error('Certificado PDF requerido'); return }
    if (!readingDate) { toast.error('Fecha requerida'); return }

    // Check at least one property value filled
    const hasAnyValue = fields.some((f) => values[f.key] && values[f.key].trim() !== '')
    if (!hasAnyValue) { toast.error('Ingresa al menos un valor de propiedad'); return }

    setIsSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('reading_date', readingDate)
      if (lote) fd.append('lote', lote)
      if (tecnico) fd.append('tecnico', tecnico)
      if (notes) fd.append('notes', notes)
      if (plantId) fd.append('plant_id', plantId)
      if (file) fd.append('file', file)
      fields.forEach((f) => {
        if (values[f.key]) fd.append(f.key, values[f.key])
      })

      const res = await fetch(`/api/quality/materials/${materialId}/readings`, {
        method: 'POST',
        body: fd,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al guardar')

      toast.success('Lectura registrada correctamente')
      reset()
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar lectura')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-stone-900">
            Registrar lectura
          </DialogTitle>
          <p className="text-xs text-stone-500 mt-0.5">{materialName}</p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Date + Lote row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="reading_date" className="text-xs font-medium text-stone-700">
                Fecha <span className="text-red-500">*</span>
              </Label>
              <Input
                id="reading_date"
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
                required
                className="mt-1 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="lote" className="text-xs font-medium text-stone-700">
                Lote / Cert. #
              </Label>
              <Input
                id="lote"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="Ej. L-2025-04"
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tecnico" className="text-xs font-medium text-stone-700">Técnico</Label>
            <Input
              id="tecnico"
              value={tecnico}
              onChange={(e) => setTecnico(e.target.value)}
              placeholder="Nombre del técnico"
              className="mt-1 text-sm"
            />
          </div>

          {/* Property fields */}
          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3 space-y-3">
            <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
              Propiedades
            </p>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <Label htmlFor={f.key} className="text-xs text-stone-600">
                    {f.label}
                    {f.required && <span className="text-red-500 ml-0.5">*</span>}
                    {f.unit && <span className="text-stone-400 ml-1">({f.unit})</span>}
                  </Label>
                  <Input
                    id={f.key}
                    type="number"
                    step={f.step ?? (f.type === 'integer' ? '1' : '0.001')}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    className="mt-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* PDF Upload */}
          <div>
            <Label className="text-xs font-medium text-stone-700 flex items-center gap-1">
              Certificado PDF
              {needsCert && <span className="text-red-500">*</span>}
              {!needsCert && <Badge variant="outline" className="text-[10px] py-0 h-4 ml-1">Opcional</Badge>}
            </Label>

            {file ? (
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-xs text-emerald-800 flex-1 truncate">{file.name}</span>
                <span className="text-xs text-emerald-600">{(file.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => setFile(null)} className="text-emerald-500 hover:text-emerald-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'mt-1 border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors',
                  isDragging
                    ? 'border-sky-400 bg-sky-50'
                    : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-white'
                )}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-5 w-5 text-stone-400 mx-auto mb-1.5" />
                <p className="text-xs text-stone-500">
                  Arrastra tu certificado aquí o <span className="text-sky-600 underline">haz clic para seleccionar</span>
                </p>
                <p className="text-[10px] text-stone-400 mt-0.5">PDF · máx. 10MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </div>
            )}
          </div>

          {isAgregado && (
            <div className="flex items-start gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
              <CheckCircle className="h-3.5 w-3.5 text-sky-600 mt-0.5 shrink-0" />
              <p className="text-xs text-sky-700">
                Las caracterizaciones se sincronizan automáticamente. Esta lectura es para datos adicionales o de validación.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="notes" className="text-xs font-medium text-stone-700">Notas</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones opcionales..."
              rows={2}
              className="mt-1 text-sm resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className={cn('flex-1', qualityHubOutlineNeutralClass)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn('flex-1', qualityHubPrimaryButtonClass)}
            >
              {isSubmitting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Guardando…</>
              ) : 'Guardar lectura'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
