'use client';

import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import OrderDetails from '@/components/orders/OrderDetails';
import RoleGuard from '@/components/auth/RoleGuard';

interface OrderDetailClientProps {
  orderId: string;
}

export default function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  
  // Track view for history
  useEffect(() => {
    // Just a marker to ensure we can go back to the right view
    sessionStorage.setItem('lastOrderView', returnTo || 'list');
  }, [returnTo]);
  
  return (
    <RoleGuard allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR', 'DOSIFICADOR', 'QUALITY_TEAM', 'EXTERNAL_SALES_AGENT']}>
      <div className="relative">
        <OrderDetails orderId={orderId} />
      </div>
    </RoleGuard>
  );
} 