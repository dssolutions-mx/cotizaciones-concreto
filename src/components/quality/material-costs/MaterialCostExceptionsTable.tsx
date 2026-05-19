'use client';

import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CostEntryException } from '@/lib/materialCostTrend';

const ISSUE_LABEL: Record<CostEntryException['issue'], string> = {
  pending_review: 'Pendiente de revisión',
  missing_landed: 'Sin landed',
  excluded_fifo: 'Excluida de FIFO',
};

const ISSUE_CLASS: Record<CostEntryException['issue'], string> = {
  pending_review: 'bg-amber-50 text-amber-800 border-amber-200',
  missing_landed: 'bg-red-50 text-red-800 border-red-200',
  excluded_fifo: 'bg-stone-100 text-stone-600 border-stone-200',
};

type Props = {
  exceptions: CostEntryException[];
};

export default function MaterialCostExceptionsTable({ exceptions }: Props) {
  if (exceptions.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/60">
        <h2 className="text-sm font-semibold text-stone-900">
          Entradas que requieren atención ({exceptions.length})
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          No participan en el promedio landed hasta resolverse en compras.
        </p>
      </div>
      <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 sticky top-0">
            <tr className="text-left text-xs text-stone-500">
              <th className="px-4 py-2 font-medium">Fecha</th>
              <th className="px-4 py-2 font-medium">Entrada</th>
              <th className="px-4 py-2 font-medium">Motivo</th>
              <th className="px-4 py-2 font-medium text-right">Kg</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {exceptions.map((row) => (
              <tr key={row.id} className="hover:bg-stone-50">
                <td className="px-4 py-2 tabular-nums text-stone-700">
                  {format(parseISO(row.entry_date), 'd MMM yyyy', { locale: es })}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{row.entry_number ?? row.id.slice(0, 8)}</td>
                <td className="px-4 py-2">
                  <span
                    className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${ISSUE_CLASS[row.issue]}`}
                  >
                    {ISSUE_LABEL[row.issue]}
                  </span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{row.qty_kg.toFixed(0)}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/finanzas/procurement?entry_id=${encodeURIComponent(row.id)}`}
                    className="text-xs text-sky-600 hover:underline"
                  >
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
