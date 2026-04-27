'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  Plus,
  Award,
  FlaskConical,
  Building2,
  CalendarDays,
  Hash,
  Tag,
  Clock,
  CheckCircle2,
  Shield,
  ExternalLink,
  TestTube2,
  ChevronRight,
  Pencil,
  FileSignature,
  FileWarning,
  RefreshCw,
  ScrollText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  EmaCalibracionCertificadoSheet,
  type CertificadoCalibracionConPdf,
} from '@/components/ema/EmaCalibracionCertificadoSheet'
import { EmaCalibracionCertificadoAttachBlock } from '@/components/ema/EmaCalibracionCertificadoAttachBlock'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import {
  publishedPlantillaSummaryFromTemplatesPayload,
  type PublishedPlantillaSummary,
} from '@/lib/ema/publishedPlantillaFromTemplatesResponse'
import type { InstrumentoDetalle, InstrumentoTrazabilidad, CompletedVerificacionCard } from '@/types/ema'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { EMA_CERTIFICADO_WRITE_ROLES } from '@/lib/ema/emaCertificadoWriteRoles'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days}d`
  return `hace ${Math.floor(days / 30)}m`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return dateStr
}

// ─── Page ────────────────────────────────────────────────────────────────────

const EMA_DETAIL_TABS = ['certificados', 'verificaciones', 'incidentes', 'trazabilidad'] as const
type EmaDetailTab = (typeof EMA_DETAIL_TABS)[number]

export default function InstrumentoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { hasRole } = useAuthSelectors()
  const canAttachCertDocs = hasRole(EMA_CERTIFICADO_WRITE_ROLES)
  const [certListKey, setCertListKey] = useState(0)

  const [instrumento, setInstrumento] = useState<InstrumentoDetalle | null>(null)
  const [certificadoVigente, setCertificadoVigente] = useState<CertificadoCalibracionConPdf | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fichaOpen, setFichaOpen] = useState(false)
  const [fichaCert, setFichaCert] = useState<CertificadoCalibracionConPdf | null>(null)
  const fichaClearRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Preloaded with instrument so the Verificaciones tab avoids a client waterfall (Next.js: parallelize, avoid child-only fetch after parent). */
  const [verificacionesTabData, setVerificacionesTabData] = useState<{
    verificaciones: CompletedVerificacionCard[]
    plantilla: PublishedPlantillaSummary | null
  }>({ verificaciones: [], plantilla: null })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [instRes, verifRes] = await Promise.all([
        fetch(`/api/ema/instrumentos/${id}`),
        fetch(`/api/ema/instrumentos/${id}/verificaciones`),
      ])
      const [instJ, verifJ] = await Promise.all([instRes.json(), verifRes.json()])
      if (!instRes.ok) throw new Error('Instrumento no encontrado')
      const inst: InstrumentoDetalle = instJ.data ?? instJ
      setInstrumento(inst)

      const verificaciones: CompletedVerificacionCard[] = verifRes.ok
        ? ((verifJ as { data?: CompletedVerificacionCard[] }).data ?? [])
        : []

      const cid = inst.conjunto_id
      const [certRes, tmplRes] = await Promise.all([
        fetch(`/api/ema/instrumentos/${id}/certificados?limit=1&vigente=true`),
        cid ? fetch(`/api/ema/conjuntos/${cid}/templates`) : Promise.resolve(null as Response | null),
      ])

      if (certRes.ok) {
        const certJ = await certRes.json()
        const certs: CertificadoCalibracionConPdf[] = certJ.data ?? []
        setCertificadoVigente(certs[0] ?? null)
      } else {
        setCertificadoVigente(null)
      }

      let plantilla: PublishedPlantillaSummary | null = null
      if (tmplRes?.ok) {
        const tmplJ = await tmplRes.json()
        plantilla = publishedPlantillaSummaryFromTemplatesPayload(tmplJ)
      }
      setVerificacionesTabData({ verificaciones, plantilla })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (fichaOpen) {
      if (fichaClearRef.current) {
        clearTimeout(fichaClearRef.current)
        fichaClearRef.current = null
      }
      return
    }
    if (!fichaCert) return
    fichaClearRef.current = setTimeout(() => {
      setFichaCert(null)
      fichaClearRef.current = null
    }, 320)
    return () => {
      if (fichaClearRef.current) clearTimeout(fichaClearRef.current)
    }
  }, [fichaOpen, fichaCert])

  const openCertFicha = useCallback((c: CertificadoCalibracionConPdf) => {
    setFichaCert(c)
    setFichaOpen(true)
  }, [])

  const handleCertDocumentUpdated = useCallback(
    (c: CertificadoCalibracionConPdf) => {
      setFichaCert(c)
      setCertListKey((k) => k + 1)
      void load()
    },
    [load],
  )

  const defaultTab: EmaDetailTab = instrumento?.tipo === 'C' ? 'verificaciones' : 'certificados'
  const [activeTab, setActiveTab] = useState<EmaDetailTab>('certificados')

  useEffect(() => {
    if (!instrumento) return
    const t = searchParams.get('tab')
    const fromUrl =
      t && (EMA_DETAIL_TABS as readonly string[]).includes(t) ? (t as EmaDetailTab) : null
    setActiveTab(fromUrl ?? defaultTab)
  }, [instrumento?.id, instrumento?.tipo, searchParams, defaultTab])

  if (loading) return <LoadingSkeleton />

  if (error || !instrumento) {
    return (
      <div className="flex flex-col gap-4">
        <EmaBreadcrumb items={[{ label: 'Instrumento' }]} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <div className="text-sm font-medium text-red-700">{error ?? 'Instrumento no encontrado'}</div>
          <Button variant="outline" size="sm" className="mt-3 border-red-300 text-red-700" onClick={() => router.back()}>
            Volver
          </Button>
        </div>
      </div>
    )
  }

  const days = daysUntil(instrumento.fecha_proximo_evento)
  const isUrgent = instrumento.estado === 'vencido' || instrumento.estado === 'proximo_vencer'

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <EmaBreadcrumb items={[{ label: instrumento.nombre }]} />

      {/* ── Header Card ───────────────────────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={() => router.back()}
              className="mt-0.5 rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold tracking-tight text-stone-900">
                  {instrumento.nombre}
                </h1>
                <EmaEstadoBadge estado={instrumento.estado} />
                <EmaTipoBadge tipo={instrumento.tipo} showLabel />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Hash className="h-3 w-3 text-stone-400" />
                <span className="font-mono text-xs text-stone-500">{instrumento.codigo}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pl-9 sm:pl-0 flex-wrap">
            {instrumento.tipo !== 'C' && certificadoVigente && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-sky-200 bg-sky-50/80 text-sky-900 gap-1.5"
                onClick={() => openCertFicha(certificadoVigente)}
              >
                <ScrollText className="h-3.5 w-3.5" />
                Ver ficha del certificado vigente
              </Button>
            )}
            {isUrgent && instrumento.tipo !== 'C' && (
              <Button size="sm" className="bg-sky-700 hover:bg-sky-800 text-white gap-1.5" asChild>
                <Link href={`/quality/instrumentos/${id}/certificar`}>
                  <Award className="h-3.5 w-3.5" />
                  Registrar certificado
                </Link>
              </Button>
            )}
            {isUrgent && instrumento.tipo === 'C' && (
              <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5" asChild>
                <Link href={`/quality/instrumentos/${id}/verificar`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Registrar verificación
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="border-stone-300 text-stone-700 hover:bg-stone-50 gap-1.5"
              asChild
            >
              <Link href={`/quality/instrumentos/${id}/editar`}>
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-200 text-red-700 hover:bg-red-50 gap-1.5"
              asChild
            >
              <Link href={`/quality/instrumentos/${id}/incidente`}>
                <AlertTriangle className="h-3.5 w-3.5" />
                Incidente
              </Link>
            </Button>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 pl-9 sm:pl-0">
          <MetaField
            icon={<Building2 className="h-3.5 w-3.5" />}
            label="Planta"
            value={instrumento.plant?.name ?? '—'}
          />
          <MetaField
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="Próximo evento"
            value={formatDate(instrumento.fecha_proximo_evento)}
            valueClassName={
              instrumento.estado === 'vencido' ? 'text-red-600'
                : instrumento.estado === 'proximo_vencer' ? 'text-amber-600'
                : undefined
            }
            sub={days !== null
              ? days < 0 ? `${Math.abs(days)}d vencido` : days === 0 ? 'Hoy' : `en ${days}d`
              : undefined
            }
            subClassName={
              instrumento.estado === 'vencido' ? 'text-red-500'
                : instrumento.estado === 'proximo_vencer' ? 'text-amber-500'
                : 'text-stone-400'
            }
          />
          <MetaField
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Ventana de servicio"
            value={(() => {
              const w = instrumento.ventana_efectiva
              if (!w || w.tipo_servicio === 'ninguno' || !w.mes_inicio || !w.mes_fin) return '—'
              const m = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
              return `${m[w.mes_inicio - 1]}–${m[w.mes_fin - 1]}`
            })()}
            sub={instrumento.ventana_efectiva?.from_override ? 'Override' : undefined}
          />
          {instrumento.marca && (
            <MetaField
              icon={<Tag className="h-3.5 w-3.5" />}
              label="Marca / Modelo"
              value={[instrumento.marca, instrumento.modelo_comercial].filter(Boolean).join(' · ')}
            />
          )}
        </div>

        {instrumento.notas && (
          <div className="mt-3 rounded-md bg-stone-50 border border-stone-200 px-3 py-2 pl-9 sm:pl-3">
            <span className="text-xs text-stone-500">Notas: </span>
            <span className="text-xs text-stone-700">{instrumento.notas}</span>
          </div>
        )}
      </div>

      {/* ── Traceability Chain ─── PROMINENT ──────────────────── */}
      <TraceabilityCard
        instrumento={instrumento}
        certificadoVigente={certificadoVigente}
        onOpenVigenteFicha={certificadoVigente ? () => openCertFicha(certificadoVigente) : undefined}
      />

      {/* ── Tabbed Sections ───────────────────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            const next = v as EmaDetailTab
            setActiveTab(next)
            const nextParams = new URLSearchParams(searchParams.toString())
            if (next === defaultTab) nextParams.delete('tab')
            else nextParams.set('tab', next)
            const qs = nextParams.toString()
            router.replace(qs ? `/quality/instrumentos/${id}?${qs}` : `/quality/instrumentos/${id}`, {
              scroll: false,
            })
          }}
        >
          <div className="border-b border-stone-200 bg-stone-50/80 px-1 pt-1">
            <TabsList className="h-auto bg-transparent gap-0 p-0">
              <TabButton value="certificados" icon={<Award className="h-3.5 w-3.5" />} label="Certificados" />
              <TabButton value="verificaciones" icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Verificaciones" />
              <TabButton value="incidentes" icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Incidentes" />
              <TabButton value="trazabilidad" icon={<FlaskConical className="h-3.5 w-3.5" />} label="Trazabilidad" />
            </TabsList>
          </div>

          <TabsContent value="certificados" className="m-0">
            <CertificadosSection
              key={certListKey}
              instrumentoId={id}
              instrumentoTipo={instrumento.tipo}
              onRefresh={load}
              onOpenCertFicha={openCertFicha}
              canAttachDocument={canAttachCertDocs}
            />
          </TabsContent>
          <TabsContent value="verificaciones" className="m-0">
            <VerificacionesSection
              instrumentoId={id}
              conjuntoId={instrumento.conjunto_id ?? null}
              verificaciones={verificacionesTabData.verificaciones}
              plantillaPublicada={verificacionesTabData.plantilla}
            />
          </TabsContent>
          <TabsContent value="incidentes" className="m-0">
            <IncidentesSection instrumentoId={id} />
          </TabsContent>
          <TabsContent value="trazabilidad" className="m-0">
            <TrazabilidadSection instrumentoId={id} />
          </TabsContent>
        </Tabs>
      </div>

      {fichaCert && (
        <EmaCalibracionCertificadoSheet
          open={fichaOpen}
          onOpenChange={setFichaOpen}
          cert={fichaCert}
          instrumentoId={id}
          canAttachDocument={canAttachCertDocs}
          onDocumentUpdated={handleCertDocumentUpdated}
        />
      )}
    </div>
  )
}

// ─── MetaField ───────────────────────────────────────────────────────────────

function MetaField({
  icon, label, value, sub, mono, valueClassName, subClassName,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  mono?: boolean
  valueClassName?: string
  subClassName?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-stone-400 mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wide font-medium text-stone-400">{label}</span>
      </div>
      <div className={cn('text-sm font-medium text-stone-900', mono && 'font-mono', valueClassName)}>
        {value}
      </div>
      {sub && <div className={cn('text-[11px] font-mono', subClassName)}>{sub}</div>}
    </div>
  )
}

function TabButton({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="flex items-center gap-1.5 rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-1.5 text-xs font-medium text-stone-500 data-[state=active]:border-stone-900 data-[state=active]:text-stone-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:text-stone-700 transition-colors"
    >
      {icon}
      {label}
    </TabsTrigger>
  )
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
      <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</span>
      {action}
    </div>
  )
}

function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-sm text-stone-400">{message}</div>
  )
}

// ─── Traceability Card ───────────────────────────────────────────────────────

function TraceabilityCard({
  instrumento,
  certificadoVigente,
  onOpenVigenteFicha,
}: {
  instrumento: InstrumentoDetalle
  certificadoVigente: CertificadoCalibracionConPdf | null
  onOpenVigenteFicha?: () => void
}) {
  const tipo = instrumento.tipo

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-4 w-4 text-stone-600" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Cadena de trazabilidad EMA
        </h2>
      </div>

      <div className="flex flex-col md:flex-row items-stretch gap-3">
        {/* Node 1: External Lab */}
        {(tipo === 'A' || tipo === 'B') && (
          <>
            <TraceNode
              title="Laboratorio EMA externo"
              subtitle={certificadoVigente?.laboratorio_externo ?? 'Sin certificado vigente'}
              detail={certificadoVigente
                ? [
                    certificadoVigente.numero_certificado && `#${certificadoVigente.numero_certificado}`,
                    `Emisión: ${certificadoVigente.fecha_emision}`,
                    `Vence: ${certificadoVigente.fecha_vencimiento}`,
                  ].filter(Boolean).join(' · ')
                : undefined
              }
              status={certificadoVigente ? 'vigente' : 'vencido'}
              accent="sky"
              onActivate={onOpenVigenteFicha}
              hrefLabel={certificadoVigente && onOpenVigenteFicha ? 'Ver ficha del certificado' : undefined}
            />
            <TraceConnector />
          </>
        )}

        {/* Node 2: Pattern instruments (for Type C) */}
        {tipo === 'C' &&
          (instrumento.instrumentos_maestro ?? []).map((m) => (
            <React.Fragment key={m.id}>
              <TraceNode
                title="Instrumento patrón (Tipo A)"
                subtitle={m.nombre}
                detail={[
                  m.codigo,
                  m.incertidumbre_expandida != null
                    ? `U = ±${m.incertidumbre_expandida}${m.incertidumbre_unidad ? ` ${m.incertidumbre_unidad}` : ''}${m.incertidumbre_k != null ? ` (k=${m.incertidumbre_k})` : ''}`
                    : null,
                ].filter(Boolean).join(' · ')}
                status={m.estado === 'vigente' ? 'vigente' : 'warning'}
                accent="sky"
                href={`/quality/instrumentos/${m.id}`}
              />
              <TraceConnector />
            </React.Fragment>
          ))}

        {tipo === 'C' && (!instrumento.instrumentos_maestro || instrumento.instrumentos_maestro.length === 0) && (
          <>
            <TraceNode
              title="Instrumentos patrón (Tipo A)"
              subtitle="Sin patrones asignados"
              status="vencido"
              accent="stone"
            />
            <TraceConnector />
          </>
        )}

        {/* This instrument */}
        <TraceNode
          title={`Este instrumento (Tipo ${tipo})`}
          subtitle={instrumento.nombre}
          detail={instrumento.codigo}
          status={instrumento.estado === 'vigente' ? 'vigente' : instrumento.estado === 'proximo_vencer' ? 'warning' : 'vencido'}
          accent={tipo === 'A' ? 'sky' : tipo === 'C' ? 'stone' : 'violet'}
          isHighlighted
        />
        <TraceConnector />

        {/* Final node: Usage */}
        <TraceNode
          title="Muestreos y ensayos"
          subtitle="Uso en operación"
          detail={
            instrumento.estado === 'vigente'
              ? tipo === 'C'
                ? 'Habilitado · al guardar equipo se registra la última verificación interna cerrada (trazabilidad)'
                : 'Habilitado'
              : 'Bloqueado si vencido'
          }
          status={instrumento.estado === 'vigente' ? 'vigente' : 'warning'}
          accent="emerald"
        />
      </div>

      <div
        className="mt-4 rounded-md border border-stone-100 bg-stone-50/90 px-3 py-2.5 text-xs text-stone-700 space-y-2"
        role="region"
        aria-label="Guía de incertidumbre y verificación"
      >
        <p className="font-medium text-stone-800">Incertidumbre y cumplimiento (referencia NMX-EC-17025-IMNC)</p>
        <ul className="list-disc pl-4 space-y-1 text-stone-600 leading-relaxed">
          <li>
            <strong>U</strong> (incertidumbre expandida) y <strong>k</strong> (factor de cobertura) provienen del{' '}
            <strong>certificado del laboratorio acreditado</strong>; al registrar el certificado, la ficha del
            instrumento se sincroniza con esos valores para cálculos internos (p. ej. cociente TUR orientativo en
            verificaciones tipo C). Si el certificado da <strong>U(L)</strong> según la longitud, use un valor{' '}
            <strong>único coherente con el intervalo</strong> (p. ej. U en el extremo superior del rango), en la misma
            unidad que registre.
          </li>
          <li>
            Puede ajustar manualmente U, k y unidad en <strong>Editar</strong> (tipos A y B) si el laboratorio emite
            correcciones sin reemplazar aún el PDF en el sistema.
          </li>
          <li>
            Los cocientes <strong>TUR</strong> mostrados en verificación son <strong>indicativos</strong>: dependen de
            la tolerancia detectada en la plantilla y no sustituyen el dictamen metrológico del laboratorio.
          </li>
        </ul>
      </div>
    </section>
  )
}

function TraceNode({
  title, subtitle, detail, status, accent: _accent, isHighlighted, href, hrefExternal, hrefLabel, onActivate,
}: {
  title: string
  subtitle: string
  detail?: string
  status: 'vigente' | 'warning' | 'vencido'
  accent: 'sky' | 'emerald' | 'stone' | 'violet'
  isHighlighted?: boolean
  href?: string
  /** When true, `href` opens in a new tab (e.g. signed PDF URL). */
  hrefExternal?: boolean
  hrefLabel?: string
  onActivate?: () => void
}) {
  const statusDot = status === 'vigente'
    ? 'bg-emerald-400'
    : status === 'warning'
    ? 'bg-amber-400'
    : 'bg-red-400'

  const interactive = Boolean(href || onActivate)
  const content = (
    <div className={cn(
      'flex-1 rounded-lg border p-3 min-w-0',
      isHighlighted
        ? 'border-stone-400 bg-stone-50 ring-1 ring-stone-300'
        : 'border-stone-200 bg-white',
      interactive && 'hover:bg-stone-50 transition-colors cursor-pointer',
    )}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('h-2 w-2 rounded-full shrink-0', statusDot)} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{title}</span>
        {onActivate && <ScrollText className="h-3 w-3 text-stone-400 ml-auto" />}
        {href && !onActivate && <ExternalLink className="h-3 w-3 text-stone-400 ml-auto" />}
      </div>
      <p className="text-sm font-medium text-stone-900 truncate">{subtitle}</p>
      {detail && <p className="text-xs text-stone-500 font-mono mt-0.5 break-words">{detail}</p>}
      {interactive && hrefLabel && (
        <p className="text-[11px] text-sky-700 font-medium mt-1.5">{hrefLabel}</p>
      )}
    </div>
  )

  if (onActivate) {
    return (
      <button
        type="button"
        onClick={onActivate}
        className="flex-1 min-w-0 no-underline text-inherit text-left"
      >
        {content}
      </button>
    )
  }
  if (href && hrefExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 no-underline text-inherit">
        {content}
      </a>
    )
  }
  if (href) return <Link href={href} className="flex-1 min-w-0">{content}</Link>
  return content
}

function TraceConnector() {
  return (
    <div className="flex items-center justify-center md:w-8 shrink-0">
      {/* Horizontal on md+, vertical on mobile */}
      <div className="hidden md:block w-full border-t-2 border-dashed border-stone-300" />
      <div className="md:hidden h-6 border-l-2 border-dashed border-stone-300" />
    </div>
  )
}

// ─── Certificados Section ────────────────────────────────────────────────────

function CertificadosSection({
  instrumentoId,
  instrumentoTipo,
  onRefresh,
  onOpenCertFicha,
  canAttachDocument = false,
}: {
  instrumentoId: string
  instrumentoTipo: string
  onRefresh: () => void | Promise<void>
  onOpenCertFicha: (c: CertificadoCalibracionConPdf) => void
  canAttachDocument?: boolean
}) {
  const [certs, setCerts] = useState<CertificadoCalibracionConPdf[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [syncingUncertainty, setSyncingUncertainty] = useState(false)
  const [listError, setListError] = useState<string | null>(null)

  const loadCerts = useCallback(async () => {
    setListError(null)
    const res = await fetch(`/api/ema/instrumentos/${instrumentoId}/certificados`)
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      setListError((j as { error?: string }).error ?? 'No se pudieron cargar los certificados')
      setCerts([])
      return
    }
    setCerts((j as { data?: CertificadoCalibracionConPdf[] }).data ?? [])
  }, [instrumentoId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadCerts().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [loadCerts])

  const handleRefreshList = async () => {
    setRefreshing(true)
    try {
      await loadCerts()
      await onRefresh()
    } finally {
      setRefreshing(false)
    }
  }

  const handleSyncUncertaintyFromCert = async () => {
    setSyncingUncertainty(true)
    setListError(null)
    try {
      const res = await fetch(`/api/ema/instrumentos/${instrumentoId}/sync-uncertainty-from-cert`, {
        method: 'POST',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setListError((j as { error?: string }).error ?? 'No se pudo sincronizar U/k desde el certificado vigente')
        return
      }
      await loadCerts()
      await onRefresh()
    } finally {
      setSyncingUncertainty(false)
    }
  }

  const usesExternalCert = instrumentoTipo === 'A' || instrumentoTipo === 'B'
  const hasVigenteCert = certs.some((c) => c.is_vigente)

  if (loading) return <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Cargando…</div>

  return (
    <div>
      <SectionHeader
        title="Certificados de calibración"
        action={
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-stone-500 gap-1 text-xs"
              onClick={handleRefreshList}
              disabled={refreshing}
              title="Actualizar lista y resumen superior"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
              Actualizar
            </Button>
            {usesExternalCert && canAttachDocument && hasVigenteCert && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 border-stone-300 text-stone-700 gap-1 text-xs"
                onClick={handleSyncUncertaintyFromCert}
                disabled={syncingUncertainty || refreshing}
                title="Copia U, k y unidad del certificado vigente a la ficha del instrumento"
              >
                <RefreshCw className={cn('h-3 w-3', syncingUncertainty && 'animate-spin')} />
                Sincronizar U/k
              </Button>
            )}
            {usesExternalCert && (
              <Button size="sm" variant="outline" className="h-7 border-stone-300 text-stone-700 gap-1 text-xs" asChild>
                <Link href={`/quality/instrumentos/${instrumentoId}/certificar`}>
                  <Plus className="h-3 w-3" /> Añadir documentación
                </Link>
              </Button>
            )}
          </div>
        }
      />
      {!usesExternalCert && (
        <div className="mx-4 my-3 rounded-lg border border-stone-200 bg-stone-50/90 px-3 py-2 text-xs text-stone-600">
          Los instrumentos <strong>Tipo C</strong> se sustentan con <strong>verificaciones internas</strong> frente a un patrón Tipo A. Esta pestaña solo aplica si hubo registros históricos de certificado externo.
        </div>
      )}
      {listError && (
        <div className="mx-4 my-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs text-red-800 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{listError}</span>
        </div>
      )}
      {certs.length === 0 ? (
        <div className="px-4 pb-6">
          <EmptyTabState message="Sin certificados registrados" />
          {usesExternalCert && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-stone-500 text-center max-w-md">
                Suba el PDF emitido por el laboratorio acreditado y complete los datos metrológicos para cerrar la trazabilidad EMA.
              </p>
              <Button size="sm" className="bg-sky-700 text-white hover:bg-sky-800 gap-1.5" asChild>
                <Link href={`/quality/instrumentos/${instrumentoId}/certificar`}>
                  <Award className="h-3.5 w-3.5" />
                  Registrar certificado y PDF
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-stone-100">
          {certs.map((c) => {
            const hasStorageKey = Boolean(c.archivo_path?.trim())
            const canOpenPdf = Boolean(c.pdf_url)
            return (
              <div
                key={c.id}
                className={cn(
                  'flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:gap-3',
                  c.is_vigente && 'bg-emerald-50/40',
                )}
              >
                <div className="flex flex-1 gap-3 min-w-0">
                  <div className={cn(
                    'mt-1.5 h-2 w-2 rounded-full shrink-0',
                    c.is_vigente ? 'bg-emerald-500' : 'bg-stone-300',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-stone-900">{c.laboratorio_externo}</span>
                      {c.is_vigente && (
                        <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          Vigente
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-xs text-stone-500 mt-0.5">
                      {c.numero_certificado && `#${c.numero_certificado} · `}
                      Emitido: {c.fecha_emision} · Vence: {c.fecha_vencimiento}
                    </div>
                    {c.acreditacion_laboratorio && (
                      <p className="text-[11px] text-stone-600 mt-0.5">
                        Acreditación: <span className="font-mono">{c.acreditacion_laboratorio}</span>
                      </p>
                    )}
                    {c.archivo_nombre_original && (
                      <p className="text-xs text-stone-600 mt-0.5 truncate" title={c.archivo_nombre_original}>
                        Archivo: {c.archivo_nombre_original}
                      </p>
                    )}
                    {c.observaciones && (
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{c.observaciones}</p>
                    )}
                    {!hasStorageKey && (
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-xs text-amber-900">
                        <FileWarning className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          {canAttachDocument
                            ? 'Sin ruta de PDF en el registro. Use «Subir / reemplazar PDF» a la derecha o en la ficha, o «Añadir documentación» para un certificado totalmente nuevo.'
                            : 'Este registro no tiene PDF en almacén. Use Añadir documentación para registrar un certificado nuevo (el historial se conserva).'}
                        </span>
                      </div>
                    )}
                    {hasStorageKey && !canOpenPdf && (
                      <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-xs text-amber-900">
                        <FileWarning className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          No se pudo generar el enlace de descarga (permisos de almacén o archivo faltante). Pulse <strong>Actualizar</strong> o contacte a administración.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-row flex-wrap sm:flex-col items-stretch sm:items-end justify-end gap-1.5 shrink-0 pl-5 sm:pl-0">
                  {canAttachDocument && (
                    <EmaCalibracionCertificadoAttachBlock
                      compact
                      instrumentoId={instrumentoId}
                      certId={c.id}
                      onSuccess={async () => {
                        await loadCerts()
                        await onRefresh()
                      }}
                      className="w-full sm:w-auto sm:max-w-[200px]"
                    />
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 border-sky-200/80 text-sky-900 gap-1 px-2 text-xs"
                    onClick={() => onOpenCertFicha(c)}
                  >
                    <ScrollText className="h-3 w-3" /> Ver ficha
                  </Button>
                  {canOpenPdf && (
                    <Button size="sm" variant="outline" className="h-7 border-sky-200 bg-sky-50/80 text-sky-900 gap-1 px-2 text-xs" asChild>
                      <a href={c.pdf_url!} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" /> PDF
                      </a>
                    </Button>
                  )}
                  {usesExternalCert && (
                    <Button size="sm" variant="outline" className="h-7 border-stone-300 text-stone-700 gap-1 px-2 text-xs" asChild>
                      <Link href={`/quality/instrumentos/${instrumentoId}/certificar`}>
                        <Plus className="h-3 w-3" /> Nuevo PDF
                      </Link>
                    </Button>
                  )}
                  <span className="font-mono text-xs text-stone-400 self-center sm:self-end">{timeAgo(c.created_at)}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Verificaciones Section ──────────────────────────────────────────────────

function VerificacionesSection({
  instrumentoId,
  conjuntoId,
  verificaciones,
  plantillaPublicada,
}: {
  instrumentoId: string
  conjuntoId: string | null
  verificaciones: CompletedVerificacionCard[]
  plantillaPublicada: PublishedPlantillaSummary | null
}) {
  const verifs = verificaciones
  const template = plantillaPublicada

  const resultadoStyle = (r: string) =>
    r === 'conforme' ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : r === 'no_conforme' ? 'bg-red-100 text-red-800 border-red-200'
      : r === 'condicional' ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-stone-100 text-stone-600 border-stone-200'

  const resultadoLabel = (r: string) =>
    r === 'conforme' ? 'Conforme'
      : r === 'no_conforme' ? 'No conforme'
      : r === 'condicional' ? 'Condicional'
      : 'Pendiente'

  const estadoLabel = (e: string) =>
    e === 'cerrado' ? 'Cerrada'
      : e === 'firmado_revisor' ? 'Firmada (revisor)'
      : e === 'firmado_operador' ? 'Firmada (operador)'
      : e === 'cancelado' ? 'Cancelada'
      : 'En proceso'

  const canStart = !!(template?.active_version_id)

  return (
    <div>
      <SectionHeader
        title="Verificaciones internas"
        action={
          canStart ? (
            <Button size="sm" variant="outline" className="h-7 border-stone-300 text-stone-700 gap-1 text-xs" asChild>
              <Link href={`/quality/instrumentos/${instrumentoId}/verificar`}>
                <Plus className="h-3 w-3" /> Iniciar verificación
              </Link>
            </Button>
          ) : conjuntoId ? (
            <Button size="sm" variant="outline" className="h-7 border-amber-200 text-amber-700 hover:bg-amber-50 gap-1 text-xs" asChild>
              <Link href={`/quality/conjuntos/${conjuntoId}/plantilla`}>
                <FileSignature className="h-3 w-3" /> Configurar plantilla
              </Link>
            </Button>
          ) : null
        }
      />
      {!canStart && (
        <div className="mx-4 my-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800">
            Este conjunto no tiene una plantilla de verificación publicada. Para ejecutar verificaciones bajo NMX-EC-17025 es necesario publicar una versión activa.
          </span>
        </div>
      )}
      {verifs.some((v) => v.estado === 'en_proceso') && (
        <div className="mx-4 my-3 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs text-sky-900">
          Hay una verificación <strong>en proceso</strong>. El instrumento sigue en <strong>vigente</strong> hasta que cierre el flujo (último paso) y se registre la próxima fecha; entonces se actualizan <strong>fecha próximo evento</strong> y el estado.
        </div>
      )}
      {verifs.length === 0 ? (
        <EmptyTabState message="Sin verificaciones registradas" />
      ) : (
        <div className="divide-y divide-stone-100">
          {verifs.map(v => (
            <Link
              key={v.id}
              href={`/quality/instrumentos/${instrumentoId}/verificaciones/${v.id}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-stone-50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-medium text-stone-900">{v.fecha_verificacion}</span>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', resultadoStyle(v.resultado))}>
                    {resultadoLabel(v.resultado)}
                  </span>
                  <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] text-stone-600">
                    {estadoLabel(v.estado)}
                  </span>
                </div>
                <div className="font-mono text-xs text-stone-500 mt-0.5">
                  {v.template_codigo}
                  {v.template_version_number != null && <> · v{v.template_version_number}</>}
                  {v.fecha_proxima_verificacion && <> · Próxima: {v.fecha_proxima_verificacion}</>}
                </div>
                {v.created_by_name && (
                  <div className="text-xs text-stone-400 mt-0.5">Por {v.created_by_name}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs text-stone-400">{timeAgo(v.created_at)}</span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Incidentes Section ──────────────────────────────────────────────────────

const SEVERIDAD_STYLE: Record<string, string> = {
  baja: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  media: 'bg-amber-100 text-amber-800 border-amber-200',
  alta: 'bg-orange-100 text-orange-800 border-orange-200',
  critica: 'bg-red-100 text-red-800 border-red-200',
}

const TIPO_INCIDENTE_LABEL: Record<string, string> = {
  dano_fisico: 'Daño físico',
  perdida: 'Pérdida',
  mal_funcionamiento: 'Mal funcionamiento',
  desviacion_lectura: 'Desviación de lectura',
  otro: 'Otro',
}

function IncidentesSection({ instrumentoId }: { instrumentoId: string }) {
  const [incidentes, setIncidentes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/ema/instrumentos/${instrumentoId}/incidentes`)
      .then(r => r.json())
      .then(j => { setIncidentes(j.data ?? []); setLoading(false) })
  }, [instrumentoId])

  if (loading) return <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Cargando…</div>

  const abiertos = incidentes.filter(i => i.estado === 'abierto' || i.estado === 'en_revision')

  return (
    <div>
      <SectionHeader
        title="Incidentes"
        action={
          <Button size="sm" variant="outline" className="h-7 border-red-200 text-red-700 hover:bg-red-50 gap-1 text-xs" asChild>
            <Link href={`/quality/instrumentos/${instrumentoId}/incidente`}>
              <AlertTriangle className="h-3 w-3" /> Reportar
            </Link>
          </Button>
        }
      />
      {abiertos.length > 0 && (
        <div className="mx-4 my-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-800">
            {abiertos.length} incidente{abiertos.length > 1 ? 's' : ''} sin resolver
          </span>
        </div>
      )}
      {incidentes.length === 0 ? (
        <EmptyTabState message="Sin incidentes reportados" />
      ) : (
        <div className="divide-y divide-stone-100">
          {incidentes.map((i: any) => (
            <div key={i.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', SEVERIDAD_STYLE[i.severidad] ?? 'bg-stone-100 text-stone-700')}>
                    {i.severidad}
                  </span>
                  <span className="text-sm font-medium text-stone-900">
                    {TIPO_INCIDENTE_LABEL[i.tipo] ?? i.tipo}
                  </span>
                  {(i.estado === 'resuelto' || i.estado === 'cerrado') ? (
                    <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] text-stone-500">{i.estado}</span>
                  ) : (
                    <span className="rounded-full bg-orange-100 border border-orange-200 px-2 py-0.5 text-[10px] text-orange-700">{i.estado}</span>
                  )}
                </div>
                <p className="text-xs text-stone-600 mt-0.5">{i.descripcion}</p>
                <span className="font-mono text-[11px] text-stone-400">{i.fecha_incidente}</span>
              </div>
              <span className="shrink-0 font-mono text-xs text-stone-400">{timeAgo(i.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Trazabilidad Section ────────────────────────────────────────────────────

function estadoSnapshotPillClass(estado: string) {
  return estado === 'vigente'
    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
    : estado === 'proximo_vencer'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : 'bg-red-100 text-red-800 border-red-200'
}

function TrazabilidadSection({ instrumentoId }: { instrumentoId: string }) {
  const [data, setData] = useState<InstrumentoTrazabilidad | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ema/instrumentos/${instrumentoId}/muestreos`)
      .then(async r => {
        const j = await r.json()
        if (!r.ok) throw new Error(j.error ?? 'Error al cargar trazabilidad')
        return j.data ?? j
      })
      .then((payload: InstrumentoTrazabilidad) => {
        if (!cancelled) setData(payload)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [instrumentoId])

  if (loading) return <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Cargando…</div>

  if (!data) {
    return (
      <div>
        <SectionHeader title="Uso en muestreos y ensayos" />
        <EmptyTabState message="No se pudo cargar la trazabilidad. Intenta de nuevo." />
      </div>
    )
  }

  const muestreos = data.muestreos ?? []
  const ensayos = data.ensayos ?? []
  const muestreosCount = data.muestreos_count ?? 0
  const ensayosCount = data.ensayos_count ?? 0

  return (
    <div>
      <SectionHeader title="Uso en muestreos y ensayos" />
      <div className="grid grid-cols-2 divide-x divide-stone-100 border-b border-stone-100">
        <div className="p-4 text-center">
          <div className="text-2xl font-semibold tabular-nums text-stone-900">{muestreosCount}</div>
          <div className="text-xs text-stone-500 mt-0.5">Muestreos</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-2xl font-semibold tabular-nums text-stone-900">{ensayosCount}</div>
          <div className="text-xs text-stone-500 mt-0.5">Ensayos</div>
        </div>
      </div>
      {muestreosCount === 0 && ensayosCount === 0 ? (
        <EmptyTabState message="Sin uso registrado en muestreos o ensayos" />
      ) : (
        <div className="divide-y divide-stone-100">
          {muestreos.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-stone-50/80 border-b border-stone-100">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  Últimos muestreos (hasta 10)
                </span>
              </div>
              {muestreos.map(m => (
                <Link
                  key={m.id}
                  href={`/quality/muestreos/${m.muestreo_id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FlaskConical className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                    <span className="font-mono text-xs text-stone-700 truncate">
                      {m.fecha_muestreo ?? m.muestreo_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      estadoSnapshotPillClass(m.estado_al_momento),
                    )}>
                      {m.estado_al_momento}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500" />
                  </div>
                </Link>
              ))}
            </div>
          )}
          {ensayos.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-stone-50/80 border-b border-stone-100">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                  Últimos ensayos (hasta 10)
                </span>
              </div>
              {ensayos.map(e => (
                <Link
                  key={e.id}
                  href={`/quality/ensayos/${e.ensayo_id}`}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TestTube2 className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                    <span className="font-mono text-xs text-stone-700 truncate">
                      {e.fecha_ensayo ?? e.ensayo_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      'rounded-full border px-2 py-0.5 text-[10px] font-medium',
                      estadoSnapshotPillClass(e.estado_al_momento),
                    )}>
                      {e.estado_al_momento}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-stone-300 group-hover:text-stone-500" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ─── Loading skeleton ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-4 w-48 bg-stone-200 rounded animate-pulse" />
      <div className="rounded-lg border border-stone-200 bg-white p-5 animate-pulse space-y-3">
        <div className="h-6 w-64 bg-stone-200 rounded" />
        <div className="h-4 w-32 bg-stone-100 rounded" />
        <div className="grid grid-cols-4 gap-4 mt-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="space-y-1">
              <div className="h-2.5 w-16 bg-stone-100 rounded" />
              <div className="h-4 w-24 bg-stone-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
