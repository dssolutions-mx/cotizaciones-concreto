'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar as CalendarIcon, Package, TrendingDown, ArrowUpDown, FileText, Save, Lock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuth } from '@/lib/hooks/useAuth'
import { DailyInventoryLog } from '@/types/inventory'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import MaterialEntriesList from './MaterialEntriesList'
import MaterialAdjustmentsList from './MaterialAdjustmentsList'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export default function DailyInventoryLogPage() {
  const { userProfile } = useAuth()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dailyLog, setDailyLog] = useState<DailyInventoryLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchDailyLog()
  }, [selectedDate])

  const fetchDailyLog = async () => {
    setLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const response = await fetch(`/api/inventory/daily-log?date=${dateStr}`)
      
      if (response.ok) {
        const data = await response.json()
        setDailyLog(data.dailyLog)
        setNotes(data.dailyLog?.daily_notes || '')
      }
    } catch (error) {
      console.error('Error fetching daily log:', error)
      toast.error('Error al cargar la bitácora del día')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    setSaving(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const response = await fetch('/api/inventory/daily-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: dateStr,
          notes
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDailyLog(data.dailyLog)
        setIsEditing(false)
        toast.success('Notas guardadas correctamente')
      } else {
        throw new Error('Error al guardar')
      }
    } catch (error) {
      console.error('Error saving notes:', error)
      toast.error('Error al guardar las notas')
    } finally {
      setSaving(false)
    }
  }

  const handleCloseDay = async () => {
    if (!confirm('¿Estás seguro de que quieres cerrar el día? Esta acción no se puede deshacer.')) {
      return
    }

    setSaving(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const response = await fetch('/api/inventory/daily-log', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: dateStr,
          close: true,
          notes
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setDailyLog(data.dailyLog)
        setIsEditing(false)
        toast.success('Día cerrado correctamente')
      } else {
        throw new Error('Error al cerrar el día')
      }
    } catch (error) {
      console.error('Error closing day:', error)
      toast.error('Error al cerrar el día')
    } finally {
      setSaving(false)
    }
  }

  const canEdit = userProfile?.role !== 'DOSIFICADOR' && !dailyLog?.is_closed
  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bitácora Diaria</h1>
          <p className="text-gray-600">
            Control de actividades de inventario
          </p>
        </div>
        
        {/* Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? (
                format(selectedDate, "PPP", { locale: es })
              ) : (
                <span>Seleccionar fecha</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Daily Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resumen del {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </CardTitle>
              <CardDescription>
                {isToday ? 'Actividades del día de hoy' : 'Actividades del día seleccionado'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              {dailyLog?.is_closed ? (
                <Badge variant="secondary">
                  <Lock className="h-3 w-3 mr-1" />
                  Día Cerrado
                </Badge>
              ) : (
                <Badge variant="default">Activo</Badge>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setIsEditing(false)
                          setNotes(dailyLog?.daily_notes || '')
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleSaveNotes}
                        disabled={saving}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Guardando...' : 'Guardar'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        Editar Notas
                      </Button>
                      {isToday && !dailyLog?.is_closed && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleCloseDay}
                          disabled={saving}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Cerrar Día
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
              <div className="p-3 bg-blue-100 rounded-full">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900">Entradas</p>
                <p className="text-2xl font-bold text-blue-700">
                  {dailyLog?.total_entries || 0}
                </p>
                <p className="text-xs text-blue-600">registros</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-orange-50 rounded-lg">
              <div className="p-3 bg-orange-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-900">Ajustes</p>
                <p className="text-2xl font-bold text-orange-700">
                  {dailyLog?.total_adjustments || 0}
                </p>
                <p className="text-xs text-orange-600">movimientos</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-red-50 rounded-lg">
              <div className="p-3 bg-red-100 rounded-full">
                <ArrowUpDown className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-900">Consumo Total</p>
                <p className="text-2xl font-bold text-red-700">
                  {dailyLog?.total_consumption 
                    ? Number(dailyLog.total_consumption).toLocaleString('es-ES', { 
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2 
                      })
                    : '0.00'
                  }
                </p>
                <p className="text-xs text-red-600">kg</p>
              </div>
            </div>
          </div>

          {/* Daily Notes */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Notas del Día</h3>
            {isEditing ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar notas sobre las actividades del día..."
                className="min-h-[100px]"
              />
            ) : (
              <div className="min-h-[100px] p-4 bg-gray-50 rounded-lg">
                {notes ? (
                  <p className="text-gray-700 whitespace-pre-wrap">{notes}</p>
                ) : (
                  <p className="text-gray-500 italic">No hay notas para este día</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Daily Activities */}
      <Card>
        <CardHeader>
          <CardTitle>Actividades del Día</CardTitle>
          <CardDescription>
            Detalle de todas las entradas y ajustes realizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="entries" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="entries">
                Entradas ({dailyLog?.total_entries || 0})
              </TabsTrigger>
              <TabsTrigger value="adjustments">
                Ajustes ({dailyLog?.total_adjustments || 0})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="entries" className="mt-6">
              <MaterialEntriesList 
                date={selectedDate} 
                isEditing={!dailyLog?.is_closed && canEdit} 
              />
            </TabsContent>
            
            <TabsContent value="adjustments" className="mt-6">
              <MaterialAdjustmentsList 
                date={selectedDate} 
                isEditing={!dailyLog?.is_closed && canEdit} 
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
