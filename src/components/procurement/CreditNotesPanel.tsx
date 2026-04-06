'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type CreditRow = {
  id: string
  po_number?: string
  supplier_name?: string
  credit_amount?: number
  credit_applied_at?: string
  credit_notes?: string
}

export default function CreditNotesPanel({
  workspacePlantId,
  plantOptions,
}: {
  workspacePlantId: string
  plantOptions: Array<{ id: string; name: string }>
}) {
  const [rows, setRows] = useState<CreditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [plantFilter, setPlantFilter] = useState<string>(workspacePlantId || 'all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([])
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  useEffect(() => {
    fetch('/api/suppliers')
      .then((res) => (res.ok ? res.json() : { suppliers: [] }))
      .then((data) => setSuppliers(data.suppliers || []))
      .catch(() => setSuppliers([]))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (plantFilter && plantFilter !== 'all') params.set('plant_id', plantFilter)
      if (supplierFilter && supplierFilter !== 'all') params.set('supplier_id', supplierFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const res = await fetch(`/api/procurement/credits?${params}`)
      const json = await res.json()
      setRows(json.success ? json.data || [] : [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [plantFilter, supplierFilter, dateFrom, dateTo])

  useEffect(() => {
    void load()
  }, [load])

  const exportExcel = async () => {
    if (rows.length === 0) return
    const XLSX = await import('xlsx')
    const sheet = rows.map((r) => ({
      OC: r.po_number,
      Proveedor: r.supplier_name,
      Monto_credito: r.credit_amount,
      Fecha: r.credit_applied_at,
      Notas: r.credit_notes,
    }))
    const ws = XLSX.utils.json_to_sheet(sheet)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Notas de crédito')
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([buf], { type: 'application/octet-stream' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `notas_credito_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const mxn = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

  return (
    <Card className="rounded-lg border border-stone-200 bg-white">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-stone-600">
          Notas de crédito (OC)
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={plantFilter} onValueChange={setPlantFilter}>
            <SelectTrigger className="w-[180px] border-stone-300">
              <SelectValue placeholder="Planta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las plantas</SelectItem>
              {plantOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={supplierFilter} onValueChange={setSupplierFilter}>
            <SelectTrigger className="w-[200px] border-stone-300">
              <SelectValue placeholder="Proveedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los proveedores</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Input
              type="date"
              className="w-[140px] h-9 border-stone-300 text-xs"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Desde"
            />
            <span className="text-xs text-stone-500">—</span>
            <Input
              type="date"
              className="w-[140px] h-9 border-stone-300 text-xs"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Hasta"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={exportExcel} disabled={rows.length === 0}>
            Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-stone-500">Sin notas de crédito registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
                  <th className="py-2 pr-2">OC</th>
                  <th className="py-2 pr-2">Proveedor</th>
                  <th className="py-2 pr-2">Monto</th>
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2">Notas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-stone-100">
                    <td className="py-2 pr-2 font-mono text-xs">{r.po_number}</td>
                    <td className="py-2 pr-2">{r.supplier_name}</td>
                    <td className="py-2 pr-2 font-mono tabular-nums">{mxn.format(Number(r.credit_amount || 0))}</td>
                    <td className="py-2 pr-2 text-xs text-stone-600">
                      {r.credit_applied_at ? r.credit_applied_at.slice(0, 10) : '—'}
                    </td>
                    <td className="py-2 text-xs text-stone-600 max-w-[240px] truncate">{r.credit_notes || '—'}</td>
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
