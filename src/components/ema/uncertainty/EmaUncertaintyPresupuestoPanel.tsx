'use client'

import React from 'react'
import Link from 'next/link'
import { BarChart3, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmaUncertaintyBudgetTable } from '@/components/ema/uncertainty/EmaUncertaintyBudgetTable'
import type { BudgetResult, UncertaintyPublished } from '@/types/ema-uncertainty'
import { cn } from '@/lib/utils'

/**
 * Parse a warning string for an embedded `[ID verificación: <uuid>]` tag.
 * Returns the clean text and the verification UUID if present.
 */
function parseWarning(w: string): { text: string; verificacionId: string | null; isCritical: boolean } {
  const idMatch = w.match(/\[ID verificación:\s*([0-9a-f-]{36})\]/i)
  const verificacionId = idMatch ? idMatch[1] : null
  const text = verificacionId ? w.replace(idMatch![0], '').trim() : w
  // Warnings that mention an uncomputed verification are critical (red)
  const isCritical = verificacionId !== null || w.startsWith('⚠')
  return { text, verificacionId, isCritical }
}

export function EmaUncertaintyPresupuestoPanel({
  budget,
  unit,
  warnings,
  published,
  onRefresh,
  refreshing,
}: {
  budget: BudgetResult | null
  unit: string
  warnings: string[]
  published: UncertaintyPublished | null
  onRefresh: () => void
  refreshing: boolean
}) {
  if (!budget) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-8 text-center text-stone-400">
        <BarChart3 className="mx-auto mb-3 h-10 w-10 text-stone-200" />
        <p className="text-sm">
          Ingresa las lecturas y pulsa <strong className="text-stone-600">Calcular presupuesto</strong>{' '}
          para ver el análisis completo.
        </p>
        <Button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-4 bg-stone-900 hover:bg-stone-800"
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
          Calcular ahora
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 md:p-6">
      {published && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
            Comparar con U publicada
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-stone-500">Declarada actual: </span>
              <span className="font-mono font-semibold">
                ± {published.u_expandida.toExponential(3)} {published.unidad}
              </span>
              <span className="ml-2 text-xs text-stone-400">k = {published.k_factor.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-stone-500">Nueva (preview): </span>
              <span className="font-mono font-semibold">
                ± {budget.U.toExponential(3)} {unit}
              </span>
              <span className="ml-2 text-xs text-stone-400">k = {budget.k.toFixed(3)}</span>
            </div>
            <div className="sm:col-span-2 text-xs text-stone-600">
              ΔU ={' '}
              <span className="font-mono">
                {((budget.U - published.u_expandida) / published.u_expandida * 100).toFixed(1)}%
              </span>{' '}
              respecto a la declarada
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => {
            const { text, verificacionId, isCritical } = parseWarning(w)
            return (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                  isCritical
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-amber-50 text-amber-700',
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span className="flex-1">{text}</span>
                {verificacionId && (
                  <Link
                    href={`/quality/ema/verificaciones/${verificacionId}`}
                    className="ml-1 inline-flex items-center gap-1 shrink-0 font-medium underline underline-offset-2 hover:opacity-80"
                  >
                    Recalcular incertidumbre
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}

      <EmaUncertaintyBudgetTable budget={budget} unit={unit} />

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onRefresh} disabled={refreshing}>
          <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
          Recalcular
        </Button>
      </div>
    </div>
  )
}
