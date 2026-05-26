'use client'

import React, { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { EmaUncertaintyReplicaTable } from '@/components/ema/uncertainty/EmaUncertaintyReplicaTable'
import { EmaUncertaintyStudyConfig } from '@/components/ema/uncertainty/EmaUncertaintyStudyConfig'
import { EmaUncertaintyPresupuestoPanel } from '@/components/ema/uncertainty/EmaUncertaintyPresupuestoPanel'
import { EmaUncertaintyPublishPanel } from '@/components/ema/uncertainty/EmaUncertaintyPublishPanel'
import {
  EmaUncertaintyWorkflowHeader,
  type UncertaintyWorkflowStep,
} from '@/components/ema/uncertainty/EmaUncertaintyWorkflowHeader'
import { EmaUncertaintyStudyEstadoBadge } from '@/components/ema/uncertainty/EmaUncertaintyStudyEstadoBadge'
import { EmaUncertaintyPlantPanel } from '@/components/ema/uncertainty/EmaUncertaintyPlantPanel'
import { EmaUncertaintyDestructiveBanner } from '@/components/ema/uncertainty/EmaUncertaintyDestructiveBanner'
import { cn } from '@/lib/utils'
import { parseEmaApiData } from '@/lib/ema/emaApiClient'
import {
  buildReplicaRows,
  computeReplicaMeasurand,
} from '@/lib/ema/uncertaintyMeasurand'
import { parseEquipoPool, validateUncertaintyInstrumentSelection } from '@/lib/ema/uncertaintyStudyDesign'
import type {
  UncertaintyStudy,
  BudgetResult,
  PublishPreflight,
  UncertaintyPublished,
  UncertaintyStudyReplica,
  UncertaintyEquipoPool,
} from '@/types/ema-uncertainty'

const VALID_TABS: UncertaintyWorkflowStep[] = [
  'configuracion',
  'lecturas',
  'presupuesto',
  'publicar',
]

function tabFromSearchParams(sp: URLSearchParams): UncertaintyWorkflowStep {
  const t = sp.get('tab')
  if (t && VALID_TABS.includes(t as UncertaintyWorkflowStep)) {
    return t as UncertaintyWorkflowStep
  }
  return 'configuracion'
}

export function StudyWorkspaceClient({
  study: initialStudy,
  publishedForMeasurand,
  measurandCode,
}: {
  study: UncertaintyStudy
  publishedForMeasurand: UncertaintyPublished | null
  measurandCode: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [study, setStudy] = useState(initialStudy)
  const [activeTab, setActiveTab] = useState<UncertaintyWorkflowStep>(() =>
    tabFromSearchParams(searchParams),
  )
  const [budget, setBudget] = useState<BudgetResult | null>(
    study.budget
      ? {
          components: study.budget.presupuesto_json,
          mean_value: study.budget.mean_value ?? 0,
          u_c: study.budget.u_combinado ?? 0,
          nu_eff: study.budget.nu_eff ?? Infinity,
          k: study.budget.k_factor ?? 2,
          U: study.budget.u_expandida ?? 0,
          U_rel_pct: study.budget.u_relativa_pct ?? null,
        }
      : null,
  )
  const [budgetWarnings, setBudgetWarnings] = useState<string[]>([])
  const [previewLoading, startPreview] = useTransition()
  const [preflight, setPreflight] = useState<PublishPreflight | null>(null)
  const [publishLoading, startPublish] = useTransition()
  const [publishError, setPublishError] = useState<string | null>(null)
  const [workflowError, setWorkflowError] = useState<string | null>(null)

  const measurand = study.measurand!
  const unit = measurand.unidad
  const isLocked = study.estado !== 'borrador'

  const [replicas, setReplicas] = useState(() =>
    buildReplicaRows(
      { id: study.id, n_replicas: study.n_replicas },
      study.replicas ?? [],
      measurand,
    ),
  )
  const [replicasPendingSave, setReplicasPendingSave] = useState(false)
  const [savingReplicas, setSavingReplicas] = useState(false)
  const [equipoPool, setEquipoPool] = useState<UncertaintyEquipoPool>(() =>
    parseEquipoPool(study.equipo_pool_json),
  )

  const backHref = `/quality/ema/incertidumbre/${measurandCode}/estudios`
  const subtitle = [
    measurand.nombre,
    study.fecha_estudio,
    study.documento_codigo,
  ]
    .filter(Boolean)
    .join(' · ')

  const refreshPreflight = useCallback(async () => {
    if (study.estado !== 'borrador') return
    try {
      const res = await fetch(`/api/ema/uncertainty/studies/${study.id}/publish`)
      if (res.ok) setPreflight(await res.json())
    } catch {
      /* ignore */
    }
  }, [study.id, study.estado])

  useEffect(() => {
    if (activeTab === 'publicar') void refreshPreflight()
  }, [activeTab, refreshPreflight])

  const persistReplicas = useCallback(async (): Promise<boolean> => {
    setSavingReplicas(true)
    setWorkflowError(null)
    try {
      const instrumentIds = [
        ...new Set(replicas.map((r) => r.instrumento_id).filter(Boolean) as string[]),
      ]
      if (instrumentIds.length > 0) {
        const validation = await validateUncertaintyInstrumentSelection(instrumentIds)
        if (!validation.ok) {
          setWorkflowError(validation.error ?? 'Instrumentos no válidos')
          return false
        }
      }

      // For VIGAS, inject the study-level span L into every replica's raw_values_json
      // so the formula evaluator can compute MR = P·L/(b·d²) without L in the grid.
      const L_span = measurand.codigo === 'VIGAS'
        ? ((study.env_overrides as Record<string, number> | null)?.L_span ?? 45)
        : null

      // For MU, inject V_recip from env_overrides so the formula (m_total−m_tara)*1000/V_recip
      // can be evaluated.  V_recip is a study constant (container volume), not entered per-replica.
      const V_recip_mu = measurand.codigo === 'MU'
        ? ((study.env_overrides as Record<string, number> | null)?.V_recipiente ?? 7.06)
        : null

      const payload = replicas.map((r) => {
        let raw = r.raw_values_json
        if (L_span !== null) raw = { ...raw, L: L_span }
        if (V_recip_mu !== null) raw = { ...raw, V_recip: V_recip_mu }
        const computed = (L_span !== null || V_recip_mu !== null)
          ? computeReplicaMeasurand(measurand, raw)
          : r.computed_value
        return {
          orden: r.orden,
          operator_id: r.operator_id,
          instrumento_id: r.instrumento_id,
          raw_values_json: raw,
          computed_value: computed,
        }
      })
      const res = await fetch(`/api/ema/uncertainty/studies/${study.id}/replicas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replicas: payload }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? 'Error guardando réplicas')
      }
      const saved = await parseEmaApiData<UncertaintyStudyReplica[]>(res)
      setReplicas(
        buildReplicaRows({ id: study.id, n_replicas: study.n_replicas }, saved, measurand),
      )
      setReplicasPendingSave(false)
      void refreshPreflight()
      router.refresh()
      return true
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      setWorkflowError(msg)
      return false
    } finally {
      setSavingReplicas(false)
    }
  }, [replicas, study.id, study.n_replicas, measurand, router, refreshPreflight])

  function handleReplicaChange(
    orden: number,
    field: string,
    value: number | string | null,
    joins?: {
      operator?: UncertaintyStudyReplica['operator'] | null
      instrumento?: UncertaintyStudyReplica['instrumento'] | null
    },
  ) {
    setReplicas((prev) => {
      const base = buildReplicaRows({ id: study.id, n_replicas: study.n_replicas }, prev, measurand)
      return base.map((r) => {
        if (r.orden !== orden) return r
        let next: typeof r
        if (field === 'operator_id') {
          next = {
            ...r,
            operator_id: value as string | null,
            operator:
              joins && 'operator' in joins
                ? joins.operator ?? undefined
                : value
                  ? r.operator
                  : undefined,
          }
        } else if (field === 'instrumento_id') {
          next = {
            ...r,
            instrumento_id: value as string | null,
            instrumento:
              joins && 'instrumento' in joins
                ? joins.instrumento ?? undefined
                : value
                  ? r.instrumento
                  : undefined,
          }
        } else if (field.startsWith('_instr_')) {
          // Secondary instrument UUID stored as a string in raw_values_json
          const raw = { ...r.raw_values_json }
          if (value === null) delete raw[field]
          else raw[field] = value as string
          next = { ...r, raw_values_json: raw }
        } else {
          const raw = { ...r.raw_values_json }
          if (value === null) delete raw[field]
          else raw[field] = Number(value)
          next = { ...r, raw_values_json: raw }
        }
        // Inject study-level constants so live formula computation stays correct:
        //   VIGAS → L_span (claro del bastidor)
        //   MU    → V_recip (volumen del recipiente)
        let rawForCompute = next.raw_values_json
        if (measurand.codigo === 'VIGAS') {
          rawForCompute = {
            ...rawForCompute,
            L: ((study.env_overrides as Record<string, number> | null)?.L_span ?? 45),
          }
        }
        if (measurand.codigo === 'MU') {
          rawForCompute = {
            ...rawForCompute,
            V_recip: ((study.env_overrides as Record<string, number> | null)?.V_recipiente ?? 7.06),
          }
        }
        return {
          ...next,
          computed_value: computeReplicaMeasurand(measurand, rawForCompute),
        }
      })
    })
    setReplicasPendingSave(true)
  }

  async function saveReplicas() {
    const ok = await persistReplicas()
    if (ok) {
      toast({ title: 'Lecturas guardadas', description: 'Réplicas actualizadas en el estudio.' })
    }
  }

  function handlePreview() {
    setWorkflowError(null)
    startPreview(async () => {
      if (replicasPendingSave) {
        const ok = await persistReplicas()
        if (!ok) return
      }
      const res = await fetch(`/api/ema/uncertainty/studies/${study.id}/preview`, {
        method: 'POST',
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setWorkflowError((d as { error?: string }).error ?? 'Error al calcular presupuesto')
        return
      }
      const { budget: b, warnings } = await res.json()
      setBudget(b)
      setBudgetWarnings(warnings ?? [])
      setActiveTab('presupuesto')
      setPreflight(null)
    })
  }

  function handlePublish(validUntil: string | null) {
    setPublishError(null)
    startPublish(async () => {
      const res = await fetch(`/api/ema/uncertainty/studies/${study.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valid_until: validUntil }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setPublishError(typeof (d as { error?: string }).error === 'string' ? (d as { error: string }).error : 'Error publicando')
        return
      }
      const result = await res.json()
      toast({
        title: 'Incertidumbre publicada',
        description: result.previous_u_expandida != null
          ? `U anterior: ±${Number(result.previous_u_expandida).toExponential(3)} → nueva: ±${Number(result.published?.u_expandida ?? budget?.U).toExponential(3)} ${unit}`
          : `U declarada: ±${Number(result.published?.u_expandida ?? budget?.U).toExponential(3)} ${unit}`,
      })
      router.refresh()
      router.push('/quality/ema/incertidumbre')
    })
  }

  const lockedTabs: UncertaintyWorkflowStep[] = isLocked
    ? ['configuracion', 'lecturas', 'presupuesto', 'publicar']
    : budget
      ? []
      : ['presupuesto', 'publicar']

  function handleTabChange(v: string) {
    const step = v as UncertaintyWorkflowStep
    setActiveTab(step)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', step)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-lg border border-stone-200 bg-white p-4 md:p-5">
        <EmaUncertaintyWorkflowHeader
          backHref={backHref}
          backLabel="Volver a estudios"
          title="Estudio de incertidumbre"
          subtitle={subtitle}
          activeStep={activeTab}
          lockedSteps={lockedTabs}
        />
        <div className="mt-3">
          <EmaUncertaintyStudyEstadoBadge estado={study.estado} />
        </div>
      </div>

      <EmaUncertaintyPlantPanel
        study={study}
        isLocked={isLocked}
        onPlantUpdated={(next) => {
          setStudy((s) => ({ ...s, plant_id: next.plant_id }))
          router.refresh()
        }}
      />

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="border-b border-stone-200 px-4 pt-4 md:px-5">
            <TabsList
              className={cn(
                'grid h-auto w-full gap-1 rounded-lg bg-stone-100/80 p-1',
                'grid-cols-2 sm:grid-cols-4',
              )}
            >
            <TabsTrigger value="configuracion" className="text-xs sm:text-sm">
              Configuración
            </TabsTrigger>
            <TabsTrigger value="lecturas" className="text-xs sm:text-sm">
              Lecturas (n={study.n_replicas})
            </TabsTrigger>
            <TabsTrigger
              value="presupuesto"
              className="text-xs sm:text-sm"
              disabled={!budget && !isLocked}
            >
              Presupuesto
            </TabsTrigger>
            <TabsTrigger value="publicar" className="text-xs sm:text-sm">
              Publicar
            </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-4 md:p-5">
            <TabsContent value="configuracion" className="mt-0 focus-visible:outline-none">
              <EmaUncertaintyStudyConfig
                study={study}
                replicas={replicas}
                isLocked={isLocked}
                onNotesSaved={(notas) => setStudy((s) => ({ ...s, notas }))}
                onGoToLecturas={() => handleTabChange('lecturas')}
                onEquipoPoolSaved={(pool) => {
                  setEquipoPool(pool)
                  setStudy((s) => ({ ...s, equipo_pool_json: pool }))
                }}
              />
            </TabsContent>

            <TabsContent value="lecturas" className="mt-0 focus-visible:outline-none">
              <EmaUncertaintyDestructiveBanner study={study} />
              {!study.plant_id && !isLocked ? (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-8 text-center text-sm text-amber-950">
                  <p className="font-medium">Asigne la planta del estudio</p>
                  <p className="mt-1 text-xs text-amber-900/90">
                    Use el panel de planta arriba para filtrar instrumentos vigentes antes de capturar
                    lecturas.
                  </p>
                </div>
              ) : (
                <EmaUncertaintyReplicaTable
                  study={study}
                  replicas={replicas}
                  equipoPool={equipoPool}
                  onReplicaChange={handleReplicaChange}
                  onBulkAssign={(patch, helpers) => {
                    setReplicas((prev) => {
                      const base = buildReplicaRows(
                        { id: study.id, n_replicas: study.n_replicas },
                        prev,
                        measurand,
                      )
                      return base.map((r, idx) => {
                        let next = { ...r }
                        if (patch.sameOperatorId) {
                          next = {
                            ...next,
                            operator_id: patch.sameOperatorId,
                            operator: helpers?.resolveOperator?.(patch.sameOperatorId) ?? next.operator,
                          }
                        } else if (
                          patch.operatorRoundRobin &&
                          equipoPool.operator_ids.length > 0
                        ) {
                          const opId =
                            equipoPool.operator_ids[idx % equipoPool.operator_ids.length]
                          next = {
                            ...next,
                            operator_id: opId,
                            operator: helpers?.resolveOperator?.(opId) ?? next.operator,
                          }
                        }
                        if (patch.sameInstrumentoId) {
                          next = {
                            ...next,
                            instrumento_id: patch.sameInstrumentoId,
                            instrumento:
                              helpers?.resolveInstrumento?.(patch.sameInstrumentoId) ??
                              next.instrumento,
                          }
                        }
                        if (patch.rawValueField && patch.rawValueData !== undefined) {
                          // Bulk-assign a raw value field (used for secondary instrument UUIDs)
                          const raw = { ...next.raw_values_json }
                          if (patch.rawValueData === null) delete raw[patch.rawValueField]
                          else raw[patch.rawValueField] = patch.rawValueData
                          next = { ...next, raw_values_json: raw }
                        }
                        let rawForComputeBulk = next.raw_values_json
                        if (measurand.codigo === 'VIGAS') {
                          rawForComputeBulk = { ...rawForComputeBulk, L: ((study.env_overrides as Record<string, number> | null)?.L_span ?? 45) }
                        }
                        if (measurand.codigo === 'MU') {
                          rawForComputeBulk = { ...rawForComputeBulk, V_recip: ((study.env_overrides as Record<string, number> | null)?.V_recipiente ?? 7.06) }
                        }
                        return {
                          ...next,
                          computed_value: computeReplicaMeasurand(measurand, rawForComputeBulk),
                        }
                      })
                    })
                    setReplicasPendingSave(true)
                  }}
                  onSave={saveReplicas}
                  pendingSave={replicasPendingSave}
                  saving={savingReplicas}
                  onPreview={handlePreview}
                  previewLoading={previewLoading}
                  isLocked={isLocked}
                />
              )}
            </TabsContent>

            <TabsContent value="presupuesto" className="mt-0 focus-visible:outline-none">
              <EmaUncertaintyPresupuestoPanel
                budget={budget}
                unit={unit}
                warnings={budgetWarnings}
                published={publishedForMeasurand}
                onRefresh={handlePreview}
                refreshing={previewLoading}
              />
            </TabsContent>

            <TabsContent value="publicar" className="mt-0 focus-visible:outline-none">
              <EmaUncertaintyPublishPanel
                study={study}
                preflight={preflight}
                onPublish={handlePublish}
                publishing={publishLoading}
                error={publishError}
                previewU={budget?.U ?? null}
                previousU={publishedForMeasurand?.u_expandida ?? null}
                unit={unit}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {workflowError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm whitespace-pre-wrap text-red-700">
          {workflowError}
        </div>
      )}
    </div>
  )
}
