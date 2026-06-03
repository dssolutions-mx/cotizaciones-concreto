'use client';

import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb';
import RemisionInspectorClient from '@/components/remisiones/RemisionInspectorClient';

export default function ConsultaRemisionesProductionPage() {
  return (
    <div className="space-y-4 pb-8">
      <InventoryBreadcrumb />
      <RemisionInspectorClient theme="production" />
    </div>
  );
}
