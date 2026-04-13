'use client';

import { useAuthBridge } from '@/adapters/auth-context-bridge';
import AccessDeniedMessage from '@/components/ui/AccessDeniedMessage';
import { MaterialPriceManager } from '@/components/prices/MaterialPriceManager';

export default function MaterialPricesByMonthPage() {
  const { profile } = useAuthBridge();

  if (profile?.role === 'QUALITY_TEAM') {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <AccessDeniedMessage
            action="acceder a la gestión de precios por mes"
            requiredRoles={['PLANT_MANAGER', 'EXECUTIVE', 'SALES_AGENT']}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-[1600px]">
      <MaterialPriceManager />
    </div>
  );
}
