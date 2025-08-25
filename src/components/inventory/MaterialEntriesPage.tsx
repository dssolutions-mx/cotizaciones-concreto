'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Plus, List, Calendar } from 'lucide-react'
import MaterialEntryForm from './MaterialEntryForm'
import MaterialEntriesList from './MaterialEntriesList'

export default function MaterialEntriesPage() {
  const [activeTab, setActiveTab] = useState('new')
  const [refreshList, setRefreshList] = useState(0)

  const handleEntrySuccess = () => {
    setRefreshList(prev => prev + 1)
    setActiveTab('list')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entradas de Material</h1>
          <p className="text-gray-600">
            Registro y gestión de recepción de materiales
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nueva Entrada
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Lista de Entradas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Registrar Nueva Entrada de Material
              </CardTitle>
              <CardDescription>
                Complete los datos de la recepción de material
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MaterialEntryForm onSuccess={handleEntrySuccess} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Entradas Registradas
              </CardTitle>
              <CardDescription>
                Historial de entradas de materiales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MaterialEntriesList 
                date={new Date()} 
                isEditing={true}
                key={refreshList}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
