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
  ArrowUp,
  ArrowDown,
  Package,
  Settings,
  FileText,
  AlertTriangle
} from 'lucide-react'
import { InventoryMovement } from '@/types/inventory'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface InventoryMovementsTableProps {
  movements: InventoryMovement[]
}

type SortField = keyof InventoryMovement
type SortDirection = 'asc' | 'desc'

export default function InventoryMovementsTable({ movements }: InventoryMovementsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<InventoryMovement['movement_type'] | 'ALL'>('ALL')
  const [sortField, setSortField] = useState<SortField>('movement_date')
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

  const filteredAndSortedMovements = movements
    .filter(movement => {
      const matchesSearch = movement.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.reference.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = movementTypeFilter === 'ALL' || movement.movement_type === movementTypeFilter
      return matchesSearch && matchesType
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

  const getMovementTypeInfo = (type: InventoryMovement['movement_type']) => {
    switch (type) {
      case 'ENTRY':
        return {
          label: 'Entrada',
          icon: <ArrowUp className="h-3 w-3" />,
          variant: 'default' as const,
          color: 'text-green-600'
        }
      case 'ADJUSTMENT':
        return {
          label: 'Ajuste',
          icon: <Settings className="h-3 w-3" />,
          variant: 'secondary' as const,
          color: 'text-blue-600'
        }
      case 'REMISION':
        return {
          label: 'Remisión',
          icon: <FileText className="h-3 w-3" />,
          variant: 'outline' as const,
          color: 'text-red-600'
        }
      case 'WASTE':
        return {
          label: 'Desperdicio',
          icon: <AlertTriangle className="h-3 w-3" />,
          variant: 'destructive' as const,
          color: 'text-orange-600'
        }
      default:
        return {
          label: type,
          icon: <Package className="h-3 w-3" />,
          variant: 'outline' as const,
          color: 'text-gray-600'
        }
    }
  }

  const formatNumber = (value: number, decimals = 2) => {
    return value.toLocaleString('es-ES', { 
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals 
    })
  }

  const movementTypeCounts = movements.reduce((acc, movement) => {
    acc[movement.movement_type] = (acc[movement.movement_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="relative w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar por material o referencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={movementTypeFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMovementTypeFilter('ALL')}
            >
              Todos ({movements.length})
            </Button>
            {(['ENTRY', 'ADJUSTMENT', 'REMISION', 'WASTE'] as const).map(type => {
              const count = movementTypeCounts[type] || 0
              const { label } = getMovementTypeInfo(type)
              if (count === 0) return null
              
              return (
                <Button
                  key={type}
                  variant={movementTypeFilter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMovementTypeFilter(type)}
                >
                  {label} ({count})
                </Button>
              )
            })}
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {filteredAndSortedMovements.length} de {movements.length} movimientos
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
                  onClick={() => handleSort('movement_date')}
                >
                  Fecha {getSortIcon('movement_date')}
                </Button>
              </TableHead>
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('movement_type')}
                >
                  Tipo {getSortIcon('movement_type')}
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
                  onClick={() => handleSort('quantity')}
                >
                  Cantidad {getSortIcon('quantity')}
                </Button>
              </TableHead>
              <TableHead className="text-center">Unidad</TableHead>
              <TableHead className="w-[180px]">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('reference')}
                >
                  Referencia {getSortIcon('reference')}
                </Button>
              </TableHead>
              <TableHead className="w-[200px]">Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedMovements.map((movement, index) => {
              const typeInfo = getMovementTypeInfo(movement.movement_type)
              return (
                <TableRow key={index} className="hover:bg-gray-50">
                  <TableCell className="font-mono text-sm">
                    {format(new Date(movement.movement_date), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeInfo.variant} className="text-xs">
                      <span className="flex items-center gap-1">
                        {typeInfo.icon}
                        {typeInfo.label}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-medium">{movement.material_name}</div>
                      <div className="text-xs text-gray-500">ID: {movement.material_id.slice(-8)}</div>
                    </div>
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    typeInfo.color
                  )}>
                    {movement.quantity > 0 ? "+" : ""}{formatNumber(movement.quantity)}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {movement.unit}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {movement.reference}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {movement.notes || '-'}
                  </TableCell>
                </TableRow>
              )
            })}
            {filteredAndSortedMovements.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {searchTerm || movementTypeFilter !== 'ALL' ? 
                    'No se encontraron movimientos que coincidan con los filtros' : 
                    'No hay movimientos disponibles'
                  }
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Stats */}
      {filteredAndSortedMovements.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <div className="font-medium">Total Entradas</div>
              <div className="text-lg font-bold text-green-600">
                +{formatNumber(filteredAndSortedMovements
                  .filter(m => m.movement_type === 'ENTRY')
                  .reduce((sum, m) => sum + m.quantity, 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Total Salidas</div>
              <div className="text-lg font-bold text-red-600">
                {formatNumber(filteredAndSortedMovements
                  .filter(m => m.movement_type === 'REMISION')
                  .reduce((sum, m) => sum + Math.abs(m.quantity), 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Total Ajustes</div>
              <div className="text-lg font-bold text-blue-600">
                {formatNumber(filteredAndSortedMovements
                  .filter(m => m.movement_type === 'ADJUSTMENT')
                  .reduce((sum, m) => sum + Math.abs(m.quantity), 0))}
              </div>
            </div>
            <div className="text-center">
              <div className="font-medium">Movimiento Neto</div>
              <div className={cn(
                "text-lg font-bold",
                filteredAndSortedMovements.reduce((sum, m) => sum + m.quantity, 0) >= 0 ? 
                  "text-green-600" : "text-red-600"
              )}>
                {formatNumber(filteredAndSortedMovements.reduce((sum, m) => sum + m.quantity, 0))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
