'use client';

import React from 'react';
import { ClientPaymentManagerModal } from '@/components/finanzas/ClientPaymentManagerModal';

export function DailyPaymentsManageButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName?: string;
}) {
  return (
    <ClientPaymentManagerModal
      clientId={clientId}
      clientName={clientName}
      triggerLabel="Gestionar"
      triggerVariant="secondary"
      triggerSize="sm"
    />
  );
}

