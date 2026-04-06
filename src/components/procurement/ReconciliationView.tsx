'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type Row = {
  po_number: string
  supplier: string
  material: string
  ordered: number
  received: number
  gap: number
  severity: 'ok' | 'partial' | 'missing'
}

export default function ReconciliationView({ workspacePlantId }: { workspacePlantId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (workspacePlantId) params.set('plant_id', workspacePlantId)
      const res = await fetch(`/api/procurement/reconciliation?${params}`)
      const json = await res.json()
      setRows(json.success ? json.data || [] : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [workspacePlantId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card className="rounded-lg border border-stone-200 bg-white">
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Conciliación recepción vs OC (líneas abiertas)
        </CardTitle>
        <p className="text-xs text-stone-500">
          Muestra partidas con saldo pendiente de recepción. Revise facturas en CXP para el cierre contable.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-stone-500">Sin discrepancias de cantidad en líneas abiertas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
                  <th className="py-2 pr-2">OC</th>
                  <th className="py-2 pr-2">Proveedor</th>
                  <th className="py-2 pr-2">Material</th>
                  <th className="py-2 pr-2">Ordenado</th>
                  <th className="py-2 pr-2">Recibido</th>
                  <th className="py-2 pr-2">Pendiente</th>
                  <th className="py-2">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.po_number}-${i}`} className="border-b border-stone-100">
                    <td className="py-2 pr-2 font-mono text-xs">{r.po_number}</td>
                    <td className="py-2 pr-2">{r.supplier}</td>
                    <td className="py-2 pr-2">{r.material}</td>
                    <td className="py-2 pr-2 font-mono tabular-nums">{r.ordered.toLocaleString('es-MX')}</td>
                    <td className="py-2 pr-2 font-mono tabular-nums">{r.received.toLocaleString('es-MX')}</td>
                    <td className="py-2 pr-2 font-mono tabular-nums text-amber-800">{r.gap.toLocaleString('es-MX')}</td>
                    <td className="py-2">
                      <Badge
                        variant="outline"
                        className={
                          r.severity === 'missing'
                            ? 'border-red-300 text-red-800'
                            : 'border-amber-300 text-amber-900'
                        }
                      >
                        {r.severity === 'missing' ? 'Sin recibir' : 'Parcial'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
