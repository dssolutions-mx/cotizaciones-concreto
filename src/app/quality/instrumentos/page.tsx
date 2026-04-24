'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronRight,
  Calendar,
  BookOpen,
  Package,
  Wrench,
  Shield,
  Clock,
  XCircle,
  RefreshCw,
  Table2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { EmaEstadoBadge } from '@/components/ema/EmaEstadoBadge'
import { EmaTipoBadge } from '@/components/ema/EmaTipoBadge'
import { cn } from '@/lib/utils'
import type { InstrumentoCard, EstadoInstrumento } from '@/types/ema'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardData {
  stats: Record<EstadoInstrumento | 'total', number>
  urgent_items: InstrumentoCard[]
  recent_activity: Array<{
    type: string
    instrumento: { id: string; codigo: string; nombre: string }
    descripcion: string
    fecha: string
  }>
  programa_proximos: Array<{
    id: string
    instrumento_id: string
    tipo_evento: string
    fecha_programada: string
    estado: string
    instrumento?: InstrumentoCard
  }>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(dateStr).getTime() - today.getTime()) / 86_400_000)
}

function daysLabel(days: number | null): string {
  if (days === null) return '—'
  if (days < 0) return `${Math.abs(days)}d vencido`
  if (days === 0) return 'Hoy'
  return `en ${days}d`
}

function tipoEventoLabel(tipo: string): string {
  switch (tipo) {
    case 'calibracion_externa': return 'Calibración externa EMA'
    case 'verificacion_interna': return 'Verificación interna'
    case 'verificacion_post_incidente': return 'Post-incidente'
    default: return tipo
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EmaHubPage() {
  const { currentPlant } = usePlantContext()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (currentPlant?.id) params.set('plant_id', currentPlant.id)
      const res = await fetch(`/api/ema/dashboard?${params}`)
      if (!res.ok) throw new Error('No se pudo cargar el panel EMA')
      setData(await res.json())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  // Split urgent items by action type
  const needsCertification = useMemo(() =>
    (data?.urgent_items ?? []).filter(i => i.tipo === 'A' || i.tipo === 'B'),
    [data]
  )
  const needsVerification = useMemo(() =>
    (data?.urgent_items ?? []).filter(i => i.tipo === 'C'),
    [data]
  )

  // Audit readiness
  const auditReadiness = useMemo(() => {
    if (!data) return null
    const active = data.stats.total - data.stats.inactivo
    if (active === 0) return null
    const vigente = data.stats.vigente
    return Math.round((vigente / active) * 100)
  }, [data])

  return (
    <div className="space-y-5">
      <EmaBreadcrumb items={[]} />

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-stone-900">
            Centro EMA — Trazabilidad de Instrumentos
          </h1>
          {currentPlant && (
            <p className="text-sm text-stone-500 mt-0.5">{currentPlant.name}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-stone-300 text-stone-600 gap-1.5 self-start"
          onClick={fetchDashboard}
          disabled={loading}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      {/* ── Error ───────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-700 shrink-0" />
          <p className="text-sm text-red-900">{error}</p>
        </div>
      )}

      {/* ── Traceability Status ─── THE HERO SECTION ────────────── */}
      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-stone-700" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600">
            Estado de trazabilidad EMA
          </h2>
          {auditReadiness !== null && (
            <span className={cn(
              'ml-auto rounded-full border px-3 py-0.5 text-xs font-medium',
              auditReadiness >= 90
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : auditReadiness >= 70
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-red-200 bg-red-50 text-red-700'
            )}>
              {auditReadiness}% preparación auditoría
            </span>
          )}
        </div>

        {loading && !data ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-[72px] rounded-lg bg-stone-100 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatusCounter
                label="Vigentes"
                count={data.stats.vigente}
                color="emerald"
                icon={<CheckCircle2 className="h-4 w-4" />}
                href="/quality/instrumentos/catalogo?estado=vigente"
              />
              <StatusCounter
                label="Por vencer"
                count={data.stats.proximo_vencer}
                color="amber"
                icon={<Clock className="h-4 w-4" />}
                href="/quality/instrumentos/catalogo?estado=proximo_vencer"
              />
              <StatusCounter
                label="Vencidos"
                count={data.stats.vencido}
                color="red"
                icon={<AlertTriangle className="h-4 w-4" />}
                href="/quality/instrumentos/catalogo?estado=vencido"
              />
              <StatusCounter
                label="En revisión"
                count={data.stats.en_revision}
                color="sky"
                icon={<RefreshCw className="h-4 w-4" />}
                href="/quality/instrumentos/catalogo?estado=en_revision"
              />
              <StatusCounter
                label="Total activos"
                count={data.stats.total - data.stats.inactivo}
                color="stone"
                icon={<Wrench className="h-4 w-4" />}
                href="/quality/instrumentos/catalogo"
              />
            </div>

            {/* Audit readiness bar */}
            {auditReadiness !== null && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-stone-500 mb-1.5">
                  <span>Preparación para auditoría EMA</span>
                  <span className="font-mono">{data.stats.vigente}/{data.stats.total - data.stats.inactivo} vigentes</span>
                </div>
                <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      auditReadiness >= 90 ? 'bg-emerald-500' : auditReadiness >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${auditReadiness}%` }}
                  />
                </div>
              </div>
            )}

            {/* Vencidos warning */}
            {data.stats.vencido > 0 && (
              <div className="mt-4 rounded-lg border-2 border-red-300 bg-red-50/60 p-3 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900">
                    Hay {data.stats.vencido} instrumento{data.stats.vencido > 1 ? 's' : ''} vencido{data.stats.vencido > 1 ? 's' : ''} que afecta{data.stats.vencido > 1 ? 'n' : ''} la acreditación EMA
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    Los instrumentos vencidos no pueden usarse en muestreos ni ensayos hasta ser recalibrados o verificados.
                  </p>
                </div>
              </div>
            )}
          </>
        ) : null}
      </section>

      {/* ── Requieren Certificación (Type A/B) ──────────────────── */}
      {needsCertification.length > 0 && (
        <ActionSection
          title="Instrumentos que requieren certificación externa"
          subtitle="Los certificados deben emitirse por laboratorios acreditados por EMA"
          icon={<Award className="h-4 w-4 text-sky-600" />}
          borderColor="border-sky-200"
          items={needsCertification}
          actionLabel="Registrar certificado"
          actionPath="certificar"
        />
      )}

      {/* ── Requieren Verificación (Type C) ─────────────────────── */}
      {needsVerification.length > 0 && (
        <ActionSection
          title="Instrumentos que requieren verificación interna"
          subtitle="La verificación interna se realiza contra el instrumento maestro (Tipo A) calibrado"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          borderColor="border-emerald-200"
          items={needsVerification}
          actionLabel="Registrar verificación"
          actionPath="verificar"
        />
      )}

      {/* ── Programa Próximo ────────────────────────────────────── */}
      {data && data.programa_proximos.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/90 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-700" />
              <h2 className="text-sm font-semibold text-amber-900">
                Próximos 7 días — {data.programa_proximos.length} evento{data.programa_proximos.length > 1 ? 's' : ''}
              </h2>
            </div>
            <Link
              href="/quality/instrumentos/programa"
              className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1"
            >
              Ver programa completo <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-amber-100">
            {data.programa_proximos.slice(0, 5).map(entry => (
              <Link
                key={entry.id}
                href={`/quality/instrumentos/${entry.instrumento_id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-amber-100/60 transition-colors"
              >
                <div className="text-center min-w-[40px]">
                  <p className="text-lg font-bold tabular-nums text-stone-800">
                    {entry.fecha_programada.split('-')[2]}
                  </p>
                  <p className="text-[10px] text-stone-500 uppercase">
                    {new Date(entry.fecha_programada + 'T12:00:00').toLocaleDateString('es-MX', { month: 'short' })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">
                    {entry.instrumento?.nombre ?? entry.instrumento_id}
                  </p>
                  <p className="text-xs text-stone-500">{tipoEventoLabel(entry.tipo_evento)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Navigation Grid ─────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 mb-3">
          Módulos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <NavCard
            href="/quality/instrumentos/catalogo"
            icon={<Wrench className="h-5 w-5 text-stone-600" />}
            label="Catálogo"
            description="Todos los instrumentos"
            count={data?.stats.total}
          />
          <NavCard
            href="/quality/instrumentos/gestion"
            icon={<Table2 className="h-5 w-5 text-stone-600" />}
            label="Gestión tabular"
            description="Tabla, panel y lotes"
          />
          <NavCard
            href="/quality/instrumentos/programa"
            icon={<Calendar className="h-5 w-5 text-stone-600" />}
            label="Programa"
            description="Calendario de calibraciones"
          />
          <NavCard
            href="/quality/conjuntos"
            icon={<BookOpen className="h-5 w-5 text-stone-600" />}
            label="Conjuntos"
            description="Conjuntos de herramientas"
          />
          <NavCard
            href="/quality/paquetes"
            icon={<Package className="h-5 w-5 text-stone-600" />}
            label="Paquetes"
            description="Conjuntos de equipo"
          />
        </div>
      </section>
    </div>
  )
}

// ─── Status Counter ──────────────────────────────────────────────────────────

function StatusCounter({
  label, count, color, icon, href,
}: {
  label: string
  count: number
  color: 'emerald' | 'amber' | 'red' | 'sky' | 'stone'
  icon: React.ReactNode
  href: string
}) {
  const colorMap = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    stone: 'bg-stone-50 border-stone-200 text-stone-700',
  }

  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg border p-3 text-center hover:ring-1 hover:ring-stone-300 transition-all',
        colorMap[color],
        count > 0 && color === 'red' && 'ring-1 ring-red-300',
      )}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {icon}
        <span className="text-2xl font-bold tabular-nums">{count}</span>
      </div>
      <div className="text-xs font-medium">{label}</div>
    </Link>
  )
}

// ─── Action Section ──────────────────────────────────────────────────────────

function ActionSection({
  title, subtitle, icon, borderColor, items, actionLabel, actionPath,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  borderColor: string
  items: InstrumentoCard[]
  actionLabel: string
  actionPath: string
}) {
  return (
    <section className={cn('rounded-lg border bg-white overflow-hidden', borderColor)}>
      <div className={cn('px-4 py-3 border-b', borderColor)}>
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          <span className="ml-auto rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
            {items.length}
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-1">{subtitle}</p>
      </div>
      <div className="divide-y divide-stone-100">
        {items.map(inst => {
          const days = daysUntil(inst.fecha_proximo_evento)
          return (
            <div key={inst.id} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
              {/* Estado accent */}
              <div className={cn(
                'w-1 self-stretch rounded-full shrink-0',
                inst.estado === 'vencido' ? 'bg-red-400' : 'bg-amber-400',
              )} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/quality/instrumentos/${inst.id}`}
                    className="text-sm font-medium text-stone-900 hover:underline truncate"
                  >
                    {inst.nombre}
                  </Link>
                  <EmaTipoBadge tipo={inst.tipo} />
                  <EmaEstadoBadge estado={inst.estado} />
                </div>
                <span className="font-mono text-xs text-stone-500">{inst.codigo}</span>
              </div>

              {/* Days countdown */}
              <span className={cn(
                'font-mono text-xs shrink-0 tabular-nums',
                inst.estado === 'vencido' ? 'text-red-600' : 'text-amber-600',
              )}>
                {daysLabel(days)}
              </span>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <Link
                  href={`/quality/instrumentos/${inst.id}/${actionPath}`}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors text-center',
                    actionPath === 'certificar'
                      ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                  )}
                >
                  {actionLabel} →
                </Link>
                {actionPath === 'certificar' && (
                  <Link
                    href={`/quality/instrumentos/${inst.id}?tab=certificados`}
                    className="text-[10px] text-stone-500 hover:text-sky-700 underline-offset-2 hover:underline"
                  >
                    Ver certificados en ficha
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Nav Card ────────────────────────────────────────────────────────────────

function NavCard({
  href, icon, label, description, count,
}: {
  href: string
  icon: React.ReactNode
  label: string
  description: string
  count?: number
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-stone-200 bg-white p-4 hover:bg-stone-50 hover:border-stone-300 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="h-9 w-9 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center group-hover:bg-stone-200 transition-colors">
          {icon}
        </div>
        {count !== undefined && (
          <span className="font-mono text-lg font-semibold text-stone-400 tabular-nums">{count}</span>
        )}
      </div>
      <p className="text-sm font-medium text-stone-900">{label}</p>
      <p className="text-xs text-stone-500 mt-0.5">{description}</p>
    </Link>
  )
}
