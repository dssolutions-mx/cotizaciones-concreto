'use client'

import React, { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, FileText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import OrphanEntriesTab from '@/components/finanzas/OrphanEntriesTab'
import InvoicesPayablesTab from '@/components/finanzas/InvoicesPayablesTab'
import { usePlantContext } from '@/contexts/PlantContext'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function CxpPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('cxp_tab') || 'sin_factura'
  const { availablePlants } = usePlantContext()
  const [plant, setPlant] = useState<string>('')

  const mxn = useMemo(() => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }), [])
  void mxn // kept for potential future use

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('cxp_tab', tab)
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión de facturas y cuentas por pagar de materiales y flota</p>
        </div>
        <Select value={plant || '__all__'} onValueChange={v => setPlant(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-[200px] bg-white border-stone-300">
            <SelectValue placeholder="Todas las plantas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las plantas</SelectItem>
            {availablePlants.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tabFromUrl} onValueChange={setTab}>
        <div className="flex items-center gap-3">
          <TabsList className="h-9">
            <TabsTrigger value="sin_factura" className="text-xs gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Sin factura
            </TabsTrigger>
            <TabsTrigger value="facturas" className="text-xs gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Facturas / CxP
            </TabsTrigger>
          </TabsList>
          <Link
            href="/finanzas/cxp/sat"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-800 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Conciliación SAT
          </Link>
        </div>

        <TabsContent value="sin_factura" className="mt-4">
          <OrphanEntriesTab workspacePlantId={plant || undefined} />
        </TabsContent>

        <TabsContent value="facturas" className="mt-4">
          <InvoicesPayablesTab workspacePlantId={plant || undefined} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
