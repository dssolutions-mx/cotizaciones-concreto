'use client';

import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import FifoMonthCloseExecutiveClient from '@/components/finanzas/FifoMonthCloseExecutiveClient';

export default function CierreCostoFifoPage() {
  return (
    <div className="container mx-auto p-6">
      <RoleProtectedSection
        allowedRoles={['EXECUTIVE']}
        action="acceder al cierre mensual de costo FIFO"
      >
        <FifoMonthCloseExecutiveClient />
      </RoleProtectedSection>
    </div>
  );
}
