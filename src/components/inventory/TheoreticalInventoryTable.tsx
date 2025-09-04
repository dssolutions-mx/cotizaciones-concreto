'use client'

import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  ChevronDown, 
  ChevronUp, 
  Search,
  Package,
  Calculator,
  Settings,
  ArrowRight,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { MaterialFlowSummary } from '@/types/inventory'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import MaterialAdjustmentForm from './MaterialAdjustmentForm'

interface TheoreticalInventoryTableProps {
  materialFlows: MaterialFlowSummary[]
  dateRange: {
    start_date: string
    end_date: string
  }
}

type SortField = keyof MaterialFlowSummary
type SortDirection = 'asc' | 'desc'

export default function TheoreticalInventoryTable({ 
  materialFlows, 
  dateRange 
}: TheoreticalInventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('material_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<MaterialFlowSummary | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField === field) {
      return sortDirection === 'asc' ?
        <ChevronUp className="h-4 w-4" /> :
        <ChevronDown className="h-4 w-4" />
    }
    return null
  }

  const filteredAndSortedFlows = materialFlows
    .filter(flow =>
      flow.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flow.unit.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc'
          ? aValue - bValue
          : bValue - aValue
      }

      return 0
    })

  const formatNumber = (num: number) => new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num)

  const openAdjustmentModal = (material: MaterialFlowSummary) => {
    setSelectedMaterial(material)
    setAdjustmentModalOpen(true)
  }

  const handleAdjustmentSuccess = (adjustment: any) => {
    setAdjustmentModalOpen(false)
    setSelectedMaterial(null)
    // TODO: Refresh data or show success message
    console.log('Adjustment created:', adjustment)
  }

  const getInventoryTrend = (theoretical: number, current: number) => {
    const diff = theoretical - current
    if (Math.abs(diff) < 1) return { icon: null, color: 'text-gray-500', label: 'Sin cambio' }
    if (diff > 0) return { icon: TrendingUp, color: 'text-green-600', label: `+${formatNumber(diff)}` }
    return { icon: TrendingDown, color: 'text-red-600', label: formatNumber(diff) }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-6 w-6" /> 
          Análisis de Inventario Teórico
        </CardTitle>
        <CardDescription>
          Movimientos de materiales para el período del{' '}
          <span className="font-semibold">
            {format(new Date(dateRange.start_date), 'dd MMM yyyy', { locale: es })}
          </span>{' '}
          al{' '}
          <span className="font-semibold">
            {format(new Date(dateRange.end_date), 'dd MMM yyyy', { locale: es })}
          </span>
        </CardDescription>
        
        {/* Search */}
        <div className="flex items-center py-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar material..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-9 max-w-sm"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead onClick={() => handleSort('material_name')} className="cursor-pointer">
                  Material {getSortIcon('material_name')}
                </TableHead>
                <TableHead onClick={() => handleSort('unit')} className="cursor-pointer">
                  Unidad {getSortIcon('unit')}
                </TableHead>
                <TableHead onClick={() => handleSort('initial_stock')} className="cursor-pointer text-right">
                  Stock Inicial {getSortIcon('initial_stock')}
                </TableHead>
                <TableHead onClick={() => handleSort('total_entries')} className="cursor-pointer text-right">
                  Entradas {getSortIcon('total_entries')}
                </TableHead>
                <TableHead onClick={() => handleSort('total_manual_additions')} className="cursor-pointer text-right">
                  Ajustes (+) {getSortIcon('total_manual_additions')}
                </TableHead>
                <TableHead onClick={() => handleSort('total_remisiones_consumption')} className="cursor-pointer text-right">
                  Consumo {getSortIcon('total_remisiones_consumption')}
                </TableHead>
                <TableHead onClick={() => handleSort('total_manual_withdrawals')} className="cursor-pointer text-right">
                  Ajustes (-) {getSortIcon('total_manual_withdrawals')}
                </TableHead>
                <TableHead onClick={() => handleSort('total_waste')} className="cursor-pointer text-right">
                  Desperdicio {getSortIcon('total_waste')}
                </TableHead>
                <TableHead onClick={() => handleSort('theoretical_final_stock')} className="cursor-pointer text-right">
                  Stock Final Teórico {getSortIcon('theoretical_final_stock')}
                </TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedFlows.length > 0 ? (
                filteredAndSortedFlows.map((flow) => {
                  const trend = getInventoryTrend(flow.theoretical_final_stock, flow.initial_stock)
                  const TrendIcon = trend.icon
                  
                  return (
                    <TableRow key={flow.material_id}>
                      <TableCell className="font-medium">{flow.material_name}</TableCell>
                      <TableCell>{flow.unit}</TableCell>
                      <TableCell className="text-right">{formatNumber(flow.initial_stock)}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        +{formatNumber(flow.total_entries)}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        +{formatNumber(flow.total_manual_additions)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        -{formatNumber(flow.total_remisiones_consumption)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        -{formatNumber(flow.total_manual_withdrawals)}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">
                        -{formatNumber(flow.total_waste)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold">{formatNumber(flow.theoretical_final_stock)}</span>
                          {TrendIcon && (
                            <div className={cn("flex items-center gap-1", trend.color)}>
                              <TrendIcon className="h-4 w-4" />
                              <span className="text-xs">{trend.label}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAdjustmentModal(flow)}
                          className="h-8 gap-1"
                          title="Crear ajuste para este material"
                        >
                          <Settings className="h-3 w-3" />
                          Ajustar
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No se encontraron materiales con los criterios de búsqueda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Explicación Simplificada */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold mb-3 text-blue-800 flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Cómo Interpretar Esta Tabla
          </h4>
          <div className="space-y-2 text-sm text-blue-700">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3 w-3" />
              <span><strong>Stock Inicial:</strong> Inventario calculado al inicio del período seleccionado</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3 w-3" />
              <span><strong>Entradas/Salidas:</strong> Todos los movimientos registrados en el período</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3 w-3" />
              <span><strong>Stock Final Teórico:</strong> Lo que deberías tener según los cálculos (Inicial + Entradas - Salidas)</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3 w-3" />
              <span><strong>Ajustar:</strong> Crear correcciones si el inventario físico real difiere del teórico</span>
            </div>
          </div>
        </div>

        {/* Nuevo Enfoque Implementado */}
        <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="font-semibold mb-2 text-green-800">✅ Nuevo Enfoque de Cálculo Histórico</h4>
          <p className="text-sm text-green-700 mb-2">
            <strong>Problema resuelto:</strong> El sistema ahora calcula el inventario de manera histórica y precisa.
          </p>
          <div className="text-xs text-green-600 space-y-1">
            <p><strong>Stock Inicial:</strong> Se calcula sumando TODOS los movimientos desde el origen hasta el inicio del período</p>
            <p><strong>Movimientos del Período:</strong> Solo incluye entradas/salidas del rango de fechas seleccionado</p>
            <p><strong>Stock Final Teórico:</strong> Inicial + Entradas - Salidas (aritmética simple y confiable)</p>
            <p><strong>Beneficio:</strong> Análisis preciso de cualquier período sin depender de datos que se actualizan</p>
          </div>
        </div>
      </CardContent>

      {/* Modal de Ajuste */}
      <Dialog open={adjustmentModalOpen} onOpenChange={setAdjustmentModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Crear Ajuste - {selectedMaterial?.material_name}
            </DialogTitle>
          </DialogHeader>
          {selectedMaterial && (
            <div className="space-y-4">
              {/* Información del Material */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">Información del Período:</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Stock Teórico Final:</span>
                    <p className="font-semibold">{formatNumber(selectedMaterial.theoretical_final_stock)} {selectedMaterial.unit}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Período:</span>
                    <p className="font-semibold">
                      {format(new Date(dateRange.start_date), 'dd/MM/yyyy', { locale: es })} - {format(new Date(dateRange.end_date), 'dd/MM/yyyy', { locale: es })}
                    </p>
                  </div>
                </div>
              </div>
              
              <MaterialAdjustmentForm
                initialData={{
                  material_id: selectedMaterial.material_id,
                  adjustment_type: 'correction',
                  reference_notes: `Ajuste para ${selectedMaterial.material_name} - Stock teórico: ${formatNumber(selectedMaterial.theoretical_final_stock)} ${selectedMaterial.unit}`
                }}
                onSuccess={handleAdjustmentSuccess}
                onCancel={() => setAdjustmentModalOpen(false)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}