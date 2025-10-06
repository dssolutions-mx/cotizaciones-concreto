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
import { createClient } from '@/lib/supabase/client';
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
  order_status: string;
  total_amount: number;
  remisiones: Array<{
    id: string;
    remision_number: string;
    volumen_fabricado: string;
    tipo_remision: string;
    fecha_hora_salida: string;
    status: string;
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
  const supabase = createClient();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrder() {
      try {
        // First get the order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', params.id)
          .single();

        if (orderError) throw orderError;

        // Then get remisiones separately
        const { data: remisionesData, error: remError } = await supabase
          .from('remisiones')
          .select('id, remision_number, volumen_fabricado, tipo_remision, fecha_hora_salida, status')
          .eq('order_id', params.id);

        if (remError) {
          console.warn('Error fetching remisiones:', remError);
        }

        setOrder({
          ...orderData,
          remisiones: remisionesData || []
        });
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchOrder();
    }
  }, [params.id, supabase]);

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

  const config = statusConfig[order.order_status] || statusConfig.created;
  const totalVolume = order.remisiones?.reduce(
    (sum, r) => sum + (parseFloat(r.volumen_fabricado) || 0),
    0
  ) || 0;

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-8">
        {/* Back Button - Refined Glass Effect */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          whileHover={{ x: -2 }}
          onClick={() => router.back()}
          className="flex items-center gap-2 text-label-secondary hover:text-label-primary mb-8 glass-thin px-4 py-2 rounded-xl transition-all duration-200"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-callout font-medium">Volver</span>
        </motion.button>

        {/* Header Card - Refined Glass Effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="glass-base rounded-3xl p-8">
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1 className="text-large-title font-bold text-label-primary mb-3">
                  Pedido #{order.order_number}
                </h1>
                <Badge variant={config.variant} size="lg">
                  {config.label}
                </Badge>
              </div>
              <div className="w-16 h-16 rounded-2xl glass-thick flex items-center justify-center border border-white/30">
                <Package className="w-8 h-8 text-label-primary" />
              </div>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl glass-thin flex items-center justify-center border border-white/20">
                    <MapPin className="w-5 h-5 text-label-tertiary" />
                  </div>
                  <div>
                    <p className="text-caption text-label-tertiary uppercase tracking-wide">Obra</p>
                    <p className="text-body font-semibold text-label-primary">{order.construction_site}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl glass-thin flex items-center justify-center border border-white/20">
                    <Calendar className="w-5 h-5 text-label-tertiary" />
                  </div>
                  <div>
                    <p className="text-caption text-label-tertiary uppercase tracking-wide">Fecha</p>
                    <p className="text-body font-semibold text-label-primary">
                      {format(new Date(order.delivery_date), "d 'de' MMMM", { locale: es })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl glass-thin flex items-center justify-center border border-white/20">
                    <Truck className="w-5 h-5 text-label-tertiary" />
                  </div>
                  <div>
                    <p className="text-caption text-label-tertiary uppercase tracking-wide">Volumen Total</p>
                    <p className="text-body font-semibold text-label-primary">{totalVolume.toFixed(1)} m³</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Deliveries Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="glass-base rounded-3xl p-8">
            <div className="flex items-center gap-4 mb-8">
              <Truck className="w-6 h-6 text-label-tertiary" />
              <h2 className="text-title-2 font-bold text-label-primary">
                Entregas ({order.remisiones?.length || 0})
              </h2>
            </div>

            {order.remisiones && order.remisiones.length > 0 ? (
              <div className="space-y-4">
                {order.remisiones.map((remision, index) => (
                  <motion.div
                    key={remision.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + index * 0.05 }}
                    className="glass-thin rounded-2xl p-6 hover:glass-base transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl glass-thin flex items-center justify-center border border-white/20">
                          <CheckCircle2 className="w-5 h-5 text-label-tertiary" />
                        </div>
                        <div>
                          <p className="text-body font-semibold text-label-primary">
                            Remisión #{remision.remision_number}
                          </p>
                          <p className="text-callout text-label-secondary">
                            {remision.tipo_remision}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-title-3 font-bold text-label-primary">
                          {parseFloat(remision.volumen_fabricado).toFixed(1)} m³
                        </p>
                        <Badge variant="success" size="sm">
                          {remision.status || 'Entregado'}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-footnote text-label-tertiary">
                      <Clock className="w-4 h-4" />
                      {format(new Date(remision.fecha_hora_salida), "d MMM yyyy, HH:mm", { locale: es })}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="w-16 h-16 text-label-tertiary mx-auto mb-4" />
                <p className="text-body text-label-secondary">
                  No hay entregas registradas para este pedido
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </Container>
    </div>
  );
}