'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaterialAdjustmentForm from './MaterialAdjustmentForm'
import { Plus, History, TrendingDown } from 'lucide-react'

interface MaterialAdjustmentsPageProps {
  // Future props for filtering, etc.
}

export default function MaterialAdjustmentsPage({}: MaterialAdjustmentsPageProps) {
  const [showForm, setShowForm] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleAdjustmentSuccess = (adjustment: any) => {
    setShowForm(false)
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Ajustes de Inventario
          </h1>
          <p className="text-gray-600 mt-1">
            Registre salidas manuales, correcciones y transferencias de materiales
          </p>
        </div>
        
        <Button 
          onClick={() => setShowForm(true)}
          disabled={showForm}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Ajuste
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingDown className="h-8 w-8 text-red-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Ajustes Hoy</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <History className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Esta Semana</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <TrendingDown className="h-8 w-8 text-orange-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Mes</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      {showForm ? (
        <MaterialAdjustmentForm
          onSuccess={handleAdjustmentSuccess}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recent">Ajustes Recientes</TabsTrigger>
            <TabsTrigger value="by-type">Por Tipo</TabsTrigger>
            <TabsTrigger value="by-material">Por Material</TabsTrigger>
          </TabsList>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Ajustes Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay ajustes registrados</p>
                  <p className="text-sm">Los ajustes aparecerán aquí una vez que registre el primero</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-type">
            <Card>
              <CardHeader>
                <CardTitle>Ajustes por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Adjustment Type Categories */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Card className="border-red-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Salidas Manuales</p>
                            <p className="text-sm text-gray-500">0 ajustes</p>
                          </div>
                          <Badge variant="outline" className="border-red-200 text-red-700">
                            Manual
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Material en Mal Estado</p>
                            <p className="text-sm text-gray-500">0 ajustes</p>
                          </div>
                          <Badge variant="outline" className="border-orange-200 text-orange-700">
                            Desperdicio
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Correcciones</p>
                            <p className="text-sm text-gray-500">0 ajustes</p>
                          </div>
                          <Badge variant="outline" className="border-blue-200 text-blue-700">
                            Corrección
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-purple-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Transferencias</p>
                            <p className="text-sm text-gray-500">0 ajustes</p>
                          </div>
                          <Badge variant="outline" className="border-purple-200 text-purple-700">
                            Transfer
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Entradas Manuales</p>
                            <p className="text-sm text-gray-500">0 ajustes</p>
                          </div>
                          <Badge variant="outline" className="border-green-200 text-green-700">
                            Entrada
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-gray-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900">Devoluciones</p>
                            <p className="text-sm text-gray-500">0 ajustes</p>
                          </div>
                          <Badge variant="outline" className="border-gray-200 text-gray-700">
                            Devolución
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-material">
            <Card>
              <CardHeader>
                <CardTitle>Ajustes por Material</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <TrendingDown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay ajustes por material</p>
                  <p className="text-sm">Los ajustes aparecerán agrupados por material una vez que registre algunos</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
