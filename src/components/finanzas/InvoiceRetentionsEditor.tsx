'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import type { InvoiceRetentionInput } from '@/types/finance'
import { ISR_RETENTION_PRESETS, IVA_RETENTION_PRESETS } from '@/lib/ap/retentionRates'
import { retentionLabelForImpuesto, roundMoney } from '@/lib/ap/invoiceTotals'

export type RetentionRowState = InvoiceRetentionInput & { key: string }

const IMPUESTO_OPTIONS = [
  { value: '001', label: 'ISR (001)' },
  { value: '002', label: 'IVA retenido (002)' },
]

function newRow(partial?: Partial<InvoiceRetentionInput>): RetentionRowState {
  return {
    key: crypto.randomUUID(),
    impuesto_sat: partial?.impuesto_sat ?? '001',
    label: partial?.label ?? 'ISR',
    base_amount: partial?.base_amount ?? null,
    rate: partial?.rate ?? null,
    amount: partial?.amount ?? 0,
    sort_order: partial?.sort_order ?? 0,
  }
}

export function retentionsFromCfdi(
  retenciones: Array<{ impuesto_sat: string; importe: number; tasa_o_cuota?: number }>,
  taxableBase: number,
): RetentionRowState[] {
  const counts: Record<string, number> = {}
  return retenciones.map((r, idx) => {
    const imp = r.impuesto_sat || '001'
    const n = counts[imp] ?? 0
    counts[imp] = n + 1
    return newRow({
      impuesto_sat: imp,
      label: retentionLabelForImpuesto(imp, n),
      base_amount: taxableBase,
      rate: r.tasa_o_cuota,
      amount: roundMoney(r.importe),
      sort_order: idx,
    })
  })
}

export function retentionsFromApi(
  rows: Array<{
    impuesto_sat: string
    label?: string | null
    base_amount?: number | null
    rate?: number | null
    amount: number
    sort_order?: number
  }>,
): RetentionRowState[] {
  return rows.map(r =>
    newRow({
      impuesto_sat: r.impuesto_sat,
      label: r.label ?? undefined,
      base_amount: r.base_amount,
      rate: r.rate,
      amount: r.amount,
      sort_order: r.sort_order,
    }),
  )
}

export function toRetentionPayload(rows: RetentionRowState[]): InvoiceRetentionInput[] {
  return rows.map((r, idx) => ({
    impuesto_sat: r.impuesto_sat,
    label: r.label,
    base_amount: r.base_amount,
    rate: r.rate,
    amount: roundMoney(Number(r.amount) || 0),
    sort_order: idx,
  }))
}

interface Props {
  rows: RetentionRowState[]
  onChange: (rows: RetentionRowState[]) => void
  taxableBase: number
  disabled?: boolean
}

export default function InvoiceRetentionsEditor({ rows, onChange, taxableBase, disabled }: Props) {
  const update = (key: string, patch: Partial<RetentionRowState>) => {
    onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)))
  }

  const addPreset = (impuesto: string, rate: number, label: string) => {
    const amount = taxableBase > 0 ? roundMoney(taxableBase * rate) : 0
    onChange([
      ...rows,
      newRow({ impuesto_sat: impuesto, label, base_amount: taxableBase, rate, amount }),
    ])
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-semibold text-stone-900">Retenciones</Label>
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={disabled}
            onClick={() => addPreset('001', 0.0125, 'ISR autotransporte 1.25%')}
          >
            + ISR 1.25%
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={disabled}
            onClick={() => addPreset('001', 0.1, 'ISR honorarios 10%')}
          >
            + ISR 10%
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px]"
            disabled={disabled}
            onClick={() => addPreset('002', 0.04, 'IVA 4%')}
          >
            + IVA 4%
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-[10px] gap-0.5"
            disabled={disabled}
            onClick={() => onChange([...rows, newRow()])}
          >
            <Plus className="h-3 w-3" /> Fila
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-stone-500 py-1">Sin retenciones. Usa los botones o importa desde CFDI.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.key} className="rounded-md border border-stone-200 bg-stone-50 p-2 space-y-2">
              <div className="flex gap-2 items-start">
                <Select
                  value={r.impuesto_sat}
                  onValueChange={v => {
                    const label = retentionLabelForImpuesto(v, 0)
                    update(r.key, { impuesto_sat: v, label })
                  }}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-7 text-xs w-[130px] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMPUESTO_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={r.label ?? ''}
                  onChange={e => update(r.key, { label: e.target.value })}
                  className="h-7 text-xs flex-1 bg-white"
                  placeholder="Etiqueta"
                  disabled={disabled}
                />
                <button
                  type="button"
                  className="p-1 text-stone-400 hover:text-red-600 shrink-0"
                  onClick={() => onChange(rows.filter(x => x.key !== r.key))}
                  disabled={disabled}
                  title="Quitar retención"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-stone-500">Importe retenido</span>
                  <Input
                    type="number"
                    value={r.amount || ''}
                    onChange={e => update(r.key, { amount: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs bg-white font-medium"
                    disabled={disabled}
                  />
                </div>
                <div className="flex-1 space-y-0.5">
                  <span className="text-[10px] text-stone-500">Tasa (opc.)</span>
                  <Input
                    type="number"
                    value={r.rate ?? ''}
                    onChange={e => {
                      const rate = parseFloat(e.target.value)
                      update(r.key, {
                        rate: Number.isFinite(rate) ? rate : null,
                        base_amount: taxableBase,
                        amount:
                          taxableBase > 0 && Number.isFinite(rate)
                            ? roundMoney(taxableBase * rate)
                            : r.amount,
                      })
                    }}
                    className="h-7 text-xs bg-white"
                    placeholder="0.0125"
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-stone-400">
        Presets ISR: {ISR_RETENTION_PRESETS.join(', ')} · IVA: {IVA_RETENTION_PRESETS.join(', ')} (sobre base gravable)
      </p>
    </div>
  )
}
