'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  TrendingUp,
  Filter,
  X,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { CreditStatus } from '@/lib/supabase/creditTerms';

interface ClientCreditData {
  client_id: string;
  business_name: string;
  client_code: string;
  credit_status: CreditStatus;
  last_payment_date: string | null;
}

interface CreditOverviewTableProps {
  clientsData: ClientCreditData[];
}

type SortField = 'business_name' | 'credit_limit' | 'current_balance' | 'utilization' | 'last_payment';
type SortDirection = 'asc' | 'desc';

export default function CreditOverviewTable({ clientsData }: CreditOverviewTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('business_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [utilizationFilter, setUtilizationFilter] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');
  const [hasTermsFilter, setHasTermsFilter] = useState<string>('yes'); // Default to showing only clients with terms
  const [overdueFilter, setOverdueFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = [...clientsData]; // Create a copy to avoid mutating original

    // Apply search filter - fixed to handle null/undefined values
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (client) =>
          (client.business_name?.toLowerCase().includes(searchLower) ?? false) ||
          (client.client_code?.toLowerCase().includes(searchLower) ?? false)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'over_limit') {
        filtered = filtered.filter((c) => c.credit_status.status === 'over_limit');
      } else if (statusFilter === 'high_utilization') {
        filtered = filtered.filter(
          (c) => c.credit_status.utilization_percentage >= 70 && c.credit_status.status !== 'over_limit'
        );
      } else if (statusFilter === 'no_terms') {
        filtered = filtered.filter((c) => !c.credit_status.has_terms);
      } else if (statusFilter === 'healthy') {
        filtered = filtered.filter((c) => c.credit_status.status === 'healthy');
      } else if (statusFilter === 'warning') {
        filtered = filtered.filter((c) => c.credit_status.status === 'warning');
      } else if (statusFilter === 'critical') {
        filtered = filtered.filter((c) => c.credit_status.status === 'critical');
      }
    }

    // Apply utilization filter
    if (utilizationFilter !== 'all') {
      if (utilizationFilter === '0-50') {
        filtered = filtered.filter((c) => c.credit_status.utilization_percentage >= 0 && c.credit_status.utilization_percentage < 50);
      } else if (utilizationFilter === '50-70') {
        filtered = filtered.filter((c) => c.credit_status.utilization_percentage >= 50 && c.credit_status.utilization_percentage < 70);
      } else if (utilizationFilter === '70-90') {
        filtered = filtered.filter((c) => c.credit_status.utilization_percentage >= 70 && c.credit_status.utilization_percentage < 90);
      } else if (utilizationFilter === '90-100') {
        filtered = filtered.filter((c) => c.credit_status.utilization_percentage >= 90 && c.credit_status.utilization_percentage < 100);
      } else if (utilizationFilter === '100+') {
        filtered = filtered.filter((c) => c.credit_status.utilization_percentage >= 100);
      }
    }

    // Apply balance filter
    if (balanceFilter !== 'all') {
      if (balanceFilter === 'positive') {
        filtered = filtered.filter((c) => c.credit_status.current_balance > 0);
      } else if (balanceFilter === 'negative') {
        filtered = filtered.filter((c) => c.credit_status.current_balance < 0);
      } else if (balanceFilter === 'zero') {
        filtered = filtered.filter((c) => c.credit_status.current_balance === 0);
      } else if (balanceFilter === 'high_balance') {
        filtered = filtered.filter((c) => c.credit_status.current_balance > 100000);
      }
    }

    // Apply has terms filter
    if (hasTermsFilter !== 'all') {
      if (hasTermsFilter === 'yes') {
        filtered = filtered.filter((c) => c.credit_status.has_terms);
      } else if (hasTermsFilter === 'no') {
        filtered = filtered.filter((c) => !c.credit_status.has_terms);
      }
    }

    // Apply overdue filter
    if (overdueFilter !== 'all') {
      if (overdueFilter === 'overdue') {
        filtered = filtered.filter((c) => c.credit_status.is_overdue);
      } else if (overdueFilter === 'not_overdue') {
        filtered = filtered.filter((c) => !c.credit_status.is_overdue);
      }
    }

    // Sort data
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'business_name':
          aValue = a.business_name;
          bValue = b.business_name;
          break;
        case 'credit_limit':
          aValue = a.credit_status.credit_limit;
          bValue = b.credit_status.credit_limit;
          break;
        case 'current_balance':
          aValue = a.credit_status.current_balance;
          bValue = b.credit_status.current_balance;
          break;
        case 'utilization':
          aValue = a.credit_status.utilization_percentage;
          bValue = b.credit_status.utilization_percentage;
          break;
        case 'last_payment':
          aValue = a.last_payment_date || '';
          bValue = b.last_payment_date || '';
          break;
        default:
          aValue = a.business_name;
          bValue = b.business_name;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [clientsData, searchTerm, sortField, sortDirection, statusFilter, utilizationFilter, balanceFilter, hasTermsFilter, overdueFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 ml-1" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    );
  };

  const getStatusBadge = (status: CreditStatus['status']) => {
    const config = {
      healthy: {
        label: 'Saludable',
        variant: 'default' as const,
        icon: CheckCircle,
        className: 'bg-green-100 text-green-700 border-green-300',
      },
      warning: {
        label: 'Advertencia',
        variant: 'secondary' as const,
        icon: AlertCircle,
        className: 'bg-orange-100 text-orange-700 border-orange-300',
      },
      critical: {
        label: 'Crítico',
        variant: 'destructive' as const,
        icon: AlertCircle,
        className: 'bg-red-100 text-red-700 border-red-300',
      },
      over_limit: {
        label: 'Sobre Límite',
        variant: 'destructive' as const,
        icon: XCircle,
        className: 'bg-red-200 text-red-900 border-red-400',
      },
    };

    const { label, className, icon: Icon } = config[status];

    return (
      <Badge className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Resumen de Crédito por Cliente
            </CardTitle>
            <CardDescription>
              Vista general del estado crediticio de {filteredAndSortedData.length} clientes
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Search and Quick Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o código de cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex gap-2">
            <Select value={hasTermsFilter} onValueChange={setHasTermsFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Términos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Con Términos</SelectItem>
                <SelectItem value="no">Sin Términos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="over_limit">Sobre el Límite</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="warning">Advertencia</SelectItem>
                <SelectItem value="healthy">Saludable</SelectItem>
                <SelectItem value="high_utilization">Alta Utilización</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {(utilizationFilter !== 'all' || balanceFilter !== 'all' || hasTermsFilter !== 'yes' || overdueFilter !== 'all') && (
                <Badge variant="secondary" className="ml-1">
                  {[
                    utilizationFilter !== 'all',
                    balanceFilter !== 'all',
                    hasTermsFilter !== 'yes',
                    overdueFilter !== 'all',
                  ].filter(Boolean).length}
                </Badge>
              )}
            </Button>

            {(searchTerm || statusFilter !== 'all' || utilizationFilter !== 'all' || balanceFilter !== 'all' || hasTermsFilter !== 'yes' || overdueFilter !== 'all') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setUtilizationFilter('all');
                  setBalanceFilter('all');
                  setHasTermsFilter('yes'); // Reset to default: show only clients with terms
                  setOverdueFilter('all');
                }}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Limpiar
              </Button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 bg-muted/50 rounded-lg border">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Utilización</Label>
              <Select value={utilizationFilter} onValueChange={setUtilizationFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="0-50">0% - 50%</SelectItem>
                  <SelectItem value="50-70">50% - 70%</SelectItem>
                  <SelectItem value="70-90">70% - 90%</SelectItem>
                  <SelectItem value="90-100">90% - 100%</SelectItem>
                  <SelectItem value="100+">100% o más</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Saldo</Label>
              <Select value={balanceFilter} onValueChange={setBalanceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="positive">Saldo Positivo</SelectItem>
                  <SelectItem value="negative">Saldo Negativo</SelectItem>
                  <SelectItem value="zero">Saldo Cero</SelectItem>
                  <SelectItem value="high_balance">Saldo Alto (&gt;$100K)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Términos de Crédito</Label>
              <Select value={hasTermsFilter} onValueChange={setHasTermsFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Con Términos</SelectItem>
                  <SelectItem value="no">Sin Términos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Estado de Pago</Label>
              <Select value={overdueFilter} onValueChange={setOverdueFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                  <SelectItem value="not_overdue">Al Día</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="mb-4 text-sm text-muted-foreground">
          Mostrando {filteredAndSortedData.length} de {clientsData.length} clientes
          {(searchTerm || statusFilter !== 'all' || utilizationFilter !== 'all' || balanceFilter !== 'all' || hasTermsFilter !== 'all' || overdueFilter !== 'all') && (
            <span className="ml-2">
              (filtros activos)
            </span>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('business_name')}
                    className="flex items-center"
                  >
                    Cliente
                    {getSortIcon('business_name')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('credit_limit')}
                    className="flex items-center"
                  >
                    Límite
                    {getSortIcon('credit_limit')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('current_balance')}
                    className="flex items-center"
                  >
                    Saldo Actual
                    {getSortIcon('current_balance')}
                  </Button>
                </TableHead>
                <TableHead>Disponible</TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('utilization')}
                    className="flex items-center"
                  >
                    Utilización
                    {getSortIcon('utilization')}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('last_payment')}
                    className="flex items-center"
                  >
                    Último Pago
                    {getSortIcon('last_payment')}
                  </Button>
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No se encontraron clientes
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedData.map((client) => (
                  <TableRow key={client.client_id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.business_name}</p>
                        <p className="text-sm text-muted-foreground">{client.client_code}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.credit_status.has_terms ? (
                        <span className="font-semibold">
                          {formatCurrency(client.credit_status.credit_limit)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">No establecido</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-semibold ${
                          client.credit_status.current_balance > client.credit_status.credit_limit
                            ? 'text-red-600'
                            : 'text-foreground'
                        }`}
                      >
                        {formatCurrency(client.credit_status.current_balance)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`${
                          client.credit_status.credit_available > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        } font-semibold`}
                      >
                        {formatCurrency(client.credit_status.credit_available)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {client.credit_status.has_terms ? (
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                client.credit_status.utilization_percentage >= 100
                                  ? 'bg-red-600'
                                  : client.credit_status.utilization_percentage >= 70
                                  ? 'bg-orange-500'
                                  : 'bg-green-600'
                              }`}
                              style={{
                                width: `${Math.min(client.credit_status.utilization_percentage, 100)}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {Math.round(client.credit_status.utilization_percentage)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.last_payment_date ? (
                        <span className="text-sm">{formatDate(client.last_payment_date)}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sin pagos</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {client.credit_status.has_terms ? (
                        getStatusBadge(client.credit_status.status)
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-700">
                          Sin Términos
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/clients/${client.client_id}/credito`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4 mr-1" />
                          Ver
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
