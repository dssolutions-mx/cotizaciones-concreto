'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingDown, 
  Plus, 
  Edit,
  AlertTriangle,
  RotateCcw,
  ArrowUpDown,
  FileText,
  User,
  Clock
} from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MaterialAdjustment } from '@/types/inventory'
import Link from 'next/link'
import { toast } from 'sonner'

interface MaterialAdjustmentsListProps {
  date: Date
  isEditing: boolean
  refreshKey?: number
  onAdjustmentsLoaded?: (adjustments: MaterialAdjustment[]) => void
}

const adjustmentTypeLabels = {
  consumption: 'Consumo Manual',
  waste: 'Pérdida/Desecho',
  correction: 'Corrección',
  transfer: 'Transferencia',
  loss: 'Pérdida por Evento'
}

const adjustmentTypeColors = {
  consumption: 'bg-blue-50 text-blue-700 border-blue-200',
  waste: 'bg-red-50 text-red-700 border-red-200',
  correction: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  transfer: 'bg-green-50 text-green-700 border-green-200',
  loss: 'bg-orange-50 text-orange-700 border-orange-200'
}

const adjustmentTypeIcons = {
  consumption: TrendingDown,
  waste: AlertTriangle,
  correction: RotateCcw,
  transfer: ArrowUpDown,
  loss: AlertTriangle
}

export default function MaterialAdjustmentsList({ date, isEditing, refreshKey, onAdjustmentsLoaded }: MaterialAdjustmentsListProps) {
  const [adjustments, setAdjustments] = useState<MaterialAdjustment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAdjustments()
  }, [date, refreshKey])

  const fetchAdjustments = async () => {
    setLoading(true)
    try {
      const dateStr = format(date, 'yyyy-MM-dd')
      console.log('=== FRONTEND: Fetching adjustments ===')
      console.log('Date object:', date)
      console.log('Formatted date string:', dateStr)
      console.log('Fetch URL:', `/api/inventory/adjustments?date=${dateStr}`)
      const response = await fetch(`/api/inventory/adjustments?date=${dateStr}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('=== FRONTEND: Adjustments API response ===')
        console.log('Response status:', response.status)
        console.log('Response data:', data)
        console.log('Adjustments array:', data.adjustments)
        console.log('Adjustments count:', data.adjustments?.length || 0)
        const adjustmentsData = data.adjustments || []
        setAdjustments(adjustmentsData)
        onAdjustmentsLoaded?.(adjustmentsData)
      } else {
        console.error('Adjustments API error:', response.status, response.statusText)
        const errorData = await response.json()
        console.error('Error details:', errorData)
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error)
      toast.error('Error al cargar los ajustes')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-24 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    )
  }

  if (adjustments.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 px-4">
          <div className="p-4 bg-gray-100 rounded-full mb-4">
            <TrendingDown className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2 text-center">
            No hay ajustes registrados
          </h3>
          <p className="text-gray-500 text-center mb-6 max-w-md">
            No se han registrado ajustes de inventario para este día. Use el botón de abajo para registrar un nuevo ajuste.
          </p>
          {isEditing && (
            <Link href="/production-control/adjustments">
              <Button size="lg" className="min-w-[200px]">
                <Plus className="h-4 w-4 mr-2" />
                Registrar Nuevo Ajuste
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Action Button */}
      {isEditing && (
        <div className="flex justify-end">
          <Link href="/production-control/adjustments">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Ajuste
            </Button>
          </Link>
        </div>
      )}

      {/* Adjustments List */}
      {adjustments.map((adjustment) => {
        const Icon = adjustmentTypeIcons[adjustment.adjustment_type]
        const colorClass = adjustmentTypeColors[adjustment.adjustment_type]
        
        return (
          <Card key={adjustment.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base sm:text-lg truncate">{adjustment.adjustment_number}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {format(new Date(`${adjustment.adjustment_date}T${adjustment.adjustment_time}`), "dd MMM yyyy 'a las' HH:mm", { locale: es })}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className={cn(colorClass, "text-xs")}>
                    {adjustmentTypeLabels[adjustment.adjustment_type]}
                  </Badge>
                  {isEditing && (
                    <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4 p-4 sm:p-6">
              {/* Material Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Material</h4>
                  <p className="text-sm text-gray-600">ID: {adjustment.material_id}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Cantidad Ajustada</h4>
                  <p className="text-lg font-semibold text-orange-600">
                    -{adjustment.quantity_adjusted.toLocaleString('es-ES', { 
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2 
                    })} kg
                  </p>
                </div>
              </div>

              {/* Inventory Changes */}
              <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                <ArrowUpDown className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-900">
                  Inventario: {adjustment.inventory_before.toLocaleString('es-ES')} → {adjustment.inventory_after.toLocaleString('es-ES')} kg
                </span>
              </div>

              {/* Reference Information */}
              {(adjustment.reference_type || adjustment.reference_notes) && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-900 mb-2">Información de Referencia</h5>
                  {adjustment.reference_type && (
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Tipo:</span> {adjustment.reference_type}
                    </p>
                  )}
                  {adjustment.reference_notes && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Notas:</span> {adjustment.reference_notes}
                    </p>
                  )}
                </div>
              )}

              {/* Footer Info */}
              <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Registrado por: {adjustment.adjusted_by}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(adjustment.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                </span>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
