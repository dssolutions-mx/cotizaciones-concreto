'use client'

import React from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Beaker,
  Building,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  MinusCircle,
  Package,
  Thermometer,
  Truck,
  User,
  Wind,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { MuestreoWithRelations } from '@/types/quality'
import { cn, formatDate } from '@/lib/utils'
import { qualityHubLinkOutlineClass, qualityHubOutlineNeutralClass } from '../../qualityHubUi'
import { getOrderInfo } from './muestreoDetailUtils'
import MuestreoRevenimientoInline from './MuestreoRevenimientoInline'

type OrderTotals = {
  totalOrderVolume: number
  totalOrderSamplings: number
  totalRemisiones: number
} | null

type Rendimiento = {
  value: number | null
  sumaMateriales: number
  volumenFabricado: number
  masaUnitaria: number
} | null

type PageStatus = { label: string; className: string }

function StatusIcon({ label }: { label: string }) {
  if (label === 'Completado') return <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
  if (label === 'En progreso') return <Clock className="h-4 w-4 shrink-0 text-amber-600" />
  if (label === 'Sin muestras') return <MinusCircle className="h-4 w-4 shrink-0 text-stone-500" />
  return <AlertCircle className="h-4 w-4 shrink-0 text-stone-600" />
}

type Props = {
  muestreo: MuestreoWithRelations
  muestreoId: string
  pageStatus: PageStatus
  orderTotals: OrderTotals
  orderTotalsLoading: boolean
  rendimientoVolumetrico: Rendimiento
  rendimientoLoading: boolean
  onRetryOrderTotals: () => void
  onRevenimientoSaved: () => void
}

export default function MuestreoMainCard({
  muestreo,
  muestreoId,
  pageStatus,
  orderTotals,
  orderTotalsLoading,
  rendimientoVolumetrico,
  rendimientoLoading,
  onRetryOrderTotals,
  onRevenimientoSaved,
}: Props) {
  const order = getOrderInfo(muestreo)

  return (
    <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Beaker className="h-5 w-5 text-stone-600" />
          Información del Muestreo
        </CardTitle>
        <CardDescription>Detalles del muestreo y condiciones de fabricación</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-stone-500 mb-1">Muestreo #</p>
                <div className="flex items-center gap-2">
                  <Beaker className="h-4 w-4 text-stone-600" />
                  <span className="font-semibold text-stone-900">{muestreo.numero_muestreo}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-500 mb-1">Estado</p>
                <div className="flex items-center gap-2">
                  <StatusIcon label={pageStatus.label} />
                  <Badge variant="outline" className={`text-xs ${pageStatus.className}`}>
                    {pageStatus.label}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Fecha Muestreo</p>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-stone-600" />
                <p className="font-semibold text-stone-900">{formatDate(muestreo.fecha_muestreo, 'PPP')}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Planta</p>
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-stone-600" />
                <Badge variant="outline" className="bg-stone-50 text-stone-700 border-stone-300">
                  {muestreo.planta}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Cliente</p>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-stone-600" />
                <p className="font-semibold text-stone-900">
                  {muestreo.remision?.order?.clients?.business_name || 'No disponible'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Remisión</p>
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-stone-600" />
                <Badge variant="secondary">
                  {muestreo.remision?.remision_number || muestreo.manual_reference || 'No disponible'}
                </Badge>
              </div>
            </div>

            {muestreo.remision?.hora_carga && (
              <div>
                <p className="text-sm font-medium text-stone-500 mb-1">Hora Carga</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-stone-600" />
                  <p className="font-semibold text-stone-900">{muestreo.remision.hora_carga}</p>
                </div>
              </div>
            )}

            {order && (
              <div>
                <p className="text-sm font-medium text-stone-500 mb-1">Orden</p>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-stone-600" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`/orders/${order.id}`, '_blank')}
                    className={cn(qualityHubLinkOutlineClass, 'px-2 py-1 h-auto text-xs gap-0.5')}
                  >
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    {order.order_number || `#${order.id?.slice(0, 8)}...`}
                  </Button>
                </div>
              </div>
            )}

            {(typeof muestreo.temperatura_ambiente === 'number' ||
              typeof muestreo.temperatura_concreto === 'number' ||
              muestreo.contenido_aire != null) && (
              <div className="pt-3 border-t border-stone-100">
                <p className="text-sm font-medium text-stone-500 mb-2">Condiciones Ambientales</p>
                <div className="grid grid-cols-2 gap-3">
                  {typeof muestreo.temperatura_ambiente === 'number' && (
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-3 w-3 text-stone-500" />
                      <span className="text-xs text-stone-600">{muestreo.temperatura_ambiente}°C</span>
                    </div>
                  )}
                  {typeof muestreo.temperatura_concreto === 'number' && (
                    <div className="flex items-center gap-2">
                      <Beaker className="h-3 w-3 text-stone-500" />
                      <span className="text-xs text-stone-600">{muestreo.temperatura_concreto}°C</span>
                    </div>
                  )}
                  {muestreo.contenido_aire != null && (
                    <div className="flex items-center gap-2">
                      <Wind className="h-3 w-3 text-stone-500" />
                      <span className="text-xs text-stone-600">{muestreo.contenido_aire}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Fórmula</p>
              <Badge variant="outline" className="bg-stone-50 text-stone-700 border-stone-300">
                {muestreo.remision?.recipe?.recipe_code || 'No disponible'}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Resistencia Diseño</p>
              <div className="text-lg font-bold text-stone-900">
                {muestreo.remision?.recipe?.strength_fc ?? '--'} kg/cm²
              </div>
            </div>

            <MuestreoRevenimientoInline
              muestreoId={muestreoId}
              valueCm={muestreo.revenimiento_sitio}
              onSaved={onRevenimientoSaved}
            />

            {typeof muestreo.masa_unitaria === 'number' && (
              <div>
                <p className="text-sm font-medium text-stone-500 mb-1">Masa Unitaria</p>
                <div className="text-2xl font-bold text-stone-900">
                  {Math.round(muestreo.masa_unitaria)}
                  <span className="text-sm font-normal text-stone-500 ml-1">kg/m³</span>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-stone-500 mb-1">Rendimiento Volumétrico</p>
              {rendimientoLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-stone-500" />
                  <span className="text-sm text-stone-500">Calculando...</span>
                </div>
              ) : rendimientoVolumetrico?.value != null ? (
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-stone-900">
                    {rendimientoVolumetrico.value.toFixed(1)}
                    <span className="text-sm font-normal text-stone-500 ml-1">%</span>
                  </div>
                  <div className="text-xs text-stone-500 space-y-1">
                    <div>Volumen fabricado: {rendimientoVolumetrico.volumenFabricado.toFixed(2)} m³</div>
                    <div>Suma materiales: {rendimientoVolumetrico.sumaMateriales.toFixed(0)} kg</div>
                    <div>Masa unitaria: {rendimientoVolumetrico.masaUnitaria.toFixed(0)} kg/m³</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-stone-500">No disponible</div>
              )}
            </div>

            {order && (
              <div className="pt-4 border-t border-stone-200">
                <h4 className="text-sm font-medium text-stone-700 mb-3">Resumen de la Orden</h4>
                {orderTotalsLoading ? (
                  <div className="flex items-center gap-2 text-stone-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Cargando resumen...</span>
                  </div>
                ) : orderTotals ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-stone-500 mb-1">Volumen Total</p>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-stone-600" />
                        <span className="text-lg font-bold text-stone-900">{orderTotals.totalOrderVolume} m³</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-500 mb-1">Total Muestreos</p>
                      <div className="flex items-center gap-2">
                        <Beaker className="h-4 w-4 text-stone-600" />
                        <span className="text-lg font-bold text-stone-900">{orderTotals.totalOrderSamplings}</span>
                        <span className="text-xs text-stone-500">muestreos</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-stone-500">No se pudo cargar el resumen de la orden</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetryOrderTotals}
                  className={cn(qualityHubOutlineNeutralClass, 'h-6 px-2 text-xs')}
                >
                  Reintentar
                </Button>
                  </div>
                )}
                {order.construction_site && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-stone-500 mb-1">Obra</p>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-stone-600" />
                      <span className="text-sm text-stone-900">{order.construction_site}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
