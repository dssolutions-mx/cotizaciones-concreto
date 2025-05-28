'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import orderService from '@/services/orderService';
import { clientService } from '@/lib/supabase/clients';
import { fetchAvailableRecipes } from '@/services/recipeService';
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
import { Copy, CalculatorIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// Define una interfaz para editar la orden
interface EditableOrderData {
  delivery_date?: string;
  delivery_time?: string;
  requires_invoice?: boolean;
  special_requirements?: string | null;
  has_pump_service?: boolean;
  pump_volume?: number;
  products?: Array<{
    id: string;
    volume: number;
    pump_volume?: number | null;
    recipe_id?: string | null;
    temp_recipe_code?: string; // Campo temporal para mostrar el código, no se guarda en BD
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
  const [availableRecipes, setAvailableRecipes] = useState<any[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [recipePrices, setRecipePrices] = useState<Record<string, number>>({});
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  
  // Recipe filter states - Added for filtering functionality
  const [strengthFilter, setStrengthFilter] = useState<number | ''>('');
  const [placementTypeFilter, setPlacementTypeFilter] = useState<string>('');
  const [slumpFilter, setSlumpFilter] = useState<number | ''>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  
  // Global pump service states
  const [hasPumpService, setHasPumpService] = useState<boolean>(false);
  const [pumpVolume, setPumpVolume] = useState<number>(0);
  const [pumpPrice, setPumpPrice] = useState<number | null>(null);
  
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
  
  // Debug: Log role information
  useEffect(() => {
    console.log('OrderDetails Debug - User Profile:', profile);
    console.log('OrderDetails Debug - User Role:', profile?.role);
    console.log('OrderDetails Debug - Is Credit Validator:', isCreditValidator);
    console.log('OrderDetails Debug - Has Role CREDIT_VALIDATOR:', hasRole('CREDIT_VALIDATOR'));
    console.log('OrderDetails Debug - Has Role Array:', hasRole(['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'CREDIT_VALIDATOR']));
  }, [profile, isCreditValidator, hasRole]);
  
  // Load pumping service pricing for client + construction site
  useEffect(() => {
    if (!order?.client_id || !order?.construction_site) {
      setPumpPrice(null);
      return;
    }
    
    const loadPumpServicePricing = async () => {
      try {
        console.log(`Fetching pump service pricing for Client: ${order.client_id}, Site: ${order.construction_site}`);
        
        // Look for pump service pricing in quote_details that are approved for this client + site combination
        const { data: pumpServiceData, error: pumpServiceError } = await supabase
          .from('quotes')
          .select(`
            quote_details(
              pump_service,
              pump_price
            )
          `)
          .eq('status', 'APPROVED')
          .eq('client_id', order.client_id)
          .eq('construction_site', order.construction_site)
          .not('quote_details.pump_price', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (pumpServiceError) {
          console.error("Error fetching pump service pricing:", pumpServiceError);
          return;
        }
        
        // Find the first quote with pump service pricing
        if (pumpServiceData && pumpServiceData.length > 0) {
          const quoteWithPumpService = pumpServiceData.find(quote => 
            quote.quote_details.some((detail: any) => detail.pump_service && detail.pump_price)
          );
          
          if (quoteWithPumpService) {
            const pumpDetail = quoteWithPumpService.quote_details.find((detail: any) => 
              detail.pump_service && detail.pump_price
            );
            
            if (pumpDetail && pumpDetail.pump_price) {
              setPumpPrice(pumpDetail.pump_price);
              console.log(`Found pump service price: $${pumpDetail.pump_price} for client + site combination`);
            }
          }
        }
        
        // Fallback: If no pump pricing found, check if this order already has legacy pump service
        // and allow manual pricing for backward compatibility
        if (!pumpServiceData || pumpServiceData.length === 0) {
          console.log('No pump service pricing found in approved quotes for this client + site combination');
          console.log('Checking if order has existing pump service for fallback pricing...');
          
          // Check if order has any existing pump service pricing we can use as fallback
          const existingPumpItems = order.products?.filter(p => p.has_pump_service && p.pump_price) || [];
          if (existingPumpItems.length > 0) {
            const fallbackPrice = existingPumpItems[0].pump_price || 0; // Ensure it's a number
            setPumpPrice(fallbackPrice);
            console.log(`Using fallback pump price from existing order items: $${fallbackPrice}`);
          } else {
            // Set to 0 to allow manual entry for legacy orders
            setPumpPrice(0);
            console.log('No existing pump pricing found. Setting to 0 to allow manual entry.');
          }
        }
      } catch (err) {
        console.error('Error loading pump service pricing:', err);
        // Set to 0 to allow manual entry in case of any errors
        setPumpPrice(0);
      }
    };
    
    loadPumpServicePricing();
  }, [order?.client_id, order?.construction_site]);
  
  // Initialize pump service state when order loads
  useEffect(() => {
    if (order) {
      // Check if order has a global pump service item
      const globalPumpItem = order.products.find(p => 
        p.product_type === 'SERVICIO DE BOMBEO' || 
        (p.has_pump_service && p.quote_detail_id === null)
      );
      
      if (globalPumpItem) {
        // Use global pump service
        setHasPumpService(true);
        setPumpVolume(globalPumpItem.pump_volume || globalPumpItem.volume || 0);
      } else {
        // Check if order has any individual product pump service (legacy)
        const orderHasPumpService = order.products.some(p => p.has_pump_service && p.pump_volume);
        const totalPumpVolume = order.products.reduce((sum, p) => sum + (p.pump_volume || 0), 0);
        
        setHasPumpService(orderHasPumpService);
        setPumpVolume(totalPumpVolume);
      }
    }
  }, [order]);
  
  // Check if the user can approve/reject credit
  const canManageCredit = (isCreditValidator || isManager) && order?.credit_status !== 'approved' && order?.credit_status !== 'rejected';

  // Check if the order can be edited based on multiple conditions
  const canEditProducts = useMemo(() => {
    // Only allow editing products if there are no remisiones registered
    return !hasRemisiones;
  }, [hasRemisiones]);

  // Function to filter recipes based on filter criteria
  const getFilteredRecipes = useCallback(() => {
    if (!availableRecipes.length) return [];
    
    let filteredRecipes = [...availableRecipes];
    
    // Apply strength filter if selected
    if (strengthFilter !== '') {
      filteredRecipes = filteredRecipes.filter(recipe => 
        recipe.strength_fc === strengthFilter
      );
    }
    
    // Apply placement type filter if selected
    if (placementTypeFilter) {
      filteredRecipes = filteredRecipes.filter(recipe => 
        recipe.placement_type === placementTypeFilter
      );
    }

    // Apply slump filter if selected
    if (slumpFilter !== '') {
      filteredRecipes = filteredRecipes.filter(recipe => 
        recipe.slump === slumpFilter
      );
    }

    // Apply search filter if entered
    if (searchFilter) {
      const searchTerm = searchFilter.toLowerCase();
      filteredRecipes = filteredRecipes.filter(recipe => 
        recipe.recipe_code.toLowerCase().includes(searchTerm) ||
        (recipe.placement_type && recipe.placement_type.toLowerCase().includes(searchTerm)) ||
        (recipe.strength_fc && `${recipe.strength_fc}`.includes(searchTerm))
      );
    }
    
    return filteredRecipes;
  }, [availableRecipes, strengthFilter, placementTypeFilter, slumpFilter, searchFilter]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setStrengthFilter('');
    setPlacementTypeFilter('');
    setSlumpFilter('');
    setSearchFilter('');
  }, []);

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
      has_pump_service: hasPumpService,
      pump_volume: pumpVolume,
      products: order.products
        .filter(p => p.product_type !== 'SERVICIO DE BOMBEO') // Exclude global pump service items from product editing
        .map(p => ({ 
          id: p.id, 
          volume: p.volume,
          pump_volume: p.pump_volume,
          recipe_id: p.recipe_id,
          temp_recipe_code: p.product_type
        }))
    });
    
    // Load available recipes when entering edit mode
    loadAvailableRecipes();
    // Reset filters when starting to edit
    resetFilters();
  };

  // Function to load available recipes
  const loadAvailableRecipes = async () => {
    try {
      setLoadingRecipes(true);
      
      if (!order?.client_id || !order?.construction_site) {
        toast.error('No se pudo determinar el cliente o la obra para cargar las recetas');
        return;
      }
      
      console.log(`Fetching active price for Client: ${order.client_id}, Site: ${order.construction_site}`);
      
      // 1. Find the active product price for this client and site
      const { data: activePrices, error: activePriceError } = await supabase
        .from('product_prices')
        .select('quote_id, id, is_active, updated_at, recipe_id')
        .eq('client_id', order.client_id)
        .eq('construction_site', order.construction_site)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });
      
      if (activePriceError) {
        console.error("Error fetching active product prices:", activePriceError);
        toast.error('Error al cargar los precios activos para el cliente');
        return;
      }
      
      console.log('Active prices fetched:', activePrices);
      
      if (!activePrices || activePrices.length === 0) {
        console.log('No active prices/quotes found for this client/site.');
        setAvailableRecipes([]);
        return;
      }
      
      // Double-check that all prices are actually active
      const trulyActivePrices = activePrices.filter(price => price.is_active === true);
      console.log(`Found ${trulyActivePrices.length} truly active prices out of ${activePrices.length} returned prices`);
      
      if (trulyActivePrices.length === 0) {
        console.log('No prices with is_active=true found despite query filter.');
        setAvailableRecipes([]);
        return;
      }
      
      // Get unique quote IDs from truly active prices
      const uniqueQuoteIds = Array.from(new Set(trulyActivePrices.map(price => price.quote_id)));
      console.log('Unique quote IDs from active prices:', uniqueQuoteIds);
      
      // Create a set of active quote-recipe combinations
      // This ensures we only display recipes that are active for a specific quote
      const activeQuoteRecipeCombos = new Set(
        trulyActivePrices
          .filter(price => price.quote_id && price.recipe_id)
          .map(price => `${price.quote_id}:${price.recipe_id}`)
      );
      console.log('Active quote-recipe combinations:', Array.from(activeQuoteRecipeCombos));
      
      // 2. Fetch all quotes linked to active prices
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          quote_details(
            id,
            volume,
            final_price,
            pump_service,
            pump_price,
            recipe_id,
            recipes:recipe_id(
              id,
              recipe_code,
              strength_fc,
              placement_type,
              max_aggregate_size,
              age_days,
              slump
            )
          )
        `)
        .in('id', uniqueQuoteIds)
        .eq('status', 'APPROVED'); // Ensure the linked quotes are still approved
      
      if (quotesError) {
        console.error("Error fetching the linked quotes:", quotesError);
        toast.error('Error al cargar las cotizaciones vinculadas');
        return;
      }
      
      if (!quotesData || quotesData.length === 0) {
        console.log('No approved quotes found for the active prices.');
        setAvailableRecipes([]);
        return;
      }
      
      console.log('Successfully fetched linked quotes:', quotesData);
      
      // 3. Extract valid recipes from the quotes
      const validRecipes: any[] = [];
      const priceMap: Record<string, number> = {};
      
      quotesData.forEach(quoteData => {
        // Filter quote details to only include those with active quote-recipe combinations
        const activeDetails = quoteData.quote_details.filter((detail: any) => 
          // Check if this specific quote-recipe combination is in our active set
          activeQuoteRecipeCombos.has(`${quoteData.id}:${detail.recipe_id}`)
        );
        
        console.log(`Quote ${quoteData.quote_number}: filtered ${quoteData.quote_details.length} details to ${activeDetails.length} active details`);
        
        // Extract recipe information from the active details
        activeDetails.forEach((detail: any) => {
          // Skip if recipe is missing
          if (!detail.recipes) return;
          
          const recipeData = detail.recipes;
          
          // Add recipe to our list if it has all the data we need
          if (recipeData.id && recipeData.recipe_code) {
            validRecipes.push({
              id: recipeData.id,
              recipe_code: recipeData.recipe_code,
              strength_fc: recipeData.strength_fc || 0,
              placement_type: recipeData.placement_type || '',
              max_aggregate_size: recipeData.max_aggregate_size || 0,
              age_days: recipeData.age_days || 0,
              slump: recipeData.slump || 0,
              unit_price: detail.final_price || 0,  // Set price from the quote detail
            });
            
            // Also store the price in our map
            priceMap[recipeData.id] = detail.final_price || 0;
          }
        });
      });
      
      console.log(`Loaded ${validRecipes.length} recipes specific to this client and site`);
      
      setAvailableRecipes(validRecipes);
      setRecipePrices(priceMap);
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast.error('Error al cargar las recetas disponibles');
    } finally {
      setLoadingRecipes(false);
    }
  };

  function handleCancelEdit() {
    setIsEditing(false);
    setEditedOrder(null);
    resetFilters();
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

  function handleRecipeChange(id: string, newRecipeId: string) {
    if (!editedOrder || !editedOrder.products) return;
    
    // Find the recipe details
    const selectedRecipe = availableRecipes.find(r => r.id === newRecipeId);
    
    const updatedProducts = editedOrder.products.map(product => {
      if (product.id === id) {
        return { 
          ...product, 
          recipe_id: newRecipeId,
          temp_recipe_code: selectedRecipe?.recipe_code || ''
        };
      }
      return product;
    });
    
    setEditedOrder({
      ...editedOrder,
      products: updatedProducts
    });
  }

  // Function to get unique values for filter dropdowns
  const getUniqueFilterValues = useCallback((field: string) => {
    if (!availableRecipes.length) return [];
    
    const values = availableRecipes
      .map(recipe => recipe[field])
      .filter(value => value !== null && value !== undefined);
    
    return Array.from(new Set(values)).sort((a, b) => {
      // For numeric values like strength and slump
      if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
      }
      // For string values
      return String(a).localeCompare(String(b));
    });
  }, [availableRecipes]);

  // Función de utilidad para obtener el precio unitario correcto
  const getProductUnitPrice = (product: any) => {
    // Special case for empty truck charges
    if (product.has_empty_truck_charge || product.product_type === 'VACÍO DE OLLA') {
      return product.empty_truck_price || product.unit_price || 0;
    }
    
    // Normal case for products with recipe_id
    if (product?.recipe_id) {
      // Intentar obtener el precio de la receta seleccionada
      const recipePrice = recipePrices[product.recipe_id] || 0;
      
      // Si no tenemos un precio en nuestro mapa, usar el precio original del producto
      return recipePrice || (product.unit_price || 0);
    }
    
    // Fallback to unit_price for any other product
    return product.unit_price || 0;
  };

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
      
      // Manejar el servicio de bombeo global
      if (pumpPrice !== null) {
        // Buscar si ya existe un item de orden específico para bombeo global
        const existingPumpItem = order.products.find(p => 
          p.product_type === 'SERVICIO DE BOMBEO' || 
          (p.has_pump_service && p.quote_detail_id === null)
        );
        
        if (hasPumpService && pumpVolume > 0) {
          // Crear o actualizar el item de bombeo global
          if (existingPumpItem) {
            // Actualizar el item existente
            await orderService.updateOrderItem(existingPumpItem.id, {
              volume: pumpVolume,
              pump_volume: pumpVolume,
              total_price: pumpPrice * pumpVolume
            });
            
            // Actualizar también pump_volume_delivered para el recálculo automático
            const { error: updateDeliveredError } = await supabase
              .from('order_items')
              .update({ pump_volume_delivered: pumpVolume })
              .eq('id', existingPumpItem.id);
            
            if (updateDeliveredError) throw updateDeliveredError;
          } else {
            // Crear un nuevo item para el servicio de bombeo global
            const { error: pumpItemError } = await supabase
              .from('order_items')
              .insert({
                order_id: orderId,
                quote_detail_id: null,
                product_type: 'SERVICIO DE BOMBEO',
                volume: pumpVolume,
                unit_price: pumpPrice,
                total_price: pumpPrice * pumpVolume,
                has_pump_service: true,
                pump_price: pumpPrice,
                pump_volume: pumpVolume,
                pump_volume_delivered: pumpVolume // Agregar esto para el recálculo automático
              });
            
            if (pumpItemError) throw pumpItemError;
          }
        } else if (existingPumpItem) {
          // Eliminar el item de bombeo si ya no se necesita
          const { error: deletePumpError } = await supabase
            .from('order_items')
            .delete()
            .eq('id', existingPumpItem.id);
          
          if (deletePumpError) throw deletePumpError;
        }
      }
      
      // Actualizar los productos si han cambiado, no hay remisiones y el estatus es 'created'
      if (editedOrder.products && 
          editedOrder.products.length > 0 && 
          !hasRemisiones) {
        console.log('No remisiones found, attempting to update items...');
        const updates = editedOrder.products.map(product => {
          const originalProduct = order.products.find(p => p.id === product.id);
          
          // Solo actualizar si los valores han cambiado
          if (originalProduct && 
              (originalProduct.volume !== product.volume || 
               originalProduct.pump_volume !== product.pump_volume ||
               originalProduct.recipe_id !== product.recipe_id)) {
               
             console.log(`Updating item ${product.id} - Volume: ${product.volume}, Pump Volume: ${product.pump_volume}, Recipe: ${product.recipe_id}`);
             
             // Find the recipe details if recipe has changed
             let productType = originalProduct.product_type;
             let unitPrice = originalProduct.unit_price;
             
             if (originalProduct.recipe_id !== product.recipe_id && product.recipe_id) {
               const selectedRecipe = availableRecipes.find(r => r.id === product.recipe_id);
               if (selectedRecipe) {
                 productType = selectedRecipe.recipe_code;
                 // Obtener el precio actualizado para la nueva receta
                 unitPrice = selectedRecipe.unit_price || originalProduct.unit_price;
               }
             }
             
             // Calcular el nuevo precio total basado en el volumen y el precio unitario
             const newTotalPrice = unitPrice * product.volume;
             
            return orderService.updateOrderItem(product.id, {
              volume: product.volume,
              pump_volume: product.pump_volume,
              // Si cambió el tipo de receta, actualizar el recipe_id y product_type
              ...(originalProduct.recipe_id !== product.recipe_id && product.recipe_id ? {
                product_type: productType,
                unit_price: unitPrice,
                total_price: newTotalPrice,
                recipe_id: product.recipe_id // Agregar recipe_id directamente en el item
              } : {
                // Si solo cambió el volumen, actualizar solo el precio total
                total_price: unitPrice * product.volume
              })
            });
          }
          return Promise.resolve();
        });
        
        await Promise.all(updates);
      } else {
          console.log(`Skipping item update. Has remisiones: ${hasRemisiones}`);
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
    // Credit validators typically don't need to see financial info, but managers do
    const canSeeFinancialInfo = hasRole(['EXECUTIVE', 'PLANT_MANAGER'] as UserRole[]);
    console.log('OrderDetails Debug - shouldShowFinancialInfo:', {
      profileRole: profile?.role,
      isDosificador,
      canSeeFinancialInfo,
      result: canSeeFinancialInfo
    });
    return canSeeFinancialInfo;
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

  // Log para depuración cuando cambien los allowedRecipeIds
  useEffect(() => {
    if (allowedRecipeIds.length > 0) {
      console.log('OrderDetails: allowedRecipeIds actualizados:', allowedRecipeIds);
    }
  }, [allowedRecipeIds]);

  // Function to handle recalculation of order final amount
  async function handleRecalculateAmount() {
    if (!order) return;
    
    try {
      setIsRecalculating(true);
      const result = await orderService.recalculateOrderAmount(order.id);
      toast.success(result.message || 'Monto final recalculado correctamente');
      
      // Reload order details to show updated amounts
      await loadOrderDetails();
    } catch (error) {
      console.error('Error recalculating order amount:', error);
      toast.error('Error al recalcular el monto: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsRecalculating(false);
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

  // Get filtered recipes
  const filteredRecipes = getFilteredRecipes();

  // Count recipes before and after filtering
  const totalRecipeCount = availableRecipes.length;
  const filteredRecipeCount = filteredRecipes.length;

  // Render the action buttons section with Payment Dialog
  const renderOrderActions = () => {
    // Check for roles that can edit most things
    const managerOrFinance = hasRole(['EXECUTIVE', 'PLANT_MANAGER'] as UserRole[]);
    
    // For delete action
    const canDeleteOrder = managerOrFinance && order && !hasRemisiones && order.order_status !== 'cancelled';
    
    // Debug: Log button visibility logic
    console.log('OrderDetails Debug - renderOrderActions:', {
      profile,
      hasRole_CREDIT_VALIDATOR: hasRole('CREDIT_VALIDATOR'),
      hasRole_Array: hasRole(['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'CREDIT_VALIDATOR']),
      managerOrFinance,
      canDeleteOrder,
      order: !!order,
      hasRemisiones,
      orderStatus: order?.order_status
    });
    
    // Menu of actions
    return (
      <div className="flex flex-wrap gap-2 mb-6 justify-end">
        {/* Debug info - temporary */}
        {profile?.role === 'CREDIT_VALIDATOR' && (
          <div className="w-full p-2 bg-yellow-100 border border-yellow-300 rounded text-xs">
            <strong>Debug Info for CREDIT_VALIDATOR:</strong><br/>
            Profile Role: {profile?.role}<br/>
            Has CREDIT_VALIDATOR Role: {hasRole('CREDIT_VALIDATOR') ? 'YES' : 'NO'}<br/>
            Has Array Role: {hasRole(['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'CREDIT_VALIDATOR']) ? 'YES' : 'NO'}
          </div>
        )}
        
        {/* Edit Order button */}
        {canEditOrder && !isEditing && (
          <Button
            onClick={handleEditClick}
            className="px-3 py-2 rounded text-sm bg-blue-600 text-white hover:bg-blue-700"
          >
            Editar Orden
          </Button>
        )}
        
        {/* Recalculate button with role protection */}
        <RoleProtectedButton
          allowedRoles={['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'CREDIT_VALIDATOR'] as UserRole[]}
          onClick={handleRecalculateAmount}
          disabled={isRecalculating}
          className="px-3 py-2 rounded text-sm bg-white border border-gray-300 hover:bg-gray-50"
          showDisabled={true}
          disabledMessage="No tienes permiso para recalcular"
        >
          {isRecalculating ? (
            <>
              <span className="animate-spin mr-2">◌</span>
              Recalculando...
            </>
          ) : (
            <>
              <CalculatorIcon className="w-4 h-4 mr-2" />
              Recalcular
            </>
          )}
        </RoleProtectedButton>
        
        {/* Delete Order button */}
        {canDeleteOrder && (
          <RoleProtectedButton
            allowedRoles={['EXECUTIVE', 'PLANT_MANAGER'] as UserRole[]}
            onClick={() => setShowConfirmDelete(true)}
            disabled={isDeleting}
            className="px-3 py-2 rounded text-sm bg-red-600 text-white hover:bg-red-700"
          >
            {isDeleting ? 'Eliminando...' : 'Eliminar Orden'}
          </RoleProtectedButton>
        )}
        
        {/* Allow adding payments for roles with FINANCE permission */}
        {shouldShowFinancialInfo() && order?.client_id && (
          <RoleProtectedButton
            allowedRoles={['EXECUTIVE', 'PLANT_MANAGER'] as UserRole[]}
            onClick={() => setIsPaymentDialogOpen(true)}
            className="px-3 py-2 rounded text-sm bg-white border border-gray-300 hover:bg-gray-50"
          >
            Registrar Pago
          </RoleProtectedButton>
        )}
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
                      {/* Credit buttons removed to avoid duplication - actions available in the bottom actions section */}
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
                    {/* Buttons removed to avoid duplication - actions are available in the bottom actions section */}
                  </div>
                </div>

                <div className="px-4 py-5 sm:px-6 bg-gray-50">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">Productos</h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">
                          {isEditing && canEditProducts ? "Receta / Producto" : "Producto"}
                        </TableHead>
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
                      {isEditing && canEditProducts
                      ? (editedOrder?.products || []).map((product) => {
                          const originalProduct = order.products.find(p => p.id === product.id);
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">
                                {loadingRecipes ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent"></div>
                                    <span>Cargando...</span>
                                  </div>
                                ) : (
                                  <>
                                    {/* Filter controls for recipes */}
                                    <div className="mb-3">
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        <input
                                          type="text"
                                          placeholder="Buscar receta..."
                                          value={searchFilter}
                                          onChange={(e) => setSearchFilter(e.target.value)}
                                          className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                                        />
                                      </div>
                                      <div className="flex flex-wrap gap-2 mb-2">
                                        <select
                                          className="text-xs px-2 py-1 border border-gray-300 rounded-md"
                                          onChange={(e) => setStrengthFilter(e.target.value ? Number(e.target.value) : '')}
                                          value={strengthFilter}
                                        >
                                          <option value="">Resistencia</option>
                                          {getUniqueFilterValues('strength_fc').map((strength) => (
                                            <option key={strength} value={strength}>{strength} kg/cm²</option>
                                          ))}
                                        </select>
                                        
                                        <select
                                          className="text-xs px-2 py-1 border border-gray-300 rounded-md"
                                          onChange={(e) => setSlumpFilter(e.target.value ? Number(e.target.value) : '')}
                                          value={slumpFilter}
                                        >
                                          <option value="">Revenimiento</option>
                                          {getUniqueFilterValues('slump').map((slump) => (
                                            <option key={slump} value={slump}>{slump} cm</option>
                                          ))}
                                        </select>
                                        
                                        <select
                                          className="text-xs px-2 py-1 border border-gray-300 rounded-md"
                                          onChange={(e) => setPlacementTypeFilter(e.target.value)}
                                          value={placementTypeFilter}
                                        >
                                          <option value="">Tipo colocación</option>
                                          {getUniqueFilterValues('placement_type').map((type) => (
                                            <option key={type} value={type}>{type}</option>
                                          ))}
                                        </select>
                                      </div>
                                      
                                      {(strengthFilter !== '' || placementTypeFilter || slumpFilter !== '' || searchFilter) && (
                                        <div className="flex justify-between items-center text-xs mb-2">
                                          <span className="text-gray-600">
                                            Mostrando {filteredRecipeCount} de {totalRecipeCount} recetas
                                          </span>
                                          <button
                                            onClick={resetFilters}
                                            className="text-blue-600 hover:text-blue-800"
                                          >
                                            Limpiar filtros
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <select
                                      value={product.recipe_id || ''}
                                      onChange={(e) => handleRecipeChange(product.id, e.target.value)}
                                      className="w-full px-2 py-1 border border-gray-300 rounded-md"
                                      disabled={loadingRecipes}
                                    >
                                      <option value="" disabled>Seleccionar receta</option>
                                      {filteredRecipes.map((recipe) => (
                                        <option key={recipe.id} value={recipe.id}>
                                          {recipe.recipe_code} - {recipe.strength_fc}kg/cm² {recipe.slump}cm {recipe.age_days}d {shouldShowFinancialInfo() ? `(${formatCurrency(recipe.unit_price || 0)})` : ''}
                                        </option>
                                      ))}
                                    </select>
                                  </>
                                )}
                                {product.recipe_id && originalProduct?.recipe_id && product.recipe_id !== originalProduct?.recipe_id && (
                                  <div className="mt-1 text-xs text-green-600 font-medium">
                                    Producto cambiado
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={product.volume}
                                  onChange={(e) => handleProductVolumeChange(product.id, parseFloat(e.target.value) || 0)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded-md"
                                />
                                <span className="ml-1">m³</span>
                              </TableCell>
                              <TableCell>
                                {originalProduct?.has_pump_service ? (
                                  <>
                                    <span className="mr-2">Sí -</span>
                                    <input
                                      type="number"
                                      min="0.01"
                                      step="0.01"
                                      value={product.pump_volume || 0}
                                      onChange={(e) => handlePumpVolumeChange(product.id, parseFloat(e.target.value) || 0)}
                                      className="w-20 px-2 py-1 border border-gray-300 rounded-md"
                                    />
                                    <span className="ml-1">m³</span>
                                  </>
                                ) : (
                                  'No'
                                )}
                              </TableCell>
                              {shouldShowFinancialInfo() && originalProduct && (
                                <>
                                  <TableCell className="text-right">{formatCurrency(getProductUnitPrice(product))}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(getProductUnitPrice(product) * product.volume)}</TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })
                      : order.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">
                            {product.product_type === 'SERVICIO DE BOMBEO' ? (
                              <span className="text-blue-600 font-semibold">
                                {product.product_type} (Global)
                              </span>
                            ) : (
                              product.product_type
                            )}
                          </TableCell>
                          <TableCell>{product.volume} m³</TableCell>
                          <TableCell>
                            {product.product_type === 'SERVICIO DE BOMBEO' ? (
                              <span className="text-blue-600">Global</span>
                            ) : product.has_pump_service ? 
                              `Sí - ${product.pump_volume} m³` : 
                              'No'}
                          </TableCell>
                          {shouldShowFinancialInfo() && (
                            <>
                              <TableCell className="text-right">{formatCurrency(getProductUnitPrice(product))}</TableCell>
                              <TableCell className="text-right">{formatCurrency(getProductUnitPrice(product) * product.volume)}</TableCell>
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
                    {!canEditProducts && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                        <div className="flex">
                          <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                              {hasRemisiones 
                                ? "Esta orden ya tiene remisiones registradas. No se pueden modificar las recetas ni los volúmenes de los productos."
                                : "Solo puedes cambiar la fecha y hora de entrega, los requisitos especiales y si requiere factura."}
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
                    
                    {/* Global Pumping Service */}
                    {pumpPrice !== null && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center mb-3">
                          <input 
                            id="hasPumpService"
                            type="checkbox"
                            checked={hasPumpService}
                            onChange={(e) => {
                              setHasPumpService(e.target.checked);
                              if (e.target.checked && pumpVolume === 0) {
                                // Set default pump volume to total concrete volume
                                const totalVolume = editedOrder?.products?.reduce((sum, p) => sum + p.volume, 0) || 0;
                                setPumpVolume(totalVolume);
                              }
                            }}
                            className="h-5 w-5 text-blue-600 rounded border-gray-300"
                          />
                          <label htmlFor="hasPumpService" className="ml-2 block text-base font-medium text-gray-800">
                            Servicio de Bombeo Global
                          </label>
                        </div>
                        
                        {hasPumpService && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 pl-7">
                            <div>
                              <label htmlFor="pumpVolume" className="block text-sm font-medium text-gray-700 mb-1">
                                Volumen a bombear (m³)
                              </label>
                              <input 
                                id="pumpVolume"
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={pumpVolume}
                                onChange={(e) => setPumpVolume(parseFloat(e.target.value))}
                                className="w-full rounded-md border border-gray-300 px-3 py-2"
                              />
                            </div>
                            <div>
                              <label htmlFor="pumpPrice" className="block text-sm font-medium text-gray-700 mb-1">
                                Precio por m³
                              </label>
                              {pumpPrice > 0 ? (
                                <div className="w-full rounded-md border border-gray-300 px-3 py-2 bg-gray-100 text-gray-700">
                                  ${pumpPrice?.toFixed(2) || '0.00'}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <input 
                                    id="pumpPrice"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={pumpPrice || ''}
                                    onChange={(e) => setPumpPrice(parseFloat(e.target.value) || 0)}
                                    placeholder="Ingrese precio de bombeo"
                                    className="w-full rounded-md border border-yellow-400 px-3 py-2 bg-yellow-50"
                                  />
                                  <p className="text-xs text-amber-600">
                                    ⚠️ No se encontró precio de bombeo para este cliente/sitio. Ingrese manualmente.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <p className="text-xs text-gray-600 mt-2">
                          {pumpPrice > 0 
                            ? "El servicio de bombeo se cobra globalmente para este cliente y sitio de construcción"
                            : "Precio manual requerido - no hay cotizaciones con bombeo para este cliente/sitio"}
                        </p>
                      </div>
                    )}
                    
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

          {/* Always show order actions, not just for financial users */}
          {renderOrderActions()}

          {shouldShowFinancialInfo() && (
            <div className="mt-6 border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Información Financiera</h2>
              
              <OrderDetailsBalance
                orderId={orderId}
                clientId={order.client_id}
                constructionSite={order.construction_site}
              />
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