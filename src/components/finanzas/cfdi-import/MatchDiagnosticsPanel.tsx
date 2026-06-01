'use client'

import React from 'react'
import type { CfdiMatchDiagnostics } from '@/types/finance'
import { UuidChip } from '@/components/finanzas/cfdi-import/UuidChip'
import { cn } from '@/lib/utils'

const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

const STATUS_INV: Record<string, string> = {
  open: 'Abierta',
  partially_paid: 'Parcial',
}

type Props = {
  diagnostics: CfdiMatchDiagnostics
  className?: string
}

export default function MatchDiagnosticsPanel({ diagnostics, className }: Props) {
  const { criteria_summary, steps, related_uuids, open_invoices_same_supplier } = diagnostics

  return (
    <div className={cn('rounded-md border border-stone-200 bg-stone-50/80 p-3 space-y-3 text-xs', className)}>
      <div>
        <p className="font-semibold text-stone-800">Por qué este resultado</p>
        <p className="text-stone-600 mt-0.5">{criteria_summary}</p>
      </div>

      <div>
        <p className="font-medium text-stone-700 mb-1">Criterios aplicados</p>
        <ol className="list-decimal list-inside space-y-0.5 text-stone-600">
          {steps.map((s, i) => (
            <li key={i} className={s.startsWith('  ') ? 'list-none ml-4 font-mono text-[10px]' : ''}>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {related_uuids.length > 0 && (
        <div>
          <p className="font-medium text-stone-700 mb-1">UUID en CfdiRelacionados (XML)</p>
          <ul className="space-y-1">
            {related_uuids.map((r) => (
              <li key={r.uuid} className="flex flex-wrap items-center gap-2">
                <UuidChip uuid={r.uuid} />
                {r.tipo_relacion && (
                  <span className="text-stone-500">rel. {r.tipo_relacion}</span>
                )}
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[10px] font-medium',
                    r.matched_in_cxp
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800',
                  )}
                >
                  {r.matched_in_cxp ? 'En CxP (abierta)' : 'Sin factura abierta con este UUID'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {open_invoices_same_supplier.length > 0 && (
        <div>
          <p className="font-medium text-stone-700 mb-1">
            Facturas abiertas del proveedor (RFC {diagnostics.emisor_rfc})
          </p>
          <div className="overflow-x-auto rounded border border-stone-200 bg-white">
            <table className="w-full text-[11px]">
              <thead className="bg-stone-50 border-b">
                <tr>
                  <th className="px-2 py-1.5 text-left">Factura</th>
                  <th className="px-2 py-1.5 text-left">Estado</th>
                  <th className="px-2 py-1.5 text-left">UUID en CxP</th>
                  <th className="px-2 py-1.5 text-left">Folio CFDI</th>
                  <th className="px-2 py-1.5 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {open_invoices_same_supplier.map((inv) => (
                  <tr key={inv.id} className="hover:bg-stone-50">
                    <td className="px-2 py-1.5 font-mono font-medium">{inv.invoice_number}</td>
                    <td className="px-2 py-1.5">{STATUS_INV[inv.status] ?? inv.status}</td>
                    <td className="px-2 py-1.5 max-w-[200px]">
                      {inv.cfdi_uuid ? (
                        <UuidChip uuid={inv.cfdi_uuid} />
                      ) : (
                        <span className="text-amber-700 font-medium">Sin UUID — no matchea por UUID</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-stone-600">
                      {[inv.cfdi_serie, inv.cfdi_folio].filter(Boolean).join('-') || '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {inv.balance != null ? mxn.format(inv.balance) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-stone-500 mt-1">
            Si el UUID del XML no aparece en «UUID en CxP», capture el CFDI de la factura o edite el UUID de la factura.
          </p>
        </div>
      )}
    </div>
  )
}
