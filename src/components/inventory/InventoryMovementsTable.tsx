'use client'

import React, { useEffect, useMemo, useState } from 'react'
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
  AlertTriangle,
  Landmark,
  ExternalLink,
} from 'lucide-react'
import { InventoryMovement, RemisionMaterialConsumption } from '@/types/inventory'
import { format, parse } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface InventoryMovementsTableProps {
  movements: InventoryMovement[]
  /** Single-material context: hide the material column */
  singleMaterial?: boolean
  /** Show price / cost columns for ENTRY rows (material audit) */
  ledgerMode?: boolean
  /** Per-remisión consumption rows (material audit — powers the Consumo sub-filter) */
  consumptionDetails?: RemisionMaterialConsumption[]
  /** Hide MXN columns in consumption detail view (e.g. DOSIFICADOR) */
  hideConsumptionMoney?: boolean
  onConsumptionNavigate?: (remisionDate: string) => void
  /** Optional last column (menus, links) */
  renderRowActions?: (movement: InventoryMovement, index: number) => React.ReactNode
  /** Resets type/search filters when material or date range changes */
  resetFiltersKey?: string
}

type SortField = keyof InventoryMovement
type SortDirection = 'asc' | 'desc'

const LEDGER_FILTER_TYPES = ['ENTRY', 'ADJUSTMENT', 'REMISION'] as const

function fmtKg(n: number) {
  return n.toLocaleString('es-MX', { maximumFractionDigits: 3 })
}

function fmtMx(n: number) {
  return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 })
}

function movementDateYmd(movementDate: string): string {
  const s = movementDate.trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s.slice(0, 10)
}

function formatMovementDate(movementDate: string): string {
  const ymd = movementDateYmd(movementDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return movementDate
  return format(parse(ymd, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy', { locale: es })
}

function remisionMovementsFromConsumption(
  details: RemisionMaterialConsumption[],
  unitFallback: string,
): InventoryMovement[] {
  return details.map((c) => ({
    movement_type: 'REMISION' as const,
    movement_date: c.remision_date,
    material_id: c.material_id,
    material_name: c.material_name,
    quantity: -Math.abs(c.cantidad_real),
    unit: unitFallback,
    reference: c.remision_number,
    notes: 'Consumo por remisión',
  }))
}

export default function InventoryMovementsTable({
  movements,
  singleMaterial = false,
  ledgerMode = false,
  consumptionDetails,
  hideConsumptionMoney = false,
  onConsumptionNavigate,
  renderRowActions,
  resetFiltersKey,
}: InventoryMovementsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<InventoryMovement['movement_type'] | 'ALL'>('ALL')
  const [sortField, setSortField] = useState<SortField>('movement_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    setSearchTerm('')
    setMovementTypeFilter('ALL')
  }, [resetFiltersKey])

  const auditConsumoMode = consumptionDetails != null

  const displayMovements = useMemo(() => {
    if (!auditConsumoMode || !consumptionDetails?.length) return movements
    const hasRemision = movements.some((m) => m.movement_type === 'REMISION')
    if (hasRemision) return movements
    const unit = movements.find((m) => m.unit)?.unit ?? 'kg'
    return [...movements, ...remisionMovementsFromConsumption(consumptionDetails, unit)]
  }, [movements, consumptionDetails, auditConsumoMode])

  const tableColSpan =
    7 +
    (ledgerMode ? 3 : 0) -
    (singleMaterial ? 1 : 0) +
    (renderRowActions ? 1 : 0)

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

  const filteredAndSortedMovements = displayMovements
    .filter(movement => {
      const matchesSearch = movement.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        movement.reference.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = movementTypeFilter === 'ALL' || movement.movement_type === movementTypeFilter
      return matchesSearch && matchesType
    })
    .sort((a, b) => {
      const aValue =
        sortField === 'movement_date' ? movementDateYmd(a.movement_date) : a[sortField]
      const bValue =
        sortField === 'movement_date' ? movementDateYmd(b.movement_date) : b[sortField]
      
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

  const getMovementTypeInfo = (
    type: InventoryMovement['movement_type'],
    options?: { ledgerOpeningMerged?: boolean },
  ) => {
    if (options?.ledgerOpeningMerged && (type === 'ENTRY' || type === 'ADJUSTMENT')) {
      return {
        label: 'Apertura',
        icon: <Landmark className="h-3 w-3" />,
        variant: 'secondary' as const,
        color: 'text-violet-700',
      }
    }
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
          label: 'Consumo',
          icon: <ArrowDown className="h-3 w-3" />,
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

  const movementTypeCounts = displayMovements.reduce((acc, movement) => {
    acc[movement.movement_type] = (acc[movement.movement_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const consumoCount = auditConsumoMode
    ? Math.max(consumptionDetails.length, movementTypeCounts.REMISION || 0)
    : movementTypeCounts.REMISION || 0

  const showConsumoDetail =
    auditConsumoMode &&
    movementTypeFilter === 'REMISION' &&
    (consumptionDetails?.length ?? 0) > 0

  const filteredConsumption = (consumptionDetails ?? []).filter((c) => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return (
      c.remision_number.toLowerCase().includes(q) ||
      (c.material_name ?? '').toLowerCase().includes(q)
    )
  })

  const filterTypeCount = (type: (typeof LEDGER_FILTER_TYPES)[number] | 'WASTE') => {
    if (type === 'REMISION') return consumoCount
    return movementTypeCounts[type] || 0
  }

  const shouldShowTypeFilter = (type: (typeof LEDGER_FILTER_TYPES)[number] | 'WASTE') => {
    if (auditConsumoMode) {
      if (type === 'WASTE') return filterTypeCount('WASTE') > 0
      return true
    }
    return filterTypeCount(type) > 0
  }

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
              Todos ({displayMovements.length})
            </Button>
            {[...LEDGER_FILTER_TYPES, 'WASTE' as const].map((type) => {
              if (!shouldShowTypeFilter(type)) return null
              const count = filterTypeCount(type)
              const { label } = getMovementTypeInfo(type)
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
          {showConsumoDetail
            ? `${filteredConsumption.length} de ${consumptionDetails?.length ?? 0} consumos`
            : `${filteredAndSortedMovements.length} de ${displayMovements.length} movimientos`}
        </div>
      </div>

      {showConsumoDetail ? (
        <div className="border border-stone-200 rounded-lg overflow-hidden bg-white max-h-[420px] overflow-y-auto">
          {filteredConsumption.length === 0 ? (
            <p className="text-sm text-stone-600 px-4 py-8 text-center">
              Sin consumos por remisión en este rango.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Remisión</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Teórica</TableHead>
                    <TableHead className="text-right">Real</TableHead>
                    <TableHead className="text-right">Δ (real−teórica)</TableHead>
                    {!hideConsumptionMoney && (
                      <>
                        <TableHead className="text-right">Costo unit.</TableHead>
                        <TableHead className="text-right">Costo FIFO</TableHead>
                      </>
                    )}
                    {onConsumptionNavigate && <TableHead className="w-[52px]" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConsumption.map((c, i) => (
                    <TableRow key={`${c.remision_number}-${i}`}>
                      <TableCell className="font-mono text-xs">{c.remision_number}</TableCell>
                      <TableCell>{formatMovementDate(c.remision_date)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtKg(c.cantidad_teorica)}</TableCell>
                      <TableCell className="text-right font-mono">{fmtKg(c.cantidad_real)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span
                          className={cn(
                            Math.abs(c.variance) > 0.5 ? 'text-red-700' : 'text-emerald-800',
                          )}
                        >
                          {c.variance >= 0 ? '+' : ''}
                          {fmtKg(c.variance)}
                        </span>
                      </TableCell>
                      {!hideConsumptionMoney && (
                        <>
                          <TableCell className="text-right font-mono">
                            {c.unit_cost_weighted != null ? fmtMx(c.unit_cost_weighted) : '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {c.total_cost_fifo != null ? fmtMx(c.total_cost_fifo) : '—'}
                          </TableCell>
                        </>
                      )}
                      {onConsumptionNavigate && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label="Ver remisiones"
                            onClick={() => onConsumptionNavigate(c.remision_date)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap justify-end gap-4 border-t border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
                <span>
                  Teórica total:{' '}
                  <span className="font-mono">
                    {fmtKg(filteredConsumption.reduce((s, c) => s + c.cantidad_teorica, 0))}
                  </span>
                </span>
                <span>
                  Real total:{' '}
                  <span className="font-mono">
                    {fmtKg(filteredConsumption.reduce((s, c) => s + c.cantidad_real, 0))}
                  </span>
                </span>
                <span>{filteredConsumption.length} remisiones</span>
              </div>
            </>
          )}
        </div>
      ) : (
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
              {!singleMaterial && (
                <TableHead className="w-[200px]">
                  <Button
                    variant="ghost"
                    className="h-auto p-0 font-semibold hover:bg-transparent"
                    onClick={() => handleSort('material_name')}
                  >
                    Material {getSortIcon('material_name')}
                  </Button>
                </TableHead>
              )}
              <TableHead className="text-right">
                <Button
                  variant="ghost"
                  className="h-auto p-0 font-semibold hover:bg-transparent"
                  onClick={() => handleSort('quantity')}
                >
                  Cantidad {getSortIcon('quantity')}
                </Button>
              </TableHead>
              {ledgerMode && (
                <>
                  <TableHead className="text-right text-xs">Precio / kg</TableHead>
                  <TableHead className="text-right text-xs">Costo total</TableHead>
                  <TableHead className="text-right text-xs">Landed / kg</TableHead>
                </>
              )}
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
              {renderRowActions && <TableHead className="w-[52px] text-right"> </TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedMovements.map((movement, index) => {
              const typeInfo = getMovementTypeInfo(movement.movement_type, {
                ledgerOpeningMerged: movement.ledger_opening_merged,
              })
              const quantityClass =
                movement.movement_type === 'ADJUSTMENT'
                  ? movement.quantity >= 0
                    ? 'text-emerald-700'
                    : 'text-red-600'
                  : typeInfo.color
              return (
                <TableRow key={index} className="hover:bg-gray-50">
                  <TableCell className="font-mono text-sm">
                    {formatMovementDate(movement.movement_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={typeInfo.variant} className="text-xs">
                      <span className="flex items-center gap-1">
                        {typeInfo.icon}
                        {typeInfo.label}
                      </span>
                    </Badge>
                  </TableCell>
                  {!singleMaterial && (
                    <TableCell className="font-medium">
                      <div>
                        <div className="font-medium">{movement.material_name}</div>
                        <div className="text-xs text-gray-500">ID: {movement.material_id.slice(-8)}</div>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    quantityClass
                  )}>
                    {movement.quantity > 0 ? "+" : ""}{formatNumber(movement.quantity)}
                  </TableCell>
                  {ledgerMode && (
                    <>
                      <TableCell className="text-right font-mono text-xs text-gray-700">
                        {movement.unit_price_mxn != null
                          ? formatNumber(movement.unit_price_mxn, 4)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-gray-700">
                        {movement.total_cost_mxn != null
                          ? formatNumber(movement.total_cost_mxn, 2)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-gray-700">
                        {movement.landed_unit_price_mxn != null
                          ? formatNumber(movement.landed_unit_price_mxn, 4)
                          : '—'}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-center font-mono text-sm">
                    {movement.unit}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {movement.reference}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {movement.notes || '-'}
                  </TableCell>
                  {renderRowActions && (
                    <TableCell className="text-right align-middle">
                      {renderRowActions(movement, index)}
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            {filteredAndSortedMovements.length === 0 && (
              <TableRow>
                <TableCell colSpan={tableColSpan} className="text-center py-8 text-gray-500">
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
      )}

      {/* Summary Stats */}
      {!showConsumoDetail && filteredAndSortedMovements.length > 0 && (
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
              <div className="font-medium">Total Consumo</div>
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
