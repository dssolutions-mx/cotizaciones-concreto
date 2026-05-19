import React from 'react'
import Link from 'next/link'
import { Plus, FlaskConical, BookOpen, ChevronRight, AlertTriangle, History } from 'lucide-react'
import { EmaBreadcrumb } from '@/components/ema/EmaBreadcrumb'
import { Button } from '@/components/ui/button'
import {
  listMeasurands,
  listPublishedU,
  listLatestDraftByMeasurand,
} from '@/services/emaUncertaintyService'
import type { UncertaintyMeasurand, UncertaintyPublished, UncertaintyStudy } from '@/types/ema-uncertainty'

export const dynamic = 'force-dynamic'

export default async function UncertaintyHubPage() {
  const [measurands, published, drafts] = await Promise.all([
    listMeasurands(),
    listPublishedU(),
    listLatestDraftByMeasurand(),
  ])

  const publishedByMeasurand = new Map<string, UncertaintyPublished>(
    published.map((p) => [p.measurand_id, p]),
  )

  return (
    <>
      <EmaBreadcrumb items={[{ label: 'Incertidumbre de Medición' }]} />

      <div className="mt-4 flex flex-col gap-5">
        <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
          <h1 className="text-xl font-semibold tracking-tight text-stone-900">
            Incertidumbre de Medición
          </h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Presupuesto de incertidumbre expandida por método de ensayo (NMX-EC-17025 §7.6).
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                ¿Qué es esto? — NMX-EC-17025-IMNC-2018 §7.6
              </p>
              <p className="mt-1 text-xs text-blue-700">
                El laboratorio evalúa la incertidumbre mediante un{' '}
                <strong>estudio periódico</strong> con réplicas controladas (JCGM 100:2008 GUM).
                El resultado es la <strong>incertidumbre expandida U = k · u_c</strong> declarada
                hasta el próximo estudio.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-blue-600">
                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono">1. Estudio</span>
                <ChevronRight className="h-3 w-3" />
                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono">2. Presupuesto</span>
                <ChevronRight className="h-3 w-3" />
                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono">3. u_c + k</span>
                <ChevronRight className="h-3 w-3" />
                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono font-semibold">
                  4. U declarada
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {measurands.map((m) => (
            <MeasurandCard
              key={m.id}
              measurand={m}
              published={publishedByMeasurand.get(m.id) ?? null}
              draft={drafts.get(m.id) ?? null}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function MeasurandCard({
  measurand: m,
  published: p,
  draft,
}: {
  measurand: UncertaintyMeasurand
  published: UncertaintyPublished | null
  draft: UncertaintyStudy | null
}) {
  const hasU = p !== null
  const isExpired =
    hasU && p.valid_until ? new Date(p.valid_until) < new Date() : false

  return (
    <div className="flex flex-col rounded-lg border border-stone-200 bg-white">
      <div className="flex items-start justify-between p-4 pb-3">
        <div>
          <span className="inline-block rounded bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-600">
            {m.codigo}
          </span>
          <h3 className="mt-1 text-sm font-semibold text-stone-800">{m.nombre}</h3>
          <p className="text-xs text-stone-500">{m.metodo_norma}</p>
        </div>
        <FlaskConical className="h-5 w-5 shrink-0 text-stone-300" />
      </div>

      <div className="mx-4 mb-3 rounded-lg border bg-stone-50 px-4 py-3">
        {hasU && !isExpired ? (
          <>
            <div className="text-[11px] text-stone-500">Incertidumbre declarada</div>
            <div className="mt-0.5 font-mono text-lg font-bold text-stone-900">
              ± {p.u_expandida.toExponential(3)}{' '}
              <span className="text-sm font-normal text-stone-600">{p.unidad}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-stone-500">
              <span>k = {p.k_factor.toFixed(3)}</span>
              <span>νeff = {isFinite(p.nu_eff) ? p.nu_eff.toFixed(1) : '∞'}</span>
              {p.valid_until && <span>Válida hasta {p.valid_until}</span>}
            </div>
          </>
        ) : isExpired ? (
          <div className="flex items-center gap-2 text-xs text-amber-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Vencida el {p!.valid_until}. Se requiere nuevo estudio.
          </div>
        ) : (
          <div className="text-xs text-stone-400 italic">Sin estudio publicado.</div>
        )}
      </div>

      {draft && (
        <div className="mx-4 mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Borrador en curso ({draft.fecha_estudio})
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-2 border-t border-stone-100 p-3">
        <Link
          href={`/quality/ema/incertidumbre/${m.codigo}/estudios`}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
        >
          <History className="h-3.5 w-3.5" />
          Historial
        </Link>
        {draft && (
          <Link
            href={`/quality/ema/incertidumbre/${m.codigo}/estudios/${draft.id}`}
            className="flex-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-center text-xs font-medium text-amber-900 hover:bg-amber-100"
          >
            Continuar
          </Link>
        )}
        {hasU && (
          <Link
            href={`/quality/ema/incertidumbre/${m.codigo}/estudios/${p!.study_id}`}
            className="flex-1 rounded-lg border border-stone-200 px-2 py-1.5 text-center text-xs text-stone-600 hover:bg-stone-50"
          >
            Ver publicado
          </Link>
        )}
        <Button asChild size="sm" className="flex-1 bg-stone-900 hover:bg-stone-800">
          <Link href={`/quality/ema/incertidumbre/${m.codigo}/estudios/nuevo`}>
            <Plus className="h-3.5 w-3.5" />
            Nuevo
          </Link>
        </Button>
      </div>
    </div>
  )
}
