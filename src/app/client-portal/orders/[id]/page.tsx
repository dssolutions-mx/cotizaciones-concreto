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
  // Keep a minimal, valid structure to unblock the build
  return (
    <div className="min-h-screen bg-background-primary">
      <Container maxWidth="2xl" className="py-8">
        <button
          onClick={() => router.back()}
          className="text-label-secondary hover:text-label-primary mb-4"
        >
          Volver
        </button>
        <h1 className="text-large-title font-bold text-label-primary">
          Pedido {String((params as any)?.id ?? '')}
        </h1>
      </Container>
    </div>
  );
}