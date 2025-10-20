'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format } from 'date-fns'

export default function PurchaseOrdersPage() {
  const [loading, setLoading] = useState(false)
  const [pos, setPos] = useState<any[]>([])
  const [plant, setPlant] = useState<string>('')
  const [supplier, setSupplier] = useState<string>('')
  const [status, setStatus] = useState<string>('open')

  const fetchPOs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (plant) params.set('plant_id', plant)
      if (supplier) params.set('supplier_id', supplier)
      if (status) params.set('status', status)
      const res = await fetch(`/api/po?${params.toString()}`)
      const data = await res.json()
      setPos(data.purchase_orders || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPOs() }, [plant, supplier, status])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Compras / Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Administre órdenes de compra, proveedores y avances</p>
        </div>
        <Button onClick={fetchPOs}>Actualizar</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Filtra por planta, proveedor y estatus</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500">Planta</label>
              <Input placeholder="UUID planta" value={plant} onChange={(e) => setPlant(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Proveedor</label>
              <Input placeholder="UUID proveedor" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Estatus</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abierta</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="fulfilled">Completada</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500">Cargando...</div>
          ) : pos.length === 0 ? (
            <div className="text-sm text-gray-500">Sin resultados</div>
          ) : (
            <div className="space-y-3">
              {pos.map(po => (
                <div key={po.id} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-semibold">PO #{po.id.slice(0,8)}</div>
                      <div className="text-gray-500">Proveedor: {po.supplier_id}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div className="uppercase text-xs px-2 py-1 rounded bg-gray-100 inline-block">{po.status}</div>
                      <div className="text-gray-500">Creado: {format(new Date(po.created_at), 'dd MMM yyyy')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


