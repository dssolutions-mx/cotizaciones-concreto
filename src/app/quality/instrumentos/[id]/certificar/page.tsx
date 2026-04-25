'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Award, CheckCircle2, Info, Loader2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import type { InstrumentoDetalle } from '@/types/ema'

export default function CertificarPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [instrumento, setInstrumento] = useState<InstrumentoDetalle | null>(null)
  const [loadingInst, setLoadingInst] = useState(true)

  const [form, setForm] = useState({
    // Lab info
    laboratorio_externo: '',
    acreditacion_laboratorio: '',
    tecnico_responsable: '',
    // Certificate identity
    numero_certificado: '',
    metodo_calibracion: '',
    // Dates
    fecha_emision: '',
    fecha_vencimiento: '',
    // Metrology (NMX-EC-17025 §5.4.6)
    incertidumbre_expandida: '',
    incertidumbre_unidad: '',
    factor_cobertura: '2',
    rango_medicion: '',
    // Conditions
    condiciones_temperatura: '',
    condiciones_humedad: '',
    condiciones_presion: '',
    // Document (archivo_path is internal object key; never shown in UI)
    archivo_path: '',
    archivo_nombre_original: '',
    observaciones: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<{ variant: 'ok' | 'error'; text: string } | null>(null)
  /** Nombre del archivo mostrado tras subida exitosa (mismo valor que se guarda como archivo_nombre_original). */
  const [pdfUploadLabel, setPdfUploadLabel] = useState<string | null>(null)
  const [pdfUploadSizeLabel, setPdfUploadSizeLabel] = useState<string | null>(null)
  const calibrationPdfRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/ema/instrumentos/${id}`)
      .then(r => r.json())
      .then(j => { setInstrumento(j.data ?? j); setLoadingInst(false) })
      .catch(() => setLoadingInst(false))
  }, [id])

  // Auto-calculate fecha_vencimiento when fecha_emision changes (cadencia_meses from conjunto)
  useEffect(() => {
    if (form.fecha_emision && instrumento) {
      const meses = instrumento.conjunto?.cadencia_meses ?? 12
      const emision = new Date(form.fecha_emision)
      emision.setMonth(emision.getMonth() + meses)
      setForm(f => ({ ...f, fecha_vencimiento: emision.toISOString().split('T')[0] }))
    }
  }, [form.fecha_emision, instrumento])

  // Auto-fill unit from conjunto when instrument loads
  useEffect(() => {
    if (instrumento?.conjunto?.unidad_medicion && !form.incertidumbre_unidad) {
      setForm(f => ({ ...f, incertidumbre_unidad: instrumento.conjunto.unidad_medicion ?? '' }))
    }
  }, [instrumento])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.archivo_path.trim()) {
      setError('Debe subir el PDF del certificado con el botón «Subir PDF» antes de registrar.')
      return
    }
    if (form.fecha_vencimiento && form.fecha_emision && form.fecha_vencimiento < form.fecha_emision) {
      setError('La fecha de vencimiento debe ser igual o posterior a la fecha de emisión.')
      return
    }
    const tipo = instrumento?.tipo
    if (tipo === 'A' || tipo === 'B') {
      const u = form.incertidumbre_expandida.trim() ? parseFloat(form.incertidumbre_expandida) : NaN
      if (!Number.isFinite(u) || !(u > 0)) {
        setError('Debe registrar la incertidumbre expandida U (> 0) tal como aparece en el certificado del laboratorio.')
        return
      }
      if (!form.incertidumbre_unidad.trim()) {
        setError('Indique la unidad de U (p. ej. mm, °C, kN).')
        return
      }
      const k = form.factor_cobertura.trim() ? parseFloat(form.factor_cobertura) : NaN
      if (!Number.isFinite(k) || k < 1 || k > 10) {
        setError('Indique el factor de cobertura k (típico 2; entre 1 y 10).')
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      const body = {
        numero_certificado: form.numero_certificado || null,
        laboratorio_externo: form.laboratorio_externo,
        acreditacion_laboratorio: form.acreditacion_laboratorio || null,
        metodo_calibracion: form.metodo_calibracion || null,
        fecha_emision: form.fecha_emision,
        fecha_vencimiento: form.fecha_vencimiento,
        archivo_path: form.archivo_path,
        archivo_nombre_original: form.archivo_nombre_original.trim() || null,
        incertidumbre_expandida: form.incertidumbre_expandida ? parseFloat(form.incertidumbre_expandida) : null,
        incertidumbre_unidad: form.incertidumbre_unidad || null,
        factor_cobertura: form.factor_cobertura ? parseFloat(form.factor_cobertura) : null,
        rango_medicion: form.rango_medicion || null,
        condiciones_ambientales: (form.condiciones_temperatura || form.condiciones_humedad || form.condiciones_presion) ? {
          temperatura: form.condiciones_temperatura || undefined,
          humedad: form.condiciones_humedad || undefined,
          presion: form.condiciones_presion || undefined,
        } : null,
        tecnico_responsable: form.tecnico_responsable || null,
        observaciones: form.observaciones || null,
      }
      const res = await fetch(`/api/ema/instrumentos/${id}/certificados`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Error registrando certificado')
      }
      router.push(`/quality/instrumentos/${id}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const update = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }))

  const handleCalibrationPdfSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadBusy(true)
    setUploadNotice(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/ema/instrumentos/${id}/certificados/upload`, { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Error al subir el PDF')
      const path = j.data?.archivo_path as string | undefined
      if (!path) throw new Error('Respuesta inválida del servidor')
      const label = (j.data?.original_name as string | undefined) || file.name || 'PDF'
      setForm((f) => ({
        ...f,
        archivo_path: path,
        archivo_nombre_original: label,
      }))
      setPdfUploadLabel(label)
      const bytes = file.size
      setPdfUploadSizeLabel(
        bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`,
      )
      setUploadNotice({
        variant: 'ok',
        text: 'PDF listo. Complete el formulario y pulse «Registrar certificado».',
      })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al subir'
      setUploadNotice({ variant: 'error', text: msg })
    } finally {
      setUploadBusy(false)
      e.target.value = ''
    }
  }

  if (loadingInst) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-4 w-64 bg-stone-200 rounded animate-pulse" />
        <div className="h-48 rounded-lg bg-stone-100 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="flex min-w-0 w-full max-w-3xl flex-col gap-5">
      <EmaBreadcrumb items={[
        { label: instrumento?.nombre ?? 'Instrumento', href: `/quality/instrumentos/${id}` },
        { label: 'Registrar certificado' },
      ]} />

      {/* Back + Title */}
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={`/quality/instrumentos/${id}`}
          className="shrink-0 rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-stone-900">
            <Award className="h-5 w-5 text-sky-600" />
            Registrar certificado de calibración
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {instrumento?.nombre} · {instrumento?.codigo}
          </p>
        </div>
      </div>

      {/* Context card */}
      {instrumento && (
        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <EmaTipoBadge tipo={instrumento.tipo} showLabel />
            <EmaEstadoBadge estado={instrumento.estado} />
            {instrumento.marca && (
              <span className="text-xs text-stone-500">{instrumento.marca} {instrumento.modelo_comercial}</span>
            )}
          </div>
          <div className="text-xs text-stone-500 font-mono">
            Cadencia: {instrumento.conjunto?.cadencia_meses ?? 12} meses
            {instrumento.conjunto?.unidad_medicion && ` · ${instrumento.conjunto.unidad_medicion}`}
          </div>
        </div>
      )}

      {/* EMA info banner */}
      <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
        <div className="text-xs text-sky-800">
          <p className="font-medium">Requisito NMX-EC-17025 · Cláusula 6.5</p>
          <p className="mt-0.5">
            El certificado debe provenir de un laboratorio acreditado por EMA o un instituto
            nacional de metrología (CENAM). Registre el número de acreditación del laboratorio
            y los valores de incertidumbre para completar la cadena de trazabilidad metrológica.
            Al guardar, la ficha del instrumento se actualiza con U, k y unidad para indicadores
            internos (p. ej. TUR orientativo en verificaciones de equipos tipo C).
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* 1. Lab section */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Laboratorio de calibración</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Laboratorio externo <span className="text-red-500">*</span></Label>
              <Input
                required
                value={form.laboratorio_externo}
                onChange={e => update('laboratorio_externo', e.target.value)}
                placeholder="ej. CIDESI, CENAM"
                className="border-stone-200"
                list="labs-suggestions"
              />
              <datalist id="labs-suggestions">
                <option value="CIDESI" />
                <option value="CENAM" />
                <option value="Centro Nacional de Metrología" />
                <option value="Laboratorio Nacional de Metrología" />
                <option value="CIATEC" />
                <option value="IMP" />
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">No. de acreditación EMA</Label>
              <Input
                value={form.acreditacion_laboratorio}
                onChange={e => update('acreditacion_laboratorio', e.target.value)}
                placeholder="ej. CAL-123-456/24"
                className="border-stone-200 font-mono"
              />
              <p className="text-[11px] text-stone-400">Número de acreditación del laboratorio ante EMA</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Técnico responsable</Label>
              <Input
                value={form.tecnico_responsable}
                onChange={e => update('tecnico_responsable', e.target.value)}
                placeholder="Nombre del técnico que firmó el certificado"
                className="border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Método de calibración</Label>
              <Input
                value={form.metodo_calibracion}
                onChange={e => update('metodo_calibracion', e.target.value)}
                placeholder="ej. NMX-CH-7500-1-IMNC-2008"
                className="border-stone-200 font-mono text-sm"
                list="metodos-list"
              />
              <datalist id="metodos-list">
                <option value="NMX-CH-7500-1-IMNC-2008" />
                <option value="NMX-CH-OIML-R76-IMNC" />
                <option value="OIML R111" />
                <option value="ISO 3650" />
                <option value="ASTM E4" />
                <option value="ASTM E74" />
              </datalist>
            </div>
          </div>
        </div>

        {/* 2. Certificate ID + dates */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Certificado</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">No. de certificado</Label>
              <Input
                value={form.numero_certificado}
                onChange={e => update('numero_certificado', e.target.value)}
                placeholder="ej. CC-2026-0001"
                className="border-stone-200 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Fecha de emisión <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                required
                value={form.fecha_emision}
                onChange={e => update('fecha_emision', e.target.value)}
                className="border-stone-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Fecha de vencimiento <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                required
                value={form.fecha_vencimiento}
                onChange={e => update('fecha_vencimiento', e.target.value)}
                className="border-stone-200"
              />
              {form.fecha_emision && form.fecha_vencimiento && (
                <p className="text-[11px] text-stone-400 font-mono">
                  {Math.round((new Date(form.fecha_vencimiento).getTime() - new Date(form.fecha_emision).getTime()) / 86_400_000)} días de vigencia
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 3. Measurement uncertainty — the EMA-critical section */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Incertidumbre de medición</h2>
            <span className="text-[10px] bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">NMX-EC-17025</span>
          </div>
          <p className="text-xs text-stone-500 -mt-2">
            Datos del certificado: incertidumbre expandida U, factor de cobertura k, y rango calibrado.
            Estos valores son requeridos para demostrar trazabilidad metrológica ante EMA.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Incertidumbre U (±)</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={form.incertidumbre_expandida}
                onChange={e => update('incertidumbre_expandida', e.target.value)}
                placeholder="ej. 0.15"
                className="border-stone-200 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Unidad</Label>
              <Input
                value={form.incertidumbre_unidad}
                onChange={e => update('incertidumbre_unidad', e.target.value)}
                placeholder="ej. kN"
                className="border-stone-200 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Factor k</Label>
              <Input
                type="number"
                step="any"
                min="1"
                value={form.factor_cobertura}
                onChange={e => update('factor_cobertura', e.target.value)}
                placeholder="2"
                className="border-stone-200 font-mono"
              />
              <p className="text-[11px] text-stone-400">Típico: k=2 (95%)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Rango calibrado</Label>
              <Input
                value={form.rango_medicion}
                onChange={e => update('rango_medicion', e.target.value)}
                placeholder="ej. 0–2000 kN"
                className="border-stone-200 font-mono text-sm"
              />
            </div>
          </div>
          {form.incertidumbre_expandida && form.incertidumbre_unidad && (
            <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 font-mono">
              U = ±{form.incertidumbre_expandida} {form.incertidumbre_unidad} (k={form.factor_cobertura || '2'}, ~{form.factor_cobertura === '2' || !form.factor_cobertura ? '95' : '—'}% confianza)
            </div>
          )}
        </div>

        {/* 4. Environmental conditions */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Condiciones ambientales</h2>
          <p className="text-xs text-stone-500 -mt-2">
            Condiciones del laboratorio durante la calibración, según el certificado.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Temperatura</Label>
              <Input
                value={form.condiciones_temperatura}
                onChange={e => update('condiciones_temperatura', e.target.value)}
                placeholder="ej. 22 ± 1 °C"
                className="border-stone-200 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Humedad relativa</Label>
              <Input
                value={form.condiciones_humedad}
                onChange={e => update('condiciones_humedad', e.target.value)}
                placeholder="ej. 45 ± 5 %HR"
                className="border-stone-200 font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-stone-600">Presión barométrica</Label>
              <Input
                value={form.condiciones_presion}
                onChange={e => update('condiciones_presion', e.target.value)}
                placeholder="ej. 780 mmHg"
                className="border-stone-200 font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* 5. Document */}
        <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Documento PDF</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] text-stone-600 marker:font-medium">
              <li>
                Pulse <strong className="text-stone-800">Subir PDF</strong> y elija el certificado del laboratorio (solo PDF válidos, máx. 10&nbsp;MB).
              </li>
              <li>
                El archivo se adjunta <strong className="text-stone-800">solo desde este formulario</strong>; no es necesario pegar rutas ni claves técnicas.
              </li>
              <li>Complete el formulario y pulse <strong className="text-stone-800">Registrar certificado</strong>.</li>
            </ol>
          </div>
          <input
            ref={calibrationPdfRef}
            type="file"
            accept=".pdf,application/pdf,application/octet-stream"
            className="hidden"
            onChange={handleCalibrationPdfSelected}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 border-stone-300 text-xs text-stone-700"
              disabled={uploadBusy}
              onClick={() => calibrationPdfRef.current?.click()}
            >
              {uploadBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Subir PDF
            </Button>
            <span className="text-[11px] text-stone-500">PDF · máx. 10&nbsp;MB</span>
          </div>
          {pdfUploadLabel && (
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-900">
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-800/90">Archivo adjunto</p>
                  <p className="min-w-0 truncate font-medium text-emerald-950" title={pdfUploadLabel}>
                    {pdfUploadLabel}
                  </p>
                  {pdfUploadSizeLabel && (
                    <p className="text-[11px] text-emerald-800/80 mt-0.5">{pdfUploadSizeLabel}</p>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 gap-1 px-2 text-emerald-900 hover:bg-emerald-100/80"
                onClick={() => {
                  setPdfUploadLabel(null)
                  setPdfUploadSizeLabel(null)
                  setForm((f) => ({ ...f, archivo_path: '', archivo_nombre_original: '' }))
                  setUploadNotice(null)
                }}
              >
                <X className="h-3.5 w-3.5" />
                Quitar archivo
              </Button>
            </div>
          )}
          {uploadNotice && (
            <p
              className={cn(
                'rounded-md px-2 py-1.5 text-xs',
                uploadNotice.variant === 'ok'
                  ? 'border border-emerald-100 bg-emerald-50 text-emerald-800'
                  : 'border border-red-100 bg-red-50 text-red-800',
              )}
            >
              {uploadNotice.text}
            </p>
          )}
          {!form.archivo_path && !pdfUploadLabel && (
            <div className="rounded-md border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-900">
              Aún no hay PDF adjunto. Use <strong>Subir PDF</strong> para continuar.
            </div>
          )}
          <p className="text-[11px] text-stone-400">
            El PDF debe incluir resultados, incertidumbre, trazabilidad y firma del laboratorio, según su acreditación.
          </p>
        </div>

        {/* 6. Notes */}
        <div className="rounded-lg border border-stone-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">Observaciones</h2>
          <Textarea
            rows={3}
            value={form.observaciones}
            onChange={e => update('observaciones', e.target.value)}
            placeholder="Notas adicionales sobre la calibración, desviaciones detectadas, recomendaciones del laboratorio..."
            className="border-stone-200 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Link
            href={`/quality/instrumentos/${id}`}
            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
          >
            Cancelar
          </Link>
          <Button
            type="submit"
            className="gap-1.5 bg-sky-700 text-white hover:bg-sky-800"
            disabled={submitting || !form.archivo_path.trim()}
            title={!form.archivo_path.trim() ? 'Suba primero el PDF con el botón «Subir PDF»' : undefined}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Award className="h-4 w-4" /> Registrar certificado</>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
