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
import { Badge } from '@/components/ui/badge'
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
import { format, parse } from 'date-fns'
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
            {format(parse(dateRange.start_date, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy', { locale: es })}
          </span>{' '}
          al{' '}
          <span className="font-semibold">
            {format(parse(dateRange.end_date, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy', { locale: es })}
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
                      <TableCell className="text-right font-medium">
                        <span className={cn(
                          "px-2 py-1 rounded",
                          flow.initial_stock > 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600"
                        )}>
                          {formatNumber(flow.initial_stock)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {flow.total_entries > 0 && (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium bg-green-50 px-2 py-1 rounded">
                            <TrendingUp className="h-3 w-3" />
                            +{formatNumber(flow.total_entries)}
                          </span>
                        )}
                        {flow.total_entries === 0 && <span className="text-gray-400">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {flow.total_manual_additions > 0 && (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium bg-green-50 px-2 py-1 rounded">
                            <TrendingUp className="h-3 w-3" />
                            +{formatNumber(flow.total_manual_additions)}
                          </span>
                        )}
                        {flow.total_manual_additions === 0 && <span className="text-gray-400">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {flow.total_remisiones_consumption > 0 && (
                          <span className="inline-flex items-center gap-1 text-red-700 font-medium bg-red-50 px-2 py-1 rounded">
                            <TrendingDown className="h-3 w-3" />
                            -{formatNumber(flow.total_remisiones_consumption)}
                          </span>
                        )}
                        {flow.total_remisiones_consumption === 0 && <span className="text-gray-400">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {flow.total_manual_withdrawals > 0 && (
                          <span className="inline-flex items-center gap-1 text-red-700 font-medium bg-red-50 px-2 py-1 rounded">
                            <TrendingDown className="h-3 w-3" />
                            -{formatNumber(flow.total_manual_withdrawals)}
                          </span>
                        )}
                        {flow.total_manual_withdrawals === 0 && <span className="text-gray-400">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {flow.total_waste > 0 && (
                          <span className="inline-flex items-center gap-1 text-orange-700 font-medium bg-orange-50 px-2 py-1 rounded">
                            <AlertTriangle className="h-3 w-3" />
                            -{formatNumber(flow.total_waste)}
                          </span>
                        )}
                        {flow.total_waste === 0 && <span className="text-gray-400">0</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn(
                            "font-semibold px-2 py-1 rounded",
                            flow.theoretical_final_stock > 0 
                              ? "bg-blue-100 text-blue-800" 
                              : flow.theoretical_final_stock < 0
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-600"
                          )}>
                            {formatNumber(flow.theoretical_final_stock)}
                          </span>
                          {Math.abs(flow.variance_percentage) > 1 && (
                            <Badge 
                              variant={Math.abs(flow.variance_percentage) > 5 ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {flow.variance_percentage > 0 ? '+' : ''}{flow.variance_percentage.toFixed(1)}%
                            </Badge>
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

        {/* Summary Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Cómo Interpretar Esta Tabla
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-blue-700">
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0" />
                <span><strong>Stock Inicial:</strong> Inventario calculado históricamente al inicio del período</span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0" />
                <span><strong>Movimientos:</strong> Entradas (+), Consumo (-), Ajustes (±), Desperdicio (-)</span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0" />
                <span><strong>Stock Final Teórico:</strong> Inicial + Entradas - Salidas (cálculo preciso)</span>
              </div>
              <div className="flex items-start gap-2">
                <ArrowRight className="h-3 w-3 mt-1 flex-shrink-0" />
                <span><strong>Varianza:</strong> Diferencia entre stock real y teórico (indica discrepancias)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-green-800">✅ Cálculo Histórico Optimizado</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-green-700 space-y-2">
              <p><strong>✓ Batch Queries:</strong> Consultas optimizadas para máximo rendimiento</p>
              <p><strong>✓ Cálculo Preciso:</strong> Stock inicial calculado desde el origen histórico</p>
              <p><strong>✓ Varianza Real:</strong> Comparación con stock actual de material_inventory</p>
              <p><strong>✓ Análisis Flexible:</strong> Cualquier período sin depender de datos actualizados</p>
            </CardContent>
          </Card>
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
                      {format(parse(dateRange.start_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: es })} - {format(parse(dateRange.end_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: es })}
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