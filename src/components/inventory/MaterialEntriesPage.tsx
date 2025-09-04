'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Package, Plus, List, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import MaterialEntryForm from './MaterialEntryForm'
import MaterialEntriesList from './MaterialEntriesList'
import InventoryBreadcrumb from './InventoryBreadcrumb'

export default function MaterialEntriesPage() {
  const [activeTab, setActiveTab] = useState('new')
  const [refreshList, setRefreshList] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(),
    to: new Date()
  })

  const handleEntrySuccess = () => {
    setRefreshList(prev => prev + 1)
    setActiveTab('list')
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <InventoryBreadcrumb />
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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Entradas Registradas
                  </CardTitle>
                  <CardDescription>
                    Historial de entradas de materiales
                  </CardDescription>
                </div>
                
                {/* Date Range Picker */}
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[280px] justify-start text-left font-normal",
                          !dateRange.from && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd MMM", { locale: es })} -{" "}
                              {format(dateRange.to, "dd MMM yyyy", { locale: es })}
                            </>
                          ) : (
                            format(dateRange.from, "dd MMM yyyy", { locale: es })
                          )
                        ) : (
                          <span>Seleccionar fechas</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <MaterialEntriesList 
                dateRange={dateRange}
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
