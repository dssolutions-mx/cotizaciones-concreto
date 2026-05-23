'use client'

import React, { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, FileText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import OrphanEntriesTab from '@/components/finanzas/OrphanEntriesTab'
import InvoicesPayablesTab from '@/components/finanzas/InvoicesPayablesTab'
import { usePlantContext } from '@/contexts/PlantContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  /** Plant scope from procurement workspace header (empty = all plants). */
  workspacePlantId?: string
  /** When true, hide page title and plant picker — parent supplies plant scope. */
  embedded?: boolean
}

export default function CxpWorkspace({ workspacePlantId = '', embedded = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { availablePlants } = usePlantContext()
  const [localPlant, setLocalPlant] = useState('')

  const activeTab = searchParams.get('cxp_tab') || 'sin_factura'
  const plantScope = embedded ? workspacePlantId : localPlant

  const setTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('cxp_tab', tab)
    if (embedded) params.set('tab', 'cxp')
    const q = params.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  return (
    <div className={embedded ? 'space-y-4' : 'p-6 space-y-6'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestión de facturas y cuentas por pagar de materiales y flota
            </p>
          </div>
          <Select value={localPlant || '__all__'} onValueChange={(v) => setLocalPlant(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[200px] bg-white border-stone-300">
              <SelectValue placeholder="Todas las plantas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las plantas</SelectItem>
              {availablePlants.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setTab}>
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

        <div className="mt-4">
          {activeTab === 'sin_factura' ? (
            <OrphanEntriesTab workspacePlantId={plantScope} hidePlantFilter={embedded} />
          ) : (
            <InvoicesPayablesTab workspacePlantId={plantScope} hidePlantFilter={embedded} />
          )}
        </div>
      </Tabs>
    </div>
  )
}