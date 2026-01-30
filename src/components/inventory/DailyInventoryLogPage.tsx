'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar as CalendarIcon, Package, TrendingDown, ArrowUpDown, FileText, Save, Lock, Plus } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { DailyInventoryLog } from '@/types/inventory'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import MaterialEntriesList from './MaterialEntriesList'
import MaterialAdjustmentsList from './MaterialAdjustmentsList'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import StatCard from './ui/StatCard'
import FloatingActionButton from './ui/FloatingActionButton'
import Link from 'next/link'
import { DailyEntriesChart, DailyAdjustmentsChart } from './charts/DailyLogCharts'

export default function DailyInventoryLogPage() {
  const { profile } = useAuthSelectors()
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [dailyLog, setDailyLog] = useState<DailyInventoryLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [entries, setEntries] = useState<any[]>([])
  const [adjustments, setAdjustments] = useState<any[]>([])

  useEffect(() => {
    fetchDailyLog()
  }, [selectedDate])

  // Refresh data when page becomes visible (e.g., when user navigates back from adjustments page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshData()
      }
    }

    const handleFocus = () => {
      refreshData()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const refreshData = () => {
    setRefreshKey(prev => prev + 1)
    fetchDailyLog()
  }

  const fetchDailyLog = async () => {
    setLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const response = await fetch(`/api/inventory/daily-log?date=${dateStr}`)
      
      if (response.ok) {
        const data = await response.json()
        setDailyLog(data.data)
        setNotes(data.data?.daily_notes || '')
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

  const canEdit = profile?.role !== 'DOSIFICADOR' && !dailyLog?.is_closed
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
      <InventoryBreadcrumb />
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bitácora Diaria</h1>
          <p className="text-gray-600 text-sm sm:text-base">
            Control de actividades de inventario
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Quick Action Buttons */}
          <div className="flex gap-2 order-2 sm:order-1">
            <Link href="/production-control/entries">
              <Button variant="outline" size="sm" className="h-10 min-w-[48px] sm:min-w-[140px]">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nueva Entrada</span>
              </Button>
            </Link>
            <Link href="/production-control/adjustments">
              <Button variant="outline" size="sm" className="h-10 min-w-[48px] sm:min-w-[140px]">
                <TrendingDown className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Nuevo Ajuste</span>
              </Button>
            </Link>
          </div>

          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full sm:w-[240px] justify-start text-left font-normal h-10",
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
                          className="h-10 min-w-[120px] font-semibold"
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <StatCard
              title="Entradas"
              value={dailyLog?.total_entries || 0}
              icon={Package}
              iconColor="text-blue-600"
              subtitle="registros"
            />
            <StatCard
              title="Ajustes"
              value={dailyLog?.total_adjustments || 0}
              icon={TrendingDown}
              iconColor="text-orange-600"
              subtitle="movimientos"
            />
            <StatCard
              title="Consumo Total"
              value={dailyLog?.total_consumption 
                ? Number(dailyLog.total_consumption).toLocaleString('es-ES', { 
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2 
                  })
                : '0.00'
              }
              icon={ArrowUpDown}
              iconColor="text-red-600"
              subtitle="kg"
            />
          </div>

          {/* Daily Notes - Collapsible */}
          <div className="border-t pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900">Notas del Día</h3>
              {!isEditing && notes && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="text-xs"
                >
                  Editar
                </Button>
              )}
            </div>
            {isEditing ? (
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Agregar notas sobre las actividades del día..."
                className="min-h-[100px] text-sm"
              />
            ) : (
              <div className="min-h-[100px] p-4 bg-gray-50 rounded-lg">
                {notes ? (
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{notes}</p>
                ) : (
                  <p className="text-gray-500 italic text-sm">No hay notas para este día</p>
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
            
            <TabsContent value="entries" className="mt-6 space-y-6">
              <DailyEntriesChart entries={entries} date={selectedDate} />
              <MaterialEntriesList 
                date={selectedDate} 
                isEditing={!dailyLog?.is_closed && canEdit}
                key={refreshKey}
                onEntriesLoaded={setEntries}
              />
            </TabsContent>
            
            <TabsContent value="adjustments" className="mt-6 space-y-6">
              <DailyAdjustmentsChart adjustments={adjustments} date={selectedDate} />
              <MaterialAdjustmentsList 
                date={selectedDate} 
                isEditing={!dailyLog?.is_closed && canEdit}
                refreshKey={refreshKey}
                onAdjustmentsLoaded={setAdjustments}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
