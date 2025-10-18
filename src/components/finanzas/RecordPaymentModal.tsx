'use client'

import React, { useMemo, useState } from 'react'
import type { Payable } from '@/types/finance'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

interface Props {
  payable: Payable
  onClose: () => void
  onSaved: () => void
}

export default function RecordPaymentModal({ payable, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])

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
            <div className="space-y-2 text-sm text-gray-600 mb-4">
              <div><b>Factura:</b> {payable.invoice_number}</div>
              <div><b>Total:</b> {mxn.format(payable.total)}</div>
            </div>

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


