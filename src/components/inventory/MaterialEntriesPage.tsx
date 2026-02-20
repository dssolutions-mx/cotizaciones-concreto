'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar as CalendarComponent } from '@/components/ui/calendar'
import { Package, Plus, List, Calendar as CalendarIcon, DollarSign } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import MaterialEntryForm from './MaterialEntryForm'
import MaterialEntriesList from './MaterialEntriesList'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import EntryPricingReviewList from './EntryPricingReviewList'
import FloatingActionButton from './ui/FloatingActionButton'
import DateRangePresets, { getDateRangeForPreset, type DateRangePreset } from './ui/DateRangePresets'
import EntriesStatistics from './EntriesStatistics'

export default function MaterialEntriesPage() {
  const searchParams = useSearchParams()
  const poIdFromUrl = searchParams.get('po_id') || undefined
  const [activeTab, setActiveTab] = useState('new')

  useEffect(() => {
    if (poIdFromUrl) setActiveTab('list')
  }, [poIdFromUrl])
  const [refreshList, setRefreshList] = useState(0)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  // Default to last 7 days for entries list
  const defaultDateRange = {
    from: subDays(new Date(), 6),
    to: new Date()
  }
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>(defaultDateRange)
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>('last7days')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [entries, setEntries] = useState<any[]>([])

  useEffect(() => {
    // Check user role for conditional tab display
    fetchUserRole()
  }, [])

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const data = await response.json()
        setUserRole(data.role)
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
  }

  const handleEntrySuccess = () => {
    setRefreshList(prev => prev + 1)
    setActiveTab('list')
  }

  const handlePricingSuccess = () => {
    setRefreshList(prev => prev + 1)
  }

  const handlePresetSelect = (preset: DateRangePreset, range: { from: Date; to: Date }) => {
    setSelectedPreset(preset)
    setDateRange(range)
  }

  const handleDateRangeChange = (range: { from: Date | undefined; to: Date | undefined }) => {
    setDateRange(range)
    // Detect if range matches a preset
    if (range.from && range.to) {
      const presets: DateRangePreset[] = ['today', 'yesterday', 'last7days', 'last30days', 'thisWeek', 'thisMonth']
      for (const preset of presets) {
        const presetRange = getDateRangeForPreset(preset)
        if (
          format(range.from, 'yyyy-MM-dd') === format(presetRange.from, 'yyyy-MM-dd') &&
          format(range.to, 'yyyy-MM-dd') === format(presetRange.to, 'yyyy-MM-dd')
        ) {
          setSelectedPreset(preset)
          return
        }
      }
      setSelectedPreset('custom')
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <InventoryBreadcrumb />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Entradas de Material</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Registro y gestión de recepción de materiales
          </p>
        </div>
        {activeTab === 'list' && (
          <FloatingActionButton
            icon={Plus}
            label="Nueva Entrada"
            onClick={() => setActiveTab('new')}
          />
        )}
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn(
          "grid w-full max-w-md",
          (userRole === 'ADMIN_OPERATIONS' || userRole === 'EXECUTIVE') ? "grid-cols-3" : "grid-cols-2"
        )}>
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nueva Entrada
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Lista de Entradas
          </TabsTrigger>
          {(userRole === 'ADMIN_OPERATIONS' || userRole === 'EXECUTIVE') && (
            <TabsTrigger value="review" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Revisión
            </TabsTrigger>
          )}
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
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Entradas Registradas
                  </CardTitle>
                  <CardDescription>
                    Historial de entradas de materiales
                  </CardDescription>
                </div>
                
                {/* Date Range Controls */}
                <div className="flex flex-col gap-3 w-full sm:w-auto">
                  {/* Date Range Presets */}
                  <DateRangePresets
                    selectedPreset={selectedPreset}
                    onPresetSelect={handlePresetSelect}
                  />
                  
                  {/* Date Range Picker */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "w-full sm:w-[280px] justify-start text-left font-normal h-10",
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
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange.from}
                        selected={dateRange}
                        onSelect={handleDateRangeChange}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <EntriesStatistics entries={entries} dateRange={dateRange} />
              <MaterialEntriesList 
                dateRange={dateRange}
                poId={poIdFromUrl}
                isEditing={true}
                key={refreshList}
                onEntriesLoaded={setEntries}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {(userRole === 'ADMIN_OPERATIONS' || userRole === 'EXECUTIVE') && (
          <TabsContent value="review" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Revisión de Precios
                </CardTitle>
                <CardDescription>
                  Entradas pendientes de revisión de costos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <EntryPricingReviewList 
                  onSuccess={handlePricingSuccess}
                  key={refreshList}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
