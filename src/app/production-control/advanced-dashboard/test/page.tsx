'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import Link from 'next/link'

/** Legacy route kept for bookmarks; main inventory UX lives at /production-control/inventario */
export default function InventoryDashboardTestNoticePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-sky-700" />
            Herramienta de inventario actualizada
          </CardTitle>
          <CardDescription>
            El antiguo dashboard avanzado por GET /api/inventory/dashboard fue sustituido por la revisión de inventario
            alineada con Compras (existencias, auditoría por material y Excel contable).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/production-control/inventario">
            <Button>Ir a revisión de inventario</Button>
          </Link>
          <Link href="/production-control">
            <Button variant="outline">Centro de materiales</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
