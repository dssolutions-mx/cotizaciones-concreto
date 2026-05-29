'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import InventoryBreadcrumb, {
  type InventoryBreadcrumbTailItem,
} from '@/components/inventory/InventoryBreadcrumb'
import ClosureStepper, {
  getClosureStepLabel,
  statusToStep,
  type ClosureStep,
} from '@/components/inventory/closure/ClosureStepper'
import TheoreticalReviewStep from '@/components/inventory/closure/TheoreticalReviewStep'
import PhysicalCountStep from '@/components/inventory/closure/PhysicalCountStep'
import ReconciliationStep from '@/components/inventory/closure/ReconciliationStep'
import JustificationStep from '@/components/inventory/closure/JustificationStep'
import SealStep from '@/components/inventory/closure/SealStep'
import ExportStep from '@/components/inventory/closure/ExportStep'
import type { InventoryClosureDetail, TheoreticalReviewMaterialRow } from '@/types/inventoryClosure'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClipboardList, XCircle, FilePen, Download, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { cn } from '@/lib/utils'

function formatClosurePeriodRange(start: string, end: string) {
  try {
    return `${format(parseISO(start), 'd MMM', { locale: es })} — ${format(parseISO(end), 'd MMM yyyy', { locale: es })}`
  } catch {
    return `${start} — ${end}`
  }
}

const STEP_ORDER: ClosureStep[] = [
  'theoretical',
  'physical_count',
  'reconciliation',
  'justification',
  'seal',
  'export',
]

import {
  canAdminInventoryClosure,
  canDeleteInventoryClosure,
} from '@/lib/auth/inventoryClosureRoles'

export default function ClosureWizardPage() {
  const params = useParams<{ id: string }>()
  const closureId = params.id
  const router = useRouter()
  const { profile } = useAuthSelectors()

  const [detail, setDetail] = useState<InventoryClosureDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState<ClosureStep>('theoretical')
  const [theoreticalConfirmed, setTheoreticalConfirmed] = useState(false)
  const [confirmingTheoretical, setConfirmingTheoretical] = useState(false)
  const [theoreticalError, setTheoreticalError] = useState<string | null>(null)
  const [theoreticalMaterials, setTheoreticalMaterials] = useState<TheoreticalReviewMaterialRow[]>([])
  const [theoreticalLoading, setTheoreticalLoading] = useState(false)
  const [adjustmentsFromLedgerAudit, setAdjustmentsFromLedgerAudit] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [creatingAmendment, setCreatingAmendment] = useState(false)
  const [amendmentError, setAmendmentError] = useState<string | null>(null)
  const [preliminaryLoading, setPreliminaryLoading] = useState(false)
  const [preliminaryError, setPreliminaryError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const canManage = canAdminInventoryClosure(profile?.role)
  const canDelete = canDeleteInventoryClosure(profile?.role)

  const closureHref = `/production-control/inventory-closure/${closureId}`

  const breadcrumbTail = useMemo((): InventoryBreadcrumbTailItem[] => {
    if (!detail) {
      return [{ label: 'Cargando cierre...' }]
    }

    const periodLabel = formatClosurePeriodRange(detail.period_start, detail.period_end)
    const plantName = detail.plant?.name ?? 'Planta'
    const kindLabel = detail.parent_closure_id ? 'Enmienda' : 'Cierre'

    const closureLabel = [periodLabel, plantName, kindLabel].filter(Boolean).join(' · ')

    if (detail.status === 'cancelled') {
      return [
        { label: closureLabel, href: closureHref },
        { label: 'Cancelado' },
      ]
    }

    return [
      { label: closureLabel, href: closureHref },
      { label: getClosureStepLabel(activeStep) },
    ]
  }, [activeStep, closureHref, detail])

  const fetchDetail = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/inventory/closures/${closureId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar cierre')
      setDetail(data.closure)
      // Only draft needs theoretical confirm; physical_count without counts is the normal next step.
      if (data.closure.status === 'draft') {
        setActiveStep('theoretical')
        setTheoreticalConfirmed(false)
      } else {
        setActiveStep(statusToStep(data.closure.status))
        setTheoreticalConfirmed(true)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [closureId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const loadTheoreticalReview = useCallback(async () => {
    setTheoreticalLoading(true)
    setTheoreticalError(null)
    try {
      const res = await fetch(`/api/inventory/closures/${closureId}/theoretical-review`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cargar revisión teórica')
      setTheoreticalMaterials(data.materials ?? [])
      setAdjustmentsFromLedgerAudit(!!data.adjustments_from_ledger_audit)
    } catch (e) {
      setTheoreticalError((e as Error).message)
    } finally {
      setTheoreticalLoading(false)
    }
  }, [closureId, fetchDetail])

  useEffect(() => {
    if (activeStep === 'theoretical' && detail && detail.status !== 'cancelled') {
      loadTheoreticalReview()
    }
  }, [activeStep, detail?.id, detail?.status, loadTheoreticalReview])

  function advanceStep() {
    const current = STEP_ORDER.indexOf(activeStep)
    if (current < STEP_ORDER.length - 1) {
      setActiveStep(STEP_ORDER[current + 1])
    }
    fetchDetail()
  }

  async function handleConfirmTheoretical() {
    setTheoreticalError(null)
    setConfirmingTheoretical(true)
    try {
      const res = await fetch(`/api/inventory/closures/${closureId}/confirm-theoretical`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al confirmar revisión teórica')
      setTheoreticalConfirmed(true)
      setActiveStep('physical_count')
      await fetchDetail()
    } catch (e) {
      setTheoreticalError((e as Error).message)
    } finally {
      setConfirmingTheoretical(false)
    }
  }

  async function handleCancel() {
    setCancelling(true)
    setCancelError(null)
    try {
      const res = await fetch(`/api/inventory/closures/${closureId}/cancel`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al cancelar')
      setShowCancelConfirm(false)
      await fetchDetail()
    } catch (e) {
      setCancelError((e as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/inventory/closures/${closureId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar')
      setShowDeleteConfirm(false)
      router.push('/production-control/inventory-closure')
    } catch (e) {
      setDeleteError((e as Error).message)
    } finally {
      setDeleting(false)
    }
  }

  async function handlePreliminaryExport() {
    setPreliminaryLoading(true)
    setPreliminaryError(null)
    try {
      const res = await fetch(`/api/inventory/closures/${closureId}/export?preliminary=1`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error al generar Excel preliminar')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Preliminar_Inventario_${detail?.period_start}_${detail?.period_end}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setPreliminaryError((e as Error).message)
    } finally {
      setPreliminaryLoading(false)
    }
  }

  async function handleCreateAmendment() {
    if (!detail) return
    setCreatingAmendment(true)
    setAmendmentError(null)
    try {
      const res = await fetch('/api/inventory/closures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plant_id: detail.plant_id,
          period_start: detail.period_start,
          period_end: detail.period_end,
          variance_threshold_pct: detail.variance_threshold_pct,
          parent_closure_id: detail.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear enmienda')
      router.push(`/production-control/inventory-closure/${data.closure.id}`)
    } catch (e) {
      setAmendmentError((e as Error).message)
    } finally {
      setCreatingAmendment(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <InventoryBreadcrumb tailItems={[{ label: 'Cargando cierre...' }]} />
        <div className="flex items-center justify-center py-24 text-stone-400 text-sm">
          Cargando cierre...
        </div>
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="space-y-6">
        <InventoryBreadcrumb tailItems={[{ label: 'Cierre no encontrado' }]} />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error ?? 'Cierre no encontrado'}
        </div>
      </div>
    )
  }

  const isSealed = detail?.status === 'sealed'
  const isCancelled = detail?.status === 'cancelled'
  const isAmendment = !!detail.parent_closure_id
  const canCancel = canManage && !isSealed && !isCancelled

  return (
    <div className="space-y-6">
      <InventoryBreadcrumb tailItems={breadcrumbTail} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B2A4A]">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-semibold text-stone-900">
                Cierre: {format(parseISO(detail.period_start), "d MMM", { locale: es })} — {format(parseISO(detail.period_end), "d MMM yyyy", { locale: es })}
              </h1>
              {isAmendment && (
                <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                  <FilePen className="h-3 w-3" />
                  Enmienda
                </span>
              )}
              {isCancelled && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  <XCircle className="h-3 w-3" />
                  Cancelado
                </span>
              )}
            </div>
            <p className="text-sm text-stone-500">{detail.plant?.name ?? '—'}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {!isSealed && !isCancelled && (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreliminaryExport}
              disabled={preliminaryLoading}
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              {preliminaryLoading ? 'Generando...' : 'Excel preliminar'}
            </Button>
          )}
          {isSealed && canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateAmendment}
              disabled={creatingAmendment}
              className="gap-1.5 text-violet-700 border-violet-200 hover:bg-violet-50"
            >
              <FilePen className="h-3.5 w-3.5" />
              {creatingAmendment ? 'Creando...' : 'Crear enmienda'}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelConfirm(true)}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancelar cierre
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="gap-1.5 text-red-700 border-red-300 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {amendmentError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {amendmentError}
        </p>
      )}

      {preliminaryError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {preliminaryError}
        </p>
      )}

      {!isSealed && !isCancelled && (
        <p className="text-xs text-stone-500 -mt-2">
          Usa <strong>Excel preliminar</strong> para compartir el puente teórico, consumos y conciliación con tu
          jefe antes de sellar el cierre.
        </p>
      )}

      {!isCancelled && (
        <ClosureStepper
          currentStep={activeStep}
          sealed={isSealed}
          className="mb-2"
        />
      )}

      {isCancelled ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm font-medium text-red-800">Este cierre fue cancelado</p>
          <p className="text-xs text-red-600 mt-1">Los datos se conservan para referencia pero no se pueden modificar.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 md:p-6">
          {activeStep === 'theoretical' && (
            <>
              {theoreticalError && (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {theoreticalError}
                </p>
              )}
              <TheoreticalReviewStep
                materials={
                  theoreticalMaterials.length > 0 ? theoreticalMaterials : detail.materials
                }
                periodStart={detail.period_start}
                periodEnd={detail.period_end}
                adjustmentsFromLedgerAudit={adjustmentsFromLedgerAudit}
                loading={theoreticalLoading}
                confirmed={theoreticalConfirmed}
                confirming={confirmingTheoretical}
                onConfirm={handleConfirmTheoretical}
              />
            </>
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
      )}

      {/* Delete confirmation (executive) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-stone-900">¿Eliminar este cierre?</p>
                <p className="text-xs text-stone-500">Solo disponible para ejecutivos.</p>
              </div>
            </div>
            <p className="text-sm text-stone-700">
              Se borrará el registro del cierre, el snapshot por material y la evidencia adjunta.
              Los <strong>ajustes de inventario</strong> generados al sellar (si los hay){' '}
              <strong>no</strong> se eliminan.
            </p>
            {deleteError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteError}
              </p>
            )}
            <div className={cn('flex gap-3', deleteError ? '' : 'pt-1')}>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                disabled={deleting}
              >
                Mantener
              </Button>
              <Button
                className="flex-1 bg-red-600 text-white hover:bg-red-700"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-stone-900">¿Cancelar este cierre?</p>
                <p className="text-xs text-stone-500">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <p className="text-sm text-stone-700">
              El cierre quedará marcado como <strong>Cancelado</strong>. Los datos se conservan
              pero el período quedará disponible para iniciar un nuevo cierre.
            </p>
            {cancelError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {cancelError}
              </p>
            )}
            <div className={cn('flex gap-3', cancelError ? '' : 'pt-1')}>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowCancelConfirm(false); setCancelError(null) }}
                disabled={cancelling}
              >
                Mantener
              </Button>
              <Button
                className="flex-1 bg-red-600 text-white hover:bg-red-700"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
