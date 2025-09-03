'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Truck, FileText, Settings } from 'lucide-react'
import PumpingServiceForm from '@/components/inventory/PumpingServiceForm'
import PumpingRemisionesAdmin from '@/components/inventory/PumpingRemisionesAdmin'
import { useUnifiedAuthBridge } from '@/adapters/unified-auth-bridge'

export default function PumpingServicePage() {
  const { hasRole } = useUnifiedAuthBridge({ preferUnified: true });
  const [activeTab, setActiveTab] = useState('form');

  const canViewAdmin = hasRole(['EXECUTIVE', 'PLANT_MANAGER']);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Servicio de Bombeo</h1>
        <p className="text-muted-foreground">
          Registra remisiones de servicio de bombeo de manera independiente
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="form" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Nueva Remisión
          </TabsTrigger>
          {canViewAdmin && (
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Administración
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="form">
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
        </TabsContent>

        {canViewAdmin && (
          <TabsContent value="admin">
            <PumpingRemisionesAdmin />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
