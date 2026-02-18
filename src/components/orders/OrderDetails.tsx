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
import { useUnifiedAuthBridge } from '@/adapters/unified-auth-bridge';
import type { UserRole } from '@/store/auth/types';
import { renderTracker } from '@/lib/performance/renderTracker';
import { formatTimestamp } from '@/lib/utils';
import RegistroRemision from '@/components/remisiones/RegistroRemision';
import RemisionesList, { formatRemisionesForAccounting } from '@/components/remisiones/RemisionesList';
import OrderDetailsBalance from './OrderDetailsBalance';
import PaymentForm from '../clients/PaymentForm';
import ClientBalanceSummary from '../clients/ClientBalanceSummary';
import { Button } from '@/components/ui/button';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';

// Component to handle signed URL fetching for evidence images
function EvidenceImage({ path }: { path: string }) {
  const [imageUrl, setImageUrl] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  
  React.useEffect(() => {
    const loadImage = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const cleanPath = path.replace('site-validation-evidence/', '');
        const { data, error } = await supabase.storage
          .from('site-validation-evidence')
          .createSignedUrl(cleanPath, 3600); // 1 hour expiry
        
        if (data?.signedUrl) {
          setImageUrl(data.signedUrl);
        } else if (error) {
          console.error('Error loading evidence image:', error);
        }
      } catch (err) {
        console.error('Error creating signed URL:', err);
      } finally {
        setLoading(false);
      }
    };
    loadImage();
  }, [path]);
  
  if (loading) {
    return <div className="w-16 h-16 bg-gray-200 rounded border animate-pulse" />;
  }
  
  if (!imageUrl) {
    return null;
  }
  
  return (
    <img 
      src={imageUrl} 
      alt="Evidencia" 
      className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-80" 
      onClick={() => window.open(imageUrl, '_blank')}
    />
  );
}
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
import { Copy, CalculatorIcon, Beaker, FileText } from 'lucide-react';
import QualityOverview from './QualityOverview';
import { toast } from 'sonner';
import CreditContextPanel from '@/components/credit/CreditContextPanel';
import { supabase } from '@/lib/supabase';
import { masterRecipeService } from '@/lib/services/masterRecipeService';

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
    quote_detail_id?: string | null;
  }>;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_google_maps_url?: string | null;
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
  const { profile, hasRole } = useUnifiedAuthBridge({ preferUnified: true });
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editedOrder, setEditedOrder] = useState<EditableOrderData | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isRejectReasonModalOpen, setIsRejectReasonModalOpen] = useState<boolean>(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'details' | 'remisiones' | 'calidad'>('details');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [clientSites, setClientSites] = useState<ConstructionSite[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);
  const [clientBalances, setClientBalances] = useState<ClientBalance[]>([]);
  const [hasRemisiones, setHasRemisiones] = useState<boolean>(false);
  const [remisionesData, setRemisionesData] = useState<any[]>([]);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApprovingCredit, setIsApprovingCredit] = useState(false);
  const [isRejectingCredit, setIsRejectingCredit] = useState(false);
  const [availableRecipes, setAvailableRecipes] = useState<any[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [recipePrices, setRecipePrices] = useState<Record<string, number>>({});
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);
  const [recipeToQuoteDetailMap, setRecipeToQuoteDetailMap] = useState<Record<string, { quote_id: string, quote_detail_id: string, unit_price: number }>>({});
  
  // Recipe filter states - Added for filtering functionality
  const [strengthFilter, setStrengthFilter] = useState<number | ''>('');
  const [placementTypeFilter, setPlacementTypeFilter] = useState<string>('');
  const [slumpFilter, setSlumpFilter] = useState<number | ''>('');
  const [searchFilter, setSearchFilter] = useState<string>('');
  
  // Global pump service states
  const [hasPumpService, setHasPumpService] = useState<boolean>(false);
  const [pumpVolume, setPumpVolume] = useState<number>(0);
  const [pumpPrice, setPumpPrice] = useState<number | null>(null);
  // Empty truck adder state
  const emptyTruckExists = useMemo(() => {
    return (order?.products || []).some(p => p.product_type === 'VACÍO DE OLLA' || p.has_empty_truck_charge);
  }, [order?.products]);
  const [showEmptyTruckAdder, setShowEmptyTruckAdder] = useState(false);
  const [emptyTruckVolumeDraft, setEmptyTruckVolumeDraft] = useState<number>(1);
  const [emptyTruckPriceDraft, setEmptyTruckPriceDraft] = useState<number>(0);
  
  // Additional products state
  interface AdditionalProduct {
    id: string;
    quoteAdditionalProductId: string;
    additionalProductId: string;
    name: string;
    code: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    quoteId: string;
  }
  const [availableAdditionalProducts, setAvailableAdditionalProducts] = useState<AdditionalProduct[]>([]);
  const [selectedAdditionalProducts, setSelectedAdditionalProducts] = useState<Set<string>>(new Set());
  const [loadingAdditionalProducts, setLoadingAdditionalProducts] = useState(false);
  
  // Per-row recipe editor toggle (collapsed by default)
  const [editingRecipeMap, setEditingRecipeMap] = useState<Record<string, boolean>>({});
  const isEditingRecipe = useCallback((id: string) => !!editingRecipeMap[id], [editingRecipeMap]);
  const openRecipeEditor = useCallback((id: string) => setEditingRecipeMap(m => ({ ...m, [id]: true })), []);
  const closeRecipeEditor = useCallback((id: string) => setEditingRecipeMap(m => { const n = { ...m }; delete n[id]; return n; }), []);
  
  // Track render performance for OrderDetails component
  useEffect(() => {
    const finishRender = renderTracker.trackRender('OrderDetails', 'order-data-change', undefined, {
      orderId,
      hasOrder: !!order,
      hasProfile: !!profile,
      orderStatus: order?.order_status,
      isLoading: loading,
      isEditing,
      hasRemisiones,
      productsCount: order?.products?.length || 0,
    });
    finishRender();
  }, [orderId, order, profile, loading, isEditing, hasRemisiones]);

  // Calculate allowed recipe IDs including variants under master items
  const [allowedRecipeIds, setAllowedRecipeIds] = useState<string[]>([]);

  useEffect(() => {
    const loadAllowed = async () => {
      if (!order?.products || order.products.length === 0) {
        setAllowedRecipeIds([]);
        return;
      }

      const recipeIds = new Set<string>();

      // Direct recipe_id items
      for (const p of order.products as any[]) {
        if (p.recipe_id) recipeIds.add(p.recipe_id);
      }

      // Expand master items to all variant recipe IDs
      const masterIds = Array.from(
        new Set(
          (order.products as any[])
            .map(p => (p as any).master_recipe_id)
            .filter(Boolean)
        )
      ) as string[];

      for (const masterId of masterIds) {
        try {
          const { variants } = await masterRecipeService.getMasterRecipeWithVariants(masterId);
          for (const v of variants) {
            if (v?.id) recipeIds.add(v.id);
          }
        } catch (e) {
          console.error('Error loading variants for master', masterId, e);
        }
      }

      setAllowedRecipeIds(Array.from(recipeIds));
    };

    loadAllowed();
  }, [order?.products]);
  
  // Check if user is a credit validator or manager
  const isCreditValidator = profile?.role === 'CREDIT_VALIDATOR' as UserRole;
  const isManager = profile?.role === 'EXECUTIVE' as UserRole || profile?.role === 'PLANT_MANAGER' as UserRole;
  const isCreator = useMemo(() => {
    try {
      return Boolean((order as any)?.created_by && profile?.id && (order as any).created_by === profile?.id);
    } catch {
      return false;
    }
  }, [order, profile?.id]);
  
  // Check if user has the Dosificador role
  const isDosificador = profile?.role === 'DOSIFICADOR' as UserRole;
  
  // Check if the order can be edited: Not allowed if completed, cancelled, or by Dosificador
  const canEditOrder = order && 
    order.order_status !== 'completed' && 
    order.order_status !== 'cancelled' &&
    !isDosificador;
  
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
      // Use DOSIFICADOR function for DOSIFICADOR role, otherwise use regular function
      let data;
      if (isDosificador) {
        const { getOrderDetailsForDosificador } = await import('@/lib/supabase/orders');
        data = await getOrderDetailsForDosificador(orderId);

        // Transform DOSIFICADOR data structure to match OrderWithDetails
        if (data && (data as any).order_items) {
          const transformedData = {
            ...data,
            site_access_rating: (data as any).site_access_rating,
            order_site_validations: (data as any).order_site_validations,
            client: (data as any).clients || (data as any).client,
            products: (data as any).order_items.map((item: any) => ({
              id: item.id,
              order_id: item.order_id,
              product_type: item.product_type,
              volume: item.volume,
              unit_price: item.unit_price,
              total_price: item.total_price,
              has_pump_service: item.has_pump_service,
              pump_price: item.pump_price,
              pump_volume: item.pump_volume,
              has_empty_truck_charge: item.has_empty_truck_charge,
              empty_truck_volume: item.empty_truck_volume,
              empty_truck_price: item.empty_truck_price,
              quote_detail_id: item.quote_detail_id,
              recipe_id: item.recipe_id,
              created_at: item.created_at,
              concrete_volume_delivered: item.concrete_volume_delivered,
              pump_volume_delivered: item.pump_volume_delivered
            }))
          };
          
          data = transformedData;
        }
      } else {
        data = await orderService.getOrderById(orderId);
      }
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

  const handleEditClick = async () => {
    if (!canEditOrder || !order) {
      return;
    }
    
    setIsEditing(true);
    setEditedOrder({
      delivery_date: order.delivery_date,
      delivery_time: order.delivery_time,
      requires_invoice: order.requires_invoice,
      special_requirements: order.special_requirements || null,
      delivery_latitude: (order as any).delivery_latitude ?? null,
      delivery_longitude: (order as any).delivery_longitude ?? null,
      delivery_google_maps_url: (order as any).delivery_google_maps_url ?? '',
      has_pump_service: hasPumpService,
      pump_volume: pumpVolume,
      products: order.products
        .filter(p => p.product_type !== 'SERVICIO DE BOMBEO') // Exclude global pump service items from product editing
        .map(p => { 
          const masterId = (p as any).master_recipe_id || null;
          return ({ 
            id: p.id, 
            volume: p.volume,
            pump_volume: p.pump_volume,
            recipe_id: p.recipe_id || masterId || null,
            master_recipe_id: masterId,
            temp_recipe_code: p.product_type
          });
        })
    });
    
    // Load available recipes when entering edit mode
    loadAvailableRecipes();
    // Load available additional products
    await loadAvailableAdditionalProducts();
    
    // Initialize selected additional products from existing order items
    const existingAdditionalProducts = order.products.filter(p => 
      p.product_type?.startsWith('PRODUCTO ADICIONAL:')
    );
    
    // Match existing products to available products by name/code
    // We'll need to match them after loading, so we'll do this in a useEffect
    // For now, set empty and let the useEffect handle matching
    setSelectedAdditionalProducts(new Set());
    
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
      
      const plantId = order.plant_id;
      console.log(`Fetching active prices for Client: ${order.client_id}, Site: ${order.construction_site}, Plant: ${plantId}`);
      
      // 1. Find the active product prices (master-first with recipe fallback)
      // IMPORTANT: Filter by plant_id to ensure we only get prices from the order's plant
      let activePricesQuery = supabase
        .from('product_prices')
        .select('quote_id, id, is_active, updated_at, master_recipe_id, recipe_id, plant_id')
        .eq('client_id', order.client_id)
        .eq('construction_site', order.construction_site)
        .eq('is_active', true);
      
      // Add plant_id filter if available
      if (plantId) {
        activePricesQuery = activePricesQuery.eq('plant_id', plantId);
      }
      
      const { data: activePrices, error: activePriceError } = await activePricesQuery
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
      
      const trulyActivePrices = activePrices.filter(price => price.is_active === true);
      console.log(`Found ${trulyActivePrices.length} truly active prices out of ${activePrices.length} returned prices`);
      
      if (trulyActivePrices.length === 0) {
        console.log('No prices with is_active=true found despite query filter.');
        setAvailableRecipes([]);
        return;
      }
      
      // Build active quote-master combinations from both master-level and recipe-mapped prices
      // IMPORTANT: Only include the MOST RECENT quote for each product (by updated_at)
      const activeQuoteMasterCombos = new Set<string>();
      
      // Direct master prices - only keep the most recent quote per master_recipe_id
      const masterPricesMap = new Map<string, any>();
      trulyActivePrices
        .filter((price: any) => price.quote_id && price.master_recipe_id)
        .forEach((price: any) => {
          const key = price.master_recipe_id;
          // Since trulyActivePrices is already ordered by updated_at DESC, first occurrence is most recent
          if (!masterPricesMap.has(key)) {
            masterPricesMap.set(key, price);
          }
        });
      
      // Add only the most recent quote for each master
      masterPricesMap.forEach((price: any) => {
        activeQuoteMasterCombos.add(`${price.quote_id}:${price.master_recipe_id}`);
      });
      
      // Recipe-level prices mapped to masters
      const recipeIdsNeedingMaster = Array.from(
        new Set(
          trulyActivePrices
            .filter((price: any) => price.recipe_id && !price.master_recipe_id)
            .map((price: any) => price.recipe_id)
        )
      );
      
      let recipeIdToMasterId: Record<string, string> = {};
      if (recipeIdsNeedingMaster.length > 0) {
        const { data: recipeRows, error: recipeErr } = await supabase
          .from('recipes')
          .select('id, master_recipe_id')
          .in('id', recipeIdsNeedingMaster);
        if (!recipeErr && recipeRows) {
          for (const r of recipeRows as any[]) {
            if (r.master_recipe_id) {
              recipeIdToMasterId[r.id] = r.master_recipe_id;
            }
          }
        }
      }
      
      // Add combos for recipe-based prices that have a master mapping - only most recent per master
      const recipeMappedMasterPricesMap = new Map<string, any>();
      trulyActivePrices
        .filter((price: any) => price.quote_id && price.recipe_id && recipeIdToMasterId[price.recipe_id])
        .forEach((price: any) => {
          const masterId = recipeIdToMasterId[price.recipe_id];
          // Since trulyActivePrices is already ordered by updated_at DESC, first occurrence is most recent
          if (!recipeMappedMasterPricesMap.has(masterId)) {
            recipeMappedMasterPricesMap.set(masterId, price);
          }
        });
      
      // Add only the most recent quote for each master (from recipe-mapped prices)
      recipeMappedMasterPricesMap.forEach((price: any) => {
        const masterId = recipeIdToMasterId[price.recipe_id];
        activeQuoteMasterCombos.add(`${price.quote_id}:${masterId}`);
      });
      
      // Build recipe fallback pairs for recipes without master - only most recent per recipe
      const activeQuoteRecipeFallbackCombos = new Set<string>();
      const recipeFallbackPricesMap = new Map<string, any>();
      trulyActivePrices
        .filter((price: any) => price.quote_id && price.recipe_id && !recipeIdToMasterId[price.recipe_id] && !price.master_recipe_id)
        .forEach((price: any) => {
          const key = price.recipe_id;
          // Since trulyActivePrices is already ordered by updated_at DESC, first occurrence is most recent
          if (!recipeFallbackPricesMap.has(key)) {
            recipeFallbackPricesMap.set(key, price);
          }
        });
      
      // Add only the most recent quote for each recipe (fallback)
      recipeFallbackPricesMap.forEach((price: any) => {
        activeQuoteRecipeFallbackCombos.add(`${price.quote_id}:${price.recipe_id}`);
      });
      
      console.log('Active quote-master combinations:', Array.from(activeQuoteMasterCombos));
      console.log('Active quote-recipe FALLBACK combinations:', Array.from(activeQuoteRecipeFallbackCombos));
      
      // Get unique quote IDs from the most recent prices only (not all active prices)
      const mostRecentQuoteIds = new Set<string>();
      masterPricesMap.forEach((price: any) => mostRecentQuoteIds.add(price.quote_id));
      recipeMappedMasterPricesMap.forEach((price: any) => mostRecentQuoteIds.add(price.quote_id));
      recipeFallbackPricesMap.forEach((price: any) => mostRecentQuoteIds.add(price.quote_id));
      
      const uniqueQuoteIds = Array.from(mostRecentQuoteIds).filter(Boolean);
      console.log('Most recent quote IDs from filtered prices:', Array.from(mostRecentQuoteIds));
      console.log('Unique quote IDs (most recent only):', uniqueQuoteIds);
      
      // Check if the order's quote_id is in the list (important for debugging)
      if ((order as any)?.quote_id && !uniqueQuoteIds.includes((order as any).quote_id)) {
        console.warn(`Order's quote_id ${(order as any).quote_id} is NOT in active prices list - will include it anyway to ensure all quote masters are available`);
        uniqueQuoteIds.push((order as any).quote_id);
      }
      
      // 2. Fetch all quotes with master and recipe joins (plant-scoped)
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
            master_recipe_id,
            recipe_id,
            master_recipes:master_recipe_id(
              id,
              plant_id,
              master_code,
              strength_fc,
              slump,
              age_days,
              placement_type,
              max_aggregate_size
            ),
            recipes:recipe_id(
              plant_id,
              recipe_code,
              strength_fc,
              placement_type,
              max_aggregate_size,
              age_days,
              slump,
              master_recipe_id,
              master_recipes:master_recipe_id(
                id,
                plant_id,
                master_code,
                strength_fc,
                slump,
                age_days,
                placement_type,
                max_aggregate_size
              )
            )
          )
        `)
        .in('id', uniqueQuoteIds)
        .eq('status', 'APPROVED');
      
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
      
      // 3. Extract valid recipes/masters from the quotes
      const validRecipes: any[] = [];
      const priceMap: Record<string, number> = {};
      const rToQDMap: Record<string, { quote_id: string, quote_detail_id: string, unit_price: number }> = {};
      const seenIds = new Set<string>(); // Track IDs to avoid duplicates
      
      quotesData.forEach(quoteData => {
        const activeDetails = quoteData.quote_details.filter((detail: any) => {
          // Master-based: STRICT - only allow if this exact quote-master combo is in our active set
          // This ensures we only show prices from the MOST RECENT quote per master
          if (detail.master_recipe_id && detail.master_recipes) {
            const hasActivePrice = activeQuoteMasterCombos.has(`${quoteData.id}:${detail.master_recipe_id}`);
            const plantMatches = detail.master_recipes.plant_id === plantId;
            // STRICT: Only include if this exact quote-master combo has an active price
            return plantMatches && hasActivePrice;
          }
          // Recipe-mapped to master: STRICT - only allow if this exact quote-master combo is active
          if (detail.recipe_id && detail.recipes && detail.recipes.master_recipe_id) {
            const hasActivePrice = detail.recipes.master_recipes && 
                                   activeQuoteMasterCombos.has(`${quoteData.id}:${detail.recipes.master_recipe_id}`);
            const plantMatches = detail.recipes.master_recipes?.plant_id === plantId;
            // STRICT: Only include if this exact quote-master combo has an active price
            return plantMatches && hasActivePrice;
          }
          // Recipe fallback: check plant and fallback pair
          if (detail.recipe_id && detail.recipes && !detail.recipes.master_recipe_id) {
            return detail.recipes.plant_id === plantId && activeQuoteRecipeFallbackCombos.has(`${quoteData.id}:${detail.recipe_id}`);
          }
          return false;
        });
        
        console.log(`Quote ${quoteData.quote_number}: filtered ${quoteData.quote_details.length} details to ${activeDetails.length} active details`);
        
        activeDetails.forEach((detail: any) => {
          // Master-based or recipe-mapped-to-master
          if ((detail.master_recipe_id && detail.master_recipes) || (detail.recipes && detail.recipes.master_recipes)) {
            const masterData = detail.master_recipes || detail.recipes?.master_recipes;
            if (masterData && masterData.master_code && masterData.id) {
              // Skip if we've already added this master ID
              if (seenIds.has(masterData.id)) {
                console.log(`Skipping duplicate master ID: ${masterData.id}`);
                return;
              }
              seenIds.add(masterData.id);
              validRecipes.push({
                id: masterData.id,
                recipe_code: masterData.master_code,
                strength_fc: masterData.strength_fc || 0,
                placement_type: masterData.placement_type || '',
                max_aggregate_size: masterData.max_aggregate_size || 0,
                age_days: masterData.age_days || 0,
                slump: masterData.slump || 0,
                unit_price: detail.final_price || 0,
              });
              priceMap[masterData.id] = detail.final_price || 0;
              rToQDMap[masterData.id] = { 
                quote_id: quoteData.id, 
                quote_detail_id: detail.id, 
                unit_price: detail.final_price || 0 
              };
            }
          }
          // Recipe fallback (no master)
          else if (detail.recipe_id && detail.recipes) {
            const recipeData = detail.recipes;
            
            // Check if this recipe has a master - if so, add the master instead
            if (recipeData.master_recipe_id && recipeData.master_recipes) {
              const masterData = recipeData.master_recipes;
              if (masterData && masterData.master_code && masterData.id) {
                // Skip if we've already added this master ID
                if (seenIds.has(masterData.id)) {
                  console.log(`Skipping duplicate master ID (from recipe fallback): ${masterData.id}`);
                  return;
                }
                seenIds.add(masterData.id);
                validRecipes.push({
                  id: masterData.id,
                  recipe_code: masterData.master_code,
                  strength_fc: masterData.strength_fc || 0,
                  placement_type: masterData.placement_type || '',
                  max_aggregate_size: masterData.max_aggregate_size || 0,
                  age_days: masterData.age_days || 0,
                  slump: masterData.slump || 0,
                  unit_price: detail.final_price || 0,
                });
                priceMap[masterData.id] = detail.final_price || 0;
                rToQDMap[masterData.id] = { 
                  quote_id: quoteData.id, 
                  quote_detail_id: detail.id, 
                  unit_price: detail.final_price || 0 
                };
              }
            } else if (recipeData.id && recipeData.recipe_code) {
              // Only add the standalone recipe if it has no master
              if (seenIds.has(recipeData.id)) {
                console.log(`Skipping duplicate recipe ID: ${recipeData.id}`);
                return;
              }
              seenIds.add(recipeData.id);
              validRecipes.push({
                id: recipeData.id,
                recipe_code: recipeData.recipe_code,
                strength_fc: recipeData.strength_fc || 0,
                placement_type: recipeData.placement_type || '',
                max_aggregate_size: recipeData.max_aggregate_size || 0,
                age_days: recipeData.age_days || 0,
                slump: recipeData.slump || 0,
                unit_price: detail.final_price || 0,
              });
              priceMap[recipeData.id] = detail.final_price || 0;
              rToQDMap[recipeData.id] = { 
                quote_id: quoteData.id, 
                quote_detail_id: detail.id, 
                unit_price: detail.final_price || 0 
              };
            }
          }
        });
      });
      
      console.log(`Loaded ${validRecipes.length} recipes/masters specific to this client and site`);
      
      setAvailableRecipes(validRecipes);
      setRecipePrices(priceMap);
      setRecipeToQuoteDetailMap(rToQDMap);
    } catch (error) {
      console.error('Error loading recipes:', error);
      toast.error('Error al cargar las recetas disponibles');
    } finally {
      setLoadingRecipes(false);
    }
  };

  // Function to load available additional products
  const loadAvailableAdditionalProducts = async () => {
    try {
      setLoadingAdditionalProducts(true);
      
      if (!order?.client_id || !order?.construction_site) {
        console.log('Cannot load additional products: missing client_id or construction_site');
        setAvailableAdditionalProducts([]);
        return;
      }
      
      console.log(`Loading additional products for Client: ${order.client_id}, Site: ${order.construction_site}`);
      
      // 1. First, check if the order has a specific quote_id and fetch it
      const orderQuoteId = (order as any)?.quote_id;
      let orderQuote: any = null;
      
      if (orderQuoteId) {
        console.log(`Order has quote_id: ${orderQuoteId}, fetching that quote first`);
        const { data: orderQuoteData, error: orderQuoteError } = await supabase
          .from('quotes')
          .select('id, quote_number, created_at, status')
          .eq('id', orderQuoteId)
          .single();
        
        if (!orderQuoteError && orderQuoteData) {
          orderQuote = orderQuoteData;
          console.log(`Found order's quote: ${orderQuote.quote_number}, status: ${orderQuote.status}`);
        }
      }
      
      // 2. Fetch all approved quotes for this client/site, ordered by created_at DESC
      const { data: allApprovedQuotes, error: approvedQuotesError } = await supabase
        .from('quotes')
        .select('id, quote_number, created_at, status')
        .eq('client_id', order.client_id)
        .eq('construction_site', order.construction_site)
        .eq('status', 'APPROVED')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (approvedQuotesError) {
        console.error('Error fetching approved quotes for additional products:', approvedQuotesError);
      }
      
      // 3. Combine quotes: order's quote first (if exists and not already in approved list), then approved quotes
      const allQuotes: any[] = [];
      const quoteIdSet = new Set<string>();
      
      // Add order's quote first if it exists and has additional products
      if (orderQuote && !quoteIdSet.has(orderQuote.id)) {
        allQuotes.push(orderQuote);
        quoteIdSet.add(orderQuote.id);
        console.log(`Added order's quote ${orderQuote.quote_number} to quote list`);
      }
      
      // Add approved quotes (excluding order's quote if it was already added)
      if (allApprovedQuotes) {
        allApprovedQuotes.forEach(q => {
          if (!quoteIdSet.has(q.id)) {
            allQuotes.push(q);
            quoteIdSet.add(q.id);
          }
        });
      }
      
      if (allQuotes.length === 0) {
        console.log('No quotes found for additional products');
        setAvailableAdditionalProducts([]);
        return;
      }
      
      console.log(`Found ${allQuotes.length} quotes to check for additional products (order's quote + approved quotes)`);
      
      // 4. Fetch additional products from these quotes
      const quoteIdsForAdditional = allQuotes.map(q => q.id);
      
      // Create a map of quote_id to quote order (0 = order's quote if exists, then newest approved, etc.)
      // Order's quote gets priority (index 0) if it exists
      const quoteOrderMap = new Map(quoteIdsForAdditional.map((id, index) => [id, index]));
      
      const { data: allAdditionalProducts, error: additionalProductsError } = await supabase
        .from('quote_additional_products')
        .select(`
          id,
          quote_id,
          additional_product_id,
          quantity,
          base_price,
          margin_percentage,
          unit_price,
          total_price,
          notes,
          additional_products (
            id,
            name,
            code,
            unit
          )
        `)
        .in('quote_id', quoteIdsForAdditional);
      
      if (additionalProductsError) {
        console.error('Error fetching additional products:', additionalProductsError);
        setAvailableAdditionalProducts([]);
        return;
      }
      
      if (!allAdditionalProducts || allAdditionalProducts.length === 0) {
        console.log('No additional products found in approved quotes');
        setAvailableAdditionalProducts([]);
        return;
      }
      
      // 3. Keep only the most recent price per additional_product_id
      // Sort by quote order (newest first) based on the created_at ordering from allApprovedQuotes
      const sortedProducts = allAdditionalProducts.sort((a, b) => {
        const orderA = quoteOrderMap.get(a.quote_id) ?? 999999;
        const orderB = quoteOrderMap.get(b.quote_id) ?? 999999;
        return orderA - orderB;
      });
      
      // Process in order (newest quotes first) and keep only the first occurrence of each additional_product_id
      const latestAdditionalProducts: Map<string, any> = new Map();
      for (const ap of sortedProducts) {
        const productId = ap.additional_product_id;
        if (!latestAdditionalProducts.has(productId)) {
          latestAdditionalProducts.set(productId, ap);
        }
      }
      
      console.log(`Found ${latestAdditionalProducts.size} unique additional products from ${allAdditionalProducts.length} total entries`);
      
      // Log which quote each additional product came from for debugging
      Array.from(latestAdditionalProducts.values()).forEach((ap: any) => {
        const quoteIndex = quoteOrderMap.get(ap.quote_id);
        const quote = allQuotes.find(q => q.id === ap.quote_id);
        console.log(`Additional product ${ap.additional_products?.name}: Using price $${ap.unit_price} from quote ${quote?.quote_number || ap.quote_id} (index: ${quoteIndex}, newest: ${quoteIndex === 0 ? 'YES' : 'NO'}, status: ${quote?.status || 'unknown'})`);
      });
      
      // 4. Map to AdditionalProduct interface
      const additionalProductsArray: AdditionalProduct[] = Array.from(latestAdditionalProducts.values()).map((ap: any) => ({
        id: ap.id,
        quoteAdditionalProductId: ap.id,
        additionalProductId: ap.additional_product_id,
        name: ap.additional_products?.name || 'Unknown',
        code: ap.additional_products?.code || 'Unknown',
        unit: ap.additional_products?.unit || 'unit',
        quantity: ap.quantity,
        unitPrice: ap.unit_price,
        totalPrice: ap.total_price,
        quoteId: ap.quote_id
      }));
      
      setAvailableAdditionalProducts(additionalProductsArray);
      console.log('Loaded additional products:', additionalProductsArray);
    } catch (error) {
      console.error('Error loading additional products:', error);
      toast.error('Error al cargar los productos adicionales disponibles');
      setAvailableAdditionalProducts([]);
    } finally {
      setLoadingAdditionalProducts(false);
    }
  };

  function handleCancelEdit() {
    setIsEditing(false);
    setEditedOrder(null);
    setSelectedAdditionalProducts(new Set());
    setAvailableAdditionalProducts([]);
    resetFilters();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (!editedOrder) return;
    
    const { name, value } = e.target;
    // For numeric coordinate fields, coerce to number or null
    if (name === 'delivery_latitude' || name === 'delivery_longitude') {
      const num = value === '' ? null : Number(value);
      setEditedOrder({
        ...editedOrder,
        [name]: (Number.isFinite(num as number) ? (num as number) : null) as any
      });
    } else {
      setEditedOrder({
        ...editedOrder,
        [name]: value
      });
    }
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
    const linkage = recipeToQuoteDetailMap[newRecipeId];
    
    const updatedProducts = editedOrder.products.map(product => {
      if (product.id === id) {
        return { 
          ...product, 
          recipe_id: newRecipeId,
          temp_recipe_code: selectedRecipe?.recipe_code || '',
          quote_detail_id: linkage?.quote_detail_id || null
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
      
      // Datos de cabecera de la orden
      const orderUpdate: any = {
        delivery_date: editedOrder.delivery_date,
        delivery_time: editedOrder.delivery_time,
        requires_invoice: editedOrder.requires_invoice,
        special_requirements: editedOrder.special_requirements,
        delivery_latitude: editedOrder.delivery_latitude ?? (order as any).delivery_latitude ?? null,
        delivery_longitude: editedOrder.delivery_longitude ?? (order as any).delivery_longitude ?? null,
        delivery_google_maps_url: editedOrder.delivery_google_maps_url ?? (order as any).delivery_google_maps_url ?? null
      };
      
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

      // Manejar la creación de cargo por vacío de olla para mantener paridad con el agendado
      if (!hasRemisiones && showEmptyTruckAdder && !emptyTruckExists) {
        const volume = emptyTruckVolumeDraft || 0;
        const price = emptyTruckPriceDraft || 0;

        if (volume > 0) {
          const { error: emptyTruckError } = await supabase
            .from('order_items')
            .insert({
              order_id: orderId,
              quote_detail_id: null,
              product_type: 'VACÍO DE OLLA',
              volume,
              unit_price: price,
              total_price: volume * price,
              has_pump_service: false,
              has_empty_truck_charge: true,
              empty_truck_volume: volume,
              empty_truck_price: price
            });

          if (emptyTruckError) throw emptyTruckError;
        }
      }

      // Handle additional products (only if no remisiones)
      if (!hasRemisiones) {
        // Get existing additional products from order
        const existingAdditionalProductItems = order.products.filter(p => 
          p.product_type?.startsWith('PRODUCTO ADICIONAL:')
        );

        // Calculate total concrete volume for multiplier calculation
        const totalConcreteVolume = editedOrder.products?.reduce((sum, p) => {
          const originalProduct = order.products.find(op => op.id === p.id);
          if (originalProduct && 
              !originalProduct.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
              originalProduct.product_type !== 'SERVICIO DE BOMBEO' &&
              originalProduct.product_type !== 'VACÍO DE OLLA') {
            return sum + (p.volume || 0);
          }
          return sum;
        }, 0) || 0;

        // Create a map of existing products by matching name/code
        const existingProductMap = new Map<string, any>();
        existingAdditionalProductItems.forEach(item => {
          const match = item.product_type?.match(/PRODUCTO ADICIONAL: (.+?) \((.+?)\)/);
          if (match) {
            const [, name, code] = match;
            const key = `${name.trim()}:${code.trim()}`;
            existingProductMap.set(key, item);
          }
        });

        // Process selected additional products
        const selectedIds = Array.from(selectedAdditionalProducts);
        const selectedProductsMap = new Map<string, AdditionalProduct>();
        
        selectedIds.forEach(id => {
          const ap = availableAdditionalProducts.find(a => a.quoteAdditionalProductId === id);
          if (ap) {
            const key = `${ap.name}:${ap.code}`;
            selectedProductsMap.set(key, ap);
          }
        });

        // Add new additional products
        for (const [key, ap] of selectedProductsMap) {
          if (!existingProductMap.has(key)) {
            // Create new order_item for this additional product
            const itemVolume = ap.quantity; // multiplier per m³
            const unitPrice = ap.unitPrice;
            const totalPrice = ap.quantity * totalConcreteVolume * unitPrice;

            const { error: insertError } = await supabase
              .from('order_items')
              .insert({
                order_id: orderId,
                quote_detail_id: null,
                recipe_id: null,
                master_recipe_id: null,
                product_type: `PRODUCTO ADICIONAL: ${ap.name} (${ap.code})`,
                volume: itemVolume,
                unit_price: unitPrice,
                total_price: totalPrice,
                has_pump_service: false,
                pump_price: null,
                pump_volume: null
              });

            if (insertError) {
              console.error('Error inserting additional product:', insertError);
              throw insertError;
            }
            console.log(`Added new additional product: ${ap.name} (${ap.code})`);
          }
        }

        // Remove deselected additional products
        for (const [key, existingItem] of existingProductMap) {
          if (!selectedProductsMap.has(key)) {
            // Delete this order_item
            const { error: deleteError } = await supabase
              .from('order_items')
              .delete()
              .eq('id', existingItem.id);

            if (deleteError) {
              console.error('Error deleting additional product:', deleteError);
              throw deleteError;
            }
            console.log(`Removed additional product: ${existingItem.product_type}`);
          } else {
            // Update if quantity or price changed (recalculate total)
            const ap = selectedProductsMap.get(key)!;
            const itemVolume = ap.quantity;
            const unitPrice = ap.unitPrice;
            const totalPrice = ap.quantity * totalConcreteVolume * unitPrice;

            // Only update if values changed
            if (existingItem.volume !== itemVolume || 
                existingItem.unit_price !== unitPrice ||
                existingItem.total_price !== totalPrice) {
              const { error: updateError } = await supabase
                .from('order_items')
                .update({
                  volume: itemVolume,
                  unit_price: unitPrice,
                  total_price: totalPrice
                })
                .eq('id', existingItem.id);

              if (updateError) {
                console.error('Error updating additional product:', updateError);
                throw updateError;
              }
              console.log(`Updated additional product: ${ap.name} (${ap.code})`);
            }
          }
        }
      }
      
      // Normalizar a recetas maestras y actualizar items (solo si no hay remisiones)
      if (editedOrder.products && editedOrder.products.length > 0 && !hasRemisiones) {
        // Filter to only concrete/recipe items, exclude special service items and additional products
        const concreteProducts = editedOrder.products.filter(p => {
          const originalProduct = order.products.find(op => op.id === p.id);
          return originalProduct && 
                 originalProduct.product_type !== 'VACÍO DE OLLA' &&
                 originalProduct.product_type !== 'SERVICIO DE BOMBEO' &&
                 originalProduct.product_type !== 'EMPTY_TRUCK_CHARGE' &&
                 !originalProduct.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
                 !originalProduct.has_empty_truck_charge;
        });

        // Normalize and save concrete items
        if (concreteProducts.length > 0) {
          // Preserve original recipe_id if not explicitly changed
          const concreteProductsWithRecipe = concreteProducts.map(p => {
            const originalProduct = order.products.find(op => op.id === p.id);
            return {
              id: p.id,
              volume: p.volume,
              pump_volume: p.pump_volume,
              // Use selected recipe_id, or fall back to original if unchanged
              recipe_id: p.recipe_id || originalProduct?.recipe_id || (originalProduct as any)?.master_recipe_id || undefined
            };
          });

          await orderService.updateOrderNormalized(
            orderId,
            orderUpdate,
            concreteProductsWithRecipe,
            { normalizeToMasters: true, mergePerMaster: true, strictMasterOnly: true }
          );
        }

        // Handle special service items separately (just update volume)
        const specialProducts = editedOrder.products.filter(p => {
          const originalProduct = order.products.find(op => op.id === p.id);
          return originalProduct && 
                 (originalProduct.product_type === 'VACÍO DE OLLA' ||
                  originalProduct.product_type === 'SERVICIO DE BOMBEO' ||
                  originalProduct.product_type === 'EMPTY_TRUCK_CHARGE' ||
                  originalProduct.has_empty_truck_charge);
        });

        // Update volume-only for special items if changed
        for (const sp of specialProducts) {
          const originalProduct = order.products.find(op => op.id === sp.id);
          if (originalProduct && originalProduct.volume !== sp.volume) {
            console.log(`Updating special item ${sp.id} volume from ${originalProduct.volume} to ${sp.volume}`);
            await orderService.updateOrderItem(sp.id, {
              volume: sp.volume,
              total_price: sp.volume * (originalProduct.unit_price || 0)
            });
          }
        }
      } else if (!hasRemisiones) {
        // No products to normalize, just update order header
        await orderService.updateOrder(orderId, orderUpdate);
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
    if (!order || isApprovingCredit) return;
    
    try {
      setIsApprovingCredit(true);
      const { success, error: approveError } = await orderService.approveCreditForOrder(order.id);
      
      if (approveError) {
        throw new Error(approveError);
      }
      
      if (success) {
        toast.success('Crédito aprobado exitosamente', {
          description: `La orden ${order.order_number || order.id} ha sido aprobada.`,
        });
        await loadOrderDetails();
      }
    } catch (err) {
      console.error('Error approving credit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al aprobar el crédito. Por favor, intente nuevamente.';
      toast.error('Error al aprobar el crédito', {
        description: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setIsApprovingCredit(false);
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
    if (!order || !rejectionReason.trim() || isRejectingCredit) return;
    
    try {
      setIsRejectingCredit(true);
      const { success, error: rejectError } = await orderService.rejectCreditByValidator(order.id, rejectionReason);
      
      if (rejectError) {
        throw new Error(rejectError);
      }
      
      if (success) {
        toast.success('Crédito rechazado', {
          description: `La orden ${order.order_number || order.id} ha sido rechazada por el validador.`,
        });
        setIsRejectReasonModalOpen(false);
        setRejectionReason('');
        await loadOrderDetails();
      }
    } catch (err) {
      console.error('Error rejecting credit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al rechazar el crédito. Por favor, intente nuevamente.';
      toast.error('Error al rechazar el crédito', {
        description: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setIsRejectingCredit(false);
    }
  }
  
  async function handleManagerReject() {
    if (!order || isRejectingCredit) return;
    
    try {
      setIsRejectingCredit(true);
      const defaultReason = "Crédito rechazado definitivamente por gerencia";
      const { success, error: rejectError } = await orderService.rejectCreditForOrder(order.id, defaultReason);
      
      if (rejectError) {
        throw new Error(rejectError);
      }
      
      if (success) {
        toast.success('Crédito rechazado definitivamente', {
          description: `La orden ${order.order_number || order.id} ha sido rechazada por gerencia.`,
        });
        setIsConfirmModalOpen(false);
        await loadOrderDetails();
      }
    } catch (err) {
      console.error('Error rejecting credit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error al rechazar el crédito. Por favor, intente nuevamente.';
      toast.error('Error al rechazar el crédito', {
        description: errorMessage,
      });
      setError(errorMessage);
    } finally {
      setIsRejectingCredit(false);
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

  // Add this function to check if financial info should be shown
  const shouldShowFinancialInfo = () => {
    // Credit validators, managers, and executives can see financial info
    const canSeeFinancialInfo = hasRole(['EXECUTIVE', 'PLANT_MANAGER', 'CREDIT_VALIDATOR'] as UserRole[]);
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

  // Load pumping service pricing for client + construction site
  useEffect(() => {
    if (!order?.client_id || !order?.construction_site) {
      setPumpPrice(null);
      return;
    }
    
    const loadPumpServicePricing = async () => {
      try {
        console.log(`Fetching pump service pricing for Client: ${order.client_id}, Site: ${order.construction_site}`);
        
        const { data: pumpServiceDetails, error: pumpServiceError } = await supabase
          .from('quote_details')
          .select(`
            pump_price,
            quotes!inner(
              client_id,
              construction_site,
              status
            )
          `)
          .eq('quotes.client_id', order.client_id)
          .eq('quotes.construction_site', order.construction_site)
          .eq('quotes.status', 'APPROVED')
          .eq('pump_service', true)
          .not('pump_price', 'is', null) // Ensure pump_price is not null
          .order('created_at', { ascending: false, foreignTable: 'quotes' })
          .limit(1);
          
        if (pumpServiceError) {
          console.error("Error fetching pump service pricing:", pumpServiceError);
          setPumpPrice(0); // Set to 0 to allow manual entry
          return;
        }
        
        if (pumpServiceDetails && pumpServiceDetails.length > 0 && pumpServiceDetails[0].pump_price !== null) {
          setPumpPrice(pumpServiceDetails[0].pump_price);
          console.log(`Found pump service price: $${pumpServiceDetails[0].pump_price} for client + site combination`);
        } else {
          console.log('No pump service pricing found in approved quotes for this client + site combination');
          setPumpPrice(0); // Set to 0 to allow manual entry
        }
      } catch (err) {
        console.error('Error loading pump service pricing:', err);
        
        // Fallback: Check if this order already has legacy pump service
        // and allow manual pricing for backward compatibility
        const existingPumpItems = order.products?.filter(p => p.has_pump_service && p.pump_price) || [];
        if (existingPumpItems.length > 0) {
          const fallbackPrice = existingPumpItems[0].pump_price || 0; // Ensure it's a number
          setPumpPrice(fallbackPrice);
        } else {
          // Set to 0 to allow manual entry for legacy orders
          setPumpPrice(0);
        }
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

  // Match existing additional products to available products when both are loaded
  useEffect(() => {
    if (isEditing && order && availableAdditionalProducts.length > 0) {
      const existingAdditionalProducts = order.products.filter(p => 
        p.product_type?.startsWith('PRODUCTO ADICIONAL:')
      );
      
      const matchedIds = new Set<string>();
      
      // Match by extracting name and code from product_type
      // Format: "PRODUCTO ADICIONAL: Name (Code)"
      existingAdditionalProducts.forEach(existing => {
        const productType = existing.product_type || '';
        const match = productType.match(/PRODUCTO ADICIONAL: (.+?) \((.+?)\)/);
        if (match) {
          const [, name, code] = match;
          
          // Find matching available product by name and code
          const matched = availableAdditionalProducts.find(ap => 
            ap.name === name.trim() && ap.code === code.trim()
          );
          
          if (matched) {
            matchedIds.add(matched.quoteAdditionalProductId);
          }
        }
      });
      
      if (matchedIds.size > 0) {
        console.log(`Matched ${matchedIds.size} existing additional products to available products`);
        setSelectedAdditionalProducts(matchedIds);
      }
    }
  }, [isEditing, order, availableAdditionalProducts]);
  
  // Check if the user can approve/reject credit
  const canManageCredit = (isCreditValidator || isManager) && order?.credit_status !== 'approved' && order?.credit_status !== 'rejected';

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
    
    // For delete action - always render for authorized users, disable when not allowed
    const deleteAuthorized = (managerOrFinance || isCreator) && !!order;
    const deleteDisabled = !!order && (hasRemisiones || order.order_status === 'cancelled');
    const deleteDisabledReason = hasRemisiones
      ? 'No se puede eliminar una orden con remisiones registradas'
      : order?.order_status === 'cancelled'
        ? 'No se puede eliminar una orden cancelada'
        : '';
    
    // Menu of actions
    return (
      <div className="flex flex-wrap gap-2 mb-6 justify-end">
        {/* Edit Order button */}
        {canEditOrder && !isEditing && (
          <Button
            onClick={handleEditClick}
            className="!bg-systemBlue hover:!bg-systemBlue/90 !text-white !opacity-100 shadow-md"
            style={{ backgroundColor: '#007AFF', color: 'white', opacity: 1 }}
          >
            Editar Orden
          </Button>
        )}
        
        {/* Recalculate button with role protection */}
        <RoleProtectedButton
          allowedRoles={['EXECUTIVE', 'PLANT_MANAGER', 'DOSIFICADOR', 'CREDIT_VALIDATOR'] as UserRole[]}
          onClick={handleRecalculateAmount}
          disabled={isRecalculating}
          className="px-3 py-2 rounded-xl text-sm font-medium border-2 border-gray-400 bg-white hover:bg-gray-100 text-gray-800 dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-700"
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
        {deleteAuthorized && (
          isCreator ? (
            <Button
              onClick={() => setShowConfirmDelete(true)}
              disabled={isDeleting || deleteDisabled}
              title={deleteDisabled ? deleteDisabledReason : undefined}
              className="px-3 py-2 rounded text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar Orden'}
            </Button>
          ) : (
            <RoleProtectedButton
              allowedRoles={['EXECUTIVE', 'PLANT_MANAGER'] as UserRole[]}
              onClick={() => setShowConfirmDelete(true)}
              disabled={isDeleting || deleteDisabled}
              showDisabled={true}
              disabledMessage={deleteDisabled ? deleteDisabledReason : 'No tienes permiso para eliminar'}
              className="px-3 py-2 rounded text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar Orden'}
            </RoleProtectedButton>
          )
        )}
        
        {/* Allow adding payments for roles with FINANCE permission */}
        {shouldShowFinancialInfo() && order?.client_id && (
          <RoleProtectedButton
            allowedRoles={['EXECUTIVE', 'PLANT_MANAGER', 'CREDIT_VALIDATOR'] as UserRole[]}
            onClick={() => setIsPaymentDialogOpen(true)}
            className="px-3 py-2 rounded-xl text-sm font-medium border-2 border-gray-400 bg-white hover:bg-gray-100 text-gray-800 dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100 dark:hover:bg-gray-700"
          >
            Registrar Pago
          </RoleProtectedButton>
        )}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header with Glass Design */}
      <div className="mb-6">
        <div className="glass-thick rounded-2xl p-6 shadow-lg">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  Orden #{order?.order_number || orderId.substring(0, 8)}
                  {/* Site Access semaforization dot */}
                  {(() => {
                    const rating = (order as any)?.site_access_rating as string | undefined;
                    const color = rating === 'green' ? 'bg-green-500' : rating === 'yellow' ? 'bg-yellow-500' : rating === 'red' ? 'bg-red-500' : 'bg-gray-300';
                    const title = rating ? `Acceso: ${rating.toUpperCase()}` : 'Acceso: N/D';
                    return <span className={`inline-block w-3 h-3 rounded-full shadow-lg ${color}`} title={title} />;
                  })()}
                </h1>
                {/* Quality Indicator Badge */}
                {hasRemisiones && (
                  <Badge 
                    variant="outline" 
                    className="bg-systemBlue/10 text-systemBlue border-systemBlue/30 hover:bg-systemBlue/20 cursor-pointer font-semibold"
                    onClick={() => setActiveTab('calidad')}
                  >
                    <Beaker className="h-3 w-3 mr-1" />
                    Calidad
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                Cliente: <span className="text-gray-900 dark:text-gray-100">{order?.client?.business_name}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Site access summary section for Yellow/Red */}
      {(() => {
        const rating = (order as any)?.site_access_rating as string | undefined;
        // Handle both array and object formats for order_site_validations
        const validations = (order as any)?.order_site_validations;
        const validation = Array.isArray(validations) ? validations[0] : validations;
        
        if (!rating || rating === 'green' || !validation) return null;
        const mapRoad: any = { paved: 'Pavimento', gravel_good: 'Terracería (buena)', gravel_rough: 'Terracería (mala)' };
        const mapSlope: any = { none: 'Sin pendiente', moderate: 'Pendiente moderada', steep: 'Pendiente pronunciada' };
        const mapWeather: any = { dry: 'Seco', light_rain: 'Lluvia ligera', heavy_rain: 'Lluvia fuerte' };
        const mapHist: any = { none: 'Sin incidentes', minor: 'Incidentes menores', major: 'Incidentes mayores' };
        return (
          <div className={`mb-4 p-3 rounded border ${rating === 'red' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
            <div className="flex items-center gap-2 font-medium">
              <span className={`inline-block w-3 h-3 rounded-full ${rating === 'red' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
              {rating === 'red' ? 'Acceso ROJO' : 'Acceso AMARILLO'}
            </div>
            <div className="mt-1 text-sm">
              {mapRoad[validation?.road_type] || '—'} • {mapSlope[validation?.road_slope] || '—'} • {mapWeather[validation?.recent_weather_impact] || '—'} • {mapHist[validation?.route_incident_history] || '—'}
            </div>
            {Array.isArray(validation?.evidence_photo_urls) && validation.evidence_photo_urls.length > 0 && (
              <div className="mt-2 flex gap-2">
                {validation.evidence_photo_urls.slice(0,3).map((p: string, idx: number) => (
                  <EvidenceImage key={`${p}-${idx}`} path={p} />
                ))}
              </div>
            )}
          </div>
        );
      })()}

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
            {/* Glass Tab Navigation - Apple HIG Style */}
            <div className="glass-thin rounded-2xl p-1.5 inline-flex gap-1 shadow-md">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'details'
                    ? 'bg-systemBlue text-white shadow-md !opacity-100'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 bg-transparent'
                }`}
                style={activeTab === 'details' ? { backgroundColor: '#007AFF', color: 'white', opacity: 1 } : undefined}
              >
                Detalles de Orden
              </button>
              <button
                onClick={() => setActiveTab('remisiones')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'remisiones'
                    ? 'bg-systemBlue text-white shadow-md !opacity-100'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 bg-transparent'
                }`}
                style={activeTab === 'remisiones' ? { backgroundColor: '#007AFF', color: 'white', opacity: 1 } : undefined}
              >
                Remisiones
              </button>
              <button
                onClick={() => setActiveTab('calidad')}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  activeTab === 'calidad'
                    ? 'bg-systemBlue text-white shadow-md !opacity-100'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 bg-transparent'
                }`}
                style={activeTab === 'calidad' ? { backgroundColor: '#007AFF', color: 'white', opacity: 1 } : undefined}
              >
                Calidad
              </button>
            </div>
                  
            {activeTab === 'details' ? (
              <div className="mt-6">
                <div className="glass-thick rounded-2xl p-6 shadow-lg">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Estado de la Orden</h3>
                  
                  {/* Fiscal Status Indicator */}
                  {order.plant && (
                    <div className={`mt-4 p-3 rounded-lg border-l-4 ${
                      order.requires_invoice 
                        ? 'bg-green-50 border-green-400' 
                        : 'bg-gray-50 border-gray-400'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={`text-sm font-medium ${
                            order.requires_invoice ? 'text-green-800' : 'text-gray-800'
                          }`}>
                            {order.requires_invoice ? '✓ Orden FISCAL' : '✓ Orden EFECTIVO'}
                          </h4>
                          <p className={`text-xs ${
                            order.requires_invoice ? 'text-green-600' : 'text-gray-600'
                          }`}>
                            {order.requires_invoice 
                              ? `Con factura - IVA ${(order.plant.business_unit.vat_rate * 100).toFixed(1)}%`
                              : 'Sin factura - No aplica IVA'
                            }
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                          order.requires_invoice 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {order.requires_invoice ? 'FISCAL' : 'EFECTIVO'}
                        </div>
                      </div>
                    </div>
                  )}
                  
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

                  {/* Credit Context Panel - Show for credit validators and executives */}
                  {/* Always show credit terms - they're important and useful even after delivery */}
                  {(isCreditValidator || isManager) && order && (order.client?.id || order.client_id) && (
                    <div className="mt-6">
                      <CreditContextPanel
                        clientId={order.client?.id || order.client_id}
                        clientName={order.client?.business_name || 'Cliente'}
                        orderAmount={order.total_amount || 0}
                        compact={false}
                      />
                    </div>
                  )}

                  {/* Credit Approval/Rejection Buttons */}
                  {/* Only show if order hasn't been delivered (no remisiones) and credit is pending */}
                  {canManageCredit && order.credit_status === 'pending' && !hasRemisiones && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        onClick={handleApproveCredit}
                        className="bg-green-600 hover:bg-green-700 text-black font-semibold"
                        disabled={isApprovingCredit || isRejectingCredit}
                      >
                        {isApprovingCredit ? 'Aprobando...' : 'Aprobar Crédito'}
                      </Button>
                      <Button
                        onClick={openRejectReasonModal}
                        variant="destructive"
                        disabled={isApprovingCredit || isRejectingCredit}
                      >
                        Rechazar Crédito
                      </Button>
                      {isManager && (
                        <Button
                          onClick={openConfirmModal}
                          variant="destructive"
                          className="bg-red-800 hover:bg-red-900"
                          disabled={isApprovingCredit || isRejectingCredit}
                        >
                          Rechazar Definitivamente
                        </Button>
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
                      <dt className="text-sm font-medium text-gray-500">Fecha de Creación</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {order.created_at ? formatTimestamp(order.created_at, 'PPp') : 'No disponible'}
                      </dd>
                    </div>
                    <div className="sm:col-span-1">
                      <dt className="text-sm font-medium text-gray-500">Tipo de Orden</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {order.requires_invoice ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            ✓ FISCAL (con factura)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            ✓ EFECTIVO (sin factura)
                          </span>
                        )}
                      </dd>
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

                  {/* Delivery location map (if coordinates exist) */}
                  {((order as any).delivery_latitude && (order as any).delivery_longitude) && (
                    <div className="mt-6">
                      <h4 className="text-md font-medium text-gray-900 mb-2">Ubicación de Entrega</h4>
                      <div className="text-sm text-gray-700 mb-3">
                        <span className="font-medium">Coordenadas:</span>
                        <span className="ml-2">
                          {(order as any).delivery_latitude}, {(order as any).delivery_longitude}
                        </span>
                        {(() => {
                          const url = (order as any).delivery_google_maps_url || `https://www.google.com/maps?q=${(order as any).delivery_latitude},${(order as any).delivery_longitude}`;
                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-3 text-blue-600 hover:text-blue-800 underline"
                            >
                              Abrir en Google Maps
                            </a>
                          );
                        })()}
                      </div>
                      <div className="rounded-md overflow-hidden bg-gray-100">
                        <iframe
                          src={`https://www.google.com/maps?q=${(order as any).delivery_latitude},${(order as any).delivery_longitude}&z=15&hl=es&output=embed`}
                          width="100%"
                          height="320"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          title="Ubicación de entrega"
                        ></iframe>
                      </div>
                    </div>
                  )}
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
                          const isSpecialService = originalProduct && (
                            originalProduct.product_type === 'VACÍO DE OLLA' ||
                            originalProduct.product_type === 'SERVICIO DE BOMBEO' ||
                            originalProduct.product_type === 'EMPTY_TRUCK_CHARGE' ||
                            originalProduct.has_empty_truck_charge
                          );
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">
                                {isSpecialService ? (
                                  <div className="py-2 text-gray-700 font-semibold">
                                    {originalProduct?.product_type || 'Servicio especial'}
                                  </div>
                                ) : loadingRecipes ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent"></div>
                                    <span>Cargando...</span>
                                  </div>
                                ) : (
                                  <>
                                    {/* Collapsed view with current recipe and price */}
                                    {!isEditingRecipe(product.id) ? (
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <div className="text-sm text-gray-900 font-medium">
                                            {originalProduct?.product_type || product.temp_recipe_code || 'Receta actual'}
                                          </div>
                                          {shouldShowFinancialInfo() && (
                                            <div className="text-xs text-gray-500">
                                              {(() => {
                                                const selectedId = product.recipe_id || originalProduct?.recipe_id || (originalProduct as any)?.master_recipe_id || '';
                                                const unit = (selectedId ? (recipePrices[selectedId] ?? originalProduct?.unit_price ?? 0) : (originalProduct?.unit_price ?? 0));
                                                return <>Precio unitario: {formatCurrency(unit)}</>;
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => openRecipeEditor(product.id)}
                                          className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                        >
                                          Cambiar receta
                                        </button>
                                      </div>
                                    ) : (
                                      <div>
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
                                          value={product.recipe_id || originalProduct?.recipe_id || (originalProduct as any)?.master_recipe_id || ''}
                                          onChange={(e) => handleRecipeChange(product.id, e.target.value)}
                                          className="w-full px-2 py-1 border border-gray-300 rounded-md"
                                          disabled={loadingRecipes}
                                        >
                                          {(product.recipe_id || originalProduct?.recipe_id || (originalProduct as any)?.master_recipe_id) ? null : (
                                            <option value="" disabled>Seleccionar receta</option>
                                          )}
                                          {(() => {
                                            const currentSelectionId = product.recipe_id || originalProduct?.recipe_id || (originalProduct as any)?.master_recipe_id || '';
                                            const currentSelectionLabel = originalProduct?.product_type || product.temp_recipe_code || '';
                                            const isCurrentInList = filteredRecipes.some(r => r.id === currentSelectionId);
                                            return !isCurrentInList && currentSelectionId ? (
                                              <option key={`current-${product.id}`} value={currentSelectionId}>
                                                {currentSelectionLabel || 'Receta actual'}
                                              </option>
                                            ) : null;
                                          })()}
                                          {filteredRecipes.map((recipe) => (
                                            <option key={recipe.id} value={recipe.id}>
                                              {recipe.recipe_code} - {recipe.strength_fc}kg/cm² {recipe.slump}cm {(recipe as any).age_hours ? `${(recipe as any).age_hours}h` : `${recipe.age_days}d`} {shouldShowFinancialInfo() ? `(${formatCurrency(recipe.unit_price || 0)})` : ''}
                                            </option>
                                          ))}
                                        </select>
                                        <div className="flex justify-end mt-2">
                                          <button
                                            type="button"
                                            onClick={() => closeRecipeEditor(product.id)}
                                            className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-50"
                                          >
                                            Cerrar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                   </>
                                 )}
                                 {!isSpecialService && product.recipe_id && originalProduct?.recipe_id && product.recipe_id !== originalProduct?.recipe_id && (
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
                                {isSpecialService ? (
                                  originalProduct?.product_type === 'SERVICIO DE BOMBEO' ? 'Global' : '-'
                                ) : originalProduct?.has_pump_service ? (
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
                                  <TableCell className="text-right">
                                    {formatCurrency(
                                      isSpecialService
                                        ? (originalProduct.unit_price || originalProduct.empty_truck_price || 0)
                                        : getProductUnitPrice(product)
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(
                                      isSpecialService
                                        ? (product.volume * (originalProduct.unit_price || originalProduct.empty_truck_price || 0))
                                        : getProductUnitPrice(product) * product.volume
                                    )}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })
                      : order.products.map((product) => {
                          const isAdditionalProduct = product.product_type?.startsWith('PRODUCTO ADICIONAL:');
                          const isPumpService = product.product_type === 'SERVICIO DE BOMBEO';
                          
                          // For additional products, extract the name from product_type
                          // Format: "PRODUCTO ADICIONAL: Name (Code)"
                          let displayName = product.product_type || '';
                          if (isAdditionalProduct) {
                            displayName = product.product_type.replace('PRODUCTO ADICIONAL: ', '');
                          }
                          
                          // Calculate concrete volume delivered for additional products multiplier
                          const concreteDelivered = order.products
                            ?.filter((p: any) => 
                              !p.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
                              p.product_type !== 'SERVICIO DE BOMBEO' &&
                              p.product_type !== 'VACÍO DE OLLA'
                            )
                            .reduce((sum: number, p: any) => sum + ((p as any).concrete_volume_delivered || p.volume || 0), 0) || 0;
                          
                          // For additional products, volume is the multiplier (quantity per m³)
                          // Total = multiplier × concrete_delivered × unit_price
                          const additionalProductTotal = isAdditionalProduct && concreteDelivered > 0
                            ? product.volume * concreteDelivered * (product.unit_price || 0)
                            : (product.unit_price || 0) * product.volume;
                          
                          return (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">
                                {isPumpService ? (
                                  <span className="text-blue-600 font-semibold">
                                    {product.product_type} (Global)
                                  </span>
                                ) : isAdditionalProduct ? (
                                  <span className="text-purple-600 font-semibold">
                                    {displayName}
                                    <span className="text-xs text-gray-500 ml-2">
                                      (Multiplicador: {product.volume} por m³)
                                    </span>
                                  </span>
                                ) : (
                                  product.product_type
                                )}
                              </TableCell>
                              <TableCell>
                                {isAdditionalProduct ? (
                                  <span>
                                    {product.volume} × {concreteDelivered.toFixed(2)} m³ = {(product.volume * concreteDelivered).toFixed(2)}
                                  </span>
                                ) : (
                                  `${product.volume} m³`
                                )}
                              </TableCell>
                              <TableCell>
                                {isPumpService ? (
                                  <span className="text-blue-600">Global</span>
                                ) : isAdditionalProduct ? (
                                  <span className="text-purple-600">Producto Adicional</span>
                                ) : product.has_pump_service ? 
                                  `Sí - ${product.pump_volume} m³` : 
                                  'No'}
                              </TableCell>
                              {shouldShowFinancialInfo() && (
                                <>
                                  <TableCell className="text-right">
                                    {formatCurrency(isAdditionalProduct ? (product.unit_price || 0) : getProductUnitPrice(product))}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {formatCurrency(isAdditionalProduct ? additionalProductTotal : (getProductUnitPrice(product) * product.volume))}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>

                {shouldShowFinancialInfo() && (
                  <div className="flex justify-end mt-4">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total:</p>
                      <p className="text-xl font-bold">{formatCurrency(order.total_amount)}</p>
                      
                      {/* VAT Information - Only show for fiscal orders */}
                      {order.plant && order.requires_invoice && (
                        <div className="mt-2 text-sm text-gray-600">
                          <p className="text-green-600 font-medium">✓ Orden FISCAL (con factura)</p>
                          <p>IVA ({order.plant.business_unit.vat_rate * 100}%): {formatCurrency(order.total_amount * order.plant.business_unit.vat_rate)}</p>
                          <p className="font-medium text-blue-600">
                            Total con IVA: {formatCurrency(order.total_amount * (1 + order.plant.business_unit.vat_rate))}
                          </p>
                        </div>
                      )}
                      
                      {/* Show when order is NOT fiscal */}
                      {order.plant && !order.requires_invoice && (
                        <div className="mt-2 text-sm text-gray-500">
                          <p className="text-gray-600">✓ Orden EFECTIVO (sin factura)</p>
                          <p>No aplica IVA</p>
                        </div>
                      )}
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

                    {/* Delivery coordinates editing */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="delivery_latitude" className="block text-sm font-medium text-gray-700 mb-1">
                          Latitud de entrega
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          name="delivery_latitude"
                          id="delivery_latitude"
                          value={editedOrder?.delivery_latitude ?? ''}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label htmlFor="delivery_longitude" className="block text-sm font-medium text-gray-700 mb-1">
                          Longitud de entrega
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          name="delivery_longitude"
                          id="delivery_longitude"
                          value={editedOrder?.delivery_longitude ?? ''}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </div>
                      <div>
                        <label htmlFor="delivery_google_maps_url" className="block text-sm font-medium text-gray-700 mb-1">
                          URL Google Maps (opcional)
                        </label>
                        <input
                          type="url"
                          name="delivery_google_maps_url"
                          id="delivery_google_maps_url"
                          placeholder="https://maps.google.com/..."
                          value={editedOrder?.delivery_google_maps_url || ''}
                          onChange={handleInputChange}
                          className="w-full rounded-md border border-gray-300 px-3 py-2"
                        />
                      </div>
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

                    {/* Add Empty Truck (Vacío de Olla) */}
                    {!emptyTruckExists && (
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-amber-800">Vacío de olla</div>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={showEmptyTruckAdder}
                              onChange={(e) => setShowEmptyTruckAdder(e.target.checked)}
                              className="h-4 w-4 text-amber-600 rounded border-gray-300"
                            />
                            <span className="text-amber-800">Agregar</span>
                          </label>
                        </div>
                        {showEmptyTruckAdder && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">Volumen (m³)</label>
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={emptyTruckVolumeDraft}
                                onChange={(e)=> setEmptyTruckVolumeDraft(parseFloat(e.target.value)||0)}
                                className="w-full rounded-md border border-amber-300 px-3 py-2 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">Precio unitario</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={emptyTruckPriceDraft}
                                onChange={(e)=> setEmptyTruckPriceDraft(parseFloat(e.target.value)||0)}
                                className="w-full rounded-md border border-amber-300 px-3 py-2 bg-white"
                              />
                            </div>
                            <div className="self-end text-sm text-gray-700">
                              Total estimado: <span className="font-semibold">{formatCurrency((emptyTruckVolumeDraft||0)*(emptyTruckPriceDraft||0))}</span>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-amber-700 mt-2">Este cargo se agrega como un producto especial y no afecta la receta.</p>
                      </div>
                    )}

                    {/* Additional Products Section */}
                    {availableAdditionalProducts.length > 0 && (
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Productos Adicionales</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Seleccione los productos adicionales que desea incluir en esta orden. Estos productos se multiplicarán por los metros cúbicos de concreto entregados.
                        </p>
                        
                        <div className="mb-3 p-2 bg-purple-100 rounded-md">
                          <p className="text-xs text-purple-800">
                            <strong>Nota:</strong> El cálculo final se realizará multiplicando la cantidad por los m³ de concreto entregados. 
                            El total mostrado aquí es una estimación basada en el volumen actual de la orden.
                          </p>
                        </div>
                        
                        {loadingAdditionalProducts ? (
                          <div className="text-center py-4 text-gray-600">Cargando productos adicionales...</div>
                        ) : (
                          <>
                            <div className="space-y-3">
                              {availableAdditionalProducts.map((ap) => {
                                const isSelected = selectedAdditionalProducts.has(ap.quoteAdditionalProductId);
                                // Calculate total concrete volume from edited products
                                const totalConcreteVolume = editedOrder?.products?.reduce((sum, p) => {
                                  // Only count concrete products, not special services
                                  const originalProduct = order?.products.find(op => op.id === p.id);
                                  if (originalProduct && 
                                      !originalProduct.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
                                      originalProduct.product_type !== 'SERVICIO DE BOMBEO' &&
                                      originalProduct.product_type !== 'VACÍO DE OLLA') {
                                    return sum + (p.volume || 0);
                                  }
                                  return sum;
                                }, 0) || 0;
                                const estimatedTotal = isSelected ? ap.quantity * totalConcreteVolume * ap.unitPrice : 0;
                                
                                return (
                                  <div
                                    key={ap.quoteAdditionalProductId}
                                    className={`flex items-center justify-between p-3 rounded-md border ${
                                      isSelected ? 'bg-purple-100 border-purple-400' : 'bg-white border-gray-200'
                                    }`}
                                  >
                                    <div className="flex items-center space-x-3 flex-1">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          const newSelected = new Set(selectedAdditionalProducts);
                                          if (e.target.checked) {
                                            newSelected.add(ap.quoteAdditionalProductId);
                                          } else {
                                            newSelected.delete(ap.quoteAdditionalProductId);
                                          }
                                          setSelectedAdditionalProducts(newSelected);
                                        }}
                                        className="h-5 w-5 text-purple-600 rounded border-gray-300"
                                      />
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-medium text-gray-800">{ap.name}</span>
                                          <span className="text-xs text-gray-500">({ap.code})</span>
                                        </div>
                                        <div className="text-sm text-gray-600 mt-1">
                                          <span className="font-medium">Cantidad por m³:</span> {ap.quantity} {ap.unit} • 
                                          <span className="font-medium ml-2">Precio unitario:</span> ${ap.unitPrice.toFixed(2)}
                                        </div>
                                        {isSelected && totalConcreteVolume > 0 && (
                                          <div className="text-sm text-purple-700 mt-1 font-medium">
                                            Estimado: {ap.quantity} × {totalConcreteVolume.toFixed(2)} m³ × ${ap.unitPrice.toFixed(2)} = ${estimatedTotal.toFixed(2)}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {selectedAdditionalProducts.size > 0 && (
                              <div className="mt-4 pt-3 border-t border-purple-200">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-medium text-gray-700">
                                    Total productos adicionales (estimado basado en volumen actual):
                                  </span>
                                  <span className="text-lg font-semibold text-purple-700">
                                    ${Array.from(selectedAdditionalProducts).reduce((sum, apId) => {
                                      const ap = availableAdditionalProducts.find(a => a.quoteAdditionalProductId === apId);
                                      const totalConcreteVolume = editedOrder?.products?.reduce((s, p) => {
                                        const originalProduct = order?.products.find(op => op.id === p.id);
                                        if (originalProduct && 
                                            !originalProduct.product_type?.startsWith('PRODUCTO ADICIONAL:') &&
                                            originalProduct.product_type !== 'SERVICIO DE BOMBEO' &&
                                            originalProduct.product_type !== 'VACÍO DE OLLA') {
                                          return s + (p.volume || 0);
                                        }
                                        return s;
                                      }, 0) || 0;
                                      return sum + (ap ? ap.quantity * totalConcreteVolume * ap.unitPrice : 0);
                                    }, 0).toFixed(2)}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  El cálculo final se realizará con los m³ de concreto realmente entregados.
                                </p>
                              </div>
                            )}
                          </>
                        )}
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
            ) : activeTab === 'remisiones' ? (
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
            ) : activeTab === 'calidad' ? (
              <div className="mt-6">
                <QualityOverview orderId={order.id} />
              </div>
            ) : null}
          </div>

          {/* Always show order actions, not just for financial users */}
          {renderOrderActions()}

          {/* Información Financiera: only in Details tab (not Remisiones or Calidad) */}
          {shouldShowFinancialInfo() && activeTab === 'details' && (
            <div className="mt-6 border-t pt-6">
              <h2 className="text-xl font-semibold mb-4">Información Financiera</h2>
              <OrderDetailsBalance
                orderId={orderId}
                clientId={order.client_id}
                constructionSite={order.construction_site}
                hideBalanceSummary
              />
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-lg text-gray-600">Orden no encontrada</p>
        </div>
      )}

      <Dialog open={isRejectReasonModalOpen} onOpenChange={setIsRejectReasonModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Razón del rechazo</DialogTitle>
            <DialogDescription>
              Por favor, indique la razón por la que se rechaza el crédito:
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            rows={3}
            placeholder="Ejemplo: Cliente con pagos pendientes"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRejectReasonModalOpen(false)}
              disabled={isRejectingCredit}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleValidatorReject}
              disabled={!rejectionReason.trim() || isRejectingCredit}
            >
              {isRejectingCredit ? 'Rechazando...' : 'Confirmar Rechazo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar rechazo definitivo</DialogTitle>
            <DialogDescription>
              ¿Está seguro de rechazar definitivamente el crédito para esta orden? Esta acción cancelará la orden y no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleManagerReject}>
              Rechazar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete order confirmation dialog */}
      <Dialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar permanentemente esta orden? Esta acción no se puede deshacer y eliminará todos los datos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDelete(false)}
              disabled={isDeleting}
            >
              No, Mantener
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteOrder}
              disabled={isDeleting}
            >
              {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Orden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment registration dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>
              Registra un pago para esta orden. El cliente y obra se asignan automáticamente.
            </DialogDescription>
          </DialogHeader>
          {order?.client_id && (
            <PaymentForm
              clientId={order.client_id}
              sites={clientSites}
              onSuccess={handlePaymentSuccess}
              onCancel={() => setIsPaymentDialogOpen(false)}
              defaultConstructionSite={order.construction_site}
              currentBalance={currentClientBalance}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 