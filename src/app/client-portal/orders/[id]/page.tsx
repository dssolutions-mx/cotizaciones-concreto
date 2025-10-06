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

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const response = await fetch(`/api/client-portal/orders/${params.id}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch order');
        }

        setOrder(result.order);
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

        {/* Remisiones */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <div className="glass-base rounded-3xl p-8">
            <h2 className="text-title-2 font-bold text-label-primary mb-6">
              Entregas (Remisiones)
            </h2>
            {order?.remisiones && order.remisiones.length > 0 ? (
              <div className="space-y-4">
                {order.remisiones.map((remision, index) => (
                  <motion.div
                    key={remision.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    className="glass-thin rounded-xl p-6"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-body font-semibold text-label-primary">
                        Remisión #{remision.remision_number}
                      </p>
                      <Badge variant="success">
                        {remision.tipo_remision}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-footnote">
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
                    </div>
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

        {/* Quality Tests */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="glass-base rounded-3xl p-8">
            <h2 className="text-title-2 font-bold text-label-primary mb-6">
              Ensayos de Calidad
            </h2>
            {order?.ensayos && order.ensayos.length > 0 ? (
              <div className="space-y-4">
                {order.ensayos.map((ensayo, index) => (
                  <motion.div
                    key={ensayo.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                    className="glass-thin rounded-xl p-6"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-body font-semibold text-label-primary">
                        Ensayo - {format(new Date(ensayo.fecha_ensayo), 'dd MMM yyyy', { locale: es })}
                      </p>
                      <Badge
                        variant={
                          parseFloat(ensayo.porcentaje_cumplimiento) >= 95
                            ? 'success'
                            : parseFloat(ensayo.porcentaje_cumplimiento) >= 85
                              ? 'warning'
                              : 'error'
                        }
                      >
                        {ensayo.porcentaje_cumplimiento}% Cumplimiento
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-footnote">
                      <div>
                        <p className="text-label-tertiary">Resistencia</p>
                        <p className="text-label-primary font-medium">
                          {ensayo.resistencia_calculada} kg/cm²
                        </p>
                      </div>
                      <div>
                        <p className="text-label-tertiary">Carga</p>
                        <p className="text-label-primary font-medium">{ensayo.carga_kg} kg</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
                <p className="text-body text-label-secondary">
                  Aún no hay ensayos registrados
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </Container>
    </div>
  );
}
