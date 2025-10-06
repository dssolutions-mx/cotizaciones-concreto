'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  Package, 
  Truck,
  Clock,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Card as BaseCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/DataList';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderDetail {
  id: string;
  order_number: string;
  construction_site: string;
  delivery_date: string;
  delivery_time?: string;
  order_status: string;
  total_amount: number;
  elemento?: string;
  special_requirements?: string;
  requires_invoice?: boolean;
  credit_status?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  order_items?: Array<{
    id: string;
    product_type: string;
    volume: number;
    unit_price: number;
    total_price: number;
    has_pump_service: boolean;
    pump_price?: number;
    pump_volume?: number;
    has_empty_truck_charge: boolean;
    empty_truck_volume?: number;
    empty_truck_price?: number;
  }>;
}

const statusConfig: Record<string, { variant: any; label: string }> = {
  created: { variant: 'neutral', label: 'Creado' },
  approved: { variant: 'success', label: 'Aprobado' },
  in_progress: { variant: 'primary', label: 'En Progreso' },
  completed: { variant: 'success', label: 'Completado' },
  cancelled: { variant: 'error', label: 'Cancelado' }
};

interface OrderResponse {
  order: OrderDetail;
  quote: any;
  remisiones: any[];
  summary: {
    totalRemisiones: number;
    totalVolume: number;
    totalMuestreos: number;
    totalSiteChecks: number;
    avgRendimientoVolumetrico?: number | null;
    totalMaterialReal?: number;
    totalMaterialTeorico?: number;
  };
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<'order' | 'remisiones' | 'quality' | 'complete'>('order');

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoadingStage('order');
        const response = await fetch(`/api/client-portal/orders/${params.id}`);
        const result = await response.json();

        if (!response.ok) {
          console.error('Order detail API error:', result);
          throw new Error(result.error || 'Failed to fetch order');
        }

        console.log('Order detail data received:', result);
        
        // Set data progressively
        setLoadingStage('remisiones');
        setOrderData(result);
        
        // Small delay to show progressive loading
        setTimeout(() => {
          setLoadingStage('quality');
        }, 100);
        
        setTimeout(() => {
          setLoadingStage('complete');
        }, 200);
        
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchOrder();
    }
  }, [params.id]);

  const order = orderData?.order;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-primary">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-16 h-16 border-4 border-label-tertiary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!order) {
    return (
      <Container>
        <div className="glass-base rounded-3xl p-12 text-center">
          <h2 className="text-title-2 font-bold text-label-primary mb-3">
            Pedido no encontrado
          </h2>
          <button
            onClick={() => router.back()}
            className="text-label-secondary hover:text-label-primary font-medium mt-4 transition-colors"
          >
            Volver
          </button>
        </div>
      </Container>
    );
  }

  // const config = statusConfig[order.order_status] || statusConfig.created;
  // const totalVolume = 0;

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-8">
        {/* Header - iOS 26 Typography */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </Button>
            <div className="w-12 h-12 rounded-2xl glass-thick flex items-center justify-center border border-white/30">
              <Package className="w-6 h-6 text-label-primary" />
            </div>
            <div>
              <h1 className="text-large-title font-bold text-label-primary">
                Pedido {order?.order_number}
              </h1>
              <p className="text-body text-label-secondary">
                {order?.construction_site} • {order?.delivery_date ?
                  format(new Date(order.delivery_date), 'dd MMM yyyy', { locale: es }) :
                  'Fecha por confirmar'}
              </p>
            </div>
          </div>
        </motion.div>


        {/* Order Status */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="glass-base rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-title-2 font-bold text-label-primary">
                Estado del Pedido
              </h2>
              <Badge variant={statusConfig[order?.order_status]?.variant || 'neutral'}>
                {statusConfig[order?.order_status]?.label || order?.order_status}
              </Badge>
            </div>

            <div className={`grid grid-cols-1 gap-6 ${
              orderData?.summary?.avgRendimientoVolumetrico ? 'md:grid-cols-4' : 
              order?.elemento ? 'md:grid-cols-4' : 'md:grid-cols-3'
            }`}>
              <div className="glass-thin rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-3">
                  <Calendar className="w-5 h-5 text-label-tertiary" />
                  <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                    Fecha de Entrega
                  </p>
                </div>
                <p className="text-title-3 font-bold text-label-primary">
                  {order?.delivery_date ?
                    format(new Date(order.delivery_date), 'dd MMM yyyy', { locale: es }) :
                    'Por confirmar'}
                </p>
                {order?.delivery_time && (
                  <p className="text-callout text-label-secondary">
                    {order.delivery_time}
                  </p>
                )}
              </div>

              <div className="glass-thin rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-3">
                  <MapPin className="w-5 h-5 text-label-tertiary" />
                  <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                    Obra
                  </p>
                </div>
                <p className="text-title-3 font-bold text-label-primary">
                  {order?.construction_site}
                </p>
              </div>

              {order?.elemento && (
                <div className="glass-thin rounded-2xl p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <Package className="w-5 h-5 text-label-tertiary" />
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                      Elemento
                    </p>
                  </div>
                  <p className="text-title-3 font-bold text-label-primary">
                    {order.elemento}
                  </p>
                </div>
              )}

              {orderData?.summary?.avgRendimientoVolumetrico !== null && 
               orderData?.summary?.avgRendimientoVolumetrico !== undefined && (
                <div className="glass-thin rounded-2xl p-6 border-2 border-blue-500/30">
                  <div className="flex items-center gap-4 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-label-tertiary" />
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                      Rendimiento
                    </p>
                  </div>
                  <p className="text-title-3 font-bold text-label-primary">
                    {orderData.summary.avgRendimientoVolumetrico.toFixed(1)}%
                  </p>
                  <Badge 
                    variant={
                      orderData.summary.avgRendimientoVolumetrico >= 98 ? 'success' : 
                      orderData.summary.avgRendimientoVolumetrico >= 95 ? 'primary' : 
                      'neutral'
                    }
                    className="mt-2"
                  >
                    {orderData.summary.avgRendimientoVolumetrico >= 98 ? 'Excelente' : 
                     orderData.summary.avgRendimientoVolumetrico >= 95 ? 'Bueno' : 
                     'Aceptable'}
                  </Badge>
                </div>
              )}

              <div className="glass-thin rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-3">
                  <Truck className="w-5 h-5 text-label-tertiary" />
                  <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                    Estado
                  </p>
                </div>
                <p className="text-title-3 font-bold text-label-primary">
                  {statusConfig[order?.order_status]?.label || order?.order_status}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Order Items */}
        {order?.order_items && order.order_items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="glass-base rounded-3xl p-8">
              <h2 className="text-title-2 font-bold text-label-primary mb-6">
                Productos del Pedido
              </h2>
              <div className="space-y-4">
                {order.order_items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.05 }}
                    className="glass-thin rounded-xl p-6"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-body font-semibold text-label-primary">
                        {item.product_type}
                      </p>
                      <p className="text-title-3 font-bold text-label-primary">
                        ${item.total_price.toLocaleString('es-MX')}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-footnote">
                      <div>
                        <p className="text-label-tertiary">Volumen</p>
                        <p className="text-label-primary font-medium">{item.volume} m³</p>
                      </div>
                      <div>
                        <p className="text-label-tertiary">Precio Unitario</p>
                        <p className="text-label-primary font-medium">${item.unit_price.toLocaleString('es-MX')}</p>
                      </div>
                    </div>
                    {item.has_pump_service && (
                      <div className="mt-3 pt-3 border-t border-white/20">
                        <p className="text-caption text-label-secondary">
                          Servicio de bombeo incluido • ${item.pump_price?.toLocaleString('es-MX')} • {item.pump_volume} m³
                        </p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Remisiones with Quality Data */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <div className="glass-base rounded-3xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-title-2 font-bold text-label-primary">
                Entregas (Remisiones)
              </h2>
              {orderData?.summary && (
                <div className="flex gap-4 text-footnote">
                  <div className="text-center">
                    <p className="text-label-tertiary">Total</p>
                    <p className="font-semibold text-label-primary">{orderData.summary.totalRemisiones}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-label-tertiary">Volumen</p>
                    <p className="font-semibold text-label-primary">{orderData.summary.totalVolume.toFixed(1)} m³</p>
                  </div>
                </div>
              )}
            </div>
            {orderData?.remisiones && orderData.remisiones.length > 0 ? (
              <div className="space-y-4">
                {orderData.remisiones.map((remision: any, index: number) => (
                  <motion.div
                    key={remision.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    className="glass-thin rounded-xl p-6"
                  >
                    {/* Remision Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-body font-semibold text-label-primary">
                          Remisión #{remision.remision_number}
                        </p>
                        {remision.conductor && (
                          <p className="text-caption text-label-secondary">
                            Conductor: {remision.conductor} {remision.unidad ? `• Unidad: ${remision.unidad}` : ''}
                          </p>
                        )}
                      </div>
                      <Badge variant={remision.tipo_remision === 'BOMBEO' ? 'primary' : 'success'}>
                        {remision.tipo_remision}
                      </Badge>
                    </div>

                    {/* Remision Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-footnote mb-4">
                      <div>
                        <p className="text-label-tertiary">Fecha</p>
                        <p className="text-label-primary font-medium">
                          {format(new Date(remision.fecha), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                      <div>
                        <p className="text-label-tertiary">Volumen</p>
                        <p className="text-label-primary font-medium">{remision.volumen_fabricado} m³</p>
                      </div>
                      {remision.recipe && (
                        <>
                          <div>
                            <p className="text-label-tertiary">Receta</p>
                            <p className="text-label-primary font-medium">{remision.recipe.recipe_code}</p>
                          </div>
                          <div>
                            <p className="text-label-tertiary">Resistencia</p>
                            <p className="text-label-primary font-medium">{remision.recipe.strength_fc} kg/cm²</p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Material Consumption & Rendimiento */}
                    {remision.materiales && remision.materiales.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-caption font-semibold text-label-primary flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Consumo de Materiales
                          </p>
                          {remision.rendimiento_volumetrico && (
                            <Badge variant={remision.rendimiento_volumetrico >= 98 ? 'success' : remision.rendimiento_volumetrico >= 95 ? 'primary' : 'neutral'}>
                              Rendimiento: {remision.rendimiento_volumetrico.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          {remision.materiales.map((material: any) => (
                            <div key={material.id} className="bg-white/5 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-caption text-label-primary font-medium">
                                  {material.material_type}
                                </p>
                                <p className="text-caption text-label-secondary">
                                  {material.cantidad_real ? `${parseFloat(material.cantidad_real).toFixed(1)} kg` : 'N/A'}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-caption text-label-tertiary">
                                <span>Teórico: {material.cantidad_teorica ? `${parseFloat(material.cantidad_teorica).toFixed(1)} kg` : 'N/A'}</span>
                                {material.ajuste && parseFloat(material.ajuste) !== 0 && (
                                  <span className="text-yellow-600">
                                    Ajuste: {parseFloat(material.ajuste).toFixed(1)} kg
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Muestreos */}
                    {remision.muestreos && remision.muestreos.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-caption font-semibold text-label-primary mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Muestreos ({remision.muestreos.length})
                        </p>
                        <div className="space-y-2">
                          {remision.muestreos.map((muestreo: any) => (
                            <div key={muestreo.id} className="bg-white/5 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-caption text-label-primary font-medium">
                                  Muestreo #{muestreo.numero_muestreo}
                                </p>
                                <p className="text-caption text-label-secondary">
                                  {format(new Date(muestreo.fecha_muestreo), 'dd MMM', { locale: es })}
                                </p>
                              </div>
                              {/* Muestreo measurements */}
                              {(muestreo.revenimiento_sitio || muestreo.masa_unitaria || muestreo.temperatura_concreto) && (
                                <div className="grid grid-cols-3 gap-2 mb-2 text-caption">
                                  {muestreo.revenimiento_sitio && (
                                    <div className="text-center bg-white/5 rounded p-1">
                                      <p className="text-label-tertiary text-[10px]">Rev.</p>
                                      <p className="text-label-primary font-medium">{muestreo.revenimiento_sitio} cm</p>
                                    </div>
                                  )}
                                  {muestreo.masa_unitaria && (
                                    <div className="text-center bg-white/5 rounded p-1">
                                      <p className="text-label-tertiary text-[10px]">M.U.</p>
                                      <p className="text-label-primary font-medium">{muestreo.masa_unitaria.toFixed(0)}</p>
                                    </div>
                                  )}
                                  {muestreo.temperatura_concreto && (
                                    <div className="text-center bg-white/5 rounded p-1">
                                      <p className="text-label-tertiary text-[10px]">Temp.</p>
                                      <p className="text-label-primary font-medium">{muestreo.temperatura_concreto}°C</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {muestreo.muestras && muestreo.muestras.length > 0 && (
                                <>
                                  <p className="text-caption text-label-tertiary mb-2">
                                    {muestreo.muestras.length} muestra(s) • 
                                    {muestreo.muestras.filter((m: any) => m.estado === 'ENSAYADO').length} ensayadas
                                  </p>
                                  {/* Show ensayo results if available */}
                                  {muestreo.muestras.some((m: any) => m.ensayos && m.ensayos.length > 0) && (
                                    <div className="mt-2 space-y-1">
                                      {muestreo.muestras
                                        .filter((m: any) => m.ensayos && m.ensayos.length > 0)
                                        .map((muestra: any) => 
                                          muestra.ensayos.map((ensayo: any, eIdx: number) => (
                                            <div key={`${muestra.id}-${eIdx}`} className="bg-white/5 rounded p-2">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-caption text-label-tertiary">
                                                  {muestra.tipo_muestra}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                  <span className="text-caption text-label-primary font-medium">
                                                    {ensayo.resistencia_calculada.toFixed(1)} kg/cm²
                                                  </span>
                                                  {ensayo.porcentaje_cumplimiento && (
                                                    <Badge 
                                                      variant={ensayo.porcentaje_cumplimiento >= 100 ? 'success' : ensayo.porcentaje_cumplimiento >= 95 ? 'primary' : 'neutral'}
                                                      size="sm"
                                                    >
                                                      {ensayo.porcentaje_cumplimiento.toFixed(0)}%
                                                    </Badge>
                                                  )}
                                                </div>
                                              </div>
                                              {ensayo.edad_display && (
                                                <div className="flex items-center gap-1">
                                                  <Clock className="w-3 h-3 text-label-tertiary" />
                                                  <span className="text-caption text-label-tertiary">
                                                    Edad: <span className="font-semibold text-label-primary">{ensayo.edad_display}</span>
                                                  </span>
                                                  {ensayo.edad_horas !== undefined && (
                                                    <span className="text-[10px] text-label-tertiary">
                                                      ({ensayo.edad_horas}h total)
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          ))
                                        )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Site Checks */}
                    {remision.site_checks && remision.site_checks.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-caption font-semibold text-label-primary mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" />
                          Pruebas en Obra ({remision.site_checks.length})
                        </p>
                        <div className="space-y-2">
                          {remision.site_checks.map((siteCheck: any) => (
                            <div key={siteCheck.id} className="bg-white/5 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant={siteCheck.test_type === 'SLUMP' ? 'primary' : 'neutral'} size="sm">
                                  {siteCheck.test_type}
                                </Badge>
                                <p className="text-caption text-label-secondary">
                                  {format(new Date(siteCheck.fecha_muestreo), 'dd MMM HH:mm', { locale: es })}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-caption">
                                {siteCheck.valor_inicial_cm && (
                                  <div>
                                    <p className="text-label-tertiary">Inicial</p>
                                    <p className="text-label-primary font-medium">{siteCheck.valor_inicial_cm} cm</p>
                                  </div>
                                )}
                                {siteCheck.valor_final_cm && (
                                  <div>
                                    <p className="text-label-tertiary">Final</p>
                                    <p className="text-label-primary font-medium">{siteCheck.valor_final_cm} cm</p>
                                  </div>
                                )}
                              </div>
                              {siteCheck.fue_ajustado && (
                                <p className="text-caption text-yellow-600 mt-2">
                                  ⚠ Ajustado: {siteCheck.detalle_ajuste}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Truck className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
                <p className="text-body text-label-secondary">
                  Aún no hay entregas registradas
                </p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Summary Stats */}
        {orderData?.summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="glass-base rounded-3xl p-8">
              <h2 className="text-title-2 font-bold text-label-primary mb-6">
                Resumen de Calidad
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-footnote text-label-tertiary mb-2">Entregas</p>
                  <p className="text-title-1 font-bold text-label-primary">{orderData.summary.totalRemisiones}</p>
                </div>
                <div className="text-center">
                  <p className="text-footnote text-label-tertiary mb-2">Muestreos</p>
                  <p className="text-title-1 font-bold text-label-primary">{orderData.summary.totalMuestreos}</p>
                </div>
                <div className="text-center">
                  <p className="text-footnote text-label-tertiary mb-2">Pruebas en Obra</p>
                  <p className="text-title-1 font-bold text-label-primary">{orderData.summary.totalSiteChecks}</p>
                </div>
                {orderData.summary.avgRendimientoVolumetrico !== null && orderData.summary.avgRendimientoVolumetrico !== undefined && (
                  <div className="text-center">
                    <p className="text-footnote text-label-tertiary mb-2">Rendimiento Volumétrico</p>
                    <p className="text-title-1 font-bold text-label-primary">
                      {orderData.summary.avgRendimientoVolumetrico.toFixed(1)}%
                    </p>
                    <Badge 
                      variant={
                        orderData.summary.avgRendimientoVolumetrico >= 98 ? 'success' : 
                        orderData.summary.avgRendimientoVolumetrico >= 95 ? 'primary' : 
                        'neutral'
                      }
                      className="mt-2"
                    >
                      {orderData.summary.avgRendimientoVolumetrico >= 98 ? 'Excelente' : 
                       orderData.summary.avgRendimientoVolumetrico >= 95 ? 'Bueno' : 
                       'Aceptable'}
                    </Badge>
                  </div>
                )}
              </div>
              
              {/* Material Consumption Summary */}
              {orderData.summary.totalMaterialReal > 0 && orderData.summary.totalMaterialTeorico > 0 && (
                <div className="mt-6 pt-6 border-t border-white/20">
                  <h3 className="text-body font-semibold text-label-primary mb-4">
                    Consumo Total de Materiales
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="glass-thin rounded-xl p-4">
                      <p className="text-footnote text-label-tertiary mb-1">Material Real</p>
                      <p className="text-title-3 font-bold text-label-primary">
                        {(orderData.summary.totalMaterialReal / 1000).toFixed(2)} ton
                      </p>
                    </div>
                    <div className="glass-thin rounded-xl p-4">
                      <p className="text-footnote text-label-tertiary mb-1">Material Teórico</p>
                      <p className="text-title-3 font-bold text-label-primary">
                        {(orderData.summary.totalMaterialTeorico / 1000).toFixed(2)} ton
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </Container>
    </div>
  );
}
