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
  Target,
  AlertTriangle
} from 'lucide-react'
import { RemisionMaterialConsumption } from '@/types/inventory'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface RemisionConsumptionTableProps {
  consumptionDetails: RemisionMaterialConsumption[]
}

type SortField = keyof RemisionMaterialConsumption
type SortDirection = 'asc' | 'desc'

export default function RemisionConsumptionTable({ consumptionDetails }: RemisionConsumptionTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [varianceFilter, setVarianceFilter] = useState<'ALL' | 'WITH_VARIANCE' | 'NO_VARIANCE'>('ALL')
  const [sortField, setSortField] = useState<SortField>('remision_date')
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

  const filteredAndSortedConsumption = consumptionDetails
    .filter(consumption => {
      const matchesSearch = consumption.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        consumption.remision_number.toLowerCase().includes(searchTerm.toLowerCase())
      
      let matchesVariance = true
      if (varianceFilter === 'WITH_VARIANCE') {
        matchesVariance = Math.abs(consumption.variance) > 0.01
      } else if (varianceFilter === 'NO_VARIANCE') {
        matchesVariance = Math.abs(consumption.variance) <= 0.01
      }
      
      return matchesSearch && matchesVariance
    })
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

  const getVarianceColor = (variance: number) => {
    const absVariance = Math.abs(variance)
    if (absVariance >= 5) return 'destructive'
    if (absVariance >= 1) return 'secondary'
    if (absVariance > 0.01) return 'outline'
    return 'default'
  }

  const getVarianceIcon = (variance: number) => {
    const absVariance = Math.abs(variance)
    if (absVariance >= 5) return <AlertTriangle className="h-3 w-3" />
    if (variance > 0.01) return <TrendingUp className="h-3 w-3" />
    if (variance < -0.01) return <TrendingDown className="h-3 w-3" />
    return <Target className="h-3 w-3" />
  }

  const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString('es-ES', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })
  }

  const calculateVariancePercentage = (variance: number, teorica: number) => {
    if (teorica === 0) return 0
    return (variance / teorica) * 100
  }

  const varianceCounts = {
    all: consumptionDetails.length,
    withVariance: consumptionDetails.filter(c => Math.abs(c.variance) > 0.01).length,
    noVariance: consumptionDetails.filter(c => Math.abs(c.variance) <= 0.01).length
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar por material o remisión..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={varianceFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVarianceFilter('ALL')}
            >
              Todas ({varianceCounts.all})
            </Button>
            <Button
              variant={varianceFilter === 'WITH_VARIANCE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVarianceFilter('WITH_VARIANCE')}
            >
              Con Varianza ({varianceCounts.withVariance})
            </Button>
            <Button
              variant={varianceFilter === 'NO_VARIANCE' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setVarianceFilter('NO_VARIANCE')}
            >
              Sin Varianza ({varianceCounts.noVariance})
            </Button>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {filteredAndSortedConsumption.length} de {consumptionDetails.length} registros
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('remision_date')}
                >
                  Fecha {getSortIcon('remision_date')}
                </Button>
              </TableHead>
              <TableHead className="w-[140px]">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('remision_number')}
                >
                  Remisión {getSortIcon('remision_number')}
                </Button>
              </TableHead>
              <TableHead className="w-[200px]">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('material_name')}
                >
                  Material {getSortIcon('material_name')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('cantidad_teorica')}
                >
                  Teórico {getSortIcon('cantidad_teorica')}
                </Button>
              </TableHead>
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('cantidad_real')}
                >
                  Real {getSortIcon('cantidad_real')}
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
              <TableHead className="text-center">Varianza %</TableHead>
              <TableHead className="text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedConsumption.map((consumption, index) => {
              const variancePercentage = calculateVariancePercentage(consumption.variance, consumption.cantidad_teorica)
              
              return (
                <TableRow key={index} className="hover:bg-gray-50">
                  <TableCell className="font-mono text-sm">
                    {format(parse(consumption.remision_date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className="font-mono text-sm font-medium">
                    {consumption.remision_number}
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-medium">{consumption.material_name}</div>
                      <div className="text-xs text-gray-500">ID: {consumption.material_id.slice(-8)}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-blue-600">
                    {formatNumber(consumption.cantidad_teorica)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    {formatNumber(consumption.cantidad_real)}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    consumption.variance > 0 ? "text-green-600" : 
                    consumption.variance < 0 ? "text-red-600" : "text-gray-600"
                  )}>
                    {consumption.variance > 0 ? "+" : ""}{formatNumber(consumption.variance)}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={cn(
                      "font-mono text-sm font-medium",
                      Math.abs(variancePercentage) >= 5 ? "text-red-600" :
                      Math.abs(variancePercentage) >= 1 ? "text-yellow-600" : "text-green-600"
                    )}>
                      {variancePercentage > 0 ? "+" : ""}{formatNumber(variancePercentage)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={getVarianceColor(consumption.variance)}
                      className="text-xs"
                    >
                      <span className="flex items-center gap-1">
                        {getVarianceIcon(consumption.variance)}
                        {Math.abs(consumption.variance) <= 0.01 ? 'Exacto' :
                         Math.abs(consumption.variance) < 1 ? 'Mínima' :
                         Math.abs(consumption.variance) < 5 ? 'Moderada' : 'Alta'}
                      </span>
                    </Badge>
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredAndSortedConsumption.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  {searchTerm || varianceFilter !== 'ALL' ? 
                    'No se encontraron registros que coincidan con los filtros' : 
                    'No hay datos de consumo disponibles'
                  }
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Stats */}
      {filteredAndSortedConsumption.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium">Total Teórico</div>
              <div className="text-lg font-bold text-blue-600">
                {formatNumber(filteredAndSortedConsumption.reduce((sum, c) => sum + c.cantidad_teorica, 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Total Real</div>
              <div className="text-lg font-bold text-green-600">
                {formatNumber(filteredAndSortedConsumption.reduce((sum, c) => sum + c.cantidad_real, 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Varianza Total</div>
              <div className={cn(
                "text-lg font-bold",
                filteredAndSortedConsumption.reduce((sum, c) => sum + c.variance, 0) >= 0 ? 
                  "text-green-600" : "text-red-600"
              )}>
                {formatNumber(filteredAndSortedConsumption.reduce((sum, c) => sum + c.variance, 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Precisión Promedio</div>
              <div className="text-lg font-bold text-purple-600">
                {formatNumber(100 - (filteredAndSortedConsumption.reduce((sum, c) => 
                  sum + Math.abs(calculateVariancePercentage(c.variance, c.cantidad_teorica)), 0) / 
                  filteredAndSortedConsumption.length))}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
