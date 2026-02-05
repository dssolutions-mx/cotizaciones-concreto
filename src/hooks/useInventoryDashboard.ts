'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import { usePlantContext } from '@/contexts/PlantContext'
import { 
  InventoryDashboardData, 
  InventoryDashboardFilters,
  MaterialFlowSummary 
} from '@/types/inventory'
import { toast } from 'sonner'
import { format, subDays } from 'date-fns'

// Performance: Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

interface UseInventoryDashboardState {
  data: InventoryDashboardData | null
  loading: boolean
  error: string | null
  filters: InventoryDashboardFilters
}

interface UseInventoryDashboardActions {
  setDateRange: (startDate: string, endDate: string) => void
  setPlantId: (plantId: string) => void
  setMaterialIds: (materialIds: string[]) => void
  setCategory: (category: string | undefined) => void
  refreshData: () => void
  exportData: () => Promise<void>
  resetFilters: () => void
}

interface UseInventoryDashboard extends UseInventoryDashboardState, UseInventoryDashboardActions {
  // Computed values for easier access
  totalMaterials: number
  materialsWithVariance: number
  materialsAtRisk: number
  averageVariancePercentage: number
}

export function useInventoryDashboard(): UseInventoryDashboard {
  const { profile } = useAuthSelectors()
  const { currentPlant, isGlobalAdmin } = usePlantContext()
  
  // Performance: Stable default dates
  const defaultDates = useMemo(() => ({
    endDate: format(new Date(), 'yyyy-MM-dd'),
    startDate: format(subDays(new Date(), 6), 'yyyy-MM-dd')
  }), [])
  
  // Separate UI state from API state to prevent over-fetching
  const [uiFilters, setUiFilters] = useState({
    start_date: defaultDates.startDate,
    end_date: defaultDates.endDate,
    material_ids: [] as string[],
    category: undefined as string | undefined
  })
  
  // Debounce filters to prevent rapid API calls
  const debouncedFilters = useDebounce(uiFilters, 500)
  
  const [state, setState] = useState<UseInventoryDashboardState>({
    data: null,
    loading: true, // Initialize as loading to show loading state immediately
    error: null,
    filters: {
      start_date: defaultDates.startDate,
      end_date: defaultDates.endDate,
      plant_id: currentPlant?.id || undefined,
      material_ids: []
    }
  })

  // Track if we're currently fetching to prevent duplicate requests
  const fetchingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isInitialLoadRef = useRef(true)
  
  // In-memory cache with TTL
  const cacheRef = useRef<Map<string, { data: InventoryDashboardData; timestamp: number }>>(new Map())
  const CACHE_TTL = 30000 // 30 seconds

  const fetchData = useCallback(async (forceRefresh = false) => {
    // Prevent duplicate requests
    if (fetchingRef.current && !forceRefresh) {
      console.log('⏳ Already fetching, skipping duplicate request')
      return
    }

    if (!profile || !currentPlant) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'No se ha seleccionado una planta válida',
        data: null 
      }))
      return
    }

    // Use debounced filters for actual API call (except for initial load)
    const activeFilters = isInitialLoadRef.current ? {
      start_date: uiFilters.start_date,
      end_date: uiFilters.end_date,
      material_ids: uiFilters.material_ids,
      category: uiFilters.category
    } : {
      start_date: debouncedFilters.start_date,
      end_date: debouncedFilters.end_date,
      material_ids: debouncedFilters.material_ids,
      category: debouncedFilters.category
    }

    // Build cache key
    const cacheKey = `${currentPlant.id}-${activeFilters.start_date}-${activeFilters.end_date}-${activeFilters.category || 'all'}-${(activeFilters.material_ids || []).join(',')}`
    
    // Check cache (unless force refresh)
    if (!forceRefresh) {
      const cached = cacheRef.current.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('✅ Using cached dashboard data')
        setState(prev => ({
          ...prev,
          data: cached.data,
          loading: false,
          error: null,
          filters: {
            ...prev.filters,
            ...activeFilters,
            plant_id: currentPlant.id
          }
        }))
        isInitialLoadRef.current = false
        return
      }
    }

    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController()
    fetchingRef.current = true
    
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      // Build query parameters
      const params = new URLSearchParams({
        start_date: activeFilters.start_date,
        end_date: activeFilters.end_date,
      })
      
      params.append('plant_id', currentPlant.id)
      
      if (activeFilters.material_ids && activeFilters.material_ids.length > 0) {
        params.append('material_ids', activeFilters.material_ids.join(','))
      }
      
      if (activeFilters.category && activeFilters.category !== 'all') {
        params.append('category', activeFilters.category)
      }

      console.log('🚀 Fetching optimized dashboard data:', {
        plant: currentPlant.name,
        dateRange: `${activeFilters.start_date} to ${activeFilters.end_date}`,
        materialCount: activeFilters.material_ids.length || 'all',
        isInitialLoad: isInitialLoadRef.current
      })

      const response = await fetch(`/api/inventory/dashboard?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (e) {
          // If response is not JSON, use status text
          throw new Error(`Error ${response.status}: ${response.statusText || 'Error de conexión con el servidor'}`)
        }
        throw new Error(errorData.error || `Error al cargar dashboard de inventario (${response.status})`)
      }

      let result
      try {
        result = await response.json()
      } catch (e) {
        throw new Error('Error al procesar la respuesta del servidor. La respuesta no es válida JSON.')
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Error en la respuesta del servidor')
      }

      console.log('✅ Dashboard data loaded successfully:', {
        materials: result.data.summary.total_materials_tracked,
        remisiones: result.data.summary.total_remisiones,
        movements: result.data.movements.length
      })

      // Store in cache
      cacheRef.current.set(cacheKey, {
        data: result.data,
        timestamp: Date.now()
      })

      // Clean up old cache entries (keep only last 10)
      if (cacheRef.current.size > 10) {
        const entries = Array.from(cacheRef.current.entries())
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
        cacheRef.current.clear()
        entries.slice(0, 10).forEach(([key, value]) => {
          cacheRef.current.set(key, value)
        })
      }

      setState(prev => ({
        ...prev,
        data: result.data,
        loading: false,
        error: null,
        filters: {
          ...prev.filters,
          ...activeFilters,
          plant_id: currentPlant.id
        }
      }))
      
      isInitialLoadRef.current = false

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('🔄 Request aborted, newer request in progress')
        return
      }

      console.error('❌ Dashboard fetch error:', error)
      
      // Handle network errors specifically
      let errorMessage = 'Error desconocido'
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        errorMessage = 'Error de conexión. Verifica tu conexión a internet o intenta nuevamente.'
      } else if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))

      // Only show toast for non-abort errors
      if (error.name !== 'AbortError') {
        toast.error(`Error al cargar dashboard: ${errorMessage}`)
      }
    } finally {
      fetchingRef.current = false
    }
  }, [profile, currentPlant, debouncedFilters, uiFilters])

  // PERFORMANCE: Fetch immediately on mount if plant is ready (initial load)
  // Then use debounced filters for subsequent changes
  useEffect(() => {
    if (!profile || !currentPlant) {
      // If no plant, set loading to false after a brief delay
      if (!currentPlant && profile) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: 'No se ha seleccionado una planta válida',
          data: null 
        }))
      }
      return
    }

    // For initial load, fetch immediately without debounce
    if (isInitialLoadRef.current) {
      console.log('🔄 Initial load - fetching immediately:', {
        plant: currentPlant.name,
        filters: uiFilters
      })
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, currentPlant?.id])

  // PERFORMANCE: Use debounced filters for subsequent filter changes
  useEffect(() => {
    if (!profile || !currentPlant || isInitialLoadRef.current) return

    console.log('🔄 Filter change - fetching with debounced filters:', {
      plant: currentPlant.name,
      filters: debouncedFilters
    })

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedFilters])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  // PERFORMANCE: Update UI state immediately, API calls are debounced
  const setDateRange = useCallback((startDate: string, endDate: string) => {
    // Validate date range
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    if (start > end) {
      toast.error('La fecha de inicio no puede ser posterior a la fecha de fin')
      return
    }

    const daysDifference = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (daysDifference > 90) {
      toast.error('El rango de fechas no puede exceder 90 días')
      return
    }

    console.log('📅 Date range updated (UI only):', { startDate, endDate })
    
    // Update UI state immediately for responsive UI
    setUiFilters(prev => ({
      ...prev,
      start_date: startDate,
      end_date: endDate
    }))
  }, [])

  const setPlantId = useCallback((plantId: string) => {
    // Plant changes are handled by context, this method is mainly for consistency
    console.log('🏭 Plant ID change requested (handled by context):', plantId)
  }, [])

  const setMaterialIds = useCallback((materialIds: string[]) => {
    console.log('🔧 Material filter updated (UI only):', materialIds)
    
    // Update UI state immediately
    setUiFilters(prev => ({
      ...prev,
      material_ids: materialIds
    }))
  }, [])

  const setCategory = useCallback((category: string | undefined) => {
    console.log('🔧 Category filter updated (UI only):', category)
    
    // Update UI state immediately
    setUiFilters(prev => ({
      ...prev,
      category: category
    }))
  }, [])

  const refreshData = useCallback(() => {
    console.log('🔄 Manual refresh triggered')
    fetchData(true) // Force refresh
  }, [fetchData])

  const exportData = useCallback(async () => {
    if (!state.data) {
      toast.error('No hay datos para exportar')
      return
    }

    try {
      // Create CSV content
      const csvContent = generateCSVContent(state.data)
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `inventario-dashboard-${state.filters.start_date}-${state.filters.end_date}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        toast.success('Archivo exportado correctamente')
      }
    } catch (error) {
      console.error('Error exporting data:', error)
      toast.error('Error al exportar datos')
    }
  }, [state.data, state.filters])

  const resetFilters = useCallback(() => {
    console.log('🔄 Resetting filters to default')
    
    setUiFilters({
      start_date: defaultDates.startDate,
      end_date: defaultDates.endDate,
      material_ids: [],
      category: undefined
    })
  }, [defaultDates])

  // PERFORMANCE: Memoized computed values to prevent unnecessary recalculations
  const computedValues = useMemo(() => {
    if (!state.data) {
      return {
        totalMaterials: 0,
        materialsWithVariance: 0,
        materialsAtRisk: 0,
        averageVariancePercentage: 0
      }
    }

    const flows = state.data.summary.material_flows
    const materialsAtRisk = flows.filter(m => Math.abs(m.variance_percentage) > 5).length
    const averageVariancePercentage = flows.length > 0
      ? flows.reduce((sum, m) => sum + Math.abs(m.variance_percentage), 0) / flows.length
      : 0

    return {
      totalMaterials: state.data.summary.total_materials_tracked,
      materialsWithVariance: state.data.summary.materials_with_variance,
      materialsAtRisk,
      averageVariancePercentage
    }
  }, [state.data])

  // PERFORMANCE: Memoized current UI filters for display
  const currentFilters = useMemo(() => ({
    ...uiFilters,
    plant_id: currentPlant?.id || undefined
  }), [uiFilters, currentPlant?.id])

  return {
    // Core state
    data: state.data,
    loading: state.loading,
    error: state.error,
    filters: currentFilters, // Use memoized current UI filters
    
    // Actions
    setDateRange,
    setPlantId,
    setMaterialIds,
    setCategory,
    refreshData,
    exportData,
    resetFilters,
    
    // Computed values (memoized for performance)
    ...computedValues
  }
}

/**
 * Generate CSV content from dashboard data
 */
function generateCSVContent(data: InventoryDashboardData): string {
  const headers = [
    'Material',
    'Unidad',
    'Stock Inicial',
    'Entradas',
    'Adiciones Manuales',
    'Consumo Remisiones',
    'Salidas Manuales',
    'Desperdicios',
    'Stock Teórico Final',
    'Stock Real Actual',
    'Varianza',
    'Varianza %'
  ]

  const rows = data.summary.material_flows.map(flow => [
    flow.material_name,
    flow.unit,
    flow.initial_stock.toFixed(2),
    flow.total_entries.toFixed(2),
    flow.total_manual_additions.toFixed(2),
    flow.total_remisiones_consumption.toFixed(2),
    flow.total_manual_withdrawals.toFixed(2),
    flow.total_waste.toFixed(2),
    flow.theoretical_final_stock.toFixed(2),
    flow.actual_current_stock.toFixed(2),
    flow.variance.toFixed(2),
    flow.variance_percentage.toFixed(2) + '%'
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')

  return csvContent
}
