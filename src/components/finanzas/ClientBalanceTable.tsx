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
  InfoIcon,
  DollarSign,
  Eye,
  Edit3
} from 'lucide-react';
import { financialService } from '@/lib/supabase/financial';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { toast } from "sonner";
import BalanceAdjustmentModal from '@/components/clients/BalanceAdjustmentModal';

interface ClientBalance {
  client_id: string;
  business_name: string;
  current_balance: number;
  last_payment_date: string | null;
  credit_status: string;
  score?: number;
  risk?: { level: string; color: string; bg: string };
}

interface ClientBalanceTableProps {
  clientBalances?: ClientBalance[];
  extraClientData?: Record<string, { lastDeliveryDate: string | null }>;
}

type SortField = 'business_name' | 'current_balance' | 'last_payment_date' | 'credit_status';
type SortDirection = 'asc' | 'desc';

// Schema for payment form validation
const paymentFormSchema = z.object({
  amount: z.string().min(1, "El monto es requerido").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    {
      message: "Debe ser un número mayor que cero",
    }
  ),
  payment_date: z.string().min(1, "La fecha es requerida"),
  payment_method: z.string().min(1, "El método de pago es requerido"),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

export function ClientBalanceTable({ clientBalances: initialClientBalances, extraClientData }: ClientBalanceTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('current_balance');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [clientBalances, setClientBalances] = useState<ClientBalance[]>(initialClientBalances || []);
  const [isLoading, setIsLoading] = useState(!initialClientBalances);
  const [error, setError] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientBalance | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isBalanceAdjustmentModalOpen, setIsBalanceAdjustmentModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientSites, setClientSites] = useState<any[]>([]);

  const daysSince = (dateStr: string | null) => {
    if (!dateStr) return null;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  };

  // Payment form setup
  const paymentForm = useForm<z.infer<typeof paymentFormSchema>>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: "",
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: "Transferencia",
      reference: "",
      notes: "",
    },
  });

  // Fetch client balances if not provided
  useEffect(() => {
    if (!initialClientBalances) {
      const fetchClientBalances = async () => {
        setIsLoading(true);
        try {
          const data = await financialService.getClientBalancesForTable();
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

  // Keep internal state in sync if caller provides a new list
  useEffect(() => {
    if (initialClientBalances) {
      setClientBalances(initialClientBalances);
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
          comparison = a.current_balance - b.current_balance;
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

  // Open payment modal for a specific client
  const openPaymentModal = (client: ClientBalance) => {
    setSelectedClient(client);
    setIsPaymentModalOpen(true);
    // Reset form when opening modal
    paymentForm.reset({
      amount: "",
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: "Transferencia",
      reference: "",
      notes: "",
    });
  };

  // Handle setting full balance amount
  const handleSetFullBalance = () => {
    if (selectedClient && selectedClient.current_balance > 0) {
      paymentForm.setValue('amount', selectedClient.current_balance.toString());
    }
  };

  // Open summary modal for a specific client
  const openSummaryModal = (client: ClientBalance) => {
    setSelectedClient(client);
    setIsSummaryModalOpen(true);
  };

  // Handle payment submission
  const onSubmitPayment = async (values: z.infer<typeof paymentFormSchema>) => {
    if (!selectedClient) return;
    
    setIsSubmitting(true);
    try {
      // Convert amount string to number
      const paymentData = {
        client_id: selectedClient.client_id,
        amount: parseFloat(values.amount),
        payment_date: values.payment_date,
        payment_method: values.payment_method,
        reference_number: values.reference || null,
        notes: values.notes || null,
        construction_site: null // Payment applied to general balance
      };
      
      // Call the API service to register payment
      const result = await financialService.registerPayment(paymentData);
      
      if (!result.success) {
        throw new Error(result.message || 'Error al registrar el pago');
      }
      
      // Update the client balance in the UI
      setClientBalances(prevBalances => 
        prevBalances.map(client => 
          client.client_id === selectedClient.client_id 
            ? { 
                ...client, 
                current_balance: client.current_balance - paymentData.amount,
                last_payment_date: values.payment_date
              } 
            : client
        )
      );
      
      toast.success(`Se ha registrado un pago de ${formatCurrency(paymentData.amount)} para ${selectedClient.business_name}`);
      setIsPaymentModalOpen(false);
    } catch (err: any) {
      console.error('Error registering payment:', err);
      toast.error(err.message || "No se pudo registrar el pago. Por favor, intente nuevamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open balance adjustment modal
  const openBalanceAdjustmentModal = async (client: ClientBalance) => {
    setSelectedClient(client);
    
    // Load client sites
    try {
      const clientServiceModule = await import('@/lib/supabase/clients');
      const sites = await clientServiceModule.clientService.getClientSites(client.client_id);
      setClientSites(sites.map(site => ({ id: site.id, name: site.name })));
    } catch (error) {
      console.error('Error loading client sites:', error);
      toast.error('No se pudieron cargar las obras del cliente');
      setClientSites([]);
    }
    
    setIsBalanceAdjustmentModalOpen(true);
  };
  
  // Handle balance adjustment completion
  const handleBalanceAdjustmentComplete = async () => {
    setIsBalanceAdjustmentModalOpen(false);
    
    // Update balance data
    try {
      const updatedBalances = await financialService.getClientBalancesForTable();
      setClientBalances(updatedBalances);
      toast.success('Balances actualizados exitosamente');
    } catch (error) {
      console.error('Error updating balances after adjustment:', error);
      toast.error('No se pudieron actualizar los balances. Recargue la página.');
    }
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
                Última Entrega
              </TableHead>
              <TableHead>
                Días sin Pago
              </TableHead>
              <TableHead>
                Días sin Entrega
              </TableHead>
              <TableHead>
                Score Cliente
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  onClick={() => handleSort('credit_status')}
                  className="font-medium flex items-center"
                >
                  Estado de Balance {renderSortIcon('credit_status')}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <InfoIcon className="ml-1 h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p><strong>Al Corriente:</strong> El cliente no debe dinero o tiene saldo a favor.</p>
                        <p><strong>Saldo Pendiente:</strong> El cliente tiene un balance pendiente por pagar.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Button>
              </TableHead>
              <TableHead className="w-[200px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedData.length > 0 ? (
              filteredAndSortedData.map((client) => (
                <TableRow key={client.client_id}>
                  <TableCell className="font-medium">
                    <Link href={`/clients/${client.client_id}`} className="text-blue-600 hover:underline">
                      {client.business_name}
                    </Link>
                  </TableCell>
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
                    {(() => {
                      const lastDelivery = extraClientData?.[client.client_id]?.lastDeliveryDate || null;
                      return lastDelivery ? formatDate(lastDelivery) : <span className="text-muted-foreground">Sin entregas</span>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const d = daysSince(client.last_payment_date);
                      return d !== null ? `${d} días` : <span className="text-muted-foreground">N/A</span>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const lastDelivery = extraClientData?.[client.client_id]?.lastDeliveryDate || null;
                      const d = daysSince(lastDelivery);
                      return d !== null ? `${d} días` : <span className="text-muted-foreground">N/A</span>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {client.score !== undefined && client.risk ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{client.score}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${client.risk.bg} ${client.risk.color}`}>
                          {client.risk.level}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      client.current_balance <= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {client.current_balance <= 0 
                        ? 'Al Corriente' 
                        : 'Saldo Pendiente'}
                    </span>
                    {client.current_balance < 0 && (
                      <span className="ml-1 text-xs text-blue-600">(Saldo a Favor)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openSummaryModal(client)}
                        className="h-8 px-2 text-blue-600"
                      >
                        <Eye className="h-4 w-4 mr-1" /> Resumen
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openPaymentModal(client)}
                        className="h-8 px-2 text-green-600"
                      >
                        <DollarSign className="h-4 w-4 mr-1" /> Pago
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => openBalanceAdjustmentModal(client)}
                        className="h-8 px-2 text-amber-600"
                      >
                        <Edit3 className="h-4 w-4 mr-1" /> Ajustar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No se encontraron resultados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Client Summary Modal */}
      <Dialog open={isSummaryModalOpen} onOpenChange={setIsSummaryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resumen del Cliente</DialogTitle>
            <DialogDescription>
              Información resumida del cliente y su estado de cuenta
            </DialogDescription>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Cliente</h4>
                  <p className="text-lg font-semibold">{selectedClient.business_name}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Saldo Actual</h4>
                  <p className={`text-lg font-semibold ${selectedClient.current_balance > 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatCurrency(selectedClient.current_balance)}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Último Pago</h4>
                  <p className="text-base">
                    {selectedClient.last_payment_date ? 
                      formatDate(selectedClient.last_payment_date) : 
                      <span className="text-muted-foreground">Sin pagos registrados</span>
                    }
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Estado</h4>
                  <span className={`px-2 py-1 text-xs rounded-full inline-block mt-1 ${
                    selectedClient.current_balance <= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedClient.current_balance <= 0 
                      ? 'Al Corriente' 
                      : 'Saldo Pendiente'}
                  </span>
                  {selectedClient.current_balance < 0 && (
                    <span className="ml-1 text-xs text-blue-600">(Saldo a Favor)</span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="sm:justify-between">
            <Button 
              variant="outline" 
              onClick={() => setIsSummaryModalOpen(false)}
            >
              Cerrar
            </Button>
            <Link 
              href={`/clients/${selectedClient?.client_id}`}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Ver Detalles Completos
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Registration Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedClient && `Registra un pago para ${selectedClient.business_name}`}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onSubmitPayment)} className="space-y-4 py-2">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monto</FormLabel>
                    <FormControl>
                      <Input placeholder="0.00" {...field} />
                    </FormControl>
                    {selectedClient && selectedClient.current_balance > 0 && (
                      <Button 
                        type="button" 
                        variant="link"
                        size="sm"
                        className="p-0 h-auto text-xs text-blue-600 hover:text-blue-800"
                        onClick={handleSetFullBalance}
                      >
                        Pagar Saldo Total: {formatCurrency(selectedClient.current_balance)}
                      </Button>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={paymentForm.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Pago</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={paymentForm.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Método de Pago</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        {...field}
                      >
                        <option value="Transferencia">Transferencia</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={paymentForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referencia (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Número de transferencia, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={paymentForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Observaciones adicionales" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="pt-4">
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Registrando..." : "Registrar Pago"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Balance Adjustment Modal */}
      {selectedClient && (
        <BalanceAdjustmentModal 
          isOpen={isBalanceAdjustmentModalOpen}
          onClose={() => setIsBalanceAdjustmentModalOpen(false)}
          clientId={selectedClient.client_id}
          clientName={selectedClient.business_name}
          clientBalance={selectedClient.current_balance}
          clientSites={clientSites}
          onAdjustmentComplete={handleBalanceAdjustmentComplete}
        />
      )}
      
    </div>
  );
} 