'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

export const runtime = 'nodejs';
import { PriceHistoryTable } from '@/components/PriceHistoryTable';
import { PriceHistoryChart } from '@/components/PriceHistoryChart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartBarIcon, TableIcon } from 'lucide-react';
import { fetchPriceHistoryByClient, fetchPriceHistoryByRecipe } from '@/services/priceHistoryService';
import type { PriceHistoryFilters, ClientPriceHistory, RecipePriceHistory, ViewMode } from '@/types/priceHistory';
import type { DateRange } from 'react-day-picker';
import { PostgrestError } from '@supabase/supabase-js';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { QualityTeamAccessDenied } from '@/components/QualityTeamAccessDenied';

export default function PriceHistoryPage() {
  const { profile } = useAuthBridge();
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [groupBy, setGroupBy] = useState<'client' | 'recipe'>('client');
  const [filters, setFilters] = useState<PriceHistoryFilters>({});
  const [data, setData] = useState<ClientPriceHistory[] | RecipePriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | undefined>(undefined);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading price history data with filters:', filters);
      const fetchFn = groupBy === 'client' ? fetchPriceHistoryByClient : fetchPriceHistoryByRecipe;
      const result = await fetchFn(filters);
      console.log('Price history data loaded:', result);
      setData(result);
    } catch (error: unknown) {
      let errorMessage = 'Error desconocido al cargar el historial de precios';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error instanceof PostgrestError) {
        errorMessage = `Error de base de datos: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      setError(errorMessage);
      console.error('Error al cargar el historial de precios:', error as unknown);
    } finally {
      setLoading(false);
    }
  }, [filters, groupBy]);

  useEffect(() => {
    if (profile?.role === 'QUALITY_TEAM') {
      return;
    }

    // Clear any existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set a new timer to load data after a delay
    debounceTimer.current = setTimeout(() => {
      loadData();
    }, 300); // 300ms debounce

    // Cleanup function to clear the timer if the component unmounts
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [filters, groupBy, profile?.role, loadData]);

  // Render access denied if user is from quality team
  if (profile?.role === 'QUALITY_TEAM') {
    return <QualityTeamAccessDenied />;
  }

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setFilters(prev => ({
      ...prev,
      startDate: range?.from,
      endDate: range?.to,
    }));
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({
      ...prev,
      searchTerm: event.target.value,
    }));
  };

  const handleViewModeChange = (value: string) => {
    if (value === 'table' || value === 'chart') {
      setViewMode(value);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Historial de Precios</h1>
        <div className="flex items-center gap-4">
          <Select
            value={groupBy}
            onValueChange={(value: 'client' | 'recipe') => setGroupBy(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agrupar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Por Cliente</SelectItem>
              <SelectItem value="recipe">Por Receta</SelectItem>
            </SelectContent>
          </Select>
          <Tabs value={viewMode} onValueChange={handleViewModeChange}>
            <TabsList>
              <TabsTrigger value="table">
                <TableIcon className="h-4 w-4 mr-2" />
                Tabla
              </TabsTrigger>
              <TabsTrigger value="chart">
                <ChartBarIcon className="h-4 w-4 mr-2" />
                Gráfico
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar..."
            value={filters.searchTerm || ''}
            onChange={handleSearch}
          />
        </div>
        <DatePickerWithRange
          value={{
            from: filters.startDate,
            to: filters.endDate,
          }}
          onChange={handleDateRangeChange}
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {data.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No se encontraron datos de historial de precios con los filtros actuales.
            </div>
          ) : viewMode === 'table' ? (
            <PriceHistoryTable data={data} groupBy={groupBy} />
          ) : (
            <PriceHistoryChart data={data} groupBy={groupBy} />
          )}
        </>
      )}
    </div>
  );
} 