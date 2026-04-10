'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertTriangle, ChevronLeft, Package } from 'lucide-react'
import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchMuestreoById, deleteMuestreo } from '@/services/qualityMuestreoService'
import { deleteMuestra } from '@/services/qualityMuestraService'
import { useAuthBridge } from '@/adapters/auth-context-bridge'
import type { MuestreoWithRelations } from '@/types/quality'
import AddSampleModal from '@/components/quality/muestreos/AddSampleModal'
import RemisionMaterialsAnalysis from '@/components/quality/RemisionMaterialsAnalysis'
import ResistanceEvolutionTimeline from '@/components/quality/muestreos/ResistanceEvolutionTimeline'
import { calcularRendimientoVolumetrico } from '@/lib/qualityMetricsUtils'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { qualityHubOutlineNeutralClass } from '@/components/quality/qualityHubUi'
import type { MuestreoInstrumentoRow } from '@/components/quality/muestreos/detail/MuestreoEquipmentCard'
import MuestreoDetailHeader from '@/components/quality/muestreos/detail/MuestreoDetailHeader'
import MuestreoMainCard from '@/components/quality/muestreos/detail/MuestreoMainCard'
import MuestreoEnvironmentalCard from '@/components/quality/muestreos/detail/MuestreoEnvironmentalCard'
import MuestreoSampleSummaryCard from '@/components/quality/muestreos/detail/MuestreoSampleSummaryCard'
import CrossPlantProductionCard, {
  type ProductionRemision,
} from '@/components/quality/muestreos/detail/CrossPlantProductionCard'
import MuestreoEquipmentCard from '@/components/quality/muestreos/detail/MuestreoEquipmentCard'
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
  const [rendimientoLoading, setRendimientoLoading] = useState(false)
  const [showDeleteMuestreoDialog, setShowDeleteMuestreoDialog] = useState(false)
  const [showDeleteMuestraDialog, setShowDeleteMuestraDialog] = useState(false)
  const [muestraToDelete, setMuestraToDelete] = useState<string | null>(null)
  const [isDeletingMuestreo, setIsDeletingMuestreo] = useState(false)
  const [isDeletingMuestra, setIsDeletingMuestra] = useState(false)

  const [productionRemision, setProductionRemision] = useState<ProductionRemision | null>(null)
  const [emaInstrumentos, setEmaInstrumentos] = useState<MuestreoInstrumentoRow[]>([])
  const [emaInstrumentosLoading, setEmaInstrumentosLoading] = useState(false)

  const fetchMuestreoDetails = useCallback(async () => {
    if (!params.id) return

    try {
      setLoading(true)
      setError(null)
      setProductionRemision(null)

      const muestreoId = Array.isArray(params.id) ? params.id[0] : params.id
      const data = await fetchMuestreoById(muestreoId)
      setMuestreo(data)

      setEmaInstrumentosLoading(true)
      fetch(`/api/ema/muestreos/${muestreoId}/instrumentos`)
        .then((r) => r.json())
        .then((j) => setEmaInstrumentos(Array.isArray(j.data) ? j.data : []))
        .catch(() => setEmaInstrumentos([]))
        .finally(() => setEmaInstrumentosLoading(false))

      const cpRemisionId = (data?.remision as { cross_plant_billing_remision_id?: string | null })
        ?.cross_plant_billing_remision_id
      if (cpRemisionId) {
        try {
          const { data: cpData } = await supabase
            .from('remisiones')
            .select(
              `
              id,
              remision_number,
              fecha,
              hora_carga,
              conductor,
              unidad,
              volumen_fabricado,
              plant_id,
              plant:plants!plant_id(id, code, name),
              recipe:recipes(recipe_code, strength_fc, slump, age_days, age_hours, tma)
            `
            )
            .eq('id', cpRemisionId)
            .maybeSingle()
          if (cpData) setProductionRemision(cpData as ProductionRemision)
        } catch {
          // non-critical
        }
      }

      if (data?.remision?.order?.id) {
        setOrderTotalsLoading(true)
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 10000)
          const totalsResponse = await fetch(`/api/orders/${data.remision.order.id}/order-totals`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
          if (totalsResponse.ok) {
            const totals = await totalsResponse.json()
            setOrderTotals(totals)
          }
        } catch {
          // non-critical
        } finally {
          setOrderTotalsLoading(false)
        }
      }

      if (data?.remision?.id && data.masa_unitaria) {
        setRendimientoLoading(true)
        try {
          const { data: materialesData, error: materialesError } = await supabase
            .from('remision_materiales')
            .select('cantidad_real')
            .eq('remision_id', data.remision.id)

          if (!materialesError && materialesData) {
            const sumaMateriales = materialesData.reduce((sum, material) => sum + (material.cantidad_real || 0), 0)
            const volumenFabricado = data.remision.volumen_fabricado || 0
            const masaUnitaria = Math.round(data.masa_unitaria)
            const rendimientoValue = calcularRendimientoVolumetrico(volumenFabricado, sumaMateriales, masaUnitaria)
            setRendimientoVolumetrico({
              value: rendimientoValue,
              sumaMateriales,
              volumenFabricado,
              masaUnitaria,
            })
          }
        } catch {
          // non-critical
        } finally {
          setRendimientoLoading(false)
        }
      }
    } catch {
      setError('No se pudo cargar la información del muestreo')
    } finally {
      setLoading(false)
    }
  }, [params.id])

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
    if (!muestreo?.remision?.order?.id) return
    setOrderTotalsLoading(true)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const totalsResponse = await fetch(`/api/orders/${muestreo.remision.order.id}/order-totals`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (totalsResponse.ok) {
        const totals = await totalsResponse.json()
        setOrderTotals(totals)
      }
    } catch {
      // ignore
    } finally {
      setOrderTotalsLoading(false)
    }
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
  const pageStatus = getMuestreoPageStatus(muestreo)

  const cilindros = muestreo.muestras?.filter((m) => m.tipo_muestra === 'CILINDRO') || []
  const vigas = muestreo.muestras?.filter((m) => m.tipo_muestra === 'VIGA') || []
  const cubos = muestreo.muestras?.filter((m) => m.tipo_muestra === 'CUBO') || []

  const remisionLabel = String(muestreo.remision?.remision_number || muestreo.manual_reference || 'Sin remisión')

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
            </div>

            {productionRemision && (
              <div className="lg:col-span-3">
                <CrossPlantProductionCard productionRemision={productionRemision} />
              </div>
            )}
          </div>

          <MuestreoEquipmentCard rows={emaInstrumentos} loading={emaInstrumentosLoading} />

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
