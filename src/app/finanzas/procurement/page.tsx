'use client'

import React, { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Package, CreditCard, BarChart3 } from 'lucide-react'
import PurchaseOrdersPage from '@/app/finanzas/po/page'
import CxpPage from '@/app/finanzas/cxp/page'
import SupplierAnalysisPage from '@/app/finanzas/proveedores/analisis/page'

export default function ProcurementWorkspacePage() {
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const defaultTab = useMemo(() => {
    if (tab === 'cxp' || tab === 'po' || tab === 'suppliers') return tab
    return 'po'
  }, [tab])

  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardContent className="py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Procurement Workspace</h1>
              <p className="text-sm text-muted-foreground">
                Gestión unificada de órdenes de compra, cuentas por pagar y análisis de proveedores.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">PO → Entry → Payable → Payment</Badge>
              <Link href="/finanzas" className="text-xs text-primary hover:underline">
                Volver a Finanzas
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="po" className="gap-2"><Package className="h-4 w-4" /> PO</TabsTrigger>
          <TabsTrigger value="cxp" className="gap-2"><CreditCard className="h-4 w-4" /> CXP</TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-2"><BarChart3 className="h-4 w-4" /> Proveedores</TabsTrigger>
        </TabsList>

        <TabsContent value="po">
          <PurchaseOrdersPage />
        </TabsContent>

        <TabsContent value="cxp">
          <CxpPage />
        </TabsContent>

        <TabsContent value="suppliers">
          <SupplierAnalysisPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}
