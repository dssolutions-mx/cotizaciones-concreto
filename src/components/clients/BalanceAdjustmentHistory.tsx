'use client';

import { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface BalanceAdjustmentHistoryProps {
  clientId?: string; // Opcional para poder mostrar todos los ajustes o filtrar por cliente
}

interface AdjustmentRecord {
  id: string;
  adjustment_type: 'TRANSFER' | 'SITE_TRANSFER' | 'MANUAL_ADDITION';
  transfer_type: 'DEBT' | 'CREDIT';
  source_client_name: string;
  target_client_name: string | null;
  source_site: string | null;
  target_site: string | null;
  amount: number;
  notes: string;
  created_by_name: string;
  created_at: string;
}

export function BalanceAdjustmentHistory({ clientId }: BalanceAdjustmentHistoryProps) {
  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    adjustmentType: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    const loadAdjustments = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Check if the function exists before calling it
        const { error: testError } = await supabase.rpc('get_client_balance_adjustments', {});
        
        if (testError && testError.message.includes('function does not exist')) {
          console.warn('Function get_client_balance_adjustments does not exist yet');
          setError('El historial de ajustes es una funcionalidad actualmente en implementación. Estará disponible próximamente.');
          setLoading(false);
          return;
        }
        
        // If the function exists, proceed with the query
        const params: Record<string, any> = {};
        
        if (clientId) {
          params.p_client_id = clientId;
        }
        
        if (filters.startDate) {
          params.p_start_date = new Date(filters.startDate).toISOString();
        }
        
        if (filters.endDate) {
          const endDate = new Date(filters.endDate);
          endDate.setHours(23, 59, 59, 999);
          params.p_end_date = endDate.toISOString();
        }
        
        if (filters.adjustmentType !== 'all') {
          params.p_adjustment_type = filters.adjustmentType;
        }
        
        console.log('Calling get_client_balance_adjustments with params:', params);
        
        const { data, error } = await supabase.rpc('get_client_balance_adjustments', params);
        
        if (error) {
          console.error('Error querying adjustments:', error);
          throw new Error(error.message || 'No se pudieron cargar los ajustes de saldo.');
        }
        
        setAdjustments(data || []);
      } catch (err: any) {
        console.error('Error loading balance adjustments:', err);
        setError(err.message || 'Error al cargar los ajustes de balance');
        toast.error('Error al cargar el historial de ajustes');
      } finally {
        setLoading(false);
      }
    };
    
    loadAdjustments();
  }, [clientId, filters, supabase]);

  // Update filters
  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // Render adjustment type in readable format
  const formatAdjustmentType = (type: string) => {
    switch(type) {
      case 'TRANSFER': return 'Transferencia entre Clientes';
      case 'SITE_TRANSFER': return 'Transferencia entre Obras';
      case 'MANUAL_ADDITION': return 'Ajuste Manual';
      default: return type;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Ajustes de Saldo</CardTitle>
        <CardDescription>
          {clientId 
            ? 'Registro de ajustes de saldo para este cliente'
            : 'Registro de todos los ajustes de saldo realizados'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-md bg-gray-50">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="adjustmentType" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Ajuste
            </label>
            <Select
              value={filters.adjustmentType}
              onValueChange={(value) => handleFilterChange('adjustmentType', value)}
            >
              <SelectTrigger id="adjustmentType">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="TRANSFER">Transferencia entre Clientes</SelectItem>
                <SelectItem value="SITE_TRANSFER">Transferencia entre Obras</SelectItem>
                <SelectItem value="MANUAL_ADDITION">Ajuste Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <Input
              type="date"
              id="startDate"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>
          
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <Input
              type="date"
              id="endDate"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>
        
        {/* Adjustments Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-600">
            <h3 className="font-semibold mb-1">Información</h3>
            <p className="text-sm">{error}</p>
          </div>
        ) : adjustments.length > 0 ? (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente Origen</TableHead>
                  <TableHead>Cliente Destino</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(adjustment.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        adjustment.adjustment_type === 'TRANSFER' ? 'bg-blue-100 text-blue-800' :
                        adjustment.adjustment_type === 'SITE_TRANSFER' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {formatAdjustmentType(adjustment.adjustment_type)}
                        {adjustment.transfer_type && (
                          <span className="ml-1">
                            ({adjustment.transfer_type === 'DEBT' ? 'Cargo' : 'Abono'})
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{adjustment.source_client_name}</TableCell>
                    <TableCell>{adjustment.target_client_name || '-'}</TableCell>
                    <TableCell>
                      {adjustment.adjustment_type === 'SITE_TRANSFER' 
                        ? `${adjustment.source_site || 'General'} → ${adjustment.target_site || 'General'}`
                        : adjustment.source_site || '-'}
                    </TableCell>
                    <TableCell className={`font-medium ${
                      adjustment.transfer_type === 'DEBT' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(adjustment.amount)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={adjustment.notes}>
                      {adjustment.notes}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No se encontraron ajustes con los filtros seleccionados.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 