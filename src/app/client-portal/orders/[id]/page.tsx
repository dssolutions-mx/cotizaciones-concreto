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
  FileText,
  ChevronLeft
} from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Card as BaseCard } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/DataList';
import ClientPortalLoader from '@/components/client-portal/ClientPortalLoader';
import { useUserPermissions } from '@/hooks/client-portal/useUserPermissions';
import { appendPortalClientId } from '@/lib/client-portal/portalClientIdUrl';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { parseLocalDate } from '@/lib/parseLocalDate';

function getVatRateFromOrder(order: {
  plant?: { business_unit?: { vat_rate?: number } | { vat_rate?: number }[] | null } | null;
}): number {
  const bu = order.plant?.business_unit;
  const raw = Array.isArray(bu) ? bu[0]?.vat_rate : bu?.vat_rate;
  return typeof raw === 'number' && !Number.isNaN(raw) ? raw : 0.16;
}

/** Aligns with operación interna: montos de partida son sin IVA; total con IVA cuando aplica factura. */
function getClientPortalOrderTotals(order: {
  total_amount: number;
  final_amount?: number | null;
  invoice_amount?: number | null;
  requires_invoice?: boolean;
  order_items?: { total_price?: number }[];
  order_additional_products?: { total_price?: number }[];
  plant?: {
    business_unit?: { vat_rate?: number } | { vat_rate?: number }[] | null;
  } | null;
}): {
  vatRate: number;
  subtotal: number;
  iva: number;
  total: number;
  requiresInvoice: boolean;
} {
  const vatRate = getVatRateFromOrder(order);
  const concreteSum =
    order.order_items?.reduce((s, i) => s + (Number(i.total_price) || 0), 0) ?? 0;
  const extrasSum =
    order.order_additional_products?.reduce((s, i) => s + (Number(i.total_price) || 0), 0) ?? 0;
  const itemsSum = concreteSum + extrasSum;
  const requiresInvoice = Boolean(order.requires_invoice);

  if (!requiresInvoice) {
    const subtotal =
      order.final_amount != null && !Number.isNaN(Number(order.final_amount))
        ? Number(order.final_amount)
        : Number(order.total_amount) || itemsSum;
    return { vatRate, subtotal, iva: 0, total: subtotal, requiresInvoice: false };
  }

  const invoiceAmt =
    order.invoice_amount != null && !Number.isNaN(Number(order.invoice_amount))
      ? Number(order.invoice_amount)
      : null;

  if (invoiceAmt != null) {
    const total = invoiceAmt;
    let subtotal: number;
    if (order.final_amount != null && !Number.isNaN(Number(order.final_amount))) {
      subtotal = Number(order.final_amount);
    } else {
      subtotal = total / (1 + vatRate);
    }
    let iva = total - subtotal;
    if (iva < 0 || !Number.isFinite(iva)) {
      iva = subtotal * vatRate;
    }
    return { vatRate, subtotal, iva, total, requiresInvoice: true };
  }

  const subtotal =
    order.final_amount != null && !Number.isNaN(Number(order.final_amount))
      ? Number(order.final_amount)
      : Number(order.total_amount) || itemsSum;
  const iva = subtotal * vatRate;
  const total = subtotal + iva;
  return { vatRate, subtotal, iva, total, requiresInvoice: true };
}

interface OrderDetail {
  id: string;
  order_number: string;
  construction_site: string;
  delivery_date: string;
  delivery_time?: string;
  order_status: string;
  client_approval_status?: string;
  total_amount: number;
  final_amount?: number | null;
  invoice_amount?: number | null;
  plant?: {
    business_unit?: { vat_rate?: number } | { vat_rate?: number }[] | null;
  } | null;
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
  order_additional_products?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes?: string | null;
    additional_products?:
      | { name?: string | null; code?: string | null; unit?: string | null }
      | { name?: string | null; code?: string | null; unit?: string | null }[]
      | null;
  }>;
}

function portalAdditionalProductMeta(line: NonNullable<OrderDetail['order_additional_products']>[number]) {
  const raw = line.additional_products;
  const meta = Array.isArray(raw) ? raw[0] : raw;
  return {
    name: meta?.name?.trim() || 'Producto adicional',
    code: meta?.code?.trim() || '',
    unit: meta?.unit?.trim() || '',
  };
}

// Helper function to get the combined status for client portal display
function getCombinedStatus(order: OrderDetail | undefined): { variant: any; label: string } {
  if (!order) return { variant: 'neutral', label: 'Cargando...' };
  
  const { order_status, credit_status, client_approval_status } = order;
  
  // Check client approval status first (pending client executive approval)
  if (client_approval_status === 'pending_client') {
    return { variant: 'warning', label: 'Pendiente de Aprobación' };
  }
  
  // Check if order was rejected by client
  if (client_approval_status === 'rejected_by_client') {
    return { variant: 'error', label: 'Rechazado por Cliente' };
  }
  
  // Order is approved by client or doesn't need approval - check credit status
  if (client_approval_status === 'approved_by_client' || client_approval_status === 'not_required') {
    if (credit_status === 'pending') {
      return { variant: 'secondary', label: 'Pendiente de Crédito' };
    }
    if (credit_status === 'approved') {
      // Credit approved - now check order status for delivery progress
      if (order_status === 'in_progress') {
        return { variant: 'primary', label: 'En Progreso' };
      }
      if (order_status === 'completed') {
        return { variant: 'success', label: 'Completado' };
      }
      return { variant: 'success', label: 'Aprobado' };
    }
    if (credit_status === 'rejected') {
      return { variant: 'error', label: 'Crédito Rechazado' };
    }
  }
  
  // Fallback to order_status based display
  const statusConfig: Record<string, { variant: any; label: string }> = {
    created: { variant: 'neutral', label: 'Creado' },
    validated: { variant: 'success', label: 'Validado' },
    in_progress: { variant: 'primary', label: 'En Progreso' },
    completed: { variant: 'success', label: 'Completado' },
    cancelled: { variant: 'error', label: 'Cancelado' }
  };
  
  return statusConfig[order_status] || { variant: 'neutral', label: 'Creado' };
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
  };
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { canViewPrices } = useUserPermissions();
  const [orderData, setOrderData] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<'order' | 'remisiones' | 'quality' | 'complete'>('order');

  useEffect(() => {
    async function fetchOrder() {
      try {
        setLoadingStage('order');
        const response = await fetch(appendPortalClientId(`/api/client-portal/orders/${params.id}`));
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
    const stageMessages = {
      order: 'Cargando detalles del pedido...',
      remisiones: 'Cargando remisiones...',
      quality: 'Cargando datos de calidad...',
      complete: 'Finalizando...'
    };
    return <ClientPortalLoader message="Cargando pedido" stage={stageMessages[loadingStage]} />;
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

  const orderTotals = getClientPortalOrderTotals(order);

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
            {/* iOS 26-style back affordance */}
            <button
              onClick={() => router.back()}
              className="group flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-white/60 dark:bg-white/5 border border-white/30 backdrop-blur-sm transition-colors hover:bg-white/70"
            >
              <ChevronLeft className="w-4 h-4 text-label-primary" />
              <span className="text-callout font-medium text-label-primary group-hover:text-label-primary/90">Volver</span>
            </button>
            <div className="w-12 h-12 rounded-2xl glass-thick flex items-center justify-center border border-white/30">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-large-title font-bold text-label-primary">
                Pedido {order?.order_number}
              </h1>
              <p className="text-body text-label-secondary">
                {order?.construction_site} • {order?.delivery_date ?
                  format(parseLocalDate(order.delivery_date), 'dd MMM yyyy', { locale: es }) :
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
          <div className="glass-base rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-title-2 font-bold text-label-primary">
                Estado del Pedido
              </h2>
              <Badge variant={getCombinedStatus(order).variant}>
                {getCombinedStatus(order).label}
              </Badge>
            </div>

            <div className={`grid grid-cols-1 gap-6 ${
              order?.elemento ? 'md:grid-cols-4' : 'md:grid-cols-3'
            }`}>
              <div className="glass-thin rounded-2xl p-6 border border-white/10 transition-all hover:border-primary/20 hover:shadow-sm">
                <div className="flex items-center gap-4 mb-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                    Fecha de Entrega
                  </p>
                </div>
                <p className="text-title-3 font-bold text-label-primary">
                  {order?.delivery_date ?
                    format(parseLocalDate(order.delivery_date), 'dd MMM yyyy', { locale: es }) :
                    'Por confirmar'}
                </p>
                {order?.delivery_time && (
                  <p className="text-callout text-label-secondary">
                    {order.delivery_time}
                  </p>
                )}
              </div>

              <div className="glass-thin rounded-2xl p-6 border border-white/10 transition-all hover:border-primary/20 hover:shadow-sm">
                <div className="flex items-center gap-4 mb-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                    Obra
                  </p>
                </div>
                <p className="text-title-3 font-bold text-label-primary">
                  {order?.construction_site}
                </p>
              </div>

              {order?.elemento && (
                <div className="glass-thin rounded-2xl p-6 border border-white/10 transition-all hover:border-primary/20 hover:shadow-sm">
                  <div className="flex items-center gap-4 mb-3">
                    <Package className="w-5 h-5 text-primary" />
                    <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                      Elemento
                    </p>
                  </div>
                  <p className="text-title-3 font-bold text-label-primary">
                    {order.elemento}
                  </p>
                </div>
              )}

              <div className="glass-thin rounded-2xl p-6 border border-white/10 transition-all hover:border-primary/20 hover:shadow-sm">
                <div className="flex items-center gap-4 mb-3">
                  <Truck className="w-5 h-5 text-primary" />
                  <p className="text-footnote text-label-tertiary uppercase tracking-wide">
                    Estado
                  </p>
                </div>
                <p className="text-title-3 font-bold text-label-primary">
                  {getCombinedStatus(order).label}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Order Items */}
        {(order?.order_items && order.order_items.length > 0) ||
        (order?.order_additional_products && order.order_additional_products.length > 0) ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <div className="glass-base rounded-3xl p-8 shadow-sm">
              {order.order_items && order.order_items.length > 0 ? (
                <>
                  <h2 className="text-title-2 font-bold text-label-primary mb-8">
                    Productos del Pedido
                  </h2>
                  <div className="space-y-4">
                    {order.order_items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + index * 0.05 }}
                        className="glass-thin rounded-xl p-6 border border-white/10 transition-all hover:border-primary/20 hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-body font-semibold text-label-primary">
                            {item.product_type}
                          </p>
                          {canViewPrices ? (
                            <div className="text-right">
                              <p className="text-footnote text-label-tertiary">Importe (sin IVA)</p>
                              <p className="text-title-3 font-bold text-label-primary">
                                ${item.total_price.toLocaleString('es-MX')}
                              </p>
                            </div>
                          ) : (
                            <p className="text-title-3 font-bold text-label-tertiary">
                              Precio no disponible
                            </p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-footnote">
                          <div>
                            <p className="text-label-tertiary">Volumen</p>
                            <p className="text-label-primary font-medium">{item.volume} m³</p>
                          </div>
                          <div>
                            <p className="text-label-tertiary">
                              Precio unitario{order.requires_invoice ? ' (sin IVA)' : ''}
                            </p>
                            {canViewPrices ? (
                              <p className="text-label-primary font-medium">${item.unit_price.toLocaleString('es-MX')}</p>
                            ) : (
                              <p className="text-label-tertiary font-medium">No disponible</p>
                            )}
                          </div>
                        </div>
                        {item.has_pump_service && (
                          <div className="mt-3 pt-3 border-t border-white/20">
                            <p className="text-caption text-label-secondary">
                              Servicio de bombeo incluido
                              {canViewPrices && ` • $${item.pump_price?.toLocaleString('es-MX')}`}
                              {` • ${item.pump_volume} m³`}
                            </p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : null}

              {order.order_additional_products && order.order_additional_products.length > 0 ? (
                <div
                  className={
                    order.order_items && order.order_items.length > 0
                      ? 'mt-10 pt-2 border-t border-white/10'
                      : ''
                  }
                >
                  <h2 className="text-title-2 font-bold text-label-primary mb-8">
                    Productos adicionales
                  </h2>
                  <p className="text-caption text-label-secondary -mt-4 mb-6">
                    Partidas de la cotización asociadas a este pedido (no son el concreto principal).
                  </p>
                  <div className="space-y-4">
                    {order.order_additional_products.map((line, index) => {
                      const meta = portalAdditionalProductMeta(line);
                      const delayBase =
                        (order.order_items?.length ?? 0) > 0 ? 0.35 + order.order_items!.length * 0.05 : 0.3;
                      return (
                        <motion.div
                          key={line.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: delayBase + index * 0.05 }}
                          className="glass-thin rounded-xl p-6 border border-white/10 transition-all hover:border-primary/20 hover:shadow-sm"
                        >
                          <div className="flex items-center justify-between mb-3 gap-4">
                            <div className="min-w-0">
                              <p className="text-body font-semibold text-label-primary">{meta.name}</p>
                              {meta.code ? (
                                <p className="text-footnote text-label-tertiary mt-0.5">Código: {meta.code}</p>
                              ) : null}
                            </div>
                            {canViewPrices ? (
                              <div className="text-right shrink-0">
                                <p className="text-footnote text-label-tertiary">Importe (sin IVA)</p>
                                <p className="text-title-3 font-bold text-label-primary">
                                  ${line.total_price.toLocaleString('es-MX')}
                                </p>
                              </div>
                            ) : (
                              <p className="text-title-3 font-bold text-label-tertiary shrink-0">
                                Precio no disponible
                              </p>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-footnote">
                            <div>
                              <p className="text-label-tertiary">Cantidad</p>
                              <p className="text-label-primary font-medium">
                                {line.quantity}
                                {meta.unit ? ` ${meta.unit}` : ''}
                              </p>
                            </div>
                            <div>
                              <p className="text-label-tertiary">
                                Precio unitario{order.requires_invoice ? ' (sin IVA)' : ''}
                              </p>
                              {canViewPrices ? (
                                <p className="text-label-primary font-medium">
                                  ${line.unit_price.toLocaleString('es-MX')}
                                </p>
                              ) : (
                                <p className="text-label-tertiary font-medium">No disponible</p>
                              )}
                            </div>
                          </div>
                          {line.notes ? (
                            <p className="text-caption text-label-secondary mt-3 pt-3 border-t border-white/20">
                              {line.notes}
                            </p>
                          ) : null}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {canViewPrices && (
                <div className="mt-8 pt-6 border-t border-white/20 space-y-3">
                  {orderTotals.requiresInvoice ? (
                    <>
                      <div className="flex justify-between text-footnote">
                        <span className="text-label-tertiary">Subtotal (sin IVA)</span>
                        <span className="text-label-primary font-medium tabular-nums">
                          ${orderTotals.subtotal.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between text-footnote">
                        <span className="text-label-tertiary">
                          IVA ({(orderTotals.vatRate * 100).toFixed(0)}%)
                        </span>
                        <span className="text-label-primary font-medium tabular-nums">
                          ${orderTotals.iva.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline gap-4 pt-2">
                        <span className="text-body font-semibold text-label-primary">Total (con IVA)</span>
                        <span className="text-title-2 font-bold text-label-primary tabular-nums">
                          ${orderTotals.total.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                      <p className="text-caption text-label-tertiary pt-1">
                        Los importes por producto y el subtotal son antes de IVA. El total final corresponde al monto a facturar.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-baseline gap-4">
                        <span className="text-body font-semibold text-label-primary">Total</span>
                        <span className="text-title-2 font-bold text-label-primary tabular-nums">
                          ${orderTotals.total.toLocaleString('es-MX', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}
                        </span>
                      </div>
                      <p className="text-caption text-label-tertiary pt-1">
                        Pedido sin factura: no aplica IVA. El monto mostrado es el total del pedido.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}

        {/* Remisiones with Quality Data */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <div className="glass-base rounded-3xl p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
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
                    className="glass-thin rounded-xl p-6 border border-white/10 transition-all hover:border-primary/20 hover:shadow-sm"
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
                          {format(parseLocalDate(remision.fecha), 'dd MMM yyyy', { locale: es })}
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

                    {/* Muestreos */}
                    {remision.muestreos && remision.muestreos.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-caption font-semibold text-label-primary mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
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
                                  {format(parseLocalDate(muestreo.fecha_muestreo), 'dd MMM', { locale: es })}
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
                                      <p className="text-label-primary font-medium">{Math.round(muestreo.masa_unitaria)}</p>
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
                          <CheckCircle2 className="w-4 h-4 text-primary" />
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
                                  {format(parseLocalDate(siteCheck.fecha_muestreo), 'dd MMM HH:mm', { locale: es })}
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
            <div className="glass-base rounded-3xl p-8 shadow-sm">
              <h2 className="text-title-2 font-bold text-label-primary mb-8">
                Resumen de Calidad
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
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
              </div>
            </div>
          </motion.div>
        )}
      </Container>
    </div>
  );
}
