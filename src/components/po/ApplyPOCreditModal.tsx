'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { DollarSign, AlertCircle, ChevronDown, ChevronUp, History } from 'lucide-react'
import { PurchaseOrderItem, POCreditHistoryEntry } from '@/types/po'

interface ApplyPOCreditModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  poItem: PurchaseOrderItem | null
}

export default function ApplyPOCreditModal({
  open,
  onClose,
  onSuccess,
  poItem,
}: ApplyPOCreditModalProps) {
  const [loading, setLoading] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditNotes, setCreditNotes] = useState('')
  const [creditHistory, setCreditHistory] = useState<POCreditHistoryEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  const mxn = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  // Reset form when modal opens/closes or poItem changes
  useEffect(() => {
    if (!open) {
      setCreditAmount('')
      setCreditNotes('')
      setCreditHistory([])
    }
  }, [open, poItem])

  // E1 — Fetch credit history when modal opens
  useEffect(() => {
    if (open && poItem?.id) {
      fetch(`/api/po/items/${poItem.id}/credit`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.history && Array.isArray(data.history)) {
            setCreditHistory(data.history)
          }
        })
        .catch(() => setCreditHistory([]))
    }
  }, [open, poItem?.id])

  if (!poItem) return null

  // Calculate current totals
  const currentUnitPrice = Number(poItem.unit_price) || 0
  const qtyOrdered = Number(poItem.qty_ordered) || 0
  const currentTotal = currentUnitPrice * qtyOrdered
  const originalUnitPrice = poItem.original_unit_price
    ? Number(poItem.original_unit_price)
    : currentUnitPrice
  const originalTotal = originalUnitPrice * qtyOrdered

  // Calculate preview values
  const creditAmountNum = parseFloat(creditAmount) || 0
  const newTotal = Math.max(0, originalTotal - creditAmountNum)
  const newUnitPrice = qtyOrdered > 0 ? newTotal / qtyOrdered : 0
  const creditPercentage = originalTotal > 0 ? (creditAmountNum / originalTotal) * 100 : 0

  // Validation
  const isValid = creditAmountNum > 0 && creditAmountNum <= originalTotal
  const exceedsTotal = creditAmountNum > originalTotal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValid) {
      toast.error('Por favor ingrese un monto de crédito válido')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/po/items/${poItem.id}/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credit_amount: creditAmountNum,
          credit_notes: creditNotes.trim() || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al aplicar crédito')
      }

      toast.success(
        `Crédito aplicado exitosamente. ${data.entriesUpdated || 0} entrada(s) actualizada(s).`
      )
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error applying credit:', error)
      toast.error(error.message || 'Error al aplicar crédito')
    } finally {
      setLoading(false)
    }
  }

  const hasExistingCredit = !!poItem.credit_amount

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Aplicar Crédito a Item de PO
          </DialogTitle>
          <DialogDescription>
            Aplicar un crédito/descuento a este item de orden de compra. El precio unitario será
            ajustado proporcionalmente y todas las entradas vinculadas serán actualizadas
            automáticamente.
          </DialogDescription>
        </DialogHeader>

        {/* PO Item Summary */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Item:</span>
            <span className="font-medium">
              {poItem.is_service
                ? poItem.service_description || 'Servicio'
                : poItem.material_id
                  ? `Material ID: ${poItem.material_id.slice(0, 8)}...`
                  : 'Material'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Cantidad Ordenada:</span>
            <span className="font-medium">
              {qtyOrdered.toLocaleString('es-MX')} {poItem.uom || 'unidades'}
            </span>
          </div>
          {hasExistingCredit && (
            <>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Precio Unitario Original:</span>
                <span className="font-medium">{mxn.format(originalUnitPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Crédito Anterior:</span>
                <span className="font-medium text-orange-600">
                  -{mxn.format(Number(poItem.credit_amount || 0))}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Precio Unitario Actual:</span>
            <span className="font-medium">{mxn.format(currentUnitPrice)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-2">
            <span>Total Actual:</span>
            <span>{mxn.format(currentTotal)}</span>
          </div>
          {hasExistingCredit && (
            <div className="flex justify-between text-xs text-gray-500">
              <span>Total Original:</span>
              <span>{mxn.format(originalTotal)}</span>
            </div>
          )}
        </div>

        {/* E1 — Historial de Créditos */}
        {creditHistory.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 text-left"
            >
              <span className="flex items-center gap-2 font-medium">
                <History className="h-4 w-4" />
                Historial de Créditos ({creditHistory.length})
              </span>
              {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {historyOpen && (
              <div className="divide-y max-h-40 overflow-y-auto">
                {creditHistory.map((h, i) => (
                  <div key={h.id} className="p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {new Date(h.applied_at).toLocaleString('es-MX')}
                      </span>
                      <span className="font-medium text-orange-600">-{mxn.format(h.applied_amount)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Acumulado: {mxn.format(h.cumulative_amount_after)} · Precio {mxn.format(h.unit_price_before)} → {mxn.format(h.unit_price_after)}
                    </div>
                    {h.notes && <div className="text-xs text-gray-600 mt-1">{h.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Credit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="credit_amount">
              Monto del Crédito <span className="text-red-500">*</span>
            </Label>
            <Input
              id="credit_amount"
              type="number"
              step="0.01"
              min="0"
              max={originalTotal}
              value={creditAmount}
              onChange={(e) => setCreditAmount(e.target.value)}
              placeholder="0.00"
              required
              className={exceedsTotal ? 'border-red-500' : ''}
            />
            {exceedsTotal && (
              <div className="flex items-center gap-1 mt-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>El crédito no puede exceder el total original ({mxn.format(originalTotal)})</span>
              </div>
            )}
            {creditAmountNum > 0 && !exceedsTotal && (
              <div className="text-xs text-gray-500 mt-1">
                {creditPercentage.toFixed(2)}% de descuento sobre el total original
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="credit_notes">Notas del Crédito (Opcional)</Label>
            <Textarea
              id="credit_notes"
              value={creditNotes}
              onChange={(e) => setCreditNotes(e.target.value)}
              placeholder="Ej: Descuento por volumen, crédito por retraso en entrega, referencia de factura..."
              rows={3}
              maxLength={1000}
            />
            <div className="text-xs text-gray-500 mt-1">
              {creditNotes.length}/1000 caracteres
            </div>
          </div>

          {/* Preview */}
          {creditAmountNum > 0 && isValid && (
            <div className="p-4 bg-blue-50 rounded-lg space-y-2 border border-blue-200">
              <div className="text-sm font-semibold text-blue-900">Vista Previa:</div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Total Original:</span>
                <span className="font-medium text-blue-900">{mxn.format(originalTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Crédito Aplicado:</span>
                <span className="font-medium text-red-600">-{mxn.format(creditAmountNum)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-blue-300 pt-2">
                <span className="text-blue-900">Nuevo Total:</span>
                <span className="text-blue-900">{mxn.format(newTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-700">Nuevo Precio Unitario:</span>
                <span className="font-medium text-blue-900">{mxn.format(newUnitPrice)}</span>
              </div>
            </div>
          )}

          {/* Warning about retroactive updates */}
          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-800">
                <strong>Nota:</strong> Al aplicar este crédito, todas las entradas de material
                vinculadas a este item de PO serán actualizadas automáticamente con el nuevo precio
                unitario. Esta acción afectará los cálculos de costo basados en estas entradas.
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !isValid}>
              {loading ? 'Aplicando...' : 'Aplicar Crédito'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
