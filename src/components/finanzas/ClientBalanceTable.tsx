'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  Search,
} from 'lucide-react';
import { financialService } from '@/lib/supabase/financial';

interface ClientBalance {
  client_id: string;
  business_name: string;
  current_balance: number;
  last_payment_date: string | null;
  credit_status: string;
}

interface ClientBalanceTableProps {
  clientBalances?: ClientBalance[];
}

type SortField = 'business_name' | 'current_balance' | 'last_payment_date' | 'credit_status';
type SortDirection = 'asc' | 'desc';

export function ClientBalanceTable({ clientBalances: initialClientBalances }: ClientBalanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('current_balance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [clientBalances, setClientBalances] = useState<ClientBalance[]>(initialClientBalances || []);
  const [isLoading, setIsLoading] = useState(!initialClientBalances);
  const [error, setError] = useState<string | null>(null);

  // Fetch client balances if not provided
  useEffect(() => {
    if (!initialClientBalances) {
      const fetchClientBalances = async () => {
        setIsLoading(true);
        try {
          const data = await financialService.getClientBalancesForTableAlternative();
          setClientBalances(data);
        } catch (err) {
          console.error('Error fetching client balances:', err);
          setError('No se pudieron cargar los balances de clientes. Por favor, intente nuevamente.');
        } finally {
          setIsLoading(false);
        }
      };
      
      fetchClientBalances();
    }
  }, [initialClientBalances]);

  // Handle sort column change
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter and sort the data
  const filteredAndSortedData = useMemo(() => {
    return clientBalances
      .filter(client => 
        client.business_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        let comparison = 0;
        
        if (sortField === 'business_name') {
          comparison = a.business_name.localeCompare(b.business_name);
        } 
        else if (sortField === 'current_balance') {
          comparison = a.current_balance - b.current_balance;
        }
        else if (sortField === 'last_payment_date') {
          // Handle null dates by sorting them last
          if (!a.last_payment_date) return 1;
          if (!b.last_payment_date) return -1;
          comparison = new Date(a.last_payment_date).getTime() - new Date(b.last_payment_date).getTime();
        }
        else if (sortField === 'credit_status') {
          comparison = a.credit_status.localeCompare(b.credit_status);
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [clientBalances, searchTerm, sortField, sortDirection]);

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (field !== sortField) {
      return <ArrowUpDown className="ml-1 h-4 w-4" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="ml-1 h-4 w-4" /> : 
      <ArrowDown className="ml-1 h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <p>Cargando balances de clientes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
        <h3 className="font-semibold mb-1">Error</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre de cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('business_name')}
                  className="font-medium flex items-center"
                >
                  Cliente {renderSortIcon('business_name')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('current_balance')}
                  className="font-medium flex items-center"
                >
                  Saldo Actual {renderSortIcon('current_balance')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('last_payment_date')}
                  className="font-medium flex items-center"
                >
                  Último Pago {renderSortIcon('last_payment_date')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('credit_status')}
                  className="font-medium flex items-center"
                >
                  Estado de Crédito {renderSortIcon('credit_status')}
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length > 0 ? (
              filteredAndSortedData.map((client) => (
                <TableRow key={client.client_id}>
                  <TableCell className="font-medium">{client.business_name}</TableCell>
                  <TableCell className={client.current_balance > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                    {formatCurrency(client.current_balance)}
                  </TableCell>
                  <TableCell>
                    {client.last_payment_date ? 
                      formatDate(client.last_payment_date) : 
                      <span className="text-muted-foreground">Sin pagos</span>
                    }
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      client.credit_status === 'approved' ? 'bg-green-100 text-green-800' :
                      client.credit_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {client.credit_status === 'approved' ? 'Aprobado' :
                       client.credit_status === 'pending' ? 'Pendiente' : 
                       'Rechazado'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={`/clients/${client.client_id}`}
                      className="text-blue-600 hover:text-blue-800 underline text-sm"
                    >
                      Ver Detalles
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No se encontraron resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 