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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  ChevronDown, 
  ChevronUp, 
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle
} from 'lucide-react'
import { MaterialFlowSummary } from '@/types/inventory'
import { cn } from '@/lib/utils'

interface MaterialFlowSummaryTableProps {
  materialFlows: MaterialFlowSummary[]
}

type SortField = keyof MaterialFlowSummary
type SortDirection = 'asc' | 'desc'

export default function MaterialFlowSummaryTable({ materialFlows }: MaterialFlowSummaryTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('variance_percentage')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
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
      flow.material_name.toLowerCase().includes(searchTerm.toLowerCase())
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

  const getVarianceColor = (variancePercentage: number) => {
    const absVariance = Math.abs(variancePercentage)
    if (absVariance >= 5) return 'destructive'
    if (absVariance >= 1) return 'secondary'
    return 'default'
  }

  const getVarianceIcon = (variancePercentage: number) => {
    if (Math.abs(variancePercentage) >= 5) return <AlertTriangle className="h-3 w-3" />
    if (variancePercentage > 0) return <TrendingUp className="h-3 w-3" />
    if (variancePercentage < 0) return <TrendingDown className="h-3 w-3" />
    return null
  }

  const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString('es-ES', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })
  }

  return (
    <div className="space-y-4">
      {/* Search and Summary */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-gray-600">
          {filteredAndSortedFlows.length} de {materialFlows.length} materiales
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[200px]">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('material_name')}
                >
                  Material {getSortIcon('material_name')}
                </Button>
              </TableHead>
              <TableHead className="text-center">Unidad</TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('initial_stock')}
                >
                  Stock Inicial {getSortIcon('initial_stock')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('total_entries')}
                >
                  Entradas {getSortIcon('total_entries')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('total_remisiones_consumption')}
                >
                  Consumo Remisiones {getSortIcon('total_remisiones_consumption')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('theoretical_final_stock')}
                >
                  Teórico Final {getSortIcon('theoretical_final_stock')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('actual_current_stock')}
                >
                  Real Actual {getSortIcon('actual_current_stock')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('variance')}
                >
                  Varianza {getSortIcon('variance')}
                </Button>
              </TableHead>
              <TableHead className="text-center">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('variance_percentage')}
                >
                  Varianza % {getSortIcon('variance_percentage')}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedFlows.map((flow) => (
              <TableRow key={flow.material_id} className="hover:bg-gray-50">
                <TableCell className="font-medium">
                  <div>
                    <div className="font-medium">{flow.material_name}</div>
                    <div className="text-xs text-gray-500">ID: {flow.material_id.slice(-8)}</div>
                  </div>
                </TableCell>
                <TableCell className="text-center font-mono text-sm">
                  {flow.unit}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(flow.initial_stock)}
                </TableCell>
                <TableCell className="text-right font-mono text-green-600">
                  +{formatNumber(flow.total_entries)}
                </TableCell>
                <TableCell className="text-right font-mono text-red-600">
                  -{formatNumber(flow.total_remisiones_consumption)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatNumber(flow.theoretical_final_stock)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatNumber(flow.actual_current_stock)}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-mono",
                  flow.variance > 0 ? "text-green-600" : flow.variance < 0 ? "text-red-600" : "text-gray-600"
                )}>
                  {flow.variance > 0 ? "+" : ""}{formatNumber(flow.variance)}
                </TableCell>
                <TableCell className="text-center">
                  <Badge 
                    variant={getVarianceColor(flow.variance_percentage)}
                    className="font-mono text-xs"
                  >
                    <span className="flex items-center gap-1">
                      {getVarianceIcon(flow.variance_percentage)}
                      {flow.variance_percentage > 0 ? "+" : ""}{formatNumber(flow.variance_percentage)}%
                    </span>
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filteredAndSortedFlows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No se encontraron materiales que coincidan con la búsqueda' : 'No hay datos de materiales disponibles'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Stats */}
      {filteredAndSortedFlows.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium">Total Stock Teórico</div>
              <div className="text-lg font-bold text-blue-600">
                {formatNumber(filteredAndSortedFlows.reduce((sum, f) => sum + f.theoretical_final_stock, 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Total Stock Real</div>
              <div className="text-lg font-bold text-green-600">
                {formatNumber(filteredAndSortedFlows.reduce((sum, f) => sum + f.actual_current_stock, 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Total Consumo</div>
              <div className="text-lg font-bold text-red-600">
                {formatNumber(filteredAndSortedFlows.reduce((sum, f) => sum + f.total_remisiones_consumption, 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Varianza Total</div>
              <div className={cn(
                "text-lg font-bold",
                filteredAndSortedFlows.reduce((sum, f) => sum + f.variance, 0) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatNumber(filteredAndSortedFlows.reduce((sum, f) => sum + f.variance, 0))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
