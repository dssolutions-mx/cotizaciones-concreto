'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import orderService from '@/services/orderService';
import { clientService } from '@/lib/supabase/clients';
import { OrderWithDetails, OrderStatus, CreditStatus } from '@/types/order';
import { ConstructionSite, ClientBalance } from '@/types/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import RegistroRemision from '@/components/remisiones/RegistroRemision';
import RemisionesList, { formatRemisionesForAccounting } from '@/components/remisiones/RemisionesList';
import OrderDetailsBalance from './OrderDetailsBalance';
import PaymentForm from '../clients/PaymentForm';
import ClientBalanceSummary from '../clients/ClientBalanceSummary';
import { Button } from '@/components/ui/button';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import { // Shadcn Dialog components
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose, 
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

// Define una interfaz para editar la orden
interface EditableOrderData {
  delivery_date?: string;
  delivery_time?: string;
  requires_invoice?: boolean;
  special_requirements?: string | null;
  products?: Array<{
    id: string;
    volume: number;
    pump_volume?: number | null;
  }>;
}

interface OrderDetailsProps {
  orderId: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(amount);
};

export default function OrderDetails({ orderId }: OrderDetailsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const { profile, hasRole } = useAuth();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedOrder, setEditedOrder] = useState<EditableOrderData | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRejectReasonModalOpen, setIsRejectReasonModalOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'remisiones'>('details');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [clientSites, setClientSites] = useState<ConstructionSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [clientBalances, setClientBalances] = useState<ClientBalance[]>([]);
  const [hasRemisiones, setHasRemisiones] = useState<boolean>(false);
  const [remisionesData, setRemisionesData] = useState<any[]>([]);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Calculate allowed recipe IDs
  const allowedRecipeIds = useMemo(() => {
    if (!order?.products) return [];
    // Now recipe_id should be directly available on products
    const ids = order.products
      .map(p => p.recipe_id) // Access recipe_id directly
      .filter((id): id is string => !!id);
    return Array.from(new Set(ids)); 
  }, [order]);
  
  // Check if user has the Dosificador role
  const isDosificador = profile?.role === 'DOSIFICADOR' as UserRole;
  
  // Determine if the order can be edited: Not allowed if completed, cancelled, or by Dosificador
  const canEditOrder = order && 
    order.order_status !== 'completed' && 
    order.order_status !== 'cancelled' &&
    !isDosificador;
  
  // Check if order can be cancelled (any status but must not have remisiones)
  const canCancelOrder = order && 
    order.order_status !== 'cancelled' && 
    !hasRemisiones && 
    !isDosificador;
  
  // Check if user is a credit validator or manager
  const isCreditValidator = profile?.role === 'CREDIT_VALIDATOR' as UserRole;
  const isManager = profile?.role === 'EXECUTIVE' as UserRole || profile?.role === 'PLANT_MANAGER' as UserRole;
  
  // Check if the user can approve/reject credit
  const canManageCredit = (isCreditValidator || isManager) && order?.credit_status !== 'approved' && order?.credit_status !== 'rejected';

  const loadOrderDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await orderService.getOrderById(orderId);
      setOrder(data as unknown as OrderWithDetails);
      setEditedOrder(null);
      
      // Fetch client balances if client_id exists
      if (data?.client_id) {
        try {
          const balances = await clientService.getClientBalances(data.client_id);
          setClientBalances(balances);
        } catch (balanceError) {
          console.error("Error loading client balances:", balanceError);
          // Decide if this error should block rendering or just be logged
        }
      } else {
        setClientBalances([]); // Reset if no client ID
      }
    } catch (err) {
      console.error('Error loading order details:', err);
      setError('Error al cargar los detalles de la orden. Por favor, intente nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrderDetails();
  }, [loadOrderDetails]);

  // Function to load client sites when payment dialog is opened
  const loadClientSitesForPayment = useCallback(async () => {
    if (!order?.client_id) return;
    
    setLoadingSites(true);
    try {
      const sites = await clientService.getClientSites(order.client_id);
      const activeSites = sites.filter(site => site.is_active);
      setClientSites(activeSites);
    } catch (error) {
      console.error("Error loading client sites for payment:", error);
    } finally {
      setLoadingSites(false);
    }
  }, [order?.client_id]);

  // Handler for successful payment
  const handlePaymentSuccess = () => {
    setIsPaymentDialogOpen(false);
    loadOrderDetails(); // Reload order data
  };

  // Find the current client balance from balances
  const currentClientBalance = useMemo(() => {
    if (clientBalances.length === 0) return 0;
    // Find general balance (not tied to specific site)
    const generalBalance = clientBalances.find(b => b.construction_site === null);
    return generalBalance?.current_balance || 0;
  }, [clientBalances]);

  useEffect(() => {
    if (isPaymentDialogOpen) {
      loadClientSitesForPayment();
    }
  }, [isPaymentDialogOpen, loadClientSitesForPayment]);

  function formatDate(dateString: string) {
    // Convertir formato YYYY-MM-DD a un objeto Date
    // Asegurar que es un formato estándar para evitar diferencias entre navegadores
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString; // Si no tiene el formato esperado, devolver el original
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Los meses en JS van de 0-11
    const day = parseInt(parts[2], 10);
    
    const date = new Date(year, month, day);
    return format(date, 'PP', { locale: es });
  }

  function formatTime(timeString: string) {
    return timeString.substring(0, 5);
  }

  function getOrderStatusColor(status: OrderStatus) {
    switch (status) {
      case 'created':
        return 'bg-blue-500 text-white';
      case 'validated':
        return 'bg-green-500 text-white';
      case 'scheduled':
        return 'bg-purple-500 text-white';
      case 'completed':
        return 'bg-green-700 text-white';
      case 'cancelled':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  function translateOrderStatus(status: OrderStatus) {
    switch (status) {
      case 'created':
        return 'Creada';
      case 'validated':
        return 'Validada';
      case 'scheduled':
        return 'Programada';
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  }

  function getCreditStatusColor(status: CreditStatus) {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500 text-white';
      case 'approved':
        return 'bg-green-500 text-white';
      case 'rejected':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  function translateCreditStatus(status: CreditStatus) {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobado';
      case 'rejected':
        return 'Rechazado';
      default:
        return status;
    }
  }

  const handleEditClick = () => {
    if (!canEditOrder || !order) {
      return;
    }
    
    setIsEditing(true);
    setEditedOrder({
      delivery_date: order.delivery_date,
      delivery_time: order.delivery_time,
      requires_invoice: order.requires_invoice,
      special_requirements: order.special_requirements || null,
      products: order.products.map(p => ({ 
        id: p.id, 
        volume: p.volume,
        pump_volume: p.pump_volume
      }))
    });
  };

  function handleCancelEdit() {
    setIsEditing(false);
    setEditedOrder(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!editedOrder) return;
    
    const { name, value } = e.target;
    setEditedOrder({
      ...editedOrder,
      [name]: value
    });
  }

  function handleProductVolumeChange(id: string, newVolume: number) {
    if (!editedOrder || !editedOrder.products) return;
    
    const updatedProducts = editedOrder.products.map(product => {
      if (product.id === id) {
        return { ...product, volume: newVolume };
      }
      return product;
    });
    
    setEditedOrder({
      ...editedOrder,
      products: updatedProducts
    });
  }

  function handlePumpVolumeChange(id: string, newVolume: number) {
    if (!editedOrder || !editedOrder.products) return;
    
    const updatedProducts = editedOrder.products.map(product => {
      if (product.id === id) {
        return { ...product, pump_volume: newVolume };
      }
      return product;
    });
    
    setEditedOrder({
      ...editedOrder,
      products: updatedProducts
    });
  }

  async function handleSaveChanges() {
    if (!editedOrder || !order) return;
    
    try {
      setIsSaving(true);
      
      // Actualizar la información general de la orden
      const orderUpdate = {
        delivery_date: editedOrder.delivery_date,
        delivery_time: editedOrder.delivery_time,
        requires_invoice: editedOrder.requires_invoice,
        special_requirements: editedOrder.special_requirements
      };
      
      await orderService.updateOrder(orderId, orderUpdate);
      
      // Actualizar los productos si han cambiado y la orden está en estado 'created'
      if (editedOrder.products && editedOrder.products.length > 0 && order.order_status === 'created') {
        console.log('Order status is created, attempting to update items...');
        const updates = editedOrder.products.map(product => {
          const originalProduct = order.products.find(p => p.id === product.id);
          
          // Solo actualizar si los valores han cambiado
          if (originalProduct && 
              (originalProduct.volume !== product.volume || 
               originalProduct.pump_volume !== product.pump_volume)) {
             console.log(`Updating item ${product.id} - Volume: ${product.volume}, Pump Volume: ${product.pump_volume}`);
            return orderService.updateOrderItem(product.id, {
              volume: product.volume,
              pump_volume: product.pump_volume,
              // Recalcular el precio total basado en el precio unitario
              total_price: originalProduct.unit_price * product.volume
            });
          }
          return Promise.resolve();
        });
        
        await Promise.all(updates);
      } else {
          console.log(`Skipping item update. Status: ${order.order_status}`);
      }
      
      // Reload order details after saving
      await loadOrderDetails();
      setIsEditing(false);
      toast.success('Los cambios se guardaron correctamente');
    } catch (err) {
      console.error('Error saving order changes:', err);
      setError('Error al guardar los cambios. Por favor, intente nuevamente.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApproveCredit() {
    if (!order) return;
    
    try {
      await orderService.approveCreditForOrder(order.id);
      await loadOrderDetails();
    } catch (err) {
      console.error('Error approving credit:', err);
      setError('Error al aprobar el crédito. Por favor, intente nuevamente.');
    }
  }
  
  function openRejectReasonModal() {
    if (!order) return;
    setRejectionReason('');
    setIsRejectReasonModalOpen(true);
  }
  
  function openConfirmModal() {
    if (!order) return;
    setIsConfirmModalOpen(true);
  }
  
  async function handleValidatorReject() {
    if (!order || !rejectionReason.trim()) return;
    
    try {
      await orderService.rejectCreditByValidator(order.id, rejectionReason);
      setIsRejectReasonModalOpen(false);
      setRejectionReason('');
      await loadOrderDetails();
    } catch (err) {
      console.error('Error rejecting credit:', err);
      setError('Error al rechazar el crédito. Por favor, intente nuevamente.');
    }
  }
  
  async function handleManagerReject() {
    if (!order) return;
    
    try {
      const defaultReason = "Crédito rechazado definitivamente por gerencia";
      await orderService.rejectCreditForOrder(order.id, defaultReason);
      setIsConfirmModalOpen(false);
      await loadOrderDetails();
    } catch (err) {
      console.error('Error rejecting credit:', err);
      setError('Error al rechazar el crédito. Por favor, intente nuevamente.');
    }
  }

  // Función para volver atrás manteniendo el contexto
  function handleGoBack() {
    if (returnTo === 'calendar') {
      router.push('/orders?showCalendarView=true');
    } else {
      router.push('/orders?showOrdersList=true');
    }
  }

  const refreshData = useCallback(() => {
    loadOrderDetails();
    // Potentially add other refresh logic if needed
  }, [loadOrderDetails]);

  // Add function to handle copy to accounting clipboard
  const handleCopyToAccounting = useCallback(async () => {
    try {
      // Check if the order has empty truck charge
      const hasEmptyTruckCharge = order?.products?.some(
        product => product.has_empty_truck_charge === true || product.product_type === 'VACÍO DE OLLA'
      ) || false;
      
      // Format the remisiones data for accounting
      const formattedData = formatRemisionesForAccounting(
        remisionesData,
        order?.requires_invoice || false,
        order?.construction_site || "",
        hasEmptyTruckCharge,
        order?.products || []
      );
      
      if (formattedData) {
        await navigator.clipboard.writeText(formattedData);
        setCopySuccess(true);
        
        // Reset success message after 3 seconds
        setTimeout(() => {
          setCopySuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setError('Error al copiar los datos al portapapeles. Por favor, intente nuevamente.');
    }
  }, [remisionesData, order?.requires_invoice, order?.construction_site, order?.products]);
  
  // Function to update remisiones data when loaded in the child component
  const handleRemisionesDataUpdate = useCallback((data: any[]) => {
    setRemisionesData(data);
    setHasRemisiones(data && data.length > 0);
  }, []);

  // Check if the order has empty truck charge product
  const hasEmptyTruckCharge = useMemo(() => {
    return order?.products?.some(
      product => product.has_empty_truck_charge === true || product.product_type === 'VACÍO DE OLLA'
    ) || false;
  }, [order?.products]);

  async function handleCancelOrder() {
    if (!order) return;
    
    try {
      setIsCancelling(true);
      await orderService.cancelOrder(orderId);
      // Reload order details after cancelling
      await loadOrderDetails();
      setShowConfirmCancel(false);
      toast.success('Orden cancelada exitosamente');
    } catch (err) {
      console.error('Error cancelling order:', err);
      setError('Error al cancelar la orden. Por favor, intente nuevamente.');
    } finally {
      setIsCancelling(false);
    }
  }

  // Add this function to check if financial info should be shown
  const shouldShowFinancialInfo = () => {
    return !isDosificador;
  };

  // Add function to handle order deletion
  async function handleDeleteOrder() {
    try {
      setIsDeleting(true);
      await orderService.deleteOrder(orderId);
      toast.success('Orden eliminada permanentemente');
      // Navigate back after deletion
      handleGoBack();
    } catch (err) {
      console.error('Error eliminando la orden:', err);
      toast.error('Error al eliminar la orden');
      setError('Error al eliminar la orden. Por favor, intente nuevamente.');
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center p-4">Cargando detalles de la orden...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-4">{error}</div>;
  }

  if (!order) {
    return <div className="text-center p-4">Orden no encontrada.</div>;
  }

  // Find the specific construction site object for this order (if available)
  const orderConstructionSite = order.construction_site;

  // Calculate total balance from fetched balances
  const totalClientBalance = clientBalances.find(b => b.construction_site === null)?.current_balance;

  // Render the action buttons section with Payment Dialog
  const renderOrderActions = () => {
    return (
      <div className="flex flex-wrap gap-2 items-center justify-end mt-4">
        <div className="flex flex-wrap gap-2">
          {/* ... existing buttons ... */}
          
          {/* Payment Button with Dialog */}
          {shouldShowFinancialInfo() && (
            <RoleProtectedSection allowedRoles={['SALES_AGENT', 'EXECUTIVE', 'PLANT_MANAGER'] as UserRole[]}>
              <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="ml-2"
                    onClick={() => setIsPaymentDialogOpen(true)}
                  >
                    Registrar Pago
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Registrar Pago para Cliente</DialogTitle>
                    <DialogDescription>
                      Ingrese los detalles del pago para {order.client.business_name}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <PaymentForm 
                    clientId={order.client_id} 
                    sites={clientSites}
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => setIsPaymentDialogOpen(false)}
                    defaultConstructionSite={order.construction_site || ''}
                    currentBalance={currentClientBalance}
                  />
                </DialogContent>
              </Dialog>
            </RoleProtectedSection>
          )}
          
          {/* Delete Order Button - Only for EXECUTIVE role */}
          <RoleProtectedSection allowedRoles={['EXECUTIVE'] as UserRole[]}>
            <Dialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="ml-2"
                  onClick={() => setShowConfirmDelete(true)}
                >
                  Eliminar Orden
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Eliminar Orden Permanentemente</DialogTitle>
                  <DialogDescription>
                    Esta acción eliminará permanentemente la orden #{order.order_number} y todos sus datos relacionados. Esta acción no se puede deshacer.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="outline" onClick={() => setShowConfirmDelete(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteOrder}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Eliminando...' : 'Confirmar Eliminación'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </RoleProtectedSection>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Orden #{order?.order_number || orderId.substring(0, 8)}
          </h1>
          <p className="mt-1 text-sm text-gray-600">Cliente: {order?.client?.business_name}</p>
        </div>
        <div>
          <button
            onClick={handleGoBack}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-xs text-gray-700 bg-white hover:bg-gray-50 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Volver
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="shrink-0">
              {/* Exclamation circle icon */}
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-60">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      ) : order ? (
        <>
          <div className="mb-6">
            <div className="border-b">
              <nav className="-mb-px flex space-x-6">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'details'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Detalles de Orden
                </button>
                <button
                  onClick={() => setActiveTab('remisiones')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'remisiones'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Remisiones
                </button>
              </nav>
            </div>
                  
            {activeTab === 'details' ? (
              <div className="mt-6 bg-white shadow-sm overflow-hidden sm:rounded-lg">
                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Estado de la Orden</h3>
                  {shouldShowFinancialInfo() && (
                    <div className="mt-4 border-t pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Balance Actual del Cliente</h4>
                      <ClientBalanceSummary 
                        clientId={order.client_id}
                      />
                    </div>
                  )}
                  <div className="mt-4 flex flex-col sm:flex-row sm:justify-between">
                    <div className="mb-2 sm:mb-0">
                      <span className="text-sm text-gray-500">Estado de Orden:</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getOrderStatusColor(order.order_status)}`}>
                        {translateOrderStatus(order.order_status)}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Estado de Crédito:</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getCreditStatusColor(order.credit_status)}`}>
                        {translateCreditStatus(order.credit_status)}
                      </span>
                    </div>
                  </div>
                  {canManageCredit && order.credit_status === 'pending' && (
                    <div className="mt-4 flex space-x-2">
                      <button
                        onClick={handleApproveCredit}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-xs text-white bg-green-600 hover:bg-green-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Aprobar Crédito
                      </button>
                      
                      {isCreditValidator ? (
                        <button
                          onClick={openRejectReasonModal}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-xs text-white bg-red-600 hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Rechazar Crédito
                        </button>
                      ) : (
                        <button
                          onClick={openConfirmModal}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-xs text-white bg-red-600 hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          Rechazar Crédito
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-4 py-5 sm:px-6">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Información de Entrega</h3>
                </div>
                <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Fecha de Entrega</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {order.delivery_date ? formatDate(order.delivery_date) : 'No especificada'}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Hora de Entrega</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {order.delivery_time ? formatTime(order.delivery_time) : 'No especificada'}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Requiere Factura</dt>
                      <dd className="mt-1 text-sm text-gray-900">{order.requires_invoice ? 'Sí' : 'No'}</dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Obra</dt>
                      <dd className="mt-1 text-sm text-gray-900">{order.construction_site || 'No especificada'}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Requerimientos Especiales</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {order.special_requirements || 'Ninguno'}
                      </dd>
                    </div>
                  </dl>
                  {/* Order actions buttons */}
                  <div className="px-4 py-5 sm:px-6 bg-gray-50 border-t flex flex-wrap gap-2">
                    {canEditOrder && !isEditing && order.order_status !== 'cancelled' && (
                      <button
                        onClick={handleEditClick}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-xs text-white bg-green-600 hover:bg-green-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Editar Orden
                      </button>
                    )}
                    
                    {canCancelOrder && !isEditing && order.order_status !== 'cancelled' && (
                      <button
                        onClick={() => setShowConfirmCancel(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-xs text-white bg-red-600 hover:bg-red-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Cancelar Orden
                      </button>
                    )}
                  </div>
                </div>

                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Productos</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Producto</TableHead>
                        <TableHead>Volumen</TableHead>
                        <TableHead>Servicio de Bomba</TableHead>
                        {shouldShowFinancialInfo() && (
                          <>
                            <TableHead className="text-right">Precio Unitario</TableHead>
                            <TableHead className="text-right">Precio Total</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.product_type}</TableCell>
                          <TableCell>{product.volume} m³</TableCell>
                          <TableCell>
                            {product.has_pump_service ? 
                              `Sí - ${product.pump_volume} m³` : 
                              'No'}
                          </TableCell>
                          {shouldShowFinancialInfo() && (
                            <>
                              <TableCell className="text-right">{formatCurrency(product.unit_price)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(product.total_price)}</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {shouldShowFinancialInfo() && (
                  <div className="flex justify-end mt-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total:</p>
                      <p className="text-xl font-bold">{formatCurrency(order.total_amount)}</p>
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div className="mt-6 space-y-5">
                    {order.order_status !== 'created' && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div className="flex">
                          <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                              La orden ya ha sido aprobada. Solo puedes cambiar la fecha y hora de entrega, los requisitos especiales 
                              y si requiere factura. El volumen no se puede modificar.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="delivery_date" className="block text-sm font-medium text-gray-700 mb-1">
                          Fecha de Entrega
                        </label>
                        <input
                          type="date"
                          name="delivery_date"
                          id="delivery_date"
                          value={editedOrder?.delivery_date || ''}
                          onChange={handleInputChange}
                          min={format(new Date(), 'yyyy-MM-dd')}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="delivery_time" className="block text-sm font-medium text-gray-700 mb-1">
                          Hora de Entrega
                        </label>
                        <input
                          type="time"
                          name="delivery_time"
                          id="delivery_time"
                          value={editedOrder?.delivery_time || ''}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          name="requires_invoice"
                          checked={editedOrder?.requires_invoice || false}
                          onChange={(e) => {
                            if (!editedOrder) return;
                            setEditedOrder({
                              ...editedOrder,
                              requires_invoice: e.target.checked
                            });
                          }}
                          className="h-4 w-4 text-green-600 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Requiere factura</span>
                      </label>
                    </div>
                    
                    <div>
                      <label htmlFor="special_requirements" className="block text-sm font-medium text-gray-700 mb-1">
                        Requisitos Especiales
                      </label>
                      <textarea
                        name="special_requirements"
                        id="special_requirements"
                        rows={3}
                        value={editedOrder?.special_requirements || ''}
                        onChange={handleInputChange}
                        className="w-full rounded-md border border-gray-300 px-3 py-2"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="px-4 py-2 border border-gray-300 rounded-md shadow-xs text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-4 py-2 border border-transparent rounded-md shadow-xs text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                {hasRemisiones && (
                  <div className="flex justify-end mb-4">
                    <Button 
                      variant="outline" 
                      className="flex items-center gap-2"
                      onClick={handleCopyToAccounting}
                    >
                      <Copy size={16} />
                      <span>Copiar para Contabilidad</span>
                      {copySuccess && (
                        <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          ¡Copiado!
                        </span>
                      )}
                    </Button>
                  </div>
                )}
                
                <RegistroRemision 
                  orderId={order.id} 
                  onRemisionCreated={loadOrderDetails} 
                  allowedRecipeIds={allowedRecipeIds}
                />
                
                <RemisionesList 
                  orderId={order.id} 
                  requiresInvoice={order.requires_invoice}
                  constructionSite={order.construction_site}
                  hasEmptyTruckCharge={hasEmptyTruckCharge}
                  onRemisionesLoaded={handleRemisionesDataUpdate}
                />
              </div>
            )}
          </div>

          {shouldShowFinancialInfo() && (
            <div className="mt-6 border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Información Financiera</h2>
              
              <OrderDetailsBalance
                orderId={orderId}
                clientId={order.client_id}
                constructionSite={order.construction_site}
              />
              
              {renderOrderActions()}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-lg text-gray-600">Orden no encontrada</p>
        </div>
      )}

      {isRejectReasonModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Razón del rechazo</h3>
            <p className="mb-4">Por favor, indique la razón por la que se rechaza el crédito:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md mb-4"
              rows={3}
              placeholder="Ejemplo: Cliente con pagos pendientes"
            />
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setIsRejectReasonModalOpen(false)}
                className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium bg-background hover:bg-accent"
              >
                Cancelar
              </button>
              <button 
                onClick={handleValidatorReject}
                disabled={!rejectionReason.trim()}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirmar rechazo definitivo</h3>
            <p className="mb-4">¿Está seguro de rechazar definitivamente el crédito para esta orden? Esta acción cancelará la orden y no se puede deshacer.</p>
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setIsConfirmModalOpen(false)}
                className="inline-flex items-center justify-center rounded-md border border-input px-4 py-2 text-sm font-medium bg-background hover:bg-accent"
              >
                Cancelar
              </button>
              <button 
                onClick={handleManagerReject}
                className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
              >
                Rechazar Definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel order confirmation dialog */}
      <Dialog open={showConfirmCancel} onOpenChange={setShowConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Cancelación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas cancelar esta orden? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmCancel(false)}
              disabled={isCancelling}
            >
              No, Mantener
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelOrder}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelando...' : 'Sí, Cancelar Orden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 