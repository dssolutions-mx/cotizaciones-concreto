'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, XCircle, ChevronRight } from 'lucide-react';
import OrderDetailClient from '@/components/orders/OrderDetailClient';
import { GlassDashboardLayout } from '@/components/orders/GlassDashboardLayout';

// Component to show success/error messages when redirected from email actions
function ActionMessage() {
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  
  if (!action) return null;
  
  const alertContent = {
    approved: {
      icon: CheckCircle2,
      className: 'mb-6 glass-base rounded-2xl border-green-200/50',
      iconClass: 'text-green-600',
      titleClass: 'text-green-800',
      descClass: 'text-green-700',
      title: 'Crédito Aprobado',
      desc: 'Has aprobado exitosamente el crédito para esta orden a través del email.',
    },
    rejected: {
      icon: XCircle,
      className: 'mb-6 glass-base rounded-2xl border-red-200/50',
      iconClass: 'text-red-600',
      titleClass: 'text-red-800',
      descClass: 'text-red-700',
      title: 'Crédito Rechazado',
      desc: 'Has rechazado el crédito para esta orden a través del email.',
    },
    error: {
      icon: AlertCircle,
      className: 'mb-6 glass-base rounded-2xl border-amber-200/50',
      iconClass: 'text-amber-600',
      titleClass: 'text-amber-800',
      descClass: 'text-amber-700',
      title: 'Error en la Acción',
      desc: 'Hubo un problema al procesar tu acción. Por favor, intenta de nuevo desde el sitio web.',
    },
  };

  const config = action === 'approved' ? alertContent.approved 
    : action === 'rejected' ? alertContent.rejected 
    : action === 'error' ? alertContent.error 
    : null;
  
  if (!config) return null;
  const Icon = config.icon;

  return (
    <Alert className={config.className}>
      <Icon className={`h-4 w-4 ${config.iconClass}`} />
      <AlertTitle className={config.titleClass}>{config.title}</AlertTitle>
      <AlertDescription className={config.descClass}>{config.desc}</AlertDescription>
    </Alert>
  );
}

// Main component that renders ActionMessage and OrderDetailClient with layout
export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const { id } = unwrappedParams;
  
  const shortId = id.length >= 8 ? `${id.substring(0, 8)}…` : id;

  return (
    <GlassDashboardLayout
      header={
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/orders" className="hover:text-foreground transition-colors">
            Pedidos
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0" />
          <span className="text-foreground font-medium">Orden #{shortId}</span>
        </nav>
      }
    >
      <ActionMessage />
      <OrderDetailClient orderId={id} />
    </GlassDashboardLayout>
  );
}
