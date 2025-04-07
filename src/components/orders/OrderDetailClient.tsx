'use client';

import React from 'react';
import OrderDetails from '@/components/orders/OrderDetails';
import RoleGuard from '@/components/auth/RoleGuard';

interface OrderDetailClientProps {
  orderId: string;
}

export default function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  return (
    <RoleGuard 
      allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
      redirectTo="/access-denied"
    >
      <div className="container mx-auto p-4">
        <OrderDetails orderId={orderId} />
      </div>
    </RoleGuard>
  );
} 