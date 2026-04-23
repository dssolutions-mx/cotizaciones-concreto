'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  Trash2,
} from 'lucide-react'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { EMA_CATALOG_DELETE_ROLES } from '@/lib/ema/catalogDeleteRoles'
import type { InstrumentoDetalle, InstrumentoTrazabilidad, CompletedVerificacionCard, EmaDeleteBlocker } from '@/types/ema'

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

export default function InstrumentoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { hasRole } = useAuthSelectors()

  const [instrumento, setInstrumento] = useState<InstrumentoDetalle | null>(null)
  const [certificadoVigente, setCertificadoVigente] = useState<{
    laboratorio_externo: string
    fecha_vencimiento: string
    fecha_emision: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
  const [deleteBlockers, setDeleteBlockers] = useState<EmaDeleteBlocker[]>([])
  const [deleteConfirmCodigo, setDeleteConfirmCodigo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ema/instrumentos/${id}`)
      if (!res.ok) throw new Error('Instrumento no encontrado')
      const j = await res.json()
      const inst: InstrumentoDetalle = j.data ?? j
      setInstrumento(inst)

      const certRes = await fetch(`/api/ema/instrumentos/${id}/certificados?limit=1&vigente=true`)
      if (certRes.ok) {
        const certJ = await certRes.json()
        const certs = certJ.data ?? []
        if (certs.length > 0) {
          setCertificadoVigente({
            laboratorio_externo: certs[0].laboratorio_externo,
            fecha_vencimiento: certs[0].fecha_vencimiento,
            fecha_emision: certs[0].fecha_emision,
          })
        }
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

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
  const defaultTab = instrumento.tipo === 'C' ? 'verificaciones' : 'certificados'

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
          <div className="flex items-center gap-2 pl-9 sm:pl-0">
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
      <TraceabilityCard instrumento={instrumento} certificadoVigente={certificadoVigente} />

      {/* ── Tabbed Sections ───────────────────────────────────── */}
      <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
        <Tabs defaultValue={defaultTab}>
          <div className="border-b border-stone-200 bg-stone-50/80 px-1 pt-1">
            <TabsList className="h-auto bg-transparent gap-0 p-0">
              <TabButton value="certificados" icon={<Award className="h-3.5 w-3.5" />} label="Certificados" />
              <TabButton value="verificaciones" icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Verificaciones" />
              <TabButton value="incidentes" icon={<AlertTriangle className="h-3.5 w-3.5" />} label="Incidentes" />
              <TabButton value="trazabilidad" icon={<FlaskConical className="h-3.5 w-3.5" />} label="Trazabilidad" />
            </TabsList>
          </div>

          <TabsContent value="certificados" className="m-0">
            <CertificadosSection instrumentoId={id} />
          </TabsContent>
          <TabsContent value="verificaciones" className="m-0">
            <VerificacionesSection instrumentoId={id} conjuntoId={instrumento.conjunto_id ?? null} />
          </TabsContent>
          <TabsContent value="incidentes" className="m-0">
            <IncidentesSection instrumentoId={id} />
          </TabsContent>
          <TabsContent value="trazabilidad" className="m-0">
            <TrazabilidadSection instrumentoId={id} />
          </TabsContent>
        </Tabs>
      </div>

      {hasRole(EMA_CATALOG_DELETE_ROLES) && (
        <div className="rounded-lg border border-red-200 bg-red-50/40 p-4 md:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-red-900">Zona de peligro</h2>
              <p className="text-xs text-red-800/90 mt-1 max-w-xl">
                Eliminar quita el instrumento del catálogo. Si ya hay trazabilidad (verificaciones, muestreos, certificados, etc.),
                el sistema no permitirá el borrado; en ese caso use <span className="font-medium">Inactivar</span> desde editar.
              </p>
            </div>
            <AlertDialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open)
                if (!open) {
                  setDeleteErr(null)
                  setDeleteBlockers([])
                  setDeleteConfirmCodigo('')
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-800 hover:bg-red-100 shrink-0 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar del catálogo
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-stone-200">
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminar instrumento</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 text-sm text-stone-600">
                      <p>
                        ¿Confirma eliminar <span className="font-mono font-medium text-stone-900">{instrumento.codigo}</span>
                        {' — '}
                        <span className="font-medium text-stone-900">{instrumento.nombre}</span>?
                      </p>
                      <p className="text-xs text-stone-500">
                        Escriba el código exacto para confirmar.
                      </p>
                      <Input
                        value={deleteConfirmCodigo}
                        onChange={(e) => setDeleteConfirmCodigo(e.target.value)}
                        placeholder={instrumento.codigo}
                        className="font-mono text-sm"
                        autoComplete="off"
                      />
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
                    disabled={deleteBusy || deleteConfirmCodigo.trim() !== instrumento.codigo}
                    className="bg-red-700 hover:bg-red-800 focus:ring-red-700"
                    onClick={async (e) => {
                      e.preventDefault()
                      setDeleteBusy(true)
                      setDeleteErr(null)
                      setDeleteBlockers([])
                      try {
                        const res = await fetch(`/api/ema/instrumentos/${id}`, { method: 'DELETE' })
                        const j = await res.json().catch(() => ({}))
                        if (res.status === 409 && Array.isArray(j.blockers)) {
                          setDeleteBlockers(j.blockers)
                          setDeleteErr(j.error ?? 'No se puede eliminar.')
                          return
                        }
                        if (!res.ok) throw new Error(j.error ?? 'Error al eliminar')
                        setDeleteOpen(false)
                        router.push('/quality/instrumentos/catalogo')
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
          </div>
        </div>
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
}: {
  instrumento: InstrumentoDetalle
  certificadoVigente: { laboratorio_externo: string; fecha_vencimiento: string; fecha_emision: string } | null
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
                ? `Vence: ${certificadoVigente.fecha_vencimiento}`
                : undefined
              }
              status={certificadoVigente ? 'vigente' : 'vencido'}
              accent="sky"
            />
            <TraceConnector />
          </>
        )}

        {/* Node 2: Master instrument (for Type C) */}
        {tipo === 'C' && instrumento.instrumento_maestro && (
          <>
            <TraceNode
              title="Instrumento maestro (Tipo A)"
              subtitle={instrumento.instrumento_maestro.nombre}
              detail={instrumento.instrumento_maestro.codigo}
              status={instrumento.instrumento_maestro.estado === 'vigente' ? 'vigente' : 'warning'}
              accent="sky"
              href={`/quality/instrumentos/${instrumento.instrumento_maestro.id}`}
            />
            <TraceConnector />
          </>
        )}

        {tipo === 'C' && !instrumento.instrumento_maestro && (
          <>
            <TraceNode
              title="Instrumento maestro (Tipo A)"
              subtitle="Sin maestro asignado"
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
          detail={instrumento.estado === 'vigente' ? 'Habilitado' : 'Bloqueado si vencido'}
          status={instrumento.estado === 'vigente' ? 'vigente' : 'warning'}
          accent="emerald"
        />
      </div>
    </section>
  )
}

function TraceNode({
  title, subtitle, detail, status, accent, isHighlighted, href,
}: {
  title: string
  subtitle: string
  detail?: string
  status: 'vigente' | 'warning' | 'vencido'
  accent: 'sky' | 'emerald' | 'stone' | 'violet'
  isHighlighted?: boolean
  href?: string
}) {
  const statusDot = status === 'vigente'
    ? 'bg-emerald-400'
    : status === 'warning'
    ? 'bg-amber-400'
    : 'bg-red-400'

  const content = (
    <div className={cn(
      'flex-1 rounded-lg border p-3 min-w-0',
      isHighlighted
        ? 'border-stone-400 bg-stone-50 ring-1 ring-stone-300'
        : 'border-stone-200 bg-white',
      href && 'hover:bg-stone-50 transition-colors cursor-pointer',
    )}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('h-2 w-2 rounded-full shrink-0', statusDot)} />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{title}</span>
        {href && <ExternalLink className="h-3 w-3 text-stone-400 ml-auto" />}
      </div>
      <p className="text-sm font-medium text-stone-900 truncate">{subtitle}</p>
      {detail && <p className="text-xs text-stone-500 font-mono mt-0.5">{detail}</p>}
    </div>
  )

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

function CertificadosSection({ instrumentoId }: { instrumentoId: string }) {
  const [certs, setCerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/ema/instrumentos/${instrumentoId}/certificados`)
      .then(r => r.json())
      .then(j => { setCerts(j.data ?? []); setLoading(false) })
  }, [instrumentoId])

  if (loading) return <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Cargando…</div>

  return (
    <div>
      <SectionHeader
        title="Certificados de calibración"
        action={
          <Button size="sm" variant="outline" className="h-7 border-stone-300 text-stone-700 gap-1 text-xs" asChild>
            <Link href={`/quality/instrumentos/${instrumentoId}/certificar`}>
              <Plus className="h-3 w-3" /> Registrar
            </Link>
          </Button>
        }
      />
      {certs.length === 0 ? (
        <EmptyTabState message="Sin certificados registrados" />
      ) : (
        <div className="divide-y divide-stone-100">
          {certs.map((c: any) => (
            <div key={c.id} className={cn('flex items-start gap-3 px-4 py-3', c.is_vigente && 'bg-emerald-50/40')}>
              <div className={cn(
                'mt-0.5 h-2 w-2 rounded-full shrink-0',
                c.is_vigente ? 'bg-emerald-500' : 'bg-stone-300'
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
                {c.observaciones && <p className="text-xs text-stone-500 mt-0.5">{c.observaciones}</p>}
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {c.pdf_url ? (
                  <Button size="sm" variant="outline" className="h-7 border-stone-300 text-stone-800 gap-1 px-2 text-xs" asChild>
                    <a href={c.pdf_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" /> Ver PDF
                    </a>
                  </Button>
                ) : null}
                <span className="font-mono text-xs text-stone-400">{timeAgo(c.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Verificaciones Section ──────────────────────────────────────────────────

function VerificacionesSection({
  instrumentoId,
  conjuntoId,
}: { instrumentoId: string; conjuntoId: string | null }) {
  const [verifs, setVerifs] = useState<CompletedVerificacionCard[]>([])
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState<{
    id: string
    codigo: string
    nombre: string
    active_version_id: string | null
    active_version_number: number | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/ema/instrumentos/${instrumentoId}/verificaciones`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error((j as { error?: string }).error ?? 'Error cargando verificaciones')
        if (!cancelled) setVerifs((j as { data?: CompletedVerificacionCard[] }).data ?? [])
      })
      .catch(() => {
        if (!cancelled) setVerifs([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [instrumentoId])

  useEffect(() => {
    if (!conjuntoId) {
      setTemplate(null)
      return
    }
    let cancelled = false
    fetch(`/api/ema/conjuntos/${conjuntoId}/templates`)
      .then(async (r) => {
        if (!r.ok) return null
        return r.json() as Promise<{ data?: unknown }>
      })
      .then((j) => {
        if (cancelled || !j) {
          if (!cancelled && !j) setTemplate(null)
          return
        }
        // API returns an array of templates; pick published + active version (same logic as /verificar page).
        const raw = j.data
        const list: unknown[] = Array.isArray(raw) ? raw : raw != null ? [raw] : []
        const publicadas = (list as Record<string, unknown>[]).filter(
          (t) => t.estado === 'publicado' && typeof t.active_version_id === 'string' && t.active_version_id,
        )
        if (publicadas.length === 0) {
          if (!cancelled) setTemplate(null)
          return
        }
        const t = publicadas[0] as {
          id: string
          codigo: string
          nombre: string
          active_version_id: string
          active_version?: { version_number?: number }
        }
        if (!cancelled) {
          setTemplate({
            id: t.id,
            codigo: t.codigo,
            nombre: t.nombre,
            active_version_id: t.active_version_id,
            active_version_number: t.active_version?.version_number ?? null,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setTemplate(null)
      })
    return () => {
      cancelled = true
    }
  }, [conjuntoId])

  if (loading) return <div className="py-10 text-center text-sm text-stone-400 animate-pulse">Cargando…</div>

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
