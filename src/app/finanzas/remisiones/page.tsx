'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, subDays, addDays, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, ChevronDown, ChevronRight, ChevronLeft, Search, X, Edit, Factory, Calendar } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { supabase } from '@/lib/supabase';
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { formatRemisionesForAccounting } from '@/components/remisiones/RemisionesList';
import { clientService } from '@/lib/supabase/clients';
import { formatCurrency } from '@/lib/utils';
import { findProductPrice, explainPriceMatch } from '@/utils/salesDataProcessor';
import EditRemisionModal from '@/components/remisiones/EditRemisionModal';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePlantContext } from '@/contexts/PlantContext';

// Helper function to safely format dates
const formatDateSafely = (dateStr: string): string => {
  if (!dateStr) return '-';
  
  // Parse the date string into parts to avoid timezone issues
  const [year, month, day] = dateStr.split('T')[0].split('-').map(num => parseInt(num, 10));
  // Create date with local timezone (without hours to avoid timezone shifts)
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return format(date, 'dd/MM/yyyy', { locale: es });
};

export default function RemisionesPorCliente() {
  // PlantContext is the single source of truth for the active plant.
  // It handles ALL user types: non-executives (set from profile.plant_id),
  // executives (set from plant-switcher in header), BU managers (first plant in BU).
  const { currentPlant, isLoading: plantLoading } = usePlantContext();
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [clientsWithRemisiones, setClientsWithRemisiones] = useState<string[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientSearchTerm, setClientSearchTerm] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string>('todos');
  const [clientSites, setClientSites] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [singleDateMode, setSingleDateMode] = useState<boolean>(false);
  const [remisiones, setRemisiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [filteredRemisiones, setFilteredRemisiones] = useState<any[]>([]);
  const [expandedRemisionId, setExpandedRemisionId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [orderProducts, setOrderProducts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalVolume, setTotalVolume] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [clientComboboxOpen, setClientComboboxOpen] = useState(false);
  const [editingRemision, setEditingRemision] = useState<any>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [plants, setPlants] = useState<Record<string, string>>({}); // id → name

  // Load plant names once on mount for cross-plant labels
  useEffect(() => {
    supabase.from('plants').select('id, name').then(({ data }) => {
      if (data) setPlants(Object.fromEntries(data.map((p: any) => [p.id, p.name])));
    });
  }, []);
  
  // Determine display name for recipe/product
  // Use remision's recipe_id and recipe data directly
  const getDisplayRecipeName = useCallback((remision: any): string => {
    // 1) Prefer explicit designation on the remision
    if (remision?.designacion_ehe) {
      return remision.designacion_ehe;
    }
    
    // 2) Use recipe code from remision
    return remision.recipe?.recipe_code || 'N/A';
  }, []);
  
  // Load clients that have remisiones at the current plant within the date range.
  // Source of plant: currentPlant from PlantContext (single source of truth).
  // Flow: remisiones (plant_id + date range) → order_ids → client_ids → client names.
  const loadClientsWithRemisiones = useCallback(async () => {
    if (!dateRange.from || !dateRange.to || !currentPlant?.id || plantLoading) return;

    setLoadingClients(true);
    try {
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');

      // Step 1: get distinct order_ids from remisiones at this plant in this date range.
      // Filtering by remision.plant_id is the authoritative plant scope — it's set on every
      // remision at creation time and never changes.
      const { data: remisionesInRange, error: remisionesError } = await supabase
        .from('remisiones')
        .select('order_id')
        .eq('plant_id', currentPlant.id)
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate)
        .not('order_id', 'is', null); // exclude cross-plant production records (order_id=null)

      if (remisionesError) throw remisionesError;

      if (!remisionesInRange || remisionesInRange.length === 0) {
        setClientsWithRemisiones([]);
        setFilteredClients([]);
        return;
      }

      const orderIds = Array.from(new Set(remisionesInRange.map(r => r.order_id)));

      // Step 2: resolve order_ids → client_ids
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, client_id')
        .in('id', orderIds);

      if (ordersError) throw ordersError;

      if (!orders || orders.length === 0) {
        setClientsWithRemisiones([]);
        setFilteredClients([]);
        return;
      }

      const clientIds = Array.from(new Set(orders.map(o => o.client_id)));
      setClientsWithRemisiones(clientIds);

      // Step 3: get client display names
      const allClients = await clientService.getApprovedClients();
      setClients(allClients);
      setFilteredClients(allClients.filter(c => clientIds.includes(c.id)));
    } catch (error) {
      console.error('Error loading clients with remisiones:', error);
      setFilteredClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, [dateRange, currentPlant, plantLoading]);

  // Load clients with remisiones when date range or plant changes
  useEffect(() => {
    loadClientsWithRemisiones();
  }, [loadClientsWithRemisiones]);
  
  // Filter clients based on search term
  useEffect(() => {
    if (!clientSearchTerm) {
      // If no search term, show all clients with remisiones in date range
      const relevantClients = clients.filter(client => 
        clientsWithRemisiones.includes(client.id)
      );
      setFilteredClients(relevantClients);
      return;
    }
    
    // Filter by search term within clients that have remisiones
    const searchTerm = clientSearchTerm.toLowerCase().trim();
    
    const filtered = clients.filter(client => {
      // Only include clients with remisiones
      if (!clientsWithRemisiones.includes(client.id)) return false;
      
      // Get all searchable text fields from the client
      const businessName = (client.business_name || '').toLowerCase();
      const clientName = (client.name || '').toLowerCase();
      const contactNames = client.contacts?.map((c: any) => (c.name || '').toLowerCase()) || [];
      const contactEmails = client.contacts?.map((c: any) => (c.email || '').toLowerCase()) || [];
      
      // Simple contains match - this works better for Spanish names with prefixes
      return (
        businessName.includes(searchTerm) || 
        clientName.includes(searchTerm) || 
        contactNames.some((name: string) => name.includes(searchTerm)) || 
        contactEmails.some((email: string) => email.includes(searchTerm))
      );
    });
    
    setFilteredClients(filtered);
  }, [clients, clientSearchTerm, clientsWithRemisiones]);
  
  // Load client construction sites when a client is selected
  useEffect(() => {
    async function loadClientSites() {
      if (!selectedClientId) {
        setClientSites([]);
        return;
      }
      
      try {
        const sites = await clientService.getClientSites(selectedClientId, true);
        const siteNames = sites.map(site => site.name);
        setClientSites(siteNames);
      } catch (error) {
        console.error('Error loading client sites:', error);
        setClientSites([]);
      }
    }
    
    loadClientSites();
  }, [selectedClientId]);
  
  // Fetch remisiones when client, date range, or plant changes
  const fetchRemisiones = useCallback(async () => {
    if (!selectedClientId || !dateRange.from || !dateRange.to || !currentPlant?.id || plantLoading) return;
    
    setLoading(true);
    
    try {
      // Format dates for Supabase query
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');
      
      // Scope to current plant (plant_id) AND client (via orders join).
      // plant_id on remision is the authoritative filter — same column used in loadClientsWithRemisiones.
      let remisionesQuery = supabase
        .from('remisiones')
        .select(`
          *,
          order:orders!inner(construction_site, requires_invoice),
          recipe:recipes(recipe_code),
          materiales:remision_materiales(*)
        `)
        .eq('plant_id', currentPlant.id)
        .eq('orders.client_id', selectedClientId);
      
      // Apply date filtering based on mode
      if (singleDateMode && dateRange.from) {
        const dateStr = format(dateRange.from, 'yyyy-MM-dd');
        remisionesQuery = remisionesQuery.eq('fecha', dateStr);
      } else {
        remisionesQuery = remisionesQuery
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate);
      }
      
      const { data: remisionesData, error: remisionesError } = await remisionesQuery
        .order('fecha', { ascending: false });
      
      if (remisionesError) throw remisionesError;
      
      if (!remisionesData || remisionesData.length === 0) {
        setRemisiones([]);
        setFilteredRemisiones([]);
        setOrderProducts([]);
        setLoading(false);
        return;
      }
      
      // Enrich remisiones with order data (already embedded via join)
      const enrichedRemisiones = (remisionesData || []).map(remision => ({
        ...remision,
        requires_invoice: remision.order?.requires_invoice ?? false,
        construction_site: remision.order?.construction_site ?? ''
      }));
      
      // Order_items: only for orders that have remisiones (typically 10-50, not 200+)
      const orderIds = Array.from(new Set(enrichedRemisiones.map(r => r.order_id).filter(Boolean)));
      let products: any[] = [];
      const ORDER_ITEMS_CHUNK = 100;

      const fetchOrderItemsChunk = async (chunk: string[]) => {
        const result = await supabase
          .from('order_items')
          .select(`
            *,
            quote_details (
              final_price,
              recipe_id,
              master_recipe_id
            )
          `)
          .in('order_id', chunk);
        return result;
      };

      try {
        if (orderIds.length <= ORDER_ITEMS_CHUNK) {
          const result = await fetchOrderItemsChunk(orderIds);
          if (result.error) throw result.error;
          products = result.data || [];
        } else {
          for (let i = 0; i < orderIds.length; i += ORDER_ITEMS_CHUNK) {
            const chunk = orderIds.slice(i, i + ORDER_ITEMS_CHUNK);
            const result = await fetchOrderItemsChunk(chunk);
            if (result.error) throw result.error;
            products = products.concat(result.data || []);
          }
        }
      } catch (relationshipError) {
        console.warn('Quote details relationship failed, falling back to basic query:', relationshipError);
        products = [];
        if (orderIds.length <= ORDER_ITEMS_CHUNK) {
          const result = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds);
          if (!result.error) products = result.data || [];
        } else {
          for (let i = 0; i < orderIds.length; i += ORDER_ITEMS_CHUNK) {
            const chunk = orderIds.slice(i, i + ORDER_ITEMS_CHUNK);
            const result = await supabase.from('order_items').select('*').in('order_id', chunk);
            if (!result.error) products = products.concat(result.data || []);
          }
        }
      }

      setOrderProducts(products);
      
      setRemisiones(enrichedRemisiones);
      
      // Calculate totals
      const volume = enrichedRemisiones.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
      setTotalVolume(volume);
      
      // Calculate total amount based on order_items prices
        // Enhanced price matching using shared sophisticated utility
        let amount = 0;
        enrichedRemisiones.forEach(remision => {
          const recipeCode = remision.recipe?.recipe_code;
          const recipeId = remision.recipe_id;
          const volume = remision.volumen_fabricado || 0;

          let price = 0;
          if (remision.tipo_remision === 'BOMBEO') {
            // Pump service - use SER002 code
            price = findProductPrice('SER002', remision.order_id, recipeId, products);
            if (debugMode) {
              console.debug('PriceDebug Pump', explainPriceMatch('SER002', remision.order_id, recipeId, products));
            }
          } else if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
            // Empty truck charge - use SER001 code
            price = findProductPrice('SER001', remision.order_id, recipeId, products);
            if (debugMode) {
              console.debug('PriceDebug Vacio', explainPriceMatch('SER001', remision.order_id, recipeId, products));
            }
          } else {
            // Regular concrete - use recipe code
            const productCode = recipeCode || 'PRODUCTO';
            price = findProductPrice(productCode, remision.order_id, recipeId, products);
            if (debugMode) {
              console.debug('PriceDebug Concrete', explainPriceMatch(productCode, remision.order_id, recipeId, products));
            }
          }

          // Debug logging for price matching issues
          if (price === 0) {
            console.warn(`No price found for remision ${remision.remision_number}, recipe: ${recipeCode}, recipe_id: ${recipeId}, type: ${remision.tipo_remision}`);
          }

          amount += price * volume;
        });
      setTotalAmount(amount);
      
      // Filtering is handled by the useEffect below — no inline call needed
    } catch (error) {
      console.error('Error fetching remisiones:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, dateRange, singleDateMode, currentPlant, plantLoading]);
  
  // Filter remisiones based on selected site and search term
  // productsOverride: when provided (e.g. from fetchRemisiones), use it for price lookup; else use orderProducts state
  const filterRemisiones = (remisiones: any[], site: string, search: string, productsOverride?: any[]) => {
    const productsToUse = productsOverride ?? orderProducts;
    let filtered = [...remisiones];
    
    // Filter by site if not "todos" (all)
    if (site !== 'todos') {
      filtered = filtered.filter(r => r.construction_site === site);
    }
    
    // Filter by search term
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.remision_number?.toLowerCase().includes(searchLower) ||
        r.construction_site?.toLowerCase().includes(searchLower) ||
        r.recipe?.recipe_code?.toLowerCase().includes(searchLower) ||
        r.conductor?.toLowerCase().includes(searchLower) ||
        r.unidad?.toLowerCase().includes(searchLower)
      );
    }
    
    setFilteredRemisiones(filtered);
    
    // Recalculate totals for filtered data
    const volume = filtered.reduce((sum, r) => sum + (r.volumen_fabricado || 0), 0);
    setTotalVolume(volume);
    
    let amount = 0;
    filtered.forEach(remision => {
      const recipeCode = remision.recipe?.recipe_code;
      const recipeId = remision.recipe_id;
      const volume = remision.volumen_fabricado || 0;

      let price = 0;
      if (remision.tipo_remision === 'BOMBEO') {
        price = findProductPrice('SER002', remision.order_id, recipeId, productsToUse);
        if (debugMode) {
          console.debug('PriceDebug Pump(filtered)', explainPriceMatch('SER002', remision.order_id, recipeId, productsToUse));
        }
      } else if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
        price = findProductPrice('SER001', remision.order_id, recipeId, productsToUse);
        if (debugMode) {
          console.debug('PriceDebug Vacio(filtered)', explainPriceMatch('SER001', remision.order_id, recipeId, productsToUse));
        }
      } else {
        const productCode = recipeCode || 'PRODUCTO';
        price = findProductPrice(productCode, remision.order_id, recipeId, productsToUse);
        if (debugMode) {
          console.debug('PriceDebug Concrete(filtered)', explainPriceMatch(productCode, remision.order_id, recipeId, productsToUse));
        }
      }

      amount += price * volume;
    });
    setTotalAmount(amount);
  };
  
  // Re-filter whenever data, site, or search changes — all client-side, no Supabase calls
  useEffect(() => {
    filterRemisiones(remisiones, selectedSite, searchTerm);
  }, [remisiones, orderProducts, selectedSite, searchTerm]);
  
  // Handle client change
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedSite('todos');
    setClientComboboxOpen(false);
  };
  
  // Handle site change
  const handleSiteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSite(e.target.value);
  };
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Trigger fetch when dependencies change
  useEffect(() => {
    if (selectedClientId) {
      fetchRemisiones();
    }
  }, [fetchRemisiones, selectedClientId]);
  
  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range && range.from) {
      setDateRange(range);
      if (selectedClientId) {
        // Clear selected client if date range changes
        setSelectedClientId('');
        setRemisiones([]);
        setFilteredRemisiones([]);
      }
    }
  };
  
  // Handle date mode change
  const handleDateModeChange = (isSingleDate: boolean) => {
    setSingleDateMode(isSingleDate);
    
    if (selectedClientId) {
      // Clear selected client if date mode changes
      setSelectedClientId('');
      setRemisiones([]);
      setFilteredRemisiones([]);
    }
  };
  
  // ── Day-by-day navigation ─────────────────────────────────────────────────
  // Moves the date one day in either direction while keeping the selected client.
  // The fetchRemisiones callback re-fires automatically because dateRange changes.
  const navigateDay = (direction: 1 | -1) => {
    setDateRange(prev => {
      if (!prev.from) return prev;
      const newDate = addDays(prev.from, direction);
      return { from: newDate, to: newDate };
    });
    if (!singleDateMode) setSingleDateMode(true);
  };

  // Jump to a specific date (used by Hoy / Ayer shortcuts); resets client.
  const jumpToDate = (date: Date) => {
    setDateRange({ from: date, to: date });
    setSingleDateMode(true);
    setSelectedClientId('');
    setRemisiones([]);
    setFilteredRemisiones([]);
  };

  // Human-readable label for the current date context
  const dateLabel = (() => {
    if (!dateRange.from) return '';
    if (singleDateMode || (dateRange.to && dateRange.from.toDateString() === dateRange.to.toDateString())) {
      if (isToday(dateRange.from)) return 'Hoy';
      if (isYesterday(dateRange.from)) return 'Ayer';
      return format(dateRange.from, "EEEE d 'de' MMMM", { locale: es });
    }
    return `${format(dateRange.from, 'd MMM', { locale: es })} – ${dateRange.to ? format(dateRange.to, 'd MMM yyyy', { locale: es }) : ''}`;
  })();
  // ─────────────────────────────────────────────────────────────────────────

  // Toggle remision details expansion
  const toggleExpand = (remisionId: string) => {
    setExpandedRemisionId(expandedRemisionId === remisionId ? null : remisionId);
  };

  // Handle edit remision
  const handleEditClick = (remision: any) => {
    setEditingRemision(remision);
    setEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    fetchRemisiones();
    setEditModalOpen(false);
    setEditingRemision(null);
  };
  
  // Copy remisiones data for accounting
  const handleCopyToAccounting = async () => {
    try {
      if (filteredRemisiones.length === 0) return;
      
      // Get first remision to determine requirements
      const firstRemision = filteredRemisiones[0];
      const requiresInvoice = firstRemision.requires_invoice || false;
      
      // Always use construction site from remision's order, regardless of filter selection
      const constructionSite = firstRemision.construction_site || '';
      
      // Check if any order has empty truck charge AND there are actual remisiones for that order
      // We only want to include empty truck if we have concrete remisiones for this
      const hasEmptyTruckCharge = orderProducts.some(
        product => (product.has_empty_truck_charge === true || product.product_type === 'VACÍO DE OLLA') &&
        // Make sure this order actually has remisiones
        filteredRemisiones.some(r => r.order_id === product.order_id && r.tipo_remision === 'CONCRETO')
      );
      
      // Format the remisiones data for accounting
      const formattedData = formatRemisionesForAccounting(
        filteredRemisiones,
        requiresInvoice,
        constructionSite,
        hasEmptyTruckCharge,
        orderProducts
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
    }
  };
  
  // Group remisiones by type
  const concreteRemisiones = filteredRemisiones.filter(r => r.tipo_remision === 'CONCRETO');
  const pumpRemisiones = filteredRemisiones.filter(r => r.tipo_remision === 'BOMBEO');
  
  // Calculate totals
  const totalConcreteVolume = concreteRemisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0);
  const totalPumpVolume = pumpRemisiones.reduce((sum, r) => sum + r.volumen_fabricado, 0);
  
  // Group concrete remisiones by recipe
  const concreteByRecipe = concreteRemisiones.reduce<Record<string, { volume: number; count: number }>>((acc, remision) => {
    const recipeCode = remision.recipe?.recipe_code || 'Sin receta';
    if (!acc[recipeCode]) {
      acc[recipeCode] = {
        volume: 0,
        count: 0
      };
    }
    acc[recipeCode].volume += remision.volumen_fabricado;
    acc[recipeCode].count += 1;
    return acc;
  }, {});
  
  // Get selected client display info
  const selectedClient = clients.find(c => c.id === selectedClientId);
  
  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 leading-tight">Remisiones por Cliente</h1>
            <p className="text-xs text-gray-500 mt-0.5">Consulta y exporta para contabilidad</p>
          </div>
          <Button
            variant={copySuccess ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'gap-2 transition-all',
              copySuccess
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                : filteredRemisiones.length > 0
                ? 'border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400'
                : 'text-gray-400 border-gray-200'
            )}
            onClick={handleCopyToAccounting}
            disabled={filteredRemisiones.length === 0}
          >
            {copySuccess ? <Check size={15} /> : <Copy size={15} />}
            {copySuccess ? '¡Copiado!' : 'Copiar para Contabilidad'}
          </Button>
        </div>
      </div>

      {/* ── Filter toolbar ──────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-screen-xl mx-auto flex flex-wrap items-end gap-3">

          {/* Date block */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Fecha</span>
              <div className="flex gap-1">
                <button
                  onClick={() => jumpToDate(new Date())}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border transition-colors leading-tight',
                    singleDateMode && dateRange.from && isToday(dateRange.from)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300'
                  )}
                >Hoy</button>
                <button
                  onClick={() => jumpToDate(subDays(new Date(), 1))}
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded border transition-colors leading-tight',
                    singleDateMode && dateRange.from && isYesterday(dateRange.from)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300'
                  )}
                >Ayer</button>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateDay(-1)}
                className="h-8 w-8 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors flex-shrink-0"
                title="Día anterior"
              ><ChevronLeft size={14} /></button>
              <div className="w-52">
                <DateRangePickerWithPresets
                  dateRange={dateRange}
                  onDateRangeChange={handleDateRangeChange}
                  singleDateMode={singleDateMode}
                  onSingleDateModeChange={handleDateModeChange}
                />
              </div>
              <button
                onClick={() => navigateDay(1)}
                disabled={singleDateMode && dateRange.from ? isToday(dateRange.from) : false}
                className="h-8 w-8 flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Día siguiente"
              ><ChevronRight size={14} /></button>
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block h-10 w-px bg-gray-100 self-end mb-0.5" />

          {/* Client combobox */}
          <div className="flex flex-col gap-1 flex-1 min-w-[220px] max-w-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cliente</span>
            <Popover open={clientComboboxOpen} onOpenChange={setClientComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientComboboxOpen}
                  className="h-8 w-full justify-between text-sm font-normal border-gray-200 hover:border-gray-300"
                  disabled={loadingClients}
                >
                  {loadingClients ? (
                    <span className="text-gray-400 text-sm">Cargando…</span>
                  ) : selectedClient ? (
                    <span className="truncate font-medium text-gray-900">{selectedClient.business_name}</span>
                  ) : (
                    <span className="text-gray-400 text-sm">Seleccionar cliente…</span>
                  )}
                  <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-gray-400" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-80" align="start">
                <div className="relative border-b border-gray-100">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Buscar cliente…"
                    className="pl-8 h-8 rounded-none border-0 focus-visible:ring-0 text-sm"
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                  />
                </div>
                <Command>
                  <CommandList className="max-h-56 overflow-auto py-1">
                    <CommandEmpty className="text-sm text-gray-500 py-4 text-center">
                      {loadingClients ? 'Cargando…' : 'Sin coincidencias'}
                    </CommandEmpty>
                    <CommandGroup>
                      {clients
                        .filter(client => {
                          if (!clientsWithRemisiones.includes(client.id)) return false;
                          if (!clientSearchTerm) return true;
                          const s = clientSearchTerm.toLowerCase();
                          return (client.business_name || '').toLowerCase().includes(s) ||
                                 (client.name || '').toLowerCase().includes(s);
                        })
                        .map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.id}
                            onSelect={() => handleClientSelect(client.id)}
                            className="cursor-pointer text-sm py-2"
                          >
                            <span className="font-medium">{client.business_name}</span>
                            {client.name && client.name !== client.business_name && (
                              <span className="ml-1.5 text-xs text-gray-400">{client.name}</span>
                            )}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedClientId && (
              <button
                className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 self-start mt-0.5"
                onClick={() => { setSelectedClientId(''); setRemisiones([]); setFilteredRemisiones([]); }}
              >
                <X size={10} /> Limpiar
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="hidden md:block h-10 w-px bg-gray-100 self-end mb-0.5" />

          {/* Obra */}
          <div className="flex flex-col gap-1 min-w-[180px] max-w-xs">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Obra</span>
            <select
              value={selectedSite}
              onChange={handleSiteChange}
              disabled={!selectedClientId}
              className="h-8 px-2.5 text-sm border border-gray-200 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="todos">Todas las obras</option>
              {clientSites.map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>

          {/* Search — pushed right */}
          <div className="ml-auto flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Buscar</span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Remisión, conductor…"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="h-8 pl-8 text-sm w-48 border-gray-200"
                />
              </div>
            </div>
            <button
              onClick={() => setDebugMode(v => !v)}
              className="h-8 px-2 text-[10px] text-gray-300 hover:text-gray-500 transition-colors self-end"
            >
              {debugMode ? 'Debug ✓' : 'Debug'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Context / stats bar ─────────────────────────────────────── */}
      {selectedClientId && !loading && filteredRemisiones.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-6 py-2">
          <div className="max-w-screen-xl mx-auto flex flex-wrap items-center gap-x-5 gap-y-1">
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Calendar size={13} className="text-gray-400 flex-shrink-0" />
              <span className="capitalize">{dateLabel}</span>
            </div>
            {selectedClient && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-sm font-semibold text-gray-900">{selectedClient.business_name}</span>
              </>
            )}
            {selectedSite !== 'todos' && (
              <>
                <span className="text-gray-200">·</span>
                <span className="text-sm text-gray-500">{selectedSite}</span>
              </>
            )}
            <span className="text-gray-200 hidden sm:block">·</span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                <span className="font-semibold tabular-nums text-gray-800">{concreteRemisiones.length}</span>
                &nbsp;rem. concreto
              </span>
              {pumpRemisiones.length > 0 && (
                <span className="text-sm text-gray-500">
                  <span className="font-semibold tabular-nums text-gray-800">{pumpRemisiones.length}</span>
                  &nbsp;bombeo
                </span>
              )}
              <span className="text-sm text-gray-500">
                <span className="font-semibold tabular-nums text-gray-800">{totalVolume.toFixed(1)}</span>
                &nbsp;m³
              </span>
              {totalAmount > 0 && (
                <span className="text-sm font-semibold tabular-nums text-gray-900">{formatCurrency(totalAmount)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-6 py-5">

        {/* Loading */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className={cn('flex items-center gap-4 px-5 py-3.5', i > 0 && 'border-t border-gray-100')}>
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-48 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
            ))}
          </div>

        /* Empty state */
        ) : filteredRemisiones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {selectedClientId ? (
              <>
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Calendar size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">Sin remisiones para este período</p>
                <p className="text-xs text-gray-400 mt-1 capitalize">
                  {dateLabel}{selectedClient ? ` · ${selectedClient.business_name}` : ''}
                </p>
                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={() => navigateDay(-1)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline underline-offset-2"
                  >
                    <ChevronLeft size={13} /> Día anterior
                  </button>
                  <span className="text-gray-200">|</span>
                  <button
                    onClick={() => navigateDay(1)}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline underline-offset-2"
                  >
                    Día siguiente <ChevronRight size={13} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Search size={20} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">Selecciona un cliente para ver sus remisiones</p>
                <p className="text-xs text-gray-400 mt-1">Los clientes activos en el período aparecerán en la lista</p>
              </>
            )}
          </div>

        /* Data */
        ) : (
          <Tabs defaultValue="concrete" className="w-full">
            {/* Tab bar — natural width, left-aligned */}
            <div className="flex items-center justify-between mb-4">
              <TabsList className="bg-gray-100/80 p-0.5 h-auto gap-0.5">
                <TabsTrigger
                  value="concrete"
                  className="text-xs px-3.5 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500"
                >
                  Concreto
                  <span className="ml-1.5 tabular-nums text-[10px] font-semibold bg-gray-200 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 rounded px-1 py-0.5">
                    {concreteRemisiones.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="pump"
                  className="text-xs px-3.5 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-gray-900 text-gray-500"
                >
                  Bombeo
                  <span className="ml-1.5 tabular-nums text-[10px] font-semibold bg-gray-200 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 rounded px-1 py-0.5">
                    {pumpRemisiones.length}
                  </span>
                  {totalPumpVolume > 0 && (
                    <span className="ml-1 text-[10px] text-gray-400">{totalPumpVolume.toFixed(1)} m³</span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Concrete tab ── */}
            <TabsContent value="concrete" className="mt-0">
              {/* Recipe summary chips */}
              {Object.keys(concreteByRecipe).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(concreteByRecipe).map(([recipe, data], index) => (
                    <span
                      key={`rc-${index}-${recipe}`}
                      className="inline-flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-full px-3 py-0.5 text-gray-600"
                    >
                      <span className="font-medium text-gray-800">{recipe}</span>
                      <span className="text-gray-400">{data.volume.toFixed(1)} m³</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-5 py-2.5 w-28">Remisión</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5 w-24">Fecha</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Obra</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Conductor</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5 w-20">Unidad</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Receta</th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-5 py-2.5 w-24">Volumen</th>
                      {debugMode && (
                        <>
                          <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Precio</th>
                          <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Match</th>
                          <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">IDs</th>
                        </>
                      )}
                      <th className="w-10 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {concreteRemisiones.map((remision) => (
                      <React.Fragment key={remision.id}>
                        <tr
                          onClick={() => toggleExpand(remision.id)}
                          className={cn(
                            'cursor-pointer transition-colors group',
                            expandedRemisionId === remision.id ? 'bg-blue-50/40' : 'hover:bg-gray-50/70'
                          )}
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-300 group-hover:text-gray-400 transition-colors">
                                {expandedRemisionId === remision.id
                                  ? <ChevronDown size={13} />
                                  : <ChevronRight size={13} />}
                              </span>
                              <span className="font-semibold text-blue-600 tabular-nums">{remision.remision_number}</span>
                              {remision.cross_plant_billing_plant_id && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-medium bg-orange-50 text-orange-600 border border-orange-200 rounded px-1.5 py-0.5 ml-0.5">
                                  <Factory size={9} /> Cruzada
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-500 text-xs tabular-nums whitespace-nowrap">{formatDateSafely(remision.fecha)}</td>
                          <td className="px-3 py-3 text-gray-700 max-w-[220px]">
                            <span className="truncate block" title={remision.construction_site || undefined}>{remision.construction_site || '—'}</span>
                          </td>
                          <td className="px-3 py-3 text-gray-600 text-xs">{remision.conductor || '—'}</td>
                          <td className="px-3 py-3 text-gray-500 text-xs font-mono">{remision.unidad || '—'}</td>
                          <td className="px-3 py-3 text-gray-600 text-xs font-mono">{getDisplayRecipeName(remision)}</td>
                          <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">
                            {remision.volumen_fabricado.toFixed(2)}&nbsp;<span className="font-normal text-gray-400 text-xs">m³</span>
                          </td>
                          {debugMode && (() => {
                            const recipeCode = remision.recipe?.recipe_code;
                            const recipeId = remision.recipe_id;
                            const productCode = recipeCode || 'PRODUCTO';
                            const price = findProductPrice(productCode, remision.order_id, recipeId, orderProducts);
                            const dbg = explainPriceMatch(productCode, remision.order_id, recipeId, orderProducts);
                            return (
                              <>
                                <td className="px-3 py-3 text-right text-xs tabular-nums">{formatCurrency(price)}</td>
                                <td className="px-3 py-3 text-xs text-gray-400">{dbg.matchedStage}</td>
                                <td className="px-3 py-3 text-xs text-gray-400 font-mono">{String(recipeId || '')} / {String(dbg.matchedItemSummary?.qd_recipe_id || '')}</td>
                              </>
                            );
                          })()}
                          <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <RoleProtectedButton
                              allowedRoles={['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE']}
                              onClick={() => handleEditClick(remision)}
                              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Editar remisión"
                            >
                              <Edit size={14} />
                            </RoleProtectedButton>
                          </td>
                        </tr>
                        {expandedRemisionId === remision.id && (
                          <tr className="bg-blue-50/30">
                            <td colSpan={debugMode ? 11 : 8} className="px-5 py-4 border-t border-blue-100/60">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-3">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Requiere Factura</p>
                                  <p className="text-sm text-gray-800">{remision.requires_invoice ? 'Sí' : 'No'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">ID de Orden</p>
                                  <p className="text-sm text-gray-800 font-mono">{remision.order_id}</p>
                                </div>
                                {remision.cross_plant_billing_plant_id && (
                                  <div className="sm:col-span-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400 mb-0.5">Planta Productora</p>
                                    <p className="text-sm text-gray-800 flex items-center gap-1.5">
                                      <Factory size={13} className="text-orange-500" />
                                      {plants[remision.cross_plant_billing_plant_id] ?? remision.cross_plant_billing_plant_id}
                                      <span className="text-[10px] text-gray-400 font-normal">(producción externa)</span>
                                    </p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── Pump tab ── */}
            <TabsContent value="pump" className="mt-0">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-5 py-2.5 w-28">Remisión</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5 w-24">Fecha</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Obra</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Conductor</th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5 w-20">Unidad</th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-5 py-2.5 w-24">Volumen</th>
                      {debugMode && (
                        <>
                          <th className="text-right text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Precio</th>
                          <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">Match</th>
                          <th className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 py-2.5">IDs</th>
                        </>
                      )}
                      <th className="w-10 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pumpRemisiones.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                          No hay remisiones de bombeo para este período
                        </td>
                      </tr>
                    ) : pumpRemisiones.map((remision) => (
                      <tr key={remision.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-5 py-3">
                          <span className="font-semibold text-blue-600 tabular-nums">{remision.remision_number}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs tabular-nums whitespace-nowrap">{formatDateSafely(remision.fecha)}</td>
                        <td className="px-3 py-3 text-gray-700 max-w-[220px]">
                          <span className="truncate block" title={remision.construction_site || undefined}>{remision.construction_site || '—'}</span>
                        </td>
                        <td className="px-3 py-3 text-gray-600 text-xs">{remision.conductor || '—'}</td>
                        <td className="px-3 py-3 text-gray-500 text-xs font-mono">{remision.unidad || '—'}</td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-gray-900">
                          {remision.volumen_fabricado.toFixed(2)}&nbsp;<span className="font-normal text-gray-400 text-xs">m³</span>
                        </td>
                        {debugMode && (() => {
                          const recipeId = remision.recipe_id;
                          const price = findProductPrice('SER002', remision.order_id, recipeId, orderProducts);
                          const dbg = explainPriceMatch('SER002', remision.order_id, recipeId, orderProducts);
                          return (
                            <>
                              <td className="px-3 py-3 text-right text-xs tabular-nums">{formatCurrency(price)}</td>
                              <td className="px-3 py-3 text-xs text-gray-400">{dbg.matchedStage}</td>
                              <td className="px-3 py-3 text-xs text-gray-400 font-mono">{String(recipeId || '')} / {String(dbg.matchedItemSummary?.qd_recipe_id || '')}</td>
                            </>
                          );
                        })()}
                        <td className="px-3 py-3 text-right">
                          <RoleProtectedButton
                            allowedRoles={['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE']}
                            onClick={() => handleEditClick(remision)}
                            className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar remisión"
                          >
                            <Edit size={14} />
                          </RoleProtectedButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Edit Modal */}
      {editingRemision && (
        <EditRemisionModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          remision={editingRemision}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
} 