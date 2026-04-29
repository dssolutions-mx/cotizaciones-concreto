'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  Edit3,
  User,
  Phone,
} from 'lucide-react';
import { financialService, type PaymentData } from '@/lib/supabase/financial';
import { ClientPaymentManagerModal } from '@/components/finanzas/ClientPaymentManagerModal';
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
import { Checkbox } from "@/components/ui/checkbox";
import BalanceAdjustmentModal from '@/components/clients/BalanceAdjustmentModal';
import { toast } from "sonner";
import type { ConstructionSite } from '@/types/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  paymentNeedsExplicitConstructionSite,
  computeFifoAllocation,
  type SiteDebtFifo,
} from '@/lib/finanzas/paymentConstructionSite';
import { fetchFifoSiteDebts } from '@/lib/finanzas/fifoSiteDebts';
import { supabase } from '@/lib/supabase/client';

const isCashPayment = (method: string) => method === 'CASH' || method === 'Efectivo';

/** Match client_payments row to selected obra / general (aligned with API storage). */
function paymentMatchesConstructionSelection(
  paymentSite: string | null | undefined,
  selected: string
): boolean {
  const sel = selected.trim();
  if (sel === 'general') {
    const n = (paymentSite ?? '').trim().toLowerCase();
    return n === '' || n === 'general';
  }
  return (paymentSite ?? '').trim() === sel;
}

interface ClientBalance {
  client_id: string;
  business_name: string;
  current_balance: number;
  last_payment_date: string | null;
  credit_status: string;
  phone?: string | null;
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
  verification_call_confirmed: z.boolean().optional(),
  construction_site: z.string().optional(),
}).refine(
  (data) => {
    if (isCashPayment(data.payment_method)) {
      return data.verification_call_confirmed === true;
    }
    return true;
  },
  { message: "Debe confirmar el cumplimiento del procedimiento de verificación para pagos en efectivo", path: ["verification_call_confirmed"] }
);

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
  const [paymentModalSites, setPaymentModalSites] = useState<ConstructionSite[]>([]);
  const [paymentSitesLoading, setPaymentSitesLoading] = useState(false);
  const [paymentBalanceGeneral, setPaymentBalanceGeneral] = useState<number | null>(null);
  const [paymentBalanceBySiteName, setPaymentBalanceBySiteName] = useState<Record<string, number>>({});
  const [paymentRecentHistory, setPaymentRecentHistory] = useState<
    {
      id: string;
      amount: number;
      payment_date: string | null;
      payment_method: string;
      construction_site: string | null;
      reference_number?: string | null;
    }[]
  >([]);
  const [paymentFifoDebts, setPaymentFifoDebts] = useState<SiteDebtFifo[]>([]);

  const namedPaymentSites = useMemo(
    () => paymentModalSites.filter((s) => s?.name?.trim()),
    [paymentModalSites]
  );
  const paymentNeedsExplicitObra = paymentNeedsExplicitConstructionSite(paymentModalSites);

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
      verification_call_confirmed: false,
      construction_site: 'general',
    },
  });

  const watchedConstructionSite = paymentForm.watch('construction_site');
  const watchedAmountStr = paymentForm.watch('amount');

  const paymentContextForSelection = useMemo(() => {
    const raw = watchedConstructionSite?.trim() ?? '';
    if (!raw) {
      return {
        showPanel: false as const,
        balance: null as number | null,
        activity: [] as typeof paymentRecentHistory,
      };
    }

    let balance: number | null;
    if (raw === 'general') {
      balance = paymentBalanceGeneral;
    } else {
      balance =
        paymentBalanceBySiteName[raw] !== undefined
          ? paymentBalanceBySiteName[raw]
          : 0;
    }

    const activity = paymentRecentHistory
      .filter((p) => paymentMatchesConstructionSelection(p.construction_site, raw))
      .slice(0, 6);

    return { showPanel: true as const, balance, activity };
  }, [
    watchedConstructionSite,
    paymentNeedsExplicitObra,
    paymentBalanceGeneral,
    paymentBalanceBySiteName,
    paymentRecentHistory,
  ]);

  const fifoPreview = useMemo(() => {
    if (!paymentNeedsExplicitObra || namedPaymentSites.length <= 1) return null;
    if ((watchedConstructionSite?.trim() ?? '') !== 'general') return null;
    const amt = parseFloat(watchedAmountStr || '');
    if (!(amt > 0)) return null;
    if (paymentFifoDebts.length === 0) {
      return { distributions: [] as { construction_site: string; amount: number }[], surplusToGeneral: amt };
    }
    return computeFifoAllocation(paymentFifoDebts, amt);
  }, [
    paymentNeedsExplicitObra,
    namedPaymentSites.length,
    watchedConstructionSite,
    watchedAmountStr,
    paymentFifoDebts,
  ]);

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

  const resetPaymentFormDefaults = useCallback(() => {
    paymentForm.reset({
      amount: "",
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: "Transferencia",
      reference: "",
      notes: "",
      verification_call_confirmed: false,
      construction_site: 'general',
    });
  }, [paymentForm]);

  // Open payment modal for a specific client (loads obras — same rules as PaymentForm / POST API)
  const openPaymentModal = async (client: ClientBalance) => {
    setSelectedClient(client);
    setPaymentModalSites([]);
    setPaymentBalanceGeneral(null);
    setPaymentBalanceBySiteName({});
    setPaymentRecentHistory([]);
    setPaymentFifoDebts([]);
    setIsPaymentModalOpen(true);
    resetPaymentFormDefaults();
    setPaymentSitesLoading(true);
    try {
      const { clientService } = await import('@/lib/supabase/clients');
      const sites = await clientService.getClientSites(client.client_id);
      setPaymentModalSites(sites);
      const named = sites.filter((s) => s?.name?.trim());

      try {
        const [{ generalBalance, siteBalances }, recentPayments] = await Promise.all([
          financialService.getAllClientBalances(client.client_id),
          financialService.getClientPaymentHistory(client.client_id, 40),
        ]);

        setPaymentBalanceGeneral(
          generalBalance?.current_balance !== undefined && generalBalance?.current_balance !== null
            ? Number(generalBalance.current_balance)
            : null
        );
        const byName: Record<string, number> = {};
        for (const row of siteBalances ?? []) {
          const name = row.construction_site?.trim();
          if (name) byName[name] = Number(row.current_balance ?? 0);
        }
        setPaymentBalanceBySiteName(byName);
        setPaymentRecentHistory(
          (recentPayments ?? []).map((p) => ({
            id: p.id,
            amount: p.amount,
            payment_date: p.payment_date,
            payment_method: p.payment_method,
            construction_site: p.construction_site ?? null,
            reference_number: p.reference_number,
          }))
        );
      } catch (snapshotErr) {
        console.error('Error loading balance snapshot for payment modal:', snapshotErr);
      }

      try {
        const fifoDebts = await fetchFifoSiteDebts(supabase, client.client_id);
        setPaymentFifoDebts(fifoDebts);
      } catch (fifoErr) {
        console.error('Error loading FIFO site debts:', fifoErr);
        setPaymentFifoDebts([]);
      }

      if (named.length === 1) {
        paymentForm.setValue('construction_site', named[0].name);
      } else if (named.length > 1) {
        paymentForm.setValue('construction_site', 'general');
      } else {
        paymentForm.setValue('construction_site', 'general');
      }
    } catch (error) {
      console.error('Error loading client sites for payment:', error);
      toast.error('No se pudieron cargar las obras del cliente');
      setPaymentModalSites([]);
    } finally {
      setPaymentSitesLoading(false);
    }
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
      const sel = values.construction_site?.trim() ?? '';
      const constructionSite = !sel || sel === 'general' ? 'general' : sel;

      const amountNum = parseFloat(values.amount);

      const paymentData: PaymentData = {
        client_id: selectedClient.client_id,
        amount: amountNum,
        payment_date: values.payment_date,
        payment_method: values.payment_method,
        reference_number: values.reference || null,
        notes: values.notes || null,
        construction_site: constructionSite === 'general' ? 'general' : constructionSite,
      };
      if (isCashPayment(values.payment_method)) {
        paymentData.verification_call_confirmed = true;
      }
      
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
                current_balance: client.current_balance - amountNum,
                last_payment_date: values.payment_date
              } 
            : client
        )
      );
      
      toast.success(`Se ha registrado un pago de ${formatCurrency(amountNum)} para ${selectedClient.business_name}`);
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
  
  const refreshBalances = async (successMessage: string = 'Balances actualizados exitosamente') => {
    try {
      const updatedBalances = await financialService.getClientBalancesForTable();
      setClientBalances(updatedBalances);
      toast.success(successMessage);
    } catch (error) {
      console.error('Error refreshing balances:', error);
      toast.error('No se pudieron actualizar los balances. Recargue la página.');
    }
  };

  // Handle balance adjustment completion
  const handleBalanceAdjustmentComplete = async () => {
    setIsBalanceAdjustmentModalOpen(false);
    await refreshBalances();
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
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openSummaryModal(client)}
                        className="h-8 px-2"
                      >
                        <Eye className="h-4 w-4 mr-1" /> Resumen
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openPaymentModal(client)}
                        className="h-8 px-2"
                      >
                        <DollarSign className="h-4 w-4 mr-1" /> Pago
                      </Button>
                      <ClientPaymentManagerModal
                        clientId={client.client_id}
                        clientName={client.business_name}
                        triggerLabel="Pagos"
                        onMutated={() => refreshBalances('Balances actualizados')}
                      />
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={() => openBalanceAdjustmentModal(client)}
                        className="h-8 px-2"
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
              variant="secondary" 
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
      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={(open) => {
          setIsPaymentModalOpen(open);
          if (!open) {
            setPaymentModalSites([]);
            setPaymentSitesLoading(false);
            setPaymentBalanceGeneral(null);
            setPaymentBalanceBySiteName({});
            setPaymentRecentHistory([]);
            setPaymentFifoDebts([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              {selectedClient && `Registra un pago para ${selectedClient.business_name}`}
            </DialogDescription>
          </DialogHeader>

          {selectedClient && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{selectedClient.business_name}</span>
              </div>
              {selectedClient.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${selectedClient.phone}`} className="text-primary hover:underline">
                    {selectedClient.phone}
                  </a>
                  {paymentForm.watch("payment_method") === "Efectivo" && (
                    <span className="text-xs text-amber-600">(número para llamada de verificación)</span>
                  )}
                </div>
              )}
            </div>
          )}
          
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
                        variant="ghost"
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
                        disabled={isSubmitting || paymentSitesLoading}
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

              {paymentSitesLoading ? (
                <p className="text-sm text-muted-foreground">Cargando obras del cliente…</p>
              ) : (
                <FormField
                  control={paymentForm.control}
                  name="construction_site"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Obra</FormLabel>
                      <Select
                        value={field.value?.trim() ? field.value : 'general'}
                        onValueChange={(v) => {
                          field.onChange(v);
                        }}
                        onOpenChange={(open) => {
                          if (!open) field.onBlur();
                        }}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger ref={field.ref}>
                            <SelectValue placeholder="Pago general u obra específica" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {paymentNeedsExplicitObra ? (
                            <>
                              <SelectItem value="general">
                                — Pago general (FIFO automático) —
                              </SelectItem>
                              {namedPaymentSites.map((site) => (
                                <SelectItem key={site.id} value={site.name}>
                                  {site.name}
                                </SelectItem>
                              ))}
                            </>
                          ) : namedPaymentSites.length === 1 ? (
                            namedPaymentSites.map((site) => (
                              <SelectItem key={site.id} value={site.name}>
                                {site.name}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="general">— Pago general —</SelectItem>
                              {namedPaymentSites.map((site) => (
                                <SelectItem key={site.id} value={site.name}>
                                  {site.name}
                                </SelectItem>
                              ))}
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {paymentNeedsExplicitObra && (
                        <p className="text-xs text-muted-foreground">
                          Varias obras: use &quot;Pago general&quot; para distribuir el monto en orden FIFO (obra con pedido más antiguo primero), o elija una obra para aplicar todo el monto ahí.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {!paymentSitesLoading && paymentContextForSelection.showPanel && (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Saldo en esta selección</span>
                    <span
                      className={`text-base font-semibold tabular-nums ${
                        paymentContextForSelection.balance !== null &&
                        paymentContextForSelection.balance > 0
                          ? 'text-red-600'
                          : paymentContextForSelection.balance !== null &&
                              paymentContextForSelection.balance < 0
                            ? 'text-green-600'
                            : 'text-foreground'
                      }`}
                    >
                      {paymentContextForSelection.balance === null &&
                      watchedConstructionSite?.trim() === 'general'
                        ? '—'
                        : formatCurrency(paymentContextForSelection.balance ?? 0)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Actividad reciente (pagos en esta obra)
                    </p>
                    {paymentContextForSelection.activity.length === 0 ? (
                      <p className="text-xs text-muted-foreground leading-snug">
                        No hay pagos recientes atribuidos a esta obra en los últimos movimientos del cliente.
                      </p>
                    ) : (
                      <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {paymentContextForSelection.activity.map((p) => (
                          <li
                            key={p.id}
                            className="flex justify-between gap-3 text-xs border-b border-border/60 pb-2 last:border-0 last:pb-0"
                          >
                            <div className="min-w-0 space-y-0.5">
                              <div className="text-muted-foreground">
                                {p.payment_date
                                  ? formatDate(p.payment_date)
                                  : 'Sin fecha'}{' '}
                                · {p.payment_method}
                              </div>
                              {p.reference_number ? (
                                <div className="truncate text-[11px] text-muted-foreground">
                                  Ref. {p.reference_number}
                                </div>
                              ) : null}
                            </div>
                            <span className="font-medium tabular-nums shrink-0">
                              {formatCurrency(p.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {!paymentSitesLoading && fifoPreview && (
                <div className="rounded-md border border-dashed border-primary/35 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Distribución FIFO prevista (obra con pedido más antiguo primero)
                  </p>
                  {fifoPreview.distributions.length > 0 ? (
                    <ul className="space-y-1.5 text-xs">
                      {fifoPreview.distributions.map((d, i) => (
                        <li key={`${d.construction_site}-${i}`} className="flex justify-between gap-2">
                          <span className="text-muted-foreground truncate">{d.construction_site}</span>
                          <span className="font-medium tabular-nums shrink-0">{formatCurrency(d.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {fifoPreview.surplusToGeneral > 0 ? (
                    <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                      Saldo a favor (crédito general):{' '}
                      <span className="font-semibold text-green-700 tabular-nums">
                        {formatCurrency(fifoPreview.surplusToGeneral)}
                      </span>
                    </p>
                  ) : null}
                </div>
              )}
              
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

              {paymentForm.watch("payment_method") === "Efectivo" && (
                <FormField
                  control={paymentForm.control}
                  name="verification_call_confirmed"
                  render={({ field }) => (
                    <FormItem>
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3">
                        <p className="text-sm font-semibold text-amber-800">Política de Cobranza en Efectivo (obligatorio)</p>
                        <p className="text-sm text-amber-800">
                          He realizado la llamada de verificación al número validado del cliente y he confirmado: monto, concepto, agente y producto.
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                          />
                          <span className="text-sm font-medium text-amber-900">
                            Confirmo cumplimiento del procedimiento de verificación (Política 3.4)
                          </span>
                        </label>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter className="pt-4">
                <Button 
                  variant="secondary" 
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || paymentSitesLoading}
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