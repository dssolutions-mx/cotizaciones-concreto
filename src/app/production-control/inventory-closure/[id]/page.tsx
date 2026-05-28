'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'
import ClosureStepper, { statusToStep, type ClosureStep } from '@/components/inventory/closure/ClosureStepper'
import TheoreticalReviewStep from '@/components/inventory/closure/TheoreticalReviewStep'
import PhysicalCountStep from '@/components/inventory/closure/PhysicalCountStep'
import ReconciliationStep from '@/components/inventory/closure/ReconciliationStep'
import JustificationStep from '@/components/inventory/closure/JustificationStep'
import SealStep from '@/components/inventory/closure/SealStep'
import ExportStep from '@/components/inventory/closure/ExportStep'
import type { InventoryClosureDetail } from '@/types/inventoryClosure'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClipboardList } from 'lucide-react'

function fmtDate(d: string) {
  try { return format(parseISO(d), "MMM yyyy", { locale: es }) } catch { return d }
}

const STEP_ORDER: ClosureStep[] = [
  'theoretical',
  'physical_count',
  'reconciliation',
  'justification',
  'seal',
  'export',
]

export default function ClosureWizardPage() {
  const params = useParams<{ id: string }>()
  const closureId = params.id

  const [detail, setDetail] = useState<InventoryClosureDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<ClosureStep>('theoretical')
  const [theoreticalConfirmed, setTheoreticalConfirmed] = useState(false)

  const fetchDetail = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/inventory/closures/${closureId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar cierre')
      setDetail(data.closure)
      const step = statusToStep(data.closure.status)
      setActiveStep(step)
      if (data.closure.status !== 'draft') setTheoreticalConfirmed(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [closureId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  function advanceStep() {
    const current = STEP_ORDER.indexOf(activeStep)
    if (current < STEP_ORDER.length - 1) {
      setActiveStep(STEP_ORDER[current + 1])
    }
    fetchDetail()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-stone-400 text-sm">
        Cargando cierre...
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? 'Cierre no encontrado'}
      </div>
    )
  }

  const isSealed = detail.status === 'sealed'

  return (
    <div className="space-y-6">
      <InventoryBreadcrumb />

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B2A4A]">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-stone-900">
            Cierre: {format(parseISO(detail.period_start), "d MMM", { locale: es })} — {format(parseISO(detail.period_end), "d MMM yyyy", { locale: es })}
          </h1>
          <p className="text-sm text-stone-500">{detail.plant?.name ?? '—'}</p>
        </div>
      </div>

      <ClosureStepper
        currentStep={activeStep}
        sealed={isSealed}
        className="mb-2"
      />

      <div className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
        {activeStep === 'theoretical' && (
          <TheoreticalReviewStep
            materials={detail.materials}
            periodStart={detail.period_start}
            periodEnd={detail.period_end}
            confirmed={theoreticalConfirmed}
            onConfirm={() => {
              setTheoreticalConfirmed(true)
              setActiveStep('physical_count')
            }}
          />
        )}

        {activeStep === 'physical_count' && (
          <PhysicalCountStep
            closureId={closureId}
            materials={detail.materials}
            thresholdPct={detail.variance_threshold_pct}
            onSaved={async () => {
              await fetchDetail()
              setActiveStep('reconciliation')
            }}
          />
        )}

        {activeStep === 'reconciliation' && (
          <ReconciliationStep
            materials={detail.materials}
            thresholdPct={detail.variance_threshold_pct}
            saving={false}
            onConfirm={() => setActiveStep('justification')}
          />
        )}

        {activeStep === 'justification' && (
          <JustificationStep
            closureId={closureId}
            materials={detail.materials}
            thresholdPct={detail.variance_threshold_pct}
            onSaved={() => {
              fetchDetail()
              setActiveStep('seal')
            }}
          />
        )}

        {activeStep === 'seal' && !isSealed && (
          <SealStep
            closureId={closureId}
            materials={detail.materials}
            onSealed={async () => {
              await fetchDetail()
              setActiveStep('export')
            }}
          />
        )}

        {(activeStep === 'export' || isSealed) && (
          <ExportStep closure={detail} />
        )}
      </div>
    </div>
  )
}
