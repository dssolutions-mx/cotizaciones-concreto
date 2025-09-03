'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Truck } from 'lucide-react'
import PumpingServiceForm from '@/components/inventory/PumpingServiceForm'

export default function PumpingServicePage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Servicio de Bombeo</h1>
        <p className="text-muted-foreground">
          Registra remisiones de servicio de bombeo de manera independiente
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Nueva Remisión de Bombeo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PumpingServiceForm />
        </CardContent>
      </Card>
    </div>
  )
}
