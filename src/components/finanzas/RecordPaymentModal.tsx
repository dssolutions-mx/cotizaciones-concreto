'use client'

import React, { useEffect, useMemo, useState } from 'react'
import type { Payable } from '@/types/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Props {
  payable: Payable & { amount_paid?: number }
  onClose: () => void
  onSaved: () => void
}

export default function RecordPaymentModal({ payable, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState<Array<{ id: string; payment_date: string; amount: number; method?: string; reference?: string }>>([])
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [threeWayWarnings, setThreeWayWarnings] = useState<string[]>([])

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

  const amountPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const amountRemaining = payable.total - amountPaid

  useEffect(() => {
    let cancelled = false
    async function fetchPayments() {
      try {
        const res = await fetch(`/api/ap/payments?payable_id=${payable.id}`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setPayments(data.payments || [])
      } catch (err) {
        if (!cancelled) setPayments([])
      } finally {
        if (!cancelled) setLoadingPayments(false)
      }
    }
    fetchPayments()
    return () => { cancelled = true }
  }, [payable.id])

  useEffect(() => {
    let cancelled = false
    async function fetchValidate() {
      try {
        const res = await fetch(`/api/ap/payables/${payable.id}/validate`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled && Array.isArray(data.warnings)) {
          setThreeWayWarnings(data.warnings.map((w: any) => {
            if (w && typeof w === 'object' && 'amount' in w && 'expected' in w) {
              return `Factura excede valor esperado: monto ${mxn.format(Number(w.amount))} vs esperado ${mxn.format(Number(w.expected))}. Revisar créditos o ajustes aplicados.`
            }
            return String(w)
          }))
        }
      } catch { /* ignore */ }
    }
    fetchValidate()
    return () => { cancelled = true }
  }, [payable.id])

  const submit = async () => {
    if (!amount || !date) {
      toast.error('Fecha y monto son requeridos')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ap/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payable_id: payable.id,
          payment_date: date,
          amount: parseFloat(amount),
          method,
          reference,
        }),
      })
      if (!res.ok) throw new Error('Error al registrar pago')
      toast.success('Pago registrado')
      const newPayment = { id: 'new', payment_date: date, amount: parseFloat(amount), method, reference }
      setPayments(prev => [newPayment, ...prev])
      onSaved()
    } catch (e) {
      console.error(e)
      toast.error('No se pudo registrar el pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Registrar Pago</CardTitle>
          </CardHeader>
          <CardContent>
            {threeWayWarnings.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md" role="alert">
                <div className="text-xs font-semibold text-amber-800 mb-1">Validación 3 vías: discrepancias detectadas</div>
                <ul className="text-xs text-amber-800 space-y-1">
                  {threeWayWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <p className="text-xs text-amber-700 mt-2">
                  Acción sugerida: verificar créditos aplicados, ajustes o diferencias de redondeo antes de registrar el pago.
                </p>
              </div>
            )}
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div><b>Factura:</b> {payable.invoice_number}</div>
              <div><b>Total:</b> {mxn.format(payable.total)}</div>
              <div><b>Pagado:</b> {mxn.format(amountPaid)}</div>
              <div><b>Pendiente:</b> {mxn.format(amountRemaining)}</div>
            </div>

            {loadingPayments ? (
              <div className="text-sm text-gray-500 py-2">Cargando historial...</div>
            ) : payments.length > 0 ? (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-700 mb-2">Historial de pagos</div>
                <div className="border rounded overflow-hidden max-h-32 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-1.5 px-2 font-medium">Fecha</th>
                        <th className="text-right py-1.5 px-2 font-medium">Monto</th>
                        <th className="text-left py-1.5 px-2 font-medium">Método</th>
                        <th className="text-left py-1.5 px-2 font-medium">Ref.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="py-1 px-2">{format(new Date(p.payment_date + 'T00:00:00'), 'dd MMM yyyy', { locale: es })}</td>
                          <td className="text-right py-1 px-2 font-medium">{mxn.format(p.amount)}</td>
                          <td className="py-1 px-2 text-gray-600">{p.method || '-'}</td>
                          <td className="py-1 px-2 text-gray-600">{p.reference || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payment_date">Fecha</Label>
                <Input id="payment_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="amount">Monto</Label>
                <Input id="amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} onWheel={(e) => e.currentTarget.blur()} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <Label htmlFor="method">Método</Label>
                <Input id="method" value={method} onChange={(e) => setMethod(e.target.value)} placeholder="Transferencia, cheque..." />
              </div>
              <div>
                <Label htmlFor="reference">Referencia</Label>
                <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Folio, banco..." />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={onClose} disabled={loading}>Cerrar</Button>
              <Button onClick={submit} disabled={loading}>Guardar</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


