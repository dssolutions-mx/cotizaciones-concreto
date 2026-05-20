'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, XCircle, ChevronRight } from 'lucide-react';
import OrderDetailClient from '@/components/orders/OrderDetailClient';

// Component to show success/error messages when redirected from email actions
function ActionMessage() {
  const searchParams = useSearchParams();
  const action = searchParams.get('action');
  
  if (!action) return null;
  
  const alertContent = {
    approved: {
      icon: CheckCircle2,
      className: 'mb-6 rounded-lg border border-green-200 bg-white p-4',
      iconClass: 'text-green-600',
      titleClass: 'text-green-800',
      descClass: 'text-green-700',
      title: 'Crédito Aprobado',
      desc: 'Has aprobado exitosamente el crédito para esta orden a través del email.',
    },
    rejected: {
      icon: XCircle,
      className: 'mb-6 rounded-lg border border-red-200 bg-white p-4',
      iconClass: 'text-red-600',
      titleClass: 'text-red-800',
      descClass: 'text-red-700',
      title: 'Crédito Rechazado',
      desc: 'Has rechazado el crédito para esta orden a través del email.',
    },
    error: {
      icon: AlertCircle,
      className: 'mb-6 rounded-lg border border-amber-200 bg-white p-4',
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

export default function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const { id } = unwrappedParams;
  
  const shortId = id.length >= 8 ? `${id.substring(0, 8)}…` : id;

  return (
    <div className="min-w-0 space-y-6">
      <nav className="flex items-center gap-2 text-sm text-stone-500">
        <Link href="/orders" className="hover:text-stone-900 transition-colors">
          Pedidos
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" />
        <span className="text-stone-900 font-medium">Orden #{shortId}</span>
      </nav>
      <ActionMessage />
      <OrderDetailClient orderId={id} />
    </div>
  );
}
