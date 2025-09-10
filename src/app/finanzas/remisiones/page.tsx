'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, parse, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, FileDown, ChevronDown, ChevronRight, Search, X, Edit } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { supabase } from '@/lib/supabase';
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { formatRemisionesForAccounting } from '@/components/remisiones/RemisionesList';
import { clientService } from '@/lib/supabase/clients';
import { formatCurrency } from '@/lib/utils';
import { findProductPrice } from '@/utils/salesDataProcessor';
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
  
  // Load clients based on date range
  const loadClientsWithRemisiones = useCallback(async () => {
    if (!dateRange.from || !dateRange.to) return;
    
    setLoadingClients(true);
    try {
      // Format dates for Supabase query
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');
      
      // First get all remisiones within the date range
      const { data: remisionesInRange, error: remisionesError } = await supabase
        .from('remisiones')
        .select('order_id')
        .gte('fecha', formattedStartDate)
        .lte('fecha', formattedEndDate);
      
      if (remisionesError) throw remisionesError;
      
      if (!remisionesInRange || remisionesInRange.length === 0) {
        setClientsWithRemisiones([]);
        setFilteredClients([]);
        setLoadingClients(false);
        return;
      }
      
      // Get unique order IDs
      const orderIds = Array.from(new Set(remisionesInRange.map(r => r.order_id)));
      
      // Get orders with those IDs to find client IDs
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, client_id')
        .in('id', orderIds);
      
      if (ordersError) throw ordersError;
      
      if (!orders || orders.length === 0) {
        setClientsWithRemisiones([]);
        setFilteredClients([]);
        setLoadingClients(false);
        return;
      }
      
      // Get unique client IDs
      const clientIds = Array.from(new Set(orders.map(order => order.client_id)));
      setClientsWithRemisiones(clientIds);
      
      // Get client details for those IDs
      const allClients = await clientService.getAllClients();
      
      // Filter to only clients with remisiones in the date range
      const relevantClients = allClients.filter(client => 
        clientIds.includes(client.id)
      );
      
      setClients(allClients);
      setFilteredClients(relevantClients);
    } catch (error) {
      console.error('Error loading clients with remisiones:', error);
      setFilteredClients([]);
    } finally {
      setLoadingClients(false);
    }
  }, [dateRange]);
  
  // Load clients with remisiones when date range changes
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
        const sites = await clientService.getClientSites(selectedClientId);
        const siteNames = sites.map(site => site.name);
        setClientSites(siteNames);
      } catch (error) {
        console.error('Error loading client sites:', error);
        setClientSites([]);
      }
    }
    
    loadClientSites();
  }, [selectedClientId]);
  
  // Fetch remisiones when client, date range, or site changes
  const fetchRemisiones = useCallback(async () => {
    if (!selectedClientId || !dateRange.from || !dateRange.to) return;
    
    setLoading(true);
    
    try {
      // Format dates for Supabase query
      const formattedStartDate = format(dateRange.from, 'yyyy-MM-dd');
      const formattedEndDate = format(dateRange.to, 'yyyy-MM-dd');
      
      // Get all orders for the selected client
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, construction_site, requires_invoice, total_amount')
        .eq('client_id', selectedClientId);
      
      if (ordersError) throw ordersError;
      
      if (!orders || orders.length === 0) {
        setRemisiones([]);
        setFilteredRemisiones([]);
        setLoading(false);
        return;
      }
      
      // Get all order IDs
      const orderIds = orders.map(order => order.id);
      
      // Get all order products for price information
      // First try with quote_details relationship, fallback to basic query if it fails
      let products;
      let productsError;

      try {
        const result = await supabase
          .from('order_items')
          .select(`
            *,
            quote_details (
              final_price,
              recipe_id
              
            )
          `)
          .in('order_id', orderIds);

        products = result.data;
        productsError = result.error;
      } catch (relationshipError) {
        console.warn('Quote details relationship failed, falling back to basic query:', relationshipError);
        // Fallback to basic query without relationship
        const fallbackResult = await supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        products = fallbackResult.data;
        productsError = fallbackResult.error;
      }

      if (productsError) {
        console.error('Error fetching order items:', productsError);
        console.error('Error details:', {
          message: productsError.message,
          details: productsError.details,
          hint: productsError.hint
        });
        throw productsError;
      }
      setOrderProducts(products || []);
      
      // Fetch remisiones for all found orders and filter by date range
      let remisionesQuery = supabase
        .from('remisiones')
        .select(`
          *,
          recipe:recipes(recipe_code),
          materiales:remision_materiales(*),
          order:orders(requires_invoice, construction_site)
        `)
        .in('order_id', orderIds);
      
      // Apply date filtering based on mode
      if (singleDateMode && dateRange.from) {
        // For single date mode, filter for exact date match
        const dateStr = format(dateRange.from, 'yyyy-MM-dd');
        remisionesQuery = remisionesQuery.eq('fecha', dateStr);
      } else {
        // For range mode, filter for date range
        remisionesQuery = remisionesQuery
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate);
      }
      
      const { data: remisionesData, error: remisionesError } = await remisionesQuery
        .order('fecha', { ascending: false });
      
      if (remisionesError) throw remisionesError;
      
      // Enrich remisiones with order data (requires_invoice and construction_site)
      const enrichedRemisiones = (remisionesData || []).map(remision => {
        const order = orders.find(o => o.id === remision.order_id);
        return {
          ...remision,
          requires_invoice: remision.order?.requires_invoice || false,
          construction_site: remision.order?.construction_site || ''
        };
      });
      
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
          } else if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
            // Empty truck charge - use SER001 code
            price = findProductPrice('SER001', remision.order_id, recipeId, products);
          } else {
            // Regular concrete - use recipe code
            const productCode = recipeCode || 'PRODUCTO';
            price = findProductPrice(productCode, remision.order_id, recipeId, products);
          }

          // Debug logging for price matching issues
          if (price === 0) {
            console.warn(`No price found for remision ${remision.remision_number}, recipe: ${recipeCode}, recipe_id: ${recipeId}, type: ${remision.tipo_remision}`);
          }

          amount += price * volume;
        });
      setTotalAmount(amount);
      
      // Apply initial site filter if needed
      filterRemisiones(enrichedRemisiones, selectedSite, searchTerm);
    } catch (error) {
      console.error('Error fetching remisiones:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, dateRange, selectedSite, searchTerm, singleDateMode]);
  
  // Filter remisiones based on selected site and search term
  const filterRemisiones = (remisiones: any[], site: string, search: string) => {
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
        // Pump service - use SER002 code
        price = findProductPrice('SER002', remision.order_id, recipeId, orderProducts);
      } else if (recipeCode === 'SER001' || remision.tipo_remision === 'VACÍO DE OLLA') {
        // Empty truck charge - use SER001 code
        price = findProductPrice('SER001', remision.order_id, recipeId, orderProducts);
      } else {
        // Regular concrete - use recipe code
        const productCode = recipeCode || 'PRODUCTO';
        price = findProductPrice(productCode, remision.order_id, recipeId, orderProducts);
      }

      amount += price * volume;
    });
    setTotalAmount(amount);
  };
  
  // Handle site selection changes
  useEffect(() => {
    filterRemisiones(remisiones, selectedSite, searchTerm);
  }, [selectedSite, searchTerm]);
  
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
    <div className="container mx-auto p-6">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Remisiones por Cliente</CardTitle>
          <CardDescription>
            Consulta y exporta las remisiones por cliente para su procesamiento en el sistema contable
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Date Range Picker */}
            <div className="flex flex-col">
              <Label>Fechas</Label>
              <DateRangePickerWithPresets 
                dateRange={dateRange} 
                onDateRangeChange={handleDateRangeChange}
                className="mt-1"
                singleDateMode={singleDateMode}
                onSingleDateModeChange={handleDateModeChange}
              />
            </div>
            
            {/* Client Selection */}
            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              
              <Popover open={clientComboboxOpen} onOpenChange={setClientComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={clientComboboxOpen}
                    className="w-full justify-between"
                    disabled={loadingClients}
                  >
                    {loadingClients ? (
                      <span className="text-gray-400">Cargando clientes...</span>
                    ) : selectedClient ? (
                      <span className="truncate">{selectedClient.business_name}</span>
                    ) : (
                      <span className="text-gray-400">Seleccionar cliente con remisiones...</span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" style={{ width: "var(--radix-popover-trigger-width)" }}>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar cliente..."
                      className="pl-8 h-9 rounded-none border-0 border-b focus-visible:ring-0"
                      value={clientSearchTerm}
                      onChange={(e) => setClientSearchTerm(e.target.value)}
                    />
                  </div>
                  <Command>
                    <CommandList className="max-h-64 overflow-auto py-2">
                      <CommandEmpty>
                        {loadingClients 
                          ? "Cargando clientes..." 
                          : "No se encontraron clientes"}
                      </CommandEmpty>
                      <CommandGroup>
                        {clients
                          .filter(client => {
                            // Filter out clients without remisiones
                            if (!clientsWithRemisiones.includes(client.id)) return false;
                            
                            // If no search term, include all clients with remisiones
                            if (!clientSearchTerm) return true;
                            
                            // Search logic - simple substring match on business name
                            const search = clientSearchTerm.toLowerCase();
                            const businessName = (client.business_name || '').toLowerCase();
                            const clientName = (client.name || '').toLowerCase();
                            
                            return businessName.includes(search) || 
                                   clientName.includes(search);
                          })
                          .map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.id}
                              onSelect={() => handleClientSelect(client.id)}
                              className="cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span>{client.business_name}</span>
                                {client.name && client.name !== client.business_name && (
                                  <span className="text-xs text-gray-500">{client.name}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              
              {selectedClientId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs mt-1 h-auto p-0"
                  onClick={() => {
                    setSelectedClientId('');
                    setRemisiones([]);
                    setFilteredRemisiones([]);
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Limpiar selección
                </Button>
              )}
            </div>
            
            {/* Site Selection */}
            <div>
              <Label htmlFor="site">Obra</Label>
              <select
                id="site"
                value={selectedSite}
                onChange={handleSiteChange}
                className="w-full p-2 border border-gray-300 rounded-md mt-1"
                disabled={!selectedClientId}
              >
                <option value="todos">Todas las Obras</option>
                {clientSites.map(site => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Search and Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
            <div className="relative w-full sm:w-64">
              <Input
                type="text"
                placeholder="Buscar remisión..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-9"
              />
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
              />
            </div>
            
            <div className="flex items-center gap-2 self-end">
              <div className="flex flex-col items-end">
                <span className="text-sm text-gray-500">Total: {formatCurrency(totalAmount)}</span>
                <span className="text-sm text-gray-500">Volumen: {totalVolume.toFixed(2)} m³</span>
              </div>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleCopyToAccounting}
                disabled={filteredRemisiones.length === 0}
              >
                {copySuccess ? <Check size={16} /> : <Copy size={16} />}
                <span>{copySuccess ? "¡Copiado!" : "Copiar para Contabilidad"}</span>
              </Button>
            </div>
          </div>
          
          {/* Results */}
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredRemisiones.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {selectedClientId 
                ? "No se encontraron remisiones con los filtros aplicados" 
                : "Selecciona un cliente para ver sus remisiones"}
            </div>
          ) : (
            <Tabs defaultValue="concrete" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="concrete">
                  Concreto ({concreteRemisiones.length})
                </TabsTrigger>
                <TabsTrigger value="pump">
                  Bombeo ({pumpRemisiones.length}) - {totalPumpVolume.toFixed(2)} m³
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="concrete">
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(concreteByRecipe).map(([recipe, data], index) => (
                    <Badge key={`recipe-badge-${index}-${recipe}`} variant="outline" className="bg-blue-50">
                      {recipe}: {data.volume.toFixed(2)} m³
                    </Badge>
                  ))}
                </div>
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>№ Remisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Conductor</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead>Receta</TableHead>
                        <TableHead className="text-right">Volumen</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {concreteRemisiones.map((remision) => (
                        <React.Fragment key={remision.id}>
                          <TableRow 
                            onClick={() => toggleExpand(remision.id)} 
                            className="cursor-pointer hover:bg-gray-50"
                          >
                            <TableCell>
                              <button className="flex items-center text-blue-600 hover:text-blue-800">
                                {expandedRemisionId === remision.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className="ml-1 font-medium">{remision.remision_number}</span>
                              </button>
                            </TableCell>
                            <TableCell>{formatDateSafely(remision.fecha)}</TableCell>
                            <TableCell>{remision.construction_site || '-'}</TableCell>
                            <TableCell>{remision.conductor || '-'}</TableCell>
                            <TableCell>{remision.unidad || '-'}</TableCell>
                            <TableCell>{remision.recipe?.recipe_code || 'N/A'}</TableCell>
                            <TableCell className="text-right">{remision.volumen_fabricado.toFixed(2)} m³</TableCell>
                            <TableCell className="text-right">
                              <div onClick={(e) => e.stopPropagation()}>
                                <RoleProtectedButton
                                  allowedRoles={['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE']}
                                  onClick={() => handleEditClick(remision)}
                                  className="p-1.5 rounded text-blue-600 hover:bg-blue-50"
                                  title="Editar remisión"
                                >
                                  <Edit size={16} />
                                </RoleProtectedButton>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedRemisionId === remision.id && (
                            <TableRow>
                              <TableCell colSpan={8} className="p-0">
                                <div className="p-4 bg-gray-50 border-t">
                                  <h4 className="text-sm font-semibold mb-2">Detalles Adicionales</h4>
                                  <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                    <div className="sm:col-span-1">
                                      <dt className="text-sm font-medium text-gray-500">Requiere Factura</dt>
                                      <dd className="mt-1 text-sm text-gray-900">
                                        {remision.requires_invoice ? 'Sí' : 'No'}
                                      </dd>
                                    </div>
                                    <div className="sm:col-span-1">
                                      <dt className="text-sm font-medium text-gray-500">ID de Orden</dt>
                                      <dd className="mt-1 text-sm text-gray-900">
                                        {remision.order_id}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="pump">
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>№ Remisión</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Obra</TableHead>
                        <TableHead>Conductor</TableHead>
                        <TableHead>Unidad</TableHead>
                        <TableHead className="text-right">Volumen</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pumpRemisiones.map((remision) => (
                        <TableRow key={remision.id}>
                          <TableCell className="font-medium">{remision.remision_number}</TableCell>
                          <TableCell>{formatDateSafely(remision.fecha)}</TableCell>
                          <TableCell>{remision.construction_site || '-'}</TableCell>
                          <TableCell>{remision.conductor || '-'}</TableCell>
                          <TableCell>{remision.unidad || '-'}</TableCell>
                          <TableCell className="text-right">{remision.volumen_fabricado.toFixed(2)} m³</TableCell>
                          <TableCell className="text-right">
                            <RoleProtectedButton
                              allowedRoles={['DOSIFICADOR', 'PLANT_MANAGER', 'EXECUTIVE']}
                              onClick={() => handleEditClick(remision)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50"
                              title="Editar remisión"
                            >
                              <Edit size={16} />
                            </RoleProtectedButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

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