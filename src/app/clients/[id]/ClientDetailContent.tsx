'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { clientService } from '@/lib/supabase/clients';
import { orderService } from '@/lib/supabase/orders';
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
import { Client, ConstructionSite as BaseConstructionSite, ClientPayment, ClientBalance } from '@/types/client';
import { OrderWithClient } from '@/types/orders';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from "sonner";
// Import for map components
import dynamic from 'next/dynamic';

// Extended type with coordinates
interface ConstructionSite extends BaseConstructionSite {
  latitude?: number | null;
  longitude?: number | null;
}

// Dynamically import map components with no SSR to avoid window errors
const GoogleMapSelector = dynamic(
  () => import('@/components/maps/GoogleMapSelector'),
  { ssr: false }
);

const GoogleMapWrapper = dynamic(
  () => import('@/components/maps/GoogleMapWrapper'),
  { ssr: false }
);

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
    is_active: true,
    latitude: null as number | null,
    longitude: null as number | null
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSiteData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Memoized callback for map location selection to prevent excessive re-renders
  const handleLocationSelect = useCallback((lat: number, lng: number) => {
    setSiteData(prev => {
      // Only update if values actually changed
      if (prev.latitude === lat && prev.longitude === lng) {
        return prev;
      }
      return {
        ...prev,
        latitude: lat,
        longitude: lng
      };
    });
  }, []);

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
        is_active: true,
        latitude: null,
        longitude: null
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
      
      {/* Map for selecting coordinates */}
      <div className="mt-4 mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ubicación en el Mapa
        </label>
        <p className="text-sm text-gray-500 mb-2">
          Haz clic en el mapa para seleccionar las coordenadas exactas de la obra
        </p>
        <GoogleMapWrapper>
          <GoogleMapSelector 
            onSelectLocation={handleLocationSelect} 
            height="400px"
            initialPosition={siteData.latitude && siteData.longitude ? 
              { lat: siteData.latitude, lng: siteData.longitude } : null}
          />
        </GoogleMapWrapper>
        
        {/* Display coordinates if selected */}
        {siteData.latitude && siteData.longitude && (
          <div className="mt-2 text-sm">
            <p>Coordenadas seleccionadas: {siteData.latitude.toFixed(6)}, {siteData.longitude.toFixed(6)}</p>
          </div>
        )}
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

// Update SiteStatusToggle to also show coordinates
function SiteStatusToggle({ site, onStatusChange }: { site: ConstructionSite, onStatusChange: () => void }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const [dialogReady, setDialogReady] = useState(false);

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

  // Return early if the site doesn't have valid coordinates
  const hasCoordinates = site.latitude && site.longitude;

  // Memoized handler for map selector to prevent re-renders
  const handleMapSelection = useCallback(() => {
    // This is a read-only map, so we don't need to do anything with selections
  }, []);
  
  // Handle dialog opening
  const openMapDialog = useCallback(() => {
    setShowMapDialog(true);
    // Short delay to ensure DOM is ready before rendering the map
    setTimeout(() => {
      setDialogReady(true);
    }, 100);
  }, []);

  // Handle dialog closing
  const closeDialog = useCallback(() => {
    setShowMapDialog(false);
    setDialogReady(false);
  }, []);

  return (
    <div>
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
      
      {hasCoordinates && (
        <div className="mt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={openMapDialog}
          >
            Ver en Mapa
          </Button>
          
          <Dialog open={showMapDialog} onOpenChange={closeDialog}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Ubicación: {site.name}</DialogTitle>
                <DialogDescription>
                  {site.location || 'Sin dirección registrada'}
                </DialogDescription>
              </DialogHeader>
              
              {dialogReady && site.latitude && site.longitude && (
                <div className="h-[400px] w-full mt-4 rounded-lg overflow-hidden">
                  <GoogleMapWrapper className="h-full w-full">
                    <GoogleMapSelector
                      initialPosition={{ lat: site.latitude, lng: site.longitude }}
                      onSelectLocation={handleMapSelection}
                      height="100%"
                      readOnly={true}
                    />
                  </GoogleMapWrapper>
                </div>
              )}
              
              <div className="mt-2 text-sm text-gray-600">
                Coordenadas: {site.latitude!.toFixed(6)}, {site.longitude!.toFixed(6)}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

// Order Detail Modal Component
function OrderDetailModal({ 
  isOpen, 
  onClose, 
  orderId 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  orderId: string | null 
}) {
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [remisiones, setRemisiones] = useState<any[]>([]);
  const [loadingRemisiones, setLoadingRemisiones] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      const fetchOrderDetails = async () => {
        setLoading(true);
        try {
          // Obtener los datos del pedido
          const { data, error } = await orderService.getOrderById(orderId);
          if (error) throw new Error(error);
          setOrderDetails(data);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Error al cargar detalles del pedido';
          setError(errorMessage);
        } finally {
          setLoading(false);
        }
      };

      // Función separada para las remisiones
      const fetchRemisiones = async () => {
        setLoadingRemisiones(true);
        try {
          // Importamos dinámicamente para evitar problemas de SSR
          const supabaseModule = await import('@/lib/supabase/client');
          const supabase = supabaseModule.supabase;
          
          if (!supabase) {
            console.error("Cliente Supabase no disponible");
            return;
          }
          
          // Verificamos primero si la tabla existe
          const { error: tableCheckError } = await supabase
            .from('remisiones')
            .select('id')
            .limit(1);
          
          // Si hay error con la tabla, probablemente no existe o no tenemos acceso
          if (tableCheckError) {
            console.log("La tabla de remisiones no está disponible:", tableCheckError.message);
            return;
          }
          
          // Si la tabla existe, procedemos con la consulta completa
          const { data: remisionesData, error: remisionesError } = await supabase
            .from('remisiones')
            .select(`
              *,
              recipe:recipes(recipe_code),
              materiales:remision_materiales(*)
            `)
            .eq('order_id', orderId)
            .order('fecha', { ascending: false });
          
          if (remisionesError) {
            console.error("Error al cargar remisiones:", remisionesError);
          } else {
            setRemisiones(remisionesData || []);
          }
        } catch (err) {
          console.error("Error inesperado al cargar remisiones:", err);
        } finally {
          setLoadingRemisiones(false);
        }
      };

      fetchOrderDetails();
      fetchRemisiones();
    }
  }, [isOpen, orderId]);

  // Agrupar remisiones por tipo
  const concreteRemisiones = remisiones.filter(r => r.tipo_remision === 'CONCRETO');
  const pumpRemisiones = remisiones.filter(r => r.tipo_remision === 'BOMBEO');
  
  // Calcular totales de volumen
  const totalConcreteVolume = concreteRemisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
  const totalPumpVolume = pumpRemisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);

  // Verificar si hay remisiones de concreto
  const hasRemisiones = concreteRemisiones.length > 0;

  if (!isOpen || !orderId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>Detalles del Pedido</DialogTitle>
          <DialogDescription>
            {orderDetails?.order_number || 'Cargando...'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <p>Cargando detalles del pedido...</p>
          </div>
        ) : error ? (
          <div className="text-red-600 py-4">
            {error}
          </div>
        ) : orderDetails ? (
          <div className="space-y-6">
            {/* Order General Info */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Número de Pedido</p>
                    <p className="text-base">{orderDetails.order_number}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Fecha de Entrega</p>
                    <p className="text-base">{formatDate(orderDetails.delivery_date, 'PP')} {orderDetails.delivery_time}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Estado</p>
                    <div className={`px-2 py-1 mt-1 rounded-full text-xs font-medium inline-flex items-center
                      ${orderDetails.order_status === 'created' ? 'bg-yellow-100 text-yellow-800' : 
                        orderDetails.order_status === 'validated' ? 'bg-green-100 text-green-800' :
                        orderDetails.order_status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                        orderDetails.order_status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {orderDetails.order_status.charAt(0).toUpperCase() + orderDetails.order_status.slice(1)}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Obra</p>
                    <p className="text-base">{orderDetails.construction_site || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Monto Total</p>
                    <p className="text-base">{orderDetails.final_amount ? formatCurrency(orderDetails.final_amount) : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Requiere Factura</p>
                    <p className="text-base">{orderDetails.requires_invoice ? 'Sí' : 'No'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Products or Remisiones */}
            {hasRemisiones ? (
              // Mostrar productos basados en remisiones
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Productos (Basados en Remisiones)</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>№ Remisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Receta</TableHead>
                        <TableHead className="text-right">Volumen (m³)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {concreteRemisiones.map((remision) => (
                        <TableRow key={remision.id}>
                          <TableCell className="font-medium">{remision.remision_number}</TableCell>
                          <TableCell>
                            {remision.fecha ? formatDate(new Date(remision.fecha), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>{remision.recipe?.recipe_code || 'N/A'}</TableCell>
                          <TableCell className="text-right">{(remision.volumen_fabricado || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Mostrar fila de totales si hay más de una remisión */}
                      {concreteRemisiones.length > 1 && (
                        <TableRow className="bg-gray-50 font-medium">
                          <TableCell colSpan={3} className="text-right">
                            Total:
                          </TableCell>
                          <TableCell className="text-right">
                            {totalConcreteVolume.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : loadingRemisiones ? (
              // Mostramos mensaje de carga si aún estamos buscando remisiones
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="py-4 text-center text-gray-500">
                    <p>Cargando información de productos...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Mostrar productos originales del pedido
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Productos</CardTitle>
                </CardHeader>
                <CardContent>
                  {orderDetails.items && orderDetails.items.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Producto</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Unitario</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderDetails.items.map((item: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell>{item.product_type || 'Producto'}</TableCell>
                            <TableCell className="text-right">{item.volume || 0} m³</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price || 0)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.total_price || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-gray-500 text-sm">No hay productos registrados para este pedido.</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bombeo (si hay remisiones de bombeo) */}
            {pumpRemisiones.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Servicios de Bombeo</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>№ Remisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead className="text-right">Volumen (m³)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pumpRemisiones.map((remision) => (
                        <TableRow key={remision.id}>
                          <TableCell className="font-medium">{remision.remision_number}</TableCell>
                          <TableCell>
                            {remision.fecha ? formatDate(new Date(remision.fecha), 'dd/MM/yyyy') : '-'}
                          </TableCell>
                          <TableCell>{remision.operador || '-'}</TableCell>
                          <TableCell className="text-right">{(remision.volumen_fabricado || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {/* Mostrar fila de totales si hay más de una remisión de bombeo */}
                      {pumpRemisiones.length > 1 && (
                        <TableRow className="bg-gray-50 font-medium">
                          <TableCell colSpan={3} className="text-right">
                            Total:
                          </TableCell>
                          <TableCell className="text-right">
                            {totalPumpVolume.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Special Requirements */}
            {orderDetails.special_requirements && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Requisitos Especiales</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{orderDetails.special_requirements}</p>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cerrar</Button>
              <Button asChild variant="default">
                <Link href={`/orders/${orderId}`} target="_blank">Ver Completo</Link>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function ClientDetailContent({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [payments, setPayments] = useState<ClientPayment[]>([]);
  const [balances, setBalances] = useState<ClientBalance[]>([]);
  const [clientOrders, setClientOrders] = useState<OrderWithClient[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Dialog state for payment form
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  // Order detail modal state
  const [isOrderDetailModalOpen, setIsOrderDetailModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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

      // Fetch orders for this client
      setLoadingOrders(true);
      const { data: orders, error: ordersError } = await orderService.getOrders({ clientId });
      if (ordersError) {
        console.error("Error loading client orders:", ordersError);
      } else {
        setClientOrders(orders);
      }
      setLoadingOrders(false);

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

  // Handle opening the order detail modal
  const handleViewOrderDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
    setIsOrderDetailModalOpen(true);
  };

  // Format date helper function for orders section
  const formatOrderDate = (dateString: string): string => {
    return formatDate(dateString, 'PP');
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
                    <TableHead>Coordenadas</TableHead>
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
                        {site.latitude && site.longitude 
                          ? `${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}`
                          : '-'
                        }
                      </TableCell>
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
          <CardDescription>Lista de pedidos asociados a este cliente</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingOrders ? (
            <p className="text-sm text-gray-500">Cargando pedidos...</p>
          ) : clientOrders.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número de Pedido</TableHead>
                  <TableHead>Fecha de Entrega</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{formatOrderDate(order.delivery_date)}</TableCell>
                    <TableCell>{order.delivery_time}</TableCell>
                    <TableCell className="truncate max-w-[150px]" title={order.construction_site || ''}>
                      {order.construction_site || "-"}
                    </TableCell>
                    <TableCell>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center
                        ${order.order_status === 'created' ? 'bg-yellow-100 text-yellow-800' : 
                          order.order_status === 'validated' ? 'bg-green-100 text-green-800' :
                          order.order_status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                          order.order_status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'}`}>
                        {order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1)}
                      </div>
                    </TableCell>
                    <TableCell>{order.final_amount ? formatCurrency(order.final_amount) : '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleViewOrderDetails(order.id)}
                      >
                        Ver Detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-gray-500">No hay pedidos registrados para este cliente.</p>
          )}
          <div className="mt-4">
            <Link href={`/orders/create?clientId=${clientId}`}>
              <Button variant="default">Crear Nuevo Pedido</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Order Detail Modal */}
      <OrderDetailModal 
        isOpen={isOrderDetailModalOpen} 
        onClose={() => setIsOrderDetailModalOpen(false)} 
        orderId={selectedOrderId} 
      />
    </div>
  );
} 