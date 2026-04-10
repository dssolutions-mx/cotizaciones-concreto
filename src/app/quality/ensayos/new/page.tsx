'use client'

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, AlertTriangle, Save, Calculator, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { fetchMuestraById } from '@/services/qualityMuestraService'
import { createEnsayo } from '@/services/qualityEnsayoService'
import type { MuestraWithRelations } from '@/types/quality'
import { FileUploader } from '@/components/ui/file-uploader'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SrFileViewer } from '@/components/quality/SrFileViewer'
import { extractSr3MaxForceFromFile } from '@/utils/sr3Parser'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import { DatePicker } from '@/components/ui/date-picker'

const ensayoFormSchema = z.object({
  muestra_id: z.string().min(1, 'El ID de la muestra es requerido'),
  fecha_ensayo: z.date({
    required_error: 'La fecha del ensayo es requerida',
  }),
  hora_ensayo: z.string().min(1, 'La hora del ensayo es requerida'),
  carga_kg: z
    .number({
      required_error: 'La carga de ruptura es requerida',
      invalid_type_error: 'La carga debe ser un número válido',
    })
    .min(0.01, 'La carga debe ser mayor a 0')
    .max(500000, 'La carga parece demasiado alta'),
  resistencia_calculada: z.number().min(0),
  porcentaje_cumplimiento: z
    .number()
    .min(0)
    .max(9999.99, 'El porcentaje no puede exceder 9999.99%'),
  observaciones: z.string().optional(),
})

type EnsayoFormValues = z.infer<typeof ensayoFormSchema>

const resultCardStyles = {
  neutral: 'border-stone-200 bg-white text-stone-500',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warn: 'border-amber-200 bg-amber-50 text-amber-800',
  bad: 'border-red-200 bg-red-50 text-red-800',
} as const

function complianceVariant(pct: number, hasCarga: boolean): keyof typeof resultCardStyles {
  if (!hasCarga) return 'neutral'
  if (pct >= 100) return 'ok'
  if (pct >= 80) return 'warn'
  return 'bad'
}

function specimenLabel(tipo: string | undefined) {
  if (tipo === 'CILINDRO') return 'Cilindro'
  if (tipo === 'VIGA') return 'Viga'
  if (tipo === 'CUBO') return 'Cubo'
  return tipo ?? '—'
}

function NuevoEnsayoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { profile } = useAuthBridge()
  const cargaInputRef = useRef<HTMLInputElement>(null)

  const [muestra, setMuestra] = useState<MuestraWithRelations | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sr3Parsing, setSr3Parsing] = useState(false)

  const muestraId = searchParams.get('muestra')

  const form = useForm<EnsayoFormValues>({
    resolver: zodResolver(ensayoFormSchema),
    defaultValues: {
      muestra_id: muestraId || '',
      fecha_ensayo: new Date(),
      hora_ensayo: new Date().toTimeString().slice(0, 5),
      carga_kg: undefined as unknown as number,
      resistencia_calculada: 0,
      porcentaje_cumplimiento: 0,
      observaciones: '',
    },
  })

  const watchCarga = form.watch('carga_kg')
  const watchRes = form.watch('resistencia_calculada')
  const watchPct = form.watch('porcentaje_cumplimiento')
  const hasCarga =
    typeof watchCarga === 'number' && !Number.isNaN(watchCarga) && watchCarga > 0

  const handleCargaChange = useCallback(
    (value: number) => {
      form.setValue('carga_kg', value)
      if (!muestra) return

      let resistencia = 0
      if (muestra.tipo_muestra === 'CILINDRO') {
        const diameter =
          typeof (muestra as { diameter_cm?: number }).diameter_cm === 'number' &&
          (muestra as { diameter_cm?: number }).diameter_cm! > 0
            ? (muestra as { diameter_cm: number }).diameter_cm
            : 15
        const radius = diameter / 2
        const area = Math.PI * radius * radius
        const isMRTest = false
        resistencia = value / area
        if (isMRTest) resistencia = resistencia * 0.13
      } else if (muestra.tipo_muestra === 'CUBO') {
        const side =
          typeof (muestra as { cube_side_cm?: number }).cube_side_cm === 'number' &&
          (muestra as { cube_side_cm?: number }).cube_side_cm! > 0
            ? (muestra as { cube_side_cm: number }).cube_side_cm
            : 15
        const area = side * side
        resistencia = value / area
      } else if (muestra.tipo_muestra === 'VIGA') {
        resistencia = (45 * value) / 3375
      }

      form.setValue('resistencia_calculada', parseFloat(resistencia.toFixed(3)))

      const targetStrength = muestra.muestreo?.remision?.recipe?.strength_fc || 0
      let porcentaje = 0
      if (targetStrength > 0 && resistencia > 0) {
        porcentaje = parseFloat(((resistencia / targetStrength) * 100).toFixed(2))
      }
      form.setValue('porcentaje_cumplimiento', porcentaje, { shouldValidate: true })
    },
    [form, muestra]
  )

  useEffect(() => {
    if (muestraId) {
      form.setValue('muestra_id', muestraId)
      void fetchMuestraDetails(muestraId)
    } else {
      setLoading(false)
      setError('No se especificó una muestra para ensayar')
    }
  }, [muestraId, form])

  useEffect(() => {
    if (!loading && muestra && cargaInputRef.current) {
      cargaInputRef.current.focus()
    }
  }, [loading, muestra])

  const fetchMuestraDetails = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMuestraById(id)
      setMuestra(data)

      if (data?.fecha_programada_ensayo) {
        try {
          const dateStr = data.fecha_programada_ensayo
          if (dateStr.includes('T')) {
            const [datePart] = dateStr.split('T')
            const [year, month, day] = datePart.split('-').map(Number)
            form.setValue('fecha_ensayo', new Date(year, month - 1, day))
          } else {
            const [year, month, day] = dateStr.split('-').map(Number)
            form.setValue('fecha_ensayo', new Date(year, month - 1, day))
          }
        } catch (e) {
          console.error('Error parsing fecha_programada_ensayo:', e)
        }
      }
    } catch (err) {
      console.error('Error fetching muestra details:', err)
      setError('Error al cargar los detalles de la muestra')
    } finally {
      setLoading(false)
    }
  }

  const handleFilesSelected = async (files: File[]) => {
    setSelectedFiles(files)
    const first = files[0]
    if (first?.name.toLowerCase().endsWith('.sr3')) {
      setSr3Parsing(true)
      try {
        const maxKg = await extractSr3MaxForceFromFile(first)
        if (maxKg > 0) {
          form.setValue('carga_kg', maxKg)
          handleCargaChange(maxKg)
        }
      } finally {
        setSr3Parsing(false)
      }
    }
  }

  const onSubmit = async (data: EnsayoFormValues) => {
    try {
      setIsSubmitting(true)
      setSubmitError(null)

      if (!muestra?.muestreo_id) {
        setSubmitError('No se pudo obtener la información completa del muestreo.')
        return
      }

      await createEnsayo({
        muestra_id: data.muestra_id,
        fecha_ensayo: data.fecha_ensayo,
        hora_ensayo: data.hora_ensayo,
        carga_kg: data.carga_kg,
        resistencia_calculada: data.resistencia_calculada,
        porcentaje_cumplimiento: data.porcentaje_cumplimiento,
        observaciones: data.observaciones || '',
        evidencia_fotografica: selectedFiles.length > 0 ? selectedFiles : [],
      })

      setSubmitSuccess(true)
      setTimeout(() => {
        if (muestra?.muestreo?.id) {
          router.push(`/quality/muestreos/${muestra.muestreo.id}`)
        } else {
          router.push('/quality/ensayos')
        }
      }, 2000)
    } catch (e) {
      console.error('Error creating ensayo:', e)
      setSubmitError('Ocurrió un error al guardar el ensayo. Por favor, intenta nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'EXECUTIVE']
  const hasAccess = profile && allowedRoles.includes(profile.role)
  const targetFc = muestra?.muestreo?.remision?.recipe?.strength_fc

  if (!hasAccess) {
    return (
      <div className="py-12 px-4">
        <div className="max-w-3xl mx-auto rounded-lg border border-amber-200 bg-amber-50/90 p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-amber-700" />
            <h2 className="text-xl font-semibold text-amber-900">Acceso restringido</h2>
          </div>
          <p className="text-sm text-amber-800">No tienes permiso para registrar ensayos de laboratorio.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-5">
        <QualityBreadcrumb
          hubName="Operaciones"
          hubHref="/quality/operaciones"
          items={[{ label: 'Ensayos', href: '/quality/ensayos' }, { label: 'Nuevo ensayo' }]}
        />
        <Card className="border border-stone-200 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
            <h3 className="text-lg font-semibold text-stone-900 mb-2">No se puede continuar</h3>
            <p className="text-sm text-stone-600 mb-6 max-w-md">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="h-9 border-stone-300 bg-white shadow-none hover:bg-stone-50"
              onClick={() => router.push('/quality/ensayos')}
            >
              Volver a ensayos pendientes
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <QualityBreadcrumb
        hubName="Operaciones"
        hubHref="/quality/operaciones"
        items={[{ label: 'Ensayos', href: '/quality/ensayos' }, { label: 'Nuevo ensayo' }]}
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
            Registro de ensayo
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Ingresa la carga de ruptura; la resistencia y el cumplimiento se calculan al instante.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-stone-200 bg-white p-12 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-sky-700" />
          <span className="text-sm text-stone-600">Cargando detalles de la muestra…</span>
        </div>
      ) : muestra ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <Card className="border border-stone-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-stone-900">Contexto de la muestra</CardTitle>
                <CardDescription className="text-stone-500">
                  Datos de referencia para el ensayo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-500">Identificación</p>
                  <p className="text-sm font-medium text-stone-900 mt-0.5">
                    {muestra.identificacion || muestra.id.substring(0, 8)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-500">Tipo</p>
                  <Badge variant="outline" className="mt-1 border-stone-300 text-stone-800">
                    {specimenLabel(muestra.tipo_muestra)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-500">Remisión</p>
                  <p className="text-sm font-medium text-stone-900 mt-0.5 font-mono tabular-nums">
                    {muestra.muestreo?.remision?.remision_number || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-500">Muestreo</p>
                  <p className="text-sm text-stone-800 mt-0.5">
                    {muestra.muestreo?.fecha_muestreo
                      ? formatDate(muestra.muestreo.fecha_muestreo, 'PPP')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-500">Fecha programada ensayo</p>
                  <p className="text-sm text-stone-800 mt-0.5">
                    {muestra.fecha_programada_ensayo
                      ? formatDate(muestra.fecha_programada_ensayo, 'PPP')
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-500">Diseño</p>
                  <p className="text-sm font-medium text-stone-900 mt-0.5">
                    {muestra.muestreo?.remision?.recipe?.recipe_code || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-stone-500">f&apos;c objetivo</p>
                  <p className="text-lg font-semibold font-mono tabular-nums text-stone-900 mt-0.5">
                    {muestra.muestreo?.remision?.recipe?.strength_fc != null
                      ? `${muestra.muestreo.remision.recipe.strength_fc} kg/cm²`
                      : '—'}
                  </p>
                </div>
                {muestra.muestreo?.remision && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-stone-500">Carga (remisión)</p>
                    <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                      {muestra.muestreo.remision.fecha && muestra.muestreo.remision.hora_carga ? (
                        <>
                          {formatDate(muestra.muestreo.remision.fecha, 'PPP')}{' '}
                          <span className="font-mono tabular-nums">
                            {muestra.muestreo.remision.hora_carga}
                          </span>
                        </>
                      ) : (
                        'No disponible'
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="border border-stone-200 bg-white shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg text-stone-900">
                  <Calculator className="h-5 w-5 text-stone-600" />
                  Resultados del laboratorio
                </CardTitle>
                <CardDescription className="text-stone-500">
                  Fecha y hora del ensayo, carga máxima y evidencia .sr3 opcional
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submitSuccess ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-5 text-emerald-900">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-emerald-100 p-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                      </div>
                      <div>
                        <p className="font-semibold">Ensayo guardado correctamente</p>
                        <p className="text-sm text-emerald-800 mt-0.5">Redirigiendo al muestreo…</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="fecha_ensayo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-stone-700">Fecha del ensayo</FormLabel>
                              <FormControl>
                                <DatePicker
                                  date={field.value}
                                  setDate={(d) => field.onChange(d ?? new Date())}
                                  className="h-9 w-full justify-start border-stone-300 bg-white font-normal text-stone-900 shadow-none hover:bg-stone-50"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="hora_ensayo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-stone-700">Hora del ensayo</FormLabel>
                              <FormControl>
                                <Input
                                  type="time"
                                  className="h-9 border-stone-300 bg-white shadow-none font-mono tabular-nums"
                                  {...field}
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(e.target.value)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="carga_kg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold text-stone-900">
                              Carga de ruptura
                            </FormLabel>
                            <FormControl>
                              <div className="flex items-stretch gap-2 rounded-lg border border-stone-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-stone-400/40">
                                <Input
                                  ref={(el) => {
                                    field.ref(el)
                                    cargaInputRef.current = el
                                  }}
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  min="0.01"
                                  placeholder="Ej. 45230.5"
                                  autoComplete="off"
                                  className="h-12 flex-1 border-0 text-lg font-mono tabular-nums text-stone-900 shadow-none focus-visible:ring-0"
                                  value={field.value === undefined || field.value === null ? '' : field.value}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    if (v === '') {
                                      field.onChange(undefined as unknown as number)
                                      form.setValue('resistencia_calculada', 0)
                                      form.setValue('porcentaje_cumplimiento', 0)
                                      return
                                    }
                                    const num = parseFloat(v)
                                    if (!Number.isNaN(num)) {
                                      field.onChange(num)
                                      handleCargaChange(num)
                                    }
                                  }}
                                  onBlur={field.onBlur}
                                  name={field.name}
                                />
                                <span className="flex items-center pr-4 text-sm font-medium text-stone-500">
                                  kg
                                </span>
                              </div>
                            </FormControl>
                            <p className="text-xs text-stone-500">
                              Valor máximo registrado por la máquina o leído del archivo .sr3
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div
                          className={cn(
                            'rounded-lg border p-4 transition-colors',
                            resultCardStyles.neutral
                          )}
                        >
                          <p className="text-xs uppercase tracking-wide text-stone-500">
                            Resistencia calculada
                          </p>
                          <p
                            className={cn(
                              'mt-1 text-2xl font-semibold font-mono tabular-nums',
                              hasCarga && watchRes > 0 ? 'text-stone-900' : 'text-stone-400'
                            )}
                          >
                            {hasCarga && watchRes > 0 ? `${watchRes.toFixed(3)}` : '—'}
                            <span className="ml-1 text-sm font-normal text-stone-500">kg/cm²</span>
                          </p>
                        </div>
                        <div
                          className={cn(
                            'rounded-lg border p-4 transition-colors',
                            resultCardStyles[complianceVariant(watchPct, hasCarga)]
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs uppercase tracking-wide opacity-90">
                              % Cumplimiento
                            </p>
                            {targetFc != null && (
                              <span className="text-[11px] text-stone-500 font-mono tabular-nums shrink-0">
                                obj. {targetFc} kg/cm²
                              </span>
                            )}
                          </div>
                          <p
                            className={cn(
                              'mt-1 text-2xl font-semibold font-mono tabular-nums',
                              !hasCarga && 'text-stone-400'
                            )}
                          >
                            {hasCarga ? `${watchPct.toFixed(2)}%` : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50/50 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FileSpreadsheet className="h-4 w-4 text-stone-600" />
                          <span className="text-sm font-medium text-stone-800">
                            Archivo de máquina (.sr3)
                          </span>
                          {sr3Parsing && (
                            <Loader2 className="h-4 w-4 animate-spin text-sky-700 ml-auto" />
                          )}
                        </div>
                        <FileUploader
                          accept=".sr3"
                          maxFiles={5}
                          maxSize={10 * 1024 * 1024}
                          onFilesSelected={(files) => void handleFilesSelected(files)}
                        />
                        {selectedFiles.length > 0 &&
                          selectedFiles[0].name.toLowerCase().endsWith('.sr3') && (
                            <div className="mt-4 space-y-2">
                              <p className="text-xs uppercase tracking-wide text-stone-500">
                                Vista previa
                              </p>
                              <SrFileViewer file={selectedFiles[0]} />
                            </div>
                          )}
                      </div>

                      <FormField
                        control={form.control}
                        name="observaciones"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-stone-700">Observaciones</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Anomalías, condiciones del equipo, etc."
                                className="min-h-[88px] border-stone-300 bg-white shadow-none placeholder:text-stone-400"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {submitError && (
                        <div className="rounded-lg border border-red-200 bg-red-50/90 p-4 flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                          <p className="text-sm text-red-900">{submitError}</p>
                        </div>
                      )}

                      <CardFooter className="flex justify-end px-0 pb-0 pt-2">
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="h-10 bg-sky-700 px-5 text-white shadow-none hover:bg-sky-800"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Guardando…
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Guardar ensayo
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </form>
                  </Form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="border border-stone-200 bg-white shadow-sm">
          <CardContent className="flex flex-col items-center justify-center p-10 text-center">
            <AlertTriangle className="h-12 w-12 text-stone-300 mb-4" />
            <h3 className="text-lg font-semibold text-stone-900 mb-2">Muestra no encontrada</h3>
            <p className="text-sm text-stone-600 mb-6">
              No se encontró la muestra con el ID indicado.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-9 border-stone-300 bg-white shadow-none"
              onClick={() => router.push('/quality/ensayos')}
            >
              Volver a ensayos pendientes
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function NuevoEnsayoLoading() {
  return (
    <div className="flex items-center justify-center gap-3 py-16">
      <Loader2 className="h-8 w-8 animate-spin text-sky-700" />
      <span className="text-sm text-stone-600">Cargando formulario…</span>
    </div>
  )
}

export default function NuevoEnsayoPage() {
  return (
    <Suspense fallback={<NuevoEnsayoLoading />}>
      <NuevoEnsayoContent />
    </Suspense>
  )
}
