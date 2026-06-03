'use client';

import { QualityBreadcrumb } from '@/components/quality/QualityBreadcrumb';
import RemisionInspectorClient from '@/components/remisiones/RemisionInspectorClient';

export default function ConsultaRemisionesQualityPage() {
  return (
    <div className="space-y-4 pb-8">
      <QualityBreadcrumb
        hubName="Operaciones"
        hubHref="/quality/operaciones"
        items={[{ label: 'Consulta de remisiones' }]}
      />
      <RemisionInspectorClient theme="quality" />
    </div>
  );
}
