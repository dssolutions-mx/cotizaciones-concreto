'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { clientService } from '@/lib/supabase/clients';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import PaymentForm from '@/components/clients/PaymentForm';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { subMonths } from 'date-fns';
// Import types from the new file
import { Client, ConstructionSite, ClientPayment, ClientBalance } from '@/types/client';
import { formatCurrency, formatDate } from '@/lib/utils'; // Assuming these now exist or will be created
import { toast } from "sonner";

// Custom Switch component since @/components/ui/switch doesn't exist
const Switch = ({ checked, onCheckedChange, disabled }: { 
  checked: boolean; 
  onCheckedChange: (checked: boolean) => void; 
  disabled?: boolean 
}) => {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors 
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 
                 ${checked ? 'bg-green-500' : 'bg-gray-200'} 
                 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out
                   ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
};

// Componente para nuevos sitios
function NewSiteForm({ clientId, onSiteAdded }: { clientId: string, onSiteAdded: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [siteData, setSiteData] = useState({
    name: '',
    location: '',
    access_restrictions: '',
    special_conditions: '',
    is_active: true
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSiteData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    if (!siteData.name.trim()) {
      alert('El nombre de la obra es obligatorio');
      return;
    }

    setIsSubmitting(true);
    try {
      await clientService.createSite(clientId, siteData);
      setSiteData({
        name: '',
        location: '',
        access_restrictions: '',
        special_conditions: '',
        is_active: true
      });
      setShowForm(false);
      onSiteAdded();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear la obra';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!showForm) {
    return (
      <div className="mt-6">
        <RoleProtectedButton
          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE']}
          onClick={() => setShowForm(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Agregar Nueva Obra
        </RoleProtectedButton>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-gray-50 p-4 rounded-md">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium">Nueva Obra</h3>
        <button 
          onClick={() => setShowForm(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="mb-3">
          <label htmlFor="site_name" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre de la Obra *
          </label>
          <input
            type="text"
            id="site_name"
            name="name"
            value={siteData.name}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="site_location" className="block text-sm font-medium text-gray-700 mb-1">
            Ubicación
          </label>
          <input
            type="text"
            id="site_location"
            name="location"
            value={siteData.location}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="site_access_restrictions" className="block text-sm font-medium text-gray-700 mb-1">
            Restricciones de Acceso
          </label>
          <textarea
            id="site_access_restrictions"
            name="access_restrictions"
            value={siteData.access_restrictions}
            onChange={handleChange}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>
        
        <div className="mb-3">
          <label htmlFor="site_special_conditions" className="block text-sm font-medium text-gray-700 mb-1">
            Condiciones Especiales
          </label>
          <textarea
            id="site_special_conditions"
            name="special_conditions"
            value={siteData.special_conditions}
            onChange={handleChange}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md"
          />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Estado de la Obra
          </label>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={siteData.is_active}
              onChange={(e) => {
                setSiteData(prev => ({
                  ...prev,
                  is_active: e.target.checked
                }));
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              Obra Activa
            </label>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end mt-4">
        <button
          type="button"
          onClick={handleSubmit}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Guardando...' : 'Guardar Obra'}
        </button>
      </div>
    </div>
  );
}

// Componente para mostrar balance del cliente (Refactored with Shadcn Card)
function ClientBalanceSummary({ balances }: { balances: ClientBalance[] }) {
  const generalBalance = balances.find(balance => balance.construction_site === null);
  const siteBalances = balances.filter(balance => balance.construction_site !== null);

  // Format balance helper
  const formatBal = (amount: number | undefined) => {
    return amount !== undefined ? formatCurrency(amount) : formatCurrency(0);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Balance del Cliente</CardTitle>
        {generalBalance?.last_updated && (
          <CardDescription>
            Última actualización: {formatDate(generalBalance.last_updated, 'PPP p')}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* General Balance */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-medium">Balance Total</span>
            <span className={`text-lg font-bold ${generalBalance && generalBalance.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatBal(generalBalance?.current_balance)}
            </span>
          </div>
        </div>

        {/* Balances por obra */}
        {siteBalances.length > 0 && (
          <div>
            <h3 className="text-md font-semibold mb-2 text-gray-800">Desglose por Obra</h3>
            <div className="space-y-2">
              {siteBalances.map((balance, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                  <span className="text-sm text-gray-700 truncate pr-2" title={balance.construction_site || 'Desconocido'}>
                    {balance.construction_site || 'Obra Desconocida'}
                  </span>
                  <span className={`text-sm font-medium ${balance.current_balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(balance.current_balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {balances.length === 0 && (
           <p className="text-sm text-center text-gray-500 py-4">No hay información de balance disponible.</p>
        )}
      </CardContent>
    </Card>
  );
}

// Componente para mostrar historial de pagos (Enhanced with Filters, Pagination, Shadcn Table)
function ClientPaymentsList({ payments: allPayments }: { payments: ClientPayment[] }) {
  const [filters, setFilters] = useState<{
    startDate: Date | undefined;
    endDate: Date | undefined;
    paymentMethod: string;
  }>({
    startDate: subMonths(new Date(), 1), // Default to last month
    endDate: new Date(),
    paymentMethod: 'all', // 'all' or specific method like 'TRANSFER', 'CASH', etc.
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Or make this configurable

  const handleFilterChange = (key: keyof typeof filters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const filteredPayments = useMemo(() => {
    return allPayments.filter(payment => {
      const paymentDate = new Date(payment.payment_date);
      const startMatch = !filters.startDate || paymentDate >= filters.startDate;
      const endMatch = !filters.endDate || paymentDate <= filters.endDate;
      const methodMatch = filters.paymentMethod === 'all' || payment.payment_method === filters.paymentMethod;
      return startMatch && endMatch && methodMatch;
    });
  }, [allPayments, filters]);

  // Pagination logic
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage, itemsPerPage]);

  const paymentMethodOptions = useMemo(() => {
    // Get unique payment methods from all payments
    const methods = new Set(allPayments.map(p => p.payment_method));
    return Array.from(methods);
  }, [allPayments]);

  const formatDateFromString = (date: string): string => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTimeFromString = (date: string): string => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Pagos</CardTitle>
        <CardDescription>Filtra y revisa los pagos registrados.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter Section */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-md bg-gray-50">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              id="startDate"
              value={filters.startDate ? filters.startDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleFilterChange('startDate', new Date(e.target.value))}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              id="endDate"
              value={filters.endDate ? filters.endDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleFilterChange('endDate', new Date(e.target.value))}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">Método</label>
            <Select 
              value={filters.paymentMethod}
              onValueChange={(value) => handleFilterChange('paymentMethod', value)}
            >
              <SelectTrigger id="paymentMethod">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {paymentMethodOptions.map(method => (
                  <SelectItem key={method} value={method}>{method}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Payments Table */}
        {paginatedPayments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No hay pagos que coincidan con los filtros seleccionados.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Notas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDateFromString(payment.payment_date)} {formatTimeFromString(payment.payment_date)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(payment.amount)}
                  </TableCell>
                  <TableCell>{payment.payment_method}</TableCell>
                  <TableCell>{payment.reference_number || '-'}</TableCell>
                  <TableCell className="truncate max-w-[150px]" title={payment.construction_site || 'Distribución automática'}>
                    {payment.construction_site || "Distribución automática"}
                  </TableCell>
                  <TableCell className="truncate max-w-[200px]" title={payment.notes || ''}>{payment.notes || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <span className="text-sm text-gray-600">
              Página {currentPage} de {totalPages} (Total: {filteredPayments.length} pagos)
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SiteStatusToggle({ site, onStatusChange }: { site: ConstructionSite, onStatusChange: () => void }) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async () => {
    try {
      setIsUpdating(true);
      await clientService.updateSiteStatus(site.id, !site.is_active);
      onStatusChange();
      toast.success(`Obra ${!site.is_active ? 'activada' : 'desactivada'} exitosamente`);
    } catch (error) {
      console.error('Error updating site status:', error);
      toast.error('Error al actualizar el estado de la obra');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch
        checked={site.is_active}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
      />
      <span className={`text-sm ${site.is_active ? 'text-green-600' : 'text-gray-500'}`}>
        {site.is_active ? 'Activa' : 'Inactiva'}
      </span>
    </div>
  );
}

export default function ClientDetailContent({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [balances, setBalances] = useState<ClientBalance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Dialog state for payment form
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // Find the current total balance for passing to PaymentForm - MOVED UP HERE to fix hooks order
  const currentTotalBalance = useMemo(() => {
    const generalBalance = balances.find(b => b.construction_site === null);
    return generalBalance?.current_balance || 0;
  }, [balances]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedClient = await clientService.getClientById(clientId);
      if (!fetchedClient) throw new Error('Cliente no encontrado');
      setClient(fetchedClient);

      const [fetchedSites, fetchedPayments, fetchedBalances] = await Promise.all([
        clientService.getClientSites(clientId),
        clientService.getClientPayments(clientId),
        clientService.getClientBalances(clientId)
      ]);
      setSites(fetchedSites);
      setPayments(fetchedPayments);
      setBalances(fetchedBalances);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido al cargar datos';
      console.error("Error loading client data:", errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePaymentAdded = () => {
    setIsPaymentDialogOpen(false); // Close the dialog
    loadData(); // Refresh data
  };

  const handlePaymentCancel = () => {
    setIsPaymentDialogOpen(false); // Close the dialog
  };

  if (loading) {
    return <div className="p-4">Cargando detalles del cliente...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>;
  }

  if (!client) {
    return <div className="p-4">No se encontró el cliente.</div>;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{client.business_name}</CardTitle>
              <CardDescription>Código: {client.client_code} | RFC: {client.rfc}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <p><strong>Contacto:</strong> {client.contact_name}</p>
            <p><strong>Email:</strong> {client.email}</p>
            <p><strong>Teléfono:</strong> {client.phone}</p>
            <p><strong>Dirección:</strong> {client.address}</p>
            <p><strong>Requiere Factura:</strong> {client.requires_invoice ? 'Sí' : 'No'}</p>
            <p><strong>Estado de Crédito:</strong> {client.credit_status}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ClientBalanceSummary balances={balances} />
        </div>

        <div className="lg:col-span-2">
           <ClientPaymentsList payments={payments} />
        </div>
      </div>

      {/* Payment registration button with Dialog */}
      {balances.length > 0 && (
        <section className="mt-6">
          <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
            <DialogTrigger asChild>
              <RoleProtectedButton
                allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
                onClick={() => setIsPaymentDialogOpen(true)}
                className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Registrar Pago
              </RoleProtectedButton>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Registrar Pago</DialogTitle>
                <DialogDescription>
                  Registre un pago para {client?.business_name}
                </DialogDescription>
              </DialogHeader>
              
              <PaymentForm
                clientId={clientId}
                sites={sites}
                onSuccess={handlePaymentAdded}
                onCancel={handlePaymentCancel}
                currentBalance={currentTotalBalance}
              />
            </DialogContent>
          </Dialog>
        </section>
      )}

      <Card>
         <CardHeader>
           <CardTitle>Obras Registradas</CardTitle>
           <CardDescription>Lista de obras asociadas a este cliente.</CardDescription>
         </CardHeader>
         <CardContent>
            {sites.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Ubicación</TableHead>
                    <TableHead>Restricciones de Acceso</TableHead>
                    <TableHead>Condiciones Especiales</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sites.map((site) => (
                    <TableRow key={site.id}>
                      <TableCell className="font-medium">{site.name}</TableCell>
                      <TableCell>{site.location || '-'}</TableCell>
                      <TableCell>{site.access_restrictions || '-'}</TableCell>
                      <TableCell>{site.special_conditions || '-'}</TableCell>
                      <TableCell>
                        <SiteStatusToggle site={site} onStatusChange={loadData} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-gray-500">No hay obras registradas para este cliente.</p>
            )}
            <NewSiteForm clientId={clientId} onSiteAdded={loadData} />
         </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Relacionados</CardTitle>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-gray-500">Funcionalidad de pedidos relacionados aún no implementada.</p>
           <Link href={`/orders?clientId=${clientId}`}>
              <Button variant="link" className="p-0 h-auto">Ver Pedidos</Button>
           </Link>
        </CardContent>
      </Card>
    </div>
  );
} 