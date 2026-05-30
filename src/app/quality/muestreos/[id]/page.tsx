'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, Package } from 'lucide-react'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { deleteMuestreo } from '@/services/qualityMuestreoService'
import { deleteMuestra } from '@/services/qualityMuestraService'
import type { MuestreoDetailBundle } from '@/services/muestreoDetailService'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import type { MuestreoWithRelations } from '@/types/quality'
import AddSampleModal from '@/components/quality/muestreos/AddSampleModal'
import RemisionMaterialsAnalysis from '@/components/quality/RemisionMaterialsAnalysis'
import ResistanceEvolutionTimeline from '@/components/quality/muestreos/ResistanceEvolutionTimeline'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { qualityHubOutlineNeutralClass } from '@/components/quality/qualityHubUi'
import type { MoldeRow, MuestreoInstrumentoRow } from '@/components/quality/muestreos/detail/MuestreoEquipmentCard'
import MuestreoDetailHeader from '@/components/quality/muestreos/detail/MuestreoDetailHeader'
import MuestreoMainCard from '@/components/quality/muestreos/detail/MuestreoMainCard'
import MuestreoEnvironmentalCard from '@/components/quality/muestreos/detail/MuestreoEnvironmentalCard'
import MuestreoFieldMeasurementsCard from '@/components/quality/muestreos/detail/MuestreoFieldMeasurementsCard'
import MuestreoSampleSummaryCard from '@/components/quality/muestreos/detail/MuestreoSampleSummaryCard'
import InformeEmissionPanel from '@/components/quality/informes/InformeEmissionPanel'
import MuestreoInformeFieldsCard from '@/components/quality/muestreos/detail/MuestreoInformeFieldsCard'
import CrossPlantProductionCard, {
  type ProductionRemision,
} from '@/components/quality/muestreos/detail/CrossPlantProductionCard'
import MuestreoEquipmentCard from '@/components/quality/muestreos/detail/MuestreoEquipmentCard'
import MuestreoAddEquipmentDialog from '@/components/quality/muestreos/detail/MuestreoAddEquipmentDialog'
import MuestreoSpecimenGrid from '@/components/quality/muestreos/detail/MuestreoSpecimenGrid'
import MuestreoDeleteDialogs from '@/components/quality/muestreos/detail/MuestreoDeleteDialogs'
import MuestreoDetailSkeleton from '@/components/quality/muestreos/detail/MuestreoDetailSkeleton'
import {
  buildOrderedMuestrasWithDisplayNames,
  getFirstEnsayoId,
  getMuestreoPageStatus,
} from '@/components/quality/muestreos/detail/muestreoDetailUtils'

export default function MuestreoDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { profile } = useAuthBridge()
  const { toast } = useToast()

  const [detailBundle, setDetailBundle] = useState<MuestreoDetailBundle | null>(null)
  const [muestreo, setMuestreo] = useState<MuestreoWithRelations | null>(null)
  const [orderTotals, setOrderTotals] = useState<{
    totalOrderVolume: number
    totalOrderSamplings: number
    totalRemisiones: number
  } | null>(null)
  const [rendimientoVolumetrico, setRendimientoVolumetrico] = useState<{
    value: number | null
    sumaMateriales: number
    volumenFabricado: number
    masaUnitaria: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddSampleModal, setShowAddSampleModal] = useState(false)
  const [orderTotalsLoading, setOrderTotalsLoading] = useState(false)
  const [showDeleteMuestreoDialog, setShowDeleteMuestreoDialog] = useState(false)
  const [showDeleteMuestraDialog, setShowDeleteMuestraDialog] = useState(false)
  const [muestraToDelete, setMuestraToDelete] = useState<string | null>(null)
  const [isDeletingMuestreo, setIsDeletingMuestreo] = useState(false)
  const [isDeletingMuestra, setIsDeletingMuestra] = useState(false)

  const [productionRemision, setProductionRemision] = useState<ProductionRemision | null>(null)
  const [emaInstrumentos, setEmaInstrumentos] = useState<MuestreoInstrumentoRow[]>([])
  const [emaInstrumentosLoading, setEmaInstrumentosLoading] = useState(false)
  const [showAddEquipmentDialog, setShowAddEquipmentDialog] = useState(false)

  const applyDetailBundle = useCallback((bundle: MuestreoDetailBundle) => {
    setDetailBundle(bundle)
    setMuestreo(bundle.muestreo)
    setEmaInstrumentos(bundle.emaInstrumentos)
    setProductionRemision(bundle.productionRemision)
    setOrderTotals(bundle.orderTotals)
    setRendimientoVolumetrico(bundle.rendimientoVolumetrico)
  }, [])

  const fetchMuestreoDetails = useCallback(async () => {
    if (!params.id) return

    try {
      setLoading(true)
      setError(null)
      setEmaInstrumentosLoading(true)
      setOrderTotalsLoading(true)

      const muestreoId = Array.isArray(params.id) ? params.id[0] : params.id
      const res = await fetch(`/api/quality/muestreos/${muestreoId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(typeof json.error === 'string' ? json.error : 'No se pudo cargar el muestreo')
      }

      applyDetailBundle(json.data as MuestreoDetailBundle)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo cargar la información del muestreo'
      setError(message)
    } finally {
      setLoading(false)
      setEmaInstrumentosLoading(false)
      setOrderTotalsLoading(false)
    }
  }, [applyDetailBundle, params.id])

  useEffect(() => {
    void fetchMuestreoDetails()
  }, [fetchMuestreoDetails])

  const handleDeleteMuestreo = async () => {
    if (!muestreo) return
    setIsDeletingMuestreo(true)
    try {
      await deleteMuestreo(muestreo.id)
      toast({
        title: 'Muestreo eliminado',
        description: 'El muestreo y sus muestras se han eliminado correctamente',
        variant: 'default',
      })
      router.push('/quality/muestreos')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar el muestreo'
      toast({ title: 'Error', description: message, variant: 'destructive' })
      setIsDeletingMuestreo(false)
    }
  }

  const handleDeleteMuestra = async () => {
    if (!muestraToDelete) return
    setIsDeletingMuestra(true)
    try {
      await deleteMuestra(muestraToDelete)
      toast({ title: 'Muestra eliminada', description: 'La muestra se ha eliminado correctamente', variant: 'default' })
      setShowDeleteMuestraDialog(false)
      setMuestraToDelete(null)
      void fetchMuestreoDetails()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar la muestra'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setIsDeletingMuestra(false)
    }
  }

  const retryOrderTotals = async () => {
    await fetchMuestreoDetails()
  }

  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE']
  const hasAccess = profile && allowedRoles.includes(profile.role)

  if (!hasAccess) {
    return (
      <div className="w-full max-w-3xl mx-auto py-16">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          <p className="text-lg mb-4 text-yellow-700">No tienes permiso para acceder a esta sección.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="w-full">
        <MuestreoDetailSkeleton />
      </div>
    )
  }

  if (error || !muestreo) {
    return (
      <div className="w-full">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className={cn(qualityHubOutlineNeutralClass, 'mb-6 h-9')}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-3xl mx-auto">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-xl font-medium text-red-800 mb-2">Error al cargar el muestreo</h3>
              <p className="text-red-700">{error || 'No se encontró el muestreo solicitado'}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className={cn(qualityHubOutlineNeutralClass, 'mt-2')}
            onClick={() => void fetchMuestreoDetails()}
          >
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const { muestrasOrdenadas, displayNameById } = buildOrderedMuestrasWithDisplayNames(muestreo)
  const firstEnsayoId = getFirstEnsayoId(muestreo)
  const ensayoHasEquipment = detailBundle?.ensayoHasEquipment ?? false
  const rendimientoLoading = loading && !rendimientoVolumetrico
  const pageStatus = getMuestreoPageStatus(muestreo)

  // Derive unique mold instruments from per-sample links for the equipment card
  const moldeRows: MoldeRow[] = (() => {
    const map = new Map<string, MoldeRow>()
    for (const m of muestreo.muestras ?? []) {
      const instr = (m as { molde_instrumento?: { id: string; codigo: string; nombre: string } | null }).molde_instrumento
      if (!instr) continue
      const label = displayNameById.get(m.id) ?? m.identificacion ?? m.id
      const existing = map.get(instr.id)
      if (existing) {
        existing.usadoEn.push(label)
      } else {
        map.set(instr.id, { id: instr.id, codigo: instr.codigo, nombre: instr.nombre, usadoEn: [label] })
      }
    }
    return Array.from(map.values())
  })()

  const cilindros = muestreo.muestras?.filter((m) => m.tipo_muestra === 'CILINDRO') || []
  const vigas = muestreo.muestras?.filter((m) => m.tipo_muestra === 'VIGA') || []
  const cubos = muestreo.muestras?.filter((m) => m.tipo_muestra === 'CUBO') || []

  const remisionLabel = String(
    muestreo.remision?.remision_number ||
      muestreo.laboratorio_lote?.lote_number ||
      muestreo.manual_reference ||
      'Sin remisión'
  )

  const canEditMuestreoEquipment =
    !!profile?.role &&
    ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE', 'ADMIN', 'ADMIN_OPERATIONS'].includes(profile.role)

  return (
    <div className="w-full">
      <QualityBreadcrumb
        className="mb-6"
        hubName="Operaciones"
        hubHref="/quality/operaciones"
        items={[{ label: 'Muestreos', href: '/quality/muestreos' }, { label: `Muestreo #${muestreo.numero_muestreo}` }]}
      />

      <MuestreoDetailHeader
        numeroMuestreo={muestreo.numero_muestreo}
        remisionLabel={remisionLabel}
        statusLabel={pageStatus.label}
        statusClassName={pageStatus.className}
        onDeleteMuestreo={() => setShowDeleteMuestreoDialog(true)}
      />

      {muestreo.laboratorio_lote?.id && (
        <p className="mb-4 text-sm">
          <Link
            href={`/quality/experimentos/${muestreo.laboratorio_lote.id}`}
            className="text-violet-800 hover:underline font-medium"
          >
            Ver experimento {muestreo.laboratorio_lote.lote_number} — {muestreo.laboratorio_lote.study_name}
          </Link>
        </p>
      )}

      <Tabs defaultValue="general" className="mb-8">
        <TabsList className="grid w-full grid-cols-2 h-auto p-1 bg-stone-100/80 rounded-lg border border-stone-200">
          <TabsTrigger
            value="general"
            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-sky-700/15 data-[state=inactive]:text-stone-600"
          >
            Información General
          </TabsTrigger>
          <TabsTrigger
            value="materials"
            disabled={!muestreo.remision}
            className="rounded-md data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-sky-700/15 data-[state=inactive]:text-stone-600 disabled:opacity-50"
          >
            Análisis de Materiales
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <MuestreoMainCard
                muestreo={muestreo}
                muestreoId={muestreo.id}
                pageStatus={pageStatus}
                orderTotals={orderTotals}
                orderTotalsLoading={orderTotalsLoading}
                rendimientoVolumetrico={rendimientoVolumetrico}
                rendimientoLoading={rendimientoLoading}
                onRetryOrderTotals={() => void retryOrderTotals()}
                onRevenimientoSaved={() => void fetchMuestreoDetails()}
              />
            </div>

            <div className="space-y-6">
              <MuestreoFieldMeasurementsCard
                muestreoId={muestreo.id}
                muestreo={muestreo}
                canEdit={canEditMuestreoEquipment}
                onSaved={() => void fetchMuestreoDetails()}
                initialGrouped={detailBundle?.medicionesCampoGrouped}
                initialPublishedUncertainty={detailBundle?.publishedUncertainty}
              />
              <MuestreoEnvironmentalCard muestreo={muestreo} />
              <MuestreoSampleSummaryCard
                muestreo={muestreo}
                cilindros={cilindros.length}
                vigas={vigas.length}
                cubos={cubos.length}
                cilindrosEnsayados={cilindros.filter((c) => c.estado === 'ENSAYADO').length}
                vigasEnsayadas={vigas.filter((v) => v.estado === 'ENSAYADO').length}
                cubosEnsayados={cubos.filter((c) => c.estado === 'ENSAYADO').length}
                firstEnsayoId={firstEnsayoId}
              />
              <MuestreoInformeFieldsCard muestreo={muestreo} onSaved={() => void fetchMuestreoDetails()} />
              <InformeEmissionPanel
                muestreo={muestreo}
                ensayoHasEquipment={ensayoHasEquipment}
                initialInforme={detailBundle?.informe}
                onRefresh={() => void fetchMuestreoDetails()}
              />
            </div>

            {productionRemision && (
              <div className="lg:col-span-3">
                <CrossPlantProductionCard productionRemision={productionRemision} />
              </div>
            )}
          </div>

          <MuestreoEquipmentCard
            rows={emaInstrumentos}
            loading={emaInstrumentosLoading}
            moldeRows={moldeRows}
            onAddEquipment={canEditMuestreoEquipment ? () => setShowAddEquipmentDialog(true) : undefined}
          />

          <MuestreoSpecimenGrid
            muestrasOrdenadas={muestrasOrdenadas}
            displayNameById={displayNameById}
            onAddSample={() => setShowAddSampleModal(true)}
            onRequestDelete={(id) => {
              setMuestraToDelete(id)
              setShowDeleteMuestraDialog(true)
            }}
          />

          {muestreo.muestras && muestreo.muestras.length > 0 && (
            <ResistanceEvolutionTimeline
              muestras={muestreo.muestras}
              fechaMuestreo={muestreo.fecha_muestreo_ts || muestreo.fecha_muestreo}
              strengthFc={muestreo.remision?.recipe?.strength_fc}
              displayNameById={displayNameById}
            />
          )}
        </TabsContent>

        <TabsContent value="materials" className="mt-6">
          {muestreo.remision ? (
            <RemisionMaterialsAnalysis remision={muestreo.remision} />
          ) : (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-stone-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-stone-900 mb-2">No hay remisión asociada</h3>
              <p className="text-stone-500">Este muestreo no tiene una remisión asociada para analizar materiales.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddSampleModal
        isOpen={showAddSampleModal}
        onClose={() => setShowAddSampleModal(false)}
        muestreoId={muestreo.id}
        muestreoDate={muestreo.fecha_muestreo}
        onSampleAdded={() => void fetchMuestreoDetails()}
      />

      <MuestreoAddEquipmentDialog
        open={showAddEquipmentDialog}
        onOpenChange={setShowAddEquipmentDialog}
        muestreoId={muestreo.id}
        plantId={muestreo.plant_id}
        onSaved={() => void fetchMuestreoDetails()}
      />

      <MuestreoDeleteDialogs
        showDeleteMuestreo={showDeleteMuestreoDialog}
        onOpenDeleteMuestreo={setShowDeleteMuestreoDialog}
        numeroMuestreo={muestreo.numero_muestreo}
        muestrasCount={muestreo.muestras?.length ?? 0}
        isDeletingMuestreo={isDeletingMuestreo}
        onConfirmDeleteMuestreo={() => void handleDeleteMuestreo()}
        showDeleteMuestra={showDeleteMuestraDialog}
        onOpenDeleteMuestra={(open) => {
          setShowDeleteMuestraDialog(open)
          if (!open) setMuestraToDelete(null)
        }}
        isDeletingMuestra={isDeletingMuestra}
        onConfirmDeleteMuestra={() => void handleDeleteMuestra()}
        onCancelDeleteMuestra={() => {
          setShowDeleteMuestraDialog(false)
          setMuestraToDelete(null)
        }}
      />
    </div>
  )
}
