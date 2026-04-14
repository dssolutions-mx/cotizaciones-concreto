'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Loader2,
  AlertTriangle,
  FileText,
  Building,
  Calendar,
  User,
  Truck,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  FileImage,
  Shield,
  Settings2,
  ChevronLeft,
  ArrowUpRight,
} from 'lucide-react'
import { fetchEnsayoById, updateEnsayoById } from '@/services/qualityEnsayoService'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import type { EnsayoWithRelations, Evidencia } from '@/types/quality'
import Link from 'next/link'
import Image from 'next/image'
import { cn, createSafeDate, formatDate } from '@/lib/utils'
import { resolveEnsayoResistenciaReportada } from '@/lib/qualityHelpers'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import {
  qualityHubLinkOutlineClass,
  qualityHubOutlineNeutralClass,
  qualityHubPrimaryButtonClass,
  qualityHubSummaryStatusMap,
  type QualityHubSummaryStatus,
} from '@/components/quality/qualityHubUi'
import SpecimenSpecsConfigSheet from '@/components/quality/ensayos/SpecimenSpecsConfigSheet'

const CARD_SHELL =
  'border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]'

function complianceKpiStatus(pct: number): QualityHubSummaryStatus {
  if (pct >= 100) return 'ok'
  if (pct >= 70) return 'warning'
  return 'critical'
}

function normalizeEvidencia(raw: Record<string, unknown>): Evidencia & { _path: string } {
  const path =
    (raw.path as string) ||
    (raw.archivo_url as string) ||
    (raw.file_path as string) ||
    ''
  return {
    id: String(raw.id),
    ensayo_id: String(raw.ensayo_id ?? ''),
    path,
    archivo_url: raw.archivo_url as string | undefined,
    nombre_archivo: (raw.nombre_archivo as string) || (raw.file_name as string) || 'Archivo',
    tipo_archivo:
      (raw.tipo_archivo as string) || (raw.file_type as string) || (raw.mime_type as string) || '',
    tamano_kb: Number(raw.tamano_kb ?? (raw.file_size ? Number(raw.file_size) / 1024 : 0)) || 0,
    _path: path,
  }
}

function evidenciaPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!path) return ''
  if (path.startsWith('http')) return path
  if (path.startsWith('evidencias/')) {
    return `${base}/storage/v1/object/public/quality-evidencias/${path}`
  }
  return `${base}/storage/v1/object/public/evidencia-ensayos/${path}`
}

function evidenciaFallbackUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!path || path.startsWith('http')) return ''
  return `${base}/storage/v1/object/public/quality/${path}`
}

type GuaranteeMetrics = {
  valorEdad: number
  unidadEdad: string
  edadGarantiaHoras: number
  fechaMuestreo: Date
  fechaEnsayo: Date
  fechaEdadGarantia: Date
  guaranteeAgeStart: Date
  guaranteeAgeEnd: Date
  diffFromEnd: number
  toleranceHours: number
  isAtGuaranteeAge: boolean
  isOutOfTime: boolean
  isTooEarly: boolean
  isEdadGarantia: boolean
}

function buildGuaranteeMetrics(ensayo: EnsayoWithRelations): GuaranteeMetrics | null {
  if (!ensayo.muestra?.muestreo?.concrete_specs) return null
  const concreteSpecs = ensayo.muestra.muestreo.concrete_specs as Record<string, unknown>
  const valorEdad = concreteSpecs?.valor_edad as number | undefined
  const unidadEdad = concreteSpecs?.unidad_edad as string | undefined
  if (!valorEdad || !unidadEdad) return null

  let edadGarantiaHoras: number
  if (unidadEdad === 'HORA') edadGarantiaHoras = valorEdad
  else if (unidadEdad === 'DÍA') edadGarantiaHoras = valorEdad * 24
  else edadGarantiaHoras = valorEdad * 24

  const m = ensayo.muestra.muestreo as { fecha_muestreo_ts?: string; fecha_muestreo?: string }
  const fechaMuestreo = m.fecha_muestreo_ts
    ? new Date(m.fecha_muestreo_ts)
    : createSafeDate(m.fecha_muestreo || '')
  const fechaEnsayo = ensayo.fecha_ensayo_ts
    ? new Date(ensayo.fecha_ensayo_ts)
    : createSafeDate(ensayo.fecha_ensayo)
  if (!fechaMuestreo || !fechaEnsayo) return null

  const fechaEdadGarantia = new Date(fechaMuestreo.getTime() + edadGarantiaHoras * 60 * 60 * 1000)

  let toleranceMinutes: number
  if (edadGarantiaHoras <= 24) toleranceMinutes = 30
  else if (edadGarantiaHoras <= 72) toleranceMinutes = 120
  else if (edadGarantiaHoras <= 168) toleranceMinutes = 360
  else if (edadGarantiaHoras <= 336) toleranceMinutes = 720
  else if (edadGarantiaHoras <= 672) toleranceMinutes = 1200
  else toleranceMinutes = 2880

  const toleranceHours = toleranceMinutes / 60
  const guaranteeAgeStart = new Date(fechaEdadGarantia.getTime() - toleranceMinutes * 60 * 1000)
  const guaranteeAgeEnd = new Date(fechaEdadGarantia.getTime() + toleranceMinutes * 60 * 1000)
  const diffFromEnd = (fechaEnsayo.getTime() - fechaEdadGarantia.getTime()) / (1000 * 60 * 60)
  const isAtGuaranteeAge = fechaEnsayo >= guaranteeAgeStart
  const isOutOfTime = isAtGuaranteeAge && fechaEnsayo > guaranteeAgeEnd
  const isTooEarly = fechaEnsayo < guaranteeAgeStart

   return {
    valorEdad,
    unidadEdad,
    edadGarantiaHoras,
    fechaMuestreo,
    fechaEnsayo,
    fechaEdadGarantia,
    guaranteeAgeStart,
    guaranteeAgeEnd,
    diffFromEnd,
    toleranceHours,
    isAtGuaranteeAge,
    isOutOfTime,
    isTooEarly,
    isEdadGarantia: !!ensayo.is_edad_garantia,
  }
}

/** Hours from ensayo to the nearest *edge* of the tolerance window (negative = inside). */
function hoursFromToleranceWindow(g: GuaranteeMetrics): {
  inWindow: boolean
  hoursBeforeWindow: number | null
  hoursAfterWindow: number | null
} {
  const tE = g.fechaEnsayo.getTime()
  const t0 = g.guaranteeAgeStart.getTime()
  const t1 = g.guaranteeAgeEnd.getTime()
  if (tE >= t0 && tE <= t1) {
    return { inWindow: true, hoursBeforeWindow: null, hoursAfterWindow: null }
  }
  if (tE < t0) {
    return { inWindow: false, hoursBeforeWindow: (t0 - tE) / (1000 * 60 * 60), hoursAfterWindow: null }
  }
  return { inWindow: false, hoursBeforeWindow: null, hoursAfterWindow: (tE - t1) / (1000 * 60 * 60) }
}

function formatHoursHuman(h: number): string {
  if (!Number.isFinite(h) || h < 0) return '—'
  if (h < 1) return `${Math.round(h * 60)} min`
  if (h < 24) return `${h >= 10 ? Math.round(h) : Number(h.toFixed(1))} h`
  const d = h / 24
  return `${d >= 10 ? Math.round(d) : Number(d.toFixed(1))} d`
}

function guaranteeBarLayout(g: GuaranteeMetrics) {
  const tM = g.fechaMuestreo.getTime()
  const tWin0 = g.guaranteeAgeStart.getTime()
  const tWin1 = g.guaranteeAgeEnd.getTime()
  const tNom = g.fechaEdadGarantia.getTime()
  const tE = g.fechaEnsayo.getTime()

  const tAxisEnd = Math.max(tE, tWin1, tNom)
  const inner = tAxisEnd - tM
  const pad = Math.max(inner * 0.03, 30 * 60 * 1000)
  const axisStart = tM
  const axisEnd = tAxisEnd + pad
  const span = Math.max(1, axisEnd - axisStart)

  const pct = (t: number) => Math.min(100, Math.max(0, ((t - axisStart) / span) * 100))

  const winLeftPct = pct(tWin0)
  const winRightPct = pct(tWin1)
  const earlyPct = winLeftPct
  const windowPct = Math.max(winRightPct - winLeftPct, 0)
  const latePct = Math.max(0, 100 - winRightPct)

  return {
    winLeftPct,
    winRightPct,
    earlyPct,
    windowPct,
    latePct,
    ensayoPct: pct(tE),
    nominalPct: pct(tNom),
    spanMs: span,
  }
}

function specimenLabel(m: EnsayoWithRelations['muestra']): string {
  if (!m) return '—'
  const spec = (m as { specimen_type_spec?: { dimension_label?: string } }).specimen_type_spec
  if (spec?.dimension_label) return spec.dimension_label
  if (m.tipo_muestra === 'CUBO' && m.cube_side_cm) return `Cubo ${m.cube_side_cm}×${m.cube_side_cm} cm`
  if (m.tipo_muestra === 'CILINDRO' && m.diameter_cm) return `Cilindro Ø${m.diameter_cm} cm`
  if (m.tipo_muestra === 'VIGA' && m.beam_width_cm && m.beam_height_cm && m.beam_span_cm) {
    return `Viga ${m.beam_width_cm}×${m.beam_height_cm}×${m.beam_span_cm} cm`
  }
  return m.tipo_muestra
}

export default function EnsayoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuthBridge()
  const [ensayo, setEnsayo] = useState<EnsayoWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [specsSheetOpen, setSpecsSheetOpen] = useState(false)
  const [lightbox, setLightbox] = useState<Evidencia | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [obsText, setObsText] = useState('')
  const [obsSaving, setObsSaving] = useState(false)

  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideActive, setOverrideActive] = useState(false)
  const [draftFactor, setDraftFactor] = useState('1')
  const [factorSaving, setFactorSaving] = useState(false)
  const [factorError, setFactorError] = useState<string | null>(null)

  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN']
  const canPatchEnsayo =
    profile && ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN'].includes(profile.role)
  const canConfigSpecs = profile && ['EXECUTIVE', 'ADMIN'].includes(profile.role)

  const reload = useCallback(async () => {
    const ensayoId = Array.isArray(params.id) ? params.id[0] : params.id
    if (!ensayoId) return
    const data = await fetchEnsayoById(ensayoId)
    setEnsayo(data)
    setObsText(data.observaciones || '')
    const f = data.factor_correccion != null ? String(data.factor_correccion) : '1'
    setDraftFactor(f)
  }, [params.id])

  useEffect(() => {
    ;(async () => {
      if (!params.id) return
      try {
        setLoading(true)
        setError(null)
        await reload()
      } catch (err) {
        console.error(err)
        setError('No se pudo cargar la información del ensayo')
      } finally {
        setLoading(false)
      }
    })()
  }, [params.id, reload])

  const recipe = ensayo?.muestra?.muestreo?.remision?.recipe as
    | { recipe_versions?: { is_current?: boolean; notes?: string }[] }
    | undefined
  const recipeVersions = recipe?.recipe_versions || []
  const currentVersion = recipeVersions.find((v) => v.is_current === true)
  const hasMR = (currentVersion?.notes || '').toString().toUpperCase().includes('MR')
  const clasificacion = hasMR ? 'MR' : 'FC'

  const muestreoBaseTs = useMemo(() => {
    const m = ensayo?.muestra?.muestreo as | { fecha_muestreo_ts?: string; fecha_muestreo?: string; hora_muestreo?: string }
      | undefined
    if (!m) return null
    if (m.fecha_muestreo_ts) return new Date(m.fecha_muestreo_ts)
    if (m.fecha_muestreo) return new Date(`${m.fecha_muestreo}T${m.hora_muestreo || '00:00'}`)
    return null
  }, [ensayo])

  const scheduledTs = useMemo(() => {
    const ms = ensayo?.muestra as
      | { fecha_programada_ensayo_ts?: string; fecha_programada_ensayo?: string }
      | undefined
    if (!ms) return null
    if (ms.fecha_programada_ensayo_ts) return new Date(ms.fecha_programada_ensayo_ts)
    if (ms.fecha_programada_ensayo) return new Date(`${ms.fecha_programada_ensayo}T12:00:00`)
    return null
  }, [ensayo])

  const plannedDiffHours =
    muestreoBaseTs && scheduledTs
      ? Math.max(0, Math.floor((scheduledTs.getTime() - muestreoBaseTs.getTime()) / 3600000))
      : null
  const plannedAgeValue =
    plannedDiffHours !== null ? (plannedDiffHours <= 48 ? plannedDiffHours : Math.round(plannedDiffHours / 24)) : null
  const plannedAgeUnitLabel = plannedDiffHours !== null ? (plannedDiffHours <= 48 ? 'horas' : 'días') : '—'

  const guaranteeAgeMetrics = ensayo ? buildGuaranteeMetrics(ensayo) : null

  const resistenciaRaw = ensayo ? Number(ensayo.resistencia_calculada) : 0
  const resistenciaCorregida = ensayo ? resolveEnsayoResistenciaReportada(ensayo) : 0
  const porcentaje = ensayo ? Number(ensayo.porcentaje_cumplimiento) : 0
  const kpiCompliance = complianceKpiStatus(porcentaje)
  const spec = ensayo?.specimen_type_spec
  const specFactor = spec?.correction_factor != null ? Number(spec.correction_factor) : null
  const appliedFactor = ensayo?.factor_correccion != null ? Number(ensayo.factor_correccion) : 1
  const isCustomFactor =
    specFactor != null && Number.isFinite(specFactor) && Math.abs(appliedFactor - specFactor) > 0.0001

  const plantCode =
    (ensayo?.muestra?.muestreo as { plant?: { code?: string }; planta?: string } | undefined)?.plant?.code ||
    (ensayo?.muestra?.muestreo as { planta?: string } | undefined)?.planta ||
    '—'

  const remision = ensayo?.muestra?.muestreo?.remision as
    | {
        orders?: { clients?: { business_name?: string }; construction_site?: string }
        manual_reference?: string
      }
    | undefined
  const clientName = remision?.orders?.clients?.business_name || '—'
  const obra = remision?.orders?.construction_site || '—'
  const muestreoId = ensayo?.muestra?.muestreo?.id

  async function saveObservaciones() {
    if (!ensayo || !canPatchEnsayo) return
    setObsSaving(true)
    try {
      await updateEnsayoById(ensayo.id, { observaciones: obsText })
      await reload()
    } catch (e) {
      console.error(e)
    } finally {
      setObsSaving(false)
    }
  }

  async function saveFactorOverride() {
    if (!ensayo || !canPatchEnsayo) return
    const v = parseFloat(draftFactor)
    if (!Number.isFinite(v) || v < 0.5 || v > 1.5) {
      setFactorError('Factor debe estar entre 0.5 y 1.5')
      return
    }
    setFactorError(null)
    setFactorSaving(true)
    try {
      await updateEnsayoById(ensayo.id, { factor_correccion: v })
      await reload()
      setOverrideOpen(false)
      setOverrideActive(false)
    } catch (e: unknown) {
      setFactorError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setFactorSaving(false)
    }
  }

  async function restoreSpecFactor() {
    if (!ensayo?.specimen_type_spec?.id || !canPatchEnsayo) return
    setFactorSaving(true)
    setFactorError(null)
    try {
      await updateEnsayoById(ensayo.id, { specimen_type_spec_id: ensayo.specimen_type_spec.id })
      await reload()
      setOverrideOpen(false)
      setOverrideActive(false)
    } catch (e: unknown) {
      setFactorError(e instanceof Error ? e.message : 'Error')
    } finally {
      setFactorSaving(false)
    }
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return (
      <div className="w-full py-16 px-4">
        <div className="max-w-3xl mx-auto rounded-lg border border-amber-200 bg-amber-50/80 p-8 flex gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-700 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold text-amber-900">Acceso restringido</h2>
            <p className="text-sm text-amber-800 mt-1">No tienes permiso para ver esta página.</p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[50vh] gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
        <p className="text-sm text-stone-600">Cargando detalle del ensayo…</p>
      </div>
    )
  }

  if (error || !ensayo) {
    return (
      <div className="w-full space-y-4">
        <Button variant="outline" className={qualityHubOutlineNeutralClass} onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 flex gap-3 max-w-2xl">
          <AlertTriangle className="h-5 w-5 text-red-700 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900">Error al cargar el ensayo</p>
            <p className="text-sm text-red-800 mt-1">{error || 'No encontrado'}</p>
          </div>
        </div>
      </div>
    )
  }

  const statusLabel = ensayo.is_ensayo_fuera_tiempo ? 'Fuera de tiempo' : 'Registrado'
  const statusBadgeClass = ensayo.is_ensayo_fuera_tiempo
    ? 'border-amber-200 bg-amber-50 text-amber-800'
    : 'border-emerald-200 bg-emerald-50 text-emerald-800'

  const compStyles = qualityHubSummaryStatusMap[kpiCompliance]

  const kpiCell = (
    label: string,
    value: string,
    status: QualityHubSummaryStatus,
    hint?: string
  ) => {
    const st = qualityHubSummaryStatusMap[status]
    return (
      <div className={cn('rounded-lg border px-4 py-3', st.card)}>
        <div className={cn('text-xs uppercase tracking-wide', st.label)}>{label}</div>
        <div className={cn('text-xl sm:text-2xl font-semibold mt-0.5 font-mono tabular-nums', st.value)}>
          {value}
        </div>
        {hint ? <div className="text-[11px] text-stone-400 mt-0.5">{hint}</div> : null}
      </div>
    )
  }

  const guaranteeBar = guaranteeAgeMetrics ? guaranteeBarLayout(guaranteeAgeMetrics) : null
  const windowRel = guaranteeAgeMetrics ? hoursFromToleranceWindow(guaranteeAgeMetrics) : null

  const evidenciasNorm = (ensayo.evidencias || []).map((e) => normalizeEvidencia(e as unknown as Record<string, unknown>))

  return (
    <div className="w-full space-y-6">
      <QualityBreadcrumb
        hubName="Operaciones"
        hubHref="/quality/operaciones"
        items={[
          { label: 'Ensayos', href: '/quality/ensayos' },
          { label: ensayo.muestra?.identificacion || 'Detalle' },
        ]}
        className="mb-2"
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
            Ensayo de {ensayo.muestra?.identificacion}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {specimenLabel(ensayo.muestra)} · {clasificacion}{' '}
            {plannedAgeValue != null ? `${plannedAgeValue} ${plannedAgeUnitLabel}` : ''} · {plantCode}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={cn('text-[10px] px-2', statusBadgeClass)}>
            {statusLabel}
          </Badge>
          <Button variant="outline" className={cn(qualityHubOutlineNeutralClass, 'h-9')} onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpiCell('Carga', `${ensayo.carga_kg.toLocaleString('es-MX')} kg`, 'neutral')}
        {kpiCell('Resistencia', `${resistenciaRaw.toFixed(2)}`, 'neutral', 'kg/cm² (bruta)')}
        {kpiCell('Resist. corregida', `${resistenciaCorregida.toFixed(2)}`, kpiCompliance, 'kg/cm²')}
        {kpiCell(
          '% Cumplimiento',
          `${porcentaje.toFixed(1)}%`,
          kpiCompliance,
          porcentaje >= 100 ? 'Objetivo' : porcentaje >= 70 ? 'Revisar' : 'Bajo'
        )}
        {kpiCell(
          'Factor',
          `×${appliedFactor.toFixed(4)}`,
          'neutral',
          spec?.dimension_label || 'Sin especificación vinculada'
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className={cn('lg:col-span-2', CARD_SHELL)}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="h-5 w-5 text-stone-600" />
              Información del ensayo
            </CardTitle>
            <CardDescription>Detalles del ensayo y la muestra evaluada</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1">Muestra</p>
                  <p className="font-semibold text-stone-900">{ensayo.muestra?.identificacion}</p>
                  <Badge variant="outline" className="mt-2 bg-stone-50 text-stone-700 border-stone-300">
                    {ensayo.muestra?.tipo_muestra}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1 flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-stone-600" />
                    Fecha de ensayo
                  </p>
                  <p className="font-semibold text-stone-900">
                    {ensayo.fecha_ensayo_ts
                      ? format(new Date(ensayo.fecha_ensayo_ts), "PPP 'a' HH:mm", { locale: es })
                      : formatDate(ensayo.fecha_ensayo, 'PPP')}
                  </p>
                  {guaranteeAgeMetrics && (
                    <p className="text-xs text-stone-500 mt-1">
                      Muestreo: {format(guaranteeAgeMetrics.fechaMuestreo, "PPP 'a' HH:mm", { locale: es })}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1 flex items-center gap-1">
                    <Building className="h-4 w-4 text-stone-600" />
                    Planta
                  </p>
                  <p className="font-semibold text-stone-900">{plantCode}</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1">Clasificación</p>
                  <Badge variant="outline" className="border-stone-300">
                    {clasificacion} {plannedAgeValue ?? ''} {plannedAgeUnitLabel}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1 flex items-center gap-1">
                    <Truck className="h-4 w-4 text-stone-600" />
                    Remisión
                  </p>
                  <p className="font-semibold text-stone-900">{remision?.manual_reference || '—'}</p>
                  {muestreoId && (
                    <Button variant="outline" size="sm" className={cn(qualityHubLinkOutlineClass, 'h-8 mt-2')} asChild>
                      <Link href={`/quality/muestreos/${muestreoId}`}>
                        Ver muestreo
                        <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                      </Link>
                    </Button>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1 flex items-center gap-1">
                    <User className="h-4 w-4 text-stone-600" />
                    Cliente
                  </p>
                  <p className="font-semibold text-stone-900">{clientName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1 flex items-center gap-1">
                    <Building className="h-4 w-4 text-stone-600" />
                    Obra
                  </p>
                  <p className="font-semibold text-stone-900">{obra}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4 space-y-2">
              <p className="text-sm font-medium text-stone-500">Observaciones</p>
              {canPatchEnsayo ? (
                <>
                  <Textarea
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    className="min-h-[100px] text-stone-800"
                    placeholder="Notas del ensayo…"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className={qualityHubPrimaryButtonClass}
                    disabled={obsSaving}
                    onClick={saveObservaciones}
                  >
                    {obsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar observaciones'}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-stone-700 whitespace-pre-wrap">{ensayo.observaciones || 'Sin observaciones'}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={CARD_SHELL}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings2 className="h-5 w-5 text-stone-600" />
              Factor de corrección
            </CardTitle>
            <CardDescription>Ajuste según tipo de probeta (persistido en base de datos)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500 mb-1">Especificación aplicada</p>
              <p className="font-semibold text-stone-900">{spec?.dimension_label || '—'}</p>
              {specFactor != null && (
                <p className="font-mono tabular-nums text-sm text-stone-700 mt-1">
                  Factor estándar: {specFactor.toFixed(4)}
                </p>
              )}
              {isCustomFactor && (
                <Badge variant="outline" className="mt-2 border-amber-200 bg-amber-50 text-amber-800 text-[10px]">
                  Factor personalizado
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className={cn('rounded-lg border p-3', compStyles.card)}>
                <p className="text-xs font-medium text-stone-500">Resist. corregida</p>
                <p className={cn('text-lg font-bold font-mono tabular-nums', compStyles.value)}>
                  {resistenciaCorregida.toFixed(2)}{' '}
                  <span className="text-sm font-normal text-stone-500">kg/cm²</span>
                </p>
              </div>
              <div className={cn('rounded-lg border p-3', compStyles.card)}>
                <p className="text-xs font-medium text-stone-500">% Cumplimiento</p>
                <div className="flex items-center gap-1.5">
                  <p className={cn('text-lg font-bold font-mono tabular-nums', compStyles.value)}>
                    {porcentaje.toFixed(1)}%
                  </p>
                  {porcentaje >= 100 ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-amber-600" />
                  )}
                </div>
              </div>
            </div>

            {canPatchEnsayo && (
              <>
                <div className="border-t border-stone-100 pt-4">
                  <Popover open={overrideOpen} onOpenChange={setOverrideOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={cn(
                          'h-9 gap-1.5 w-full sm:w-auto',
                          overrideActive ? qualityHubPrimaryButtonClass : qualityHubOutlineNeutralClass
                        )}
                        onClick={() => {
                          setOverrideActive(true)
                          setDraftFactor(String(appliedFactor))
                          setFactorError(null)
                        }}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Ajustar factor
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72" align="end">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-sm font-medium">Factor manual</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setOverrideActive(false)
                              setOverrideOpen(false)
                            }}
                          >
                            Cerrar
                          </Button>
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          min={0.5}
                          max={1.5}
                          className="h-8 text-center font-mono"
                          value={draftFactor}
                          onChange={(e) => setDraftFactor(e.target.value)}
                        />
                        {factorError && <p className="text-xs text-red-600">{factorError}</p>}
                        <Button
                          type="button"
                          size="sm"
                          className={cn(qualityHubPrimaryButtonClass, 'w-full')}
                          disabled={factorSaving}
                          onClick={saveFactorOverride}
                        >
                          {factorSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
                        </Button>
                        {ensayo.specimen_type_spec?.id && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(qualityHubOutlineNeutralClass, 'w-full text-xs')}
                            disabled={factorSaving}
                            onClick={restoreSpecFactor}
                          >
                            Restaurar factor de especificación
                          </Button>
                        )}
                        <p className="text-[11px] text-stone-400">
                          Ajuste entre 0.5 y 1.5. Se recalculan resistencia corregida y cumplimiento.
                        </p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                {canConfigSpecs && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(qualityHubLinkOutlineClass, 'w-full text-xs h-9')}
                    onClick={() => setSpecsSheetOpen(true)}
                  >
                    Configurar especificaciones de probetas
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {guaranteeAgeMetrics && guaranteeBar && windowRel && (() => {
        const g = guaranteeAgeMetrics
        const bar = guaranteeBar
        const tolLabel =
          g.toleranceHours < 24
            ? `${g.toleranceHours} h`
            : `${g.toleranceHours / 24} d`

        const plainSummary = windowRel.inWindow
          ? `La edad del ensayo está bien: ocurrió dentro de la franja verde (entre el inicio y el fin permitidos, alrededor de la edad objetivo de ${g.edadGarantiaHoras} h).`
          : g.isTooEarly && windowRel.hoursBeforeWindow != null
            ? `El ensayo se hizo demasiado pronto: todavía faltaban ${formatHoursHuman(windowRel.hoursBeforeWindow)} para entrar en la franja permitida.`
            : windowRel.hoursAfterWindow != null
              ? `El ensayo se hizo demasiado tarde: pasaron ${formatHoursHuman(windowRel.hoursAfterWindow)} después del fin de la franja permitida.`
              : 'Comparación respecto a la ventana de tolerancia.'

        const respectoVentana = windowRel.inWindow
          ? 'Dentro de la franja'
          : g.isTooEarly && windowRel.hoursBeforeWindow != null
            ? `${formatHoursHuman(windowRel.hoursBeforeWindow)} antes del inicio`
            : windowRel.hoursAfterWindow != null
              ? `${formatHoursHuman(windowRel.hoursAfterWindow)} después del fin`
              : '—'

        const moments = [
          {
            key: 'muestreo',
            label: '1. Muestreo',
            sub: 'Aquí empieza el reloj de edad.',
            date: g.fechaMuestreo,
            tone: 'muted' as const,
          },
          {
            key: 'ventana-inicio',
            label: '2. Inicio de la franja permitida',
            sub: `Primera hora válida para ensayar (objetivo − ${tolLabel}).`,
            date: g.guaranteeAgeStart,
            tone: 'muted' as const,
          },
          {
            key: 'objetivo',
            label: '3. Edad objetivo (nominal)',
            sub: `${g.valorEdad} ${g.unidadEdad === 'HORA' ? 'horas' : 'días'} desde el muestreo.`,
            date: g.fechaEdadGarantia,
            tone: 'accent' as const,
          },
          {
            key: 'ventana-fin',
            label: '4. Fin de la franja permitida',
            sub: `Última hora válida (objetivo + ${tolLabel}).`,
            date: g.guaranteeAgeEnd,
            tone: 'muted' as const,
          },
          {
            key: 'ensayo',
            label: '5. Ensayo registrado',
            sub: windowRel.inWindow
              ? 'Cayó dentro de la franja verde.'
              : g.isTooEarly
                ? 'Quedó antes de la franja (muy temprano).'
                : 'Quedó después de la franja (fuera de tiempo).',
            date: g.fechaEnsayo,
            tone: windowRel.inWindow ? ('ok' as const) : ('bad' as const),
          },
        ]

        return (
          <Card className={CARD_SHELL}>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-stone-600" />
                Edad garantía
              </CardTitle>
              <CardDescription>
                El reloj arranca en el muestreo. La franja verde es el único tramo donde la edad del ensayo cumple;
                el margen es ±{tolLabel} respecto a la edad objetivo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border border-stone-200/90 bg-gradient-to-b from-stone-50/90 to-white p-4 sm:p-5 space-y-5">
                <p className="text-sm text-stone-800 leading-relaxed font-medium">{plainSummary}</p>

                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500 mb-2">
                    Escala real (tiempo transcurrido desde el muestreo)
                  </p>
                  <p className="text-[11px] text-stone-500 mb-3">
                    Izquierda = más cerca del muestreo; derecha = más tarde. La franja verde no está “centrada en la tarjeta”: su posición y ancho reflejan fechas reales.
                  </p>

                  <div className="relative h-[4.5rem] sm:h-[3.75rem]">
                    <div
                      className="absolute left-0 right-0 top-9 sm:top-8 h-3.5 rounded-full overflow-hidden ring-1 ring-stone-200/80 bg-stone-100 shadow-inner"
                      aria-hidden
                    >
                      <div
                        className="absolute left-0 top-0 h-full bg-amber-200/90 border-r border-amber-300/60"
                        style={{ width: `${bar.earlyPct}%` }}
                        title="Antes de la ventana permitida"
                      />
                      <div
                        className="absolute top-0 h-full min-w-[2px] bg-emerald-500/90 border-x border-emerald-700/25 shadow-sm"
                        style={{ left: `${bar.winLeftPct}%`, width: `${bar.windowPct}%` }}
                        title="Franja permitida"
                      />
                      <div
                        className="absolute right-0 top-0 h-full bg-rose-200/90 border-l border-rose-300/60"
                        style={{ width: `${bar.latePct}%` }}
                        title="Después del límite permitido"
                      />
                    </div>

                    <div
                      className="absolute top-9 sm:top-8 w-0.5 h-4 bg-emerald-950/55 z-[1] pointer-events-none"
                      style={{ left: `${bar.nominalPct}%`, transform: 'translateX(-50%)' }}
                      title="Edad objetivo"
                    />

                    <div
                      className="absolute top-0 z-10 flex flex-col items-center min-w-[5rem] max-w-[10rem]"
                      style={{ left: `${bar.ensayoPct}%`, transform: 'translateX(-50%)' }}
                    >
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shadow-sm text-center leading-tight',
                          windowRel.inWindow
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : 'bg-red-50 text-red-900 border-red-200'
                        )}
                      >
                        Ensayo
                      </span>
                      <div
                        className={cn(
                          'w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent mt-0.5',
                          windowRel.inWindow ? 'border-t-emerald-600' : 'border-t-red-600'
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-stone-600">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-2 rounded-sm bg-amber-200/90 ring-1 ring-amber-300/60" />
                      Antes (muy temprano)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-2 rounded-sm bg-emerald-500/90 ring-1 ring-emerald-700/25" />
                      Franja permitida
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-3 h-2 rounded-sm bg-rose-200/90 ring-1 ring-rose-300/60" />
                      Después (tarde)
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-stone-500">
                      <span className="inline-block w-0.5 h-3 bg-emerald-950/55" />
                      Marca vertical = edad objetivo
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-stone-200/80 bg-white/80 p-3 sm:p-4">
                  <p className="text-xs font-semibold text-stone-700 mb-3">Orden cronológico (lo mismo que la barra)</p>
                  <ul className="space-y-3">
                    {moments.map((m) => (
                      <li key={m.key} className="flex gap-3 text-sm">
                        <span
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            m.tone === 'ok' && 'bg-emerald-500',
                            m.tone === 'bad' && 'bg-red-500',
                            m.tone === 'accent' && 'bg-emerald-700/70',
                            m.tone === 'muted' && 'bg-stone-300'
                          )}
 />
                        <div>
                          <p className="font-medium text-stone-900">{m.label}</p>
                          <p className="text-xs text-stone-500">{m.sub}</p>
                          <p className="text-xs text-stone-700 font-mono tabular-nums mt-0.5">
                            {format(m.date, "d MMM yyyy, HH:mm", { locale: es })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1">Estado</p>
                  {g.isTooEarly ? (
                    <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800">
                      Muy temprano
                    </Badge>
                  ) : g.isOutOfTime ? (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-red-800">
                      Fuera de tolerancia
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                      En franja
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1">Edad requerida</p>
                  <p className="font-semibold text-stone-900 font-mono tabular-nums text-sm">
                    {g.valorEdad} {g.unidadEdad === 'HORA' ? 'horas' : 'días'} ({g.edadGarantiaHoras} h)
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1">Respecto a la franja</p>
                  <p
                    className={cn(
                      'font-semibold font-mono tabular-nums text-sm',
                      windowRel.inWindow ? 'text-emerald-700' : g.isTooEarly ? 'text-sky-700' : 'text-red-700'
                    )}
                  >
                    {respectoVentana}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-500 mb-1">Margen (tolerancia)</p>
                  <p className="text-sm text-stone-600">± {tolLabel} alrededor del objetivo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })()}

      <Card className={CARD_SHELL}>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileImage className="h-5 w-5 text-stone-600" />
            Evidencias
          </CardTitle>
          <CardDescription>Fotografías y documentos del ensayo</CardDescription>
        </CardHeader>
        <CardContent>
          {evidenciasNorm.length === 0 ? (
            <div className="border border-dashed border-stone-200 bg-stone-50/50 rounded-lg py-10 px-4 text-center">
              <FileImage className="h-12 w-12 text-stone-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-stone-900 mb-1">No hay evidencias registradas</p>
              <p className="text-sm text-stone-500">Las fotos adjuntas al ensayo aparecerán aquí.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {evidenciasNorm.map((ev) => {
                const primary = evidenciaPublicUrl(ev._path)
                const fallback = evidenciaFallbackUrl(ev._path)
                const isImg =
                  ev.tipo_archivo.startsWith('image/') ||
                  /\.(jpe?g|png|gif|webp)$/i.test(ev.nombre_archivo || '')
                return (
                  <button
                    key={ev.id}
                    type="button"
                    className="text-left rounded-lg border border-stone-200 bg-white overflow-hidden transition-all hover:shadow-md hover:border-sky-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40"
                    onClick={() => {
                      setLightbox(ev)
                      setLightboxSrc(primary)
                    }}
                  >
                    <div className="aspect-square relative bg-stone-100">
                      {isImg ? (
                        <Image src={primary} alt={ev.nombre_archivo} fill className="object-cover" unoptimized />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="h-12 w-12 text-stone-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-medium text-stone-700 truncate">{ev.nombre_archivo}</p>
                      <p className="text-xs text-stone-500 mt-0.5">{Math.round(ev.tamano_kb)} KB</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!lightbox}
        onOpenChange={(o) => {
          if (!o) {
            setLightbox(null)
            setLightboxSrc(null)
          }
        }}
      >
        <DialogContent className="max-w-[min(96vw,900px)] p-0 gap-0 overflow-hidden bg-stone-950 border-stone-800">
          <DialogHeader className="p-4 border-b border-stone-800">
            <DialogTitle className="text-stone-100 text-base truncate pr-8">
              {lightbox?.nombre_archivo}
            </DialogTitle>
          </DialogHeader>
                   <div className="relative w-full min-h-[50vh] max-h-[80vh] flex items-center justify-center bg-black">
            {lightbox &&
              (() => {
                const lbPath = (lightbox as Evidencia & { _path?: string })._path || ''
                const isImg =
                  lightbox.tipo_archivo.startsWith('image/') ||
                  /\.(jpe?g|png|gif|webp)$/i.test(lightbox.nombre_archivo)
                if (isImg && lightboxSrc) {
                  return (
                    <Image
                      src={lightboxSrc}
                      alt={lightbox.nombre_archivo}
                      width={1200}
                      height={900}
                      className="max-h-[80vh] w-auto h-auto object-contain"
                      unoptimized
                      onError={() => {
                        const fb = evidenciaFallbackUrl(lbPath)
                        if (fb && fb !== lightboxSrc) setLightboxSrc(fb)
                      }}
                    />
                  )
                }
                const href = lightboxSrc || evidenciaPublicUrl(lbPath)
                return (
                  <div className="flex flex-col items-center gap-4 p-8 text-center text-stone-300">
                    <FileText className="h-16 w-16 text-stone-500" />
                    <p className="text-sm max-w-md">{lightbox.nombre_archivo}</p>
                    {href ? (
                      <Button variant="outline" size="sm" className="border-stone-600 text-stone-100" asChild>
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          Abrir archivo <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                        </a>
                      </Button>
                    ) : null}
                  </div>
                )
              })()}
          </div>
          <div className="p-3 text-xs text-stone-400 border-t border-stone-800">
            {lightbox ? `${Math.round(lightbox.tamano_kb)} KB · ${lightbox.tipo_archivo || 'archivo'}` : null}
          </div>
        </DialogContent>
      </Dialog>

      <SpecimenSpecsConfigSheet
        open={specsSheetOpen}
        onOpenChange={setSpecsSheetOpen}
        onSaved={() => reload()}
      />
    </div>
  )
}
