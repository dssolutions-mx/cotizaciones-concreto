'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  COMPLIANCE_CANONICAL_CC_EMAILS,
  COMPLIANCE_ROUTING_MATRIX,
} from '@/lib/compliance/recipients';

const rows = Object.values(COMPLIANCE_CANONICAL_CC_EMAILS);

export function ComplianceRoutingReferenceCard() {
  return (
    <Card className="border-stone-200">
      <CardHeader>
        <CardTitle>Correos del sistema (política fija en código)</CardTitle>
        <CardDescription>
          Lo que ves aquí es la misma lógica que usa el envío. La tabla de abajo solo agrega{' '}
          <strong>extras por planta</strong> (y el digest); no reemplaza estos CC regionales.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-stone-900">Nómina de correos en copia (CC)</h4>
          <div className="overflow-x-auto rounded-md border border-stone-200">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-stone-100 text-xs uppercase text-stone-600">
                <tr>
                  <th className="px-3 py-2">Uso</th>
                  <th className="px-3 py-2">Correo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.email} className="border-t border-stone-100">
                    <td className="px-3 py-2 text-stone-700">{row.label}</td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-800">{row.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-stone-900">Cómo se combinan (por planta)</h4>
          {COMPLIANCE_ROUTING_MATRIX.map((block) => (
            <div
              key={block.id}
              className="rounded-lg border border-stone-200 bg-stone-50/80 px-4 py-3 text-sm"
            >
              <div className="font-medium text-stone-900">{block.title}</div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-stone-500">
                Plantas: {block.plantScope}
              </div>
              <p className="mt-2 leading-relaxed text-stone-700">{block.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <strong>Overrides por planta (tabla siguiente):</strong> “Extra en Para” ={' '}
          <code className="rounded bg-amber-100/80 px-1">dosificador</code> del JSON; “Jefe de planta” ={' '}
          <code className="rounded bg-amber-100/80 px-1">jefe_planta</code>; “CC adicionales” ={' '}
          <code className="rounded bg-amber-100/80 px-1">extra_cc</code>. Se fusionan con variables de
          entorno si las sigues usando; la base de datos gana por campo cuando hay valor.
        </div>
      </CardContent>
    </Card>
  );
}
