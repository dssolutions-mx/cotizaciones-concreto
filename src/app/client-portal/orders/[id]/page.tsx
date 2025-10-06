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

  // const config = statusConfig[order.order_status] || statusConfig.created;
  // const totalVolume = 0;

  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-8">
        <h1>Order Details Page</h1>
        <p>Order ID: {params.id}</p>
      </Container>
    </div>
  );
}
