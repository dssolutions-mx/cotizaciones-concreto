'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { format, subDays, subMonths, isValid, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Info, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import dynamic from 'next/dynamic';
import { ApexOptions } from 'apexcharts';
import { DateRange } from "react-day-picker";
import { DateRangePickerWithPresets } from "@/components/ui/date-range-picker-with-presets"
import * as XLSX from 'xlsx';
import { usePlantContext } from '@/contexts/PlantContext';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';

// Dynamically import ApexCharts with SSR disabled
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });
// Dynamically import DateRangePickerWithPresets to avoid SSR issues
const DateRangePickerWithPresetsComponent = dynamic(
  () => import("@/components/ui/date-range-picker-with-presets").then(mod => mod.DateRangePickerWithPresets),
  { 
    ssr: false,
    loading: () => (
      <div className="animate-pulse bg-gray-200 rounded h-10 w-full"></div>
    )
  }
);

// Create a custom Spanish calendar component
const SpanishCalendar = (props: any) => {
  // Override the day names to use cleaner Spanish abbreviations
  const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  
  return (
    <div className="spanish-calendar">
      <style jsx>{`
        .spanish-calendar :global(.rdp-head_cell) {
          font-size: 0.8rem !important;
          font-weight: 500 !important;
          padding: 0.5rem 0 !important;
          text-align: center !important;
        }
        
        .spanish-calendar :global(.rdp-months) {
          display: flex;
          justify-content: space-between;
        }
        
        .spanish-calendar :global(.rdp-caption) {
          padding: 0 0.5rem;
          font-weight: 500;
          font-size: 0.9rem;
          text-align: center;
        }
      `}</style>
      <Calendar
        {...props}
        locale={es}
        ISOWeek
        formatters={{
          formatWeekdayName: () => "",  // Clear default day names
        }}
        components={{
          HeadCell: ({ value }: { value: Date }) => {
            // Display our custom day names
            const index = value.getDay();
            // Sunday is 0 in JS but the last day in our array
            const adjustedIndex = index === 0 ? 6 : index - 1;
            return <th className="rdp-head_cell">{dayNames[adjustedIndex]}</th>;
          }
        }}
      />
    </div>
  )
}

export default function VentasDashboard() {
  const { currentPlant } = usePlantContext();
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));
  const [salesData, setSalesData] = useState<any[]>([]);
  const [remisionesData, setRemisionesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [clients, setClients] = useState<{id: string, name: string}[]>([]);
  const [layoutType, setLayoutType] = useState<'current' | 'powerbi'>('powerbi');
  
  // State for PowerBI Filters
  const [resistanceFilter, setResistanceFilter] = useState<string>('all');
  const [efectivoFiscalFilter, setEfectivoFiscalFilter] = useState<string>('all');
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [codigoProductoFilter, setCodigoProductoFilter] = useState<string>('all');

  // State for Filter Options
  const [resistances, setResistances] = useState<string[]>([]);
  const [tipos, setTipos] = useState<string[]>([]);
  const [productCodes, setProductCodes] = useState<string[]>([]);
  
  // VAT Calculation State
  const [includeVAT, setIncludeVAT] = useState<boolean>(false);
  const VAT_RATE = 0.16; // 16% VAT rate
  
  // Format the dates for display
  const formattedStartDate = startDate ? format(startDate, 'dd/MM/yyyy', { locale: es }) : '';
  const formattedEndDate = endDate ? format(endDate, 'dd/MM/yyyy', { locale: es }) : '';
  
  // Calculate date range for display
  const dateRangeText = useMemo(() => {
    if (!startDate || !endDate) return 'Seleccione un rango de fechas';
    return `${format(startDate, 'dd/MM/yyyy', { locale: es })} - ${format(endDate, 'dd/MM/yyyy', { locale: es })}`;
  }, [startDate, endDate]);
  
  // Add this formatNumberWithUnits function
  const formatNumberWithUnits = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
    } else {
      return value.toFixed(2);
    }
  };

  // ApexCharts formatter function for tooltips
  const formatApexCurrency = (value: number) => {
    return formatCurrency(value);
  };

  // Common ApexCharts configurations
  const apexCommonOptions = useMemo(() => ({
    chart: {
      toolbar: {
        show: false
      },
      background: 'transparent',
      fontFamily: 'Inter, system-ui, sans-serif',
      animations: {
        enabled: true,
        speed: 300, // Reduced animation speed for better performance
        dynamicAnimation: {
          speed: 150
        }
      }
    },
    colors: ['#3EB56D', '#2D8450', '#5DC78A', '#206238', '#83D7A5'], // Company green palette
    dataLabels: {
      enabled: false // Disabled for cleaner look
    },
    legend: {
      position: 'bottom' as const,
      fontSize: '12px',
      fontWeight: 500,
      markers: {
        size: 6
      },
      itemMargin: {
        horizontal: 10,
        vertical: 0
      }
    },
    stroke: {
      curve: 'smooth' as const,
      width: 2
    },
    tooltip: {
      y: {
        formatter: (val: number) => formatCurrency(val)
      },
      theme: 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, system-ui, sans-serif'
      }
    },
    grid: {
      borderColor: '#f1f5f9',
      strokeDashArray: 4,
      padding: {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
      }
    }
  }), []);
  
  // Fetch sales data based on the selected date range
  useEffect(() => {
    async function fetchSalesData() {
      if (!startDate || !endDate) {
        // Set default empty data
        setSalesData([]);
        setRemisionesData([]);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Format dates for Supabase query
        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');
        
        // 1. Fetch remisiones directly by their fecha field
        let remisionesQuery = supabase
          .from('remisiones')
          .select(`
            *,
            recipe:recipes(recipe_code, strength_fc),
            order:orders(
              id,
              order_number,
              delivery_date,
              client_id,
              construction_site,
              requires_invoice,
              clients:clients(business_name)
            )
          `)
          .gte('fecha', formattedStartDate)
          .lte('fecha', formattedEndDate);
        
        // Apply plant filter if a plant is selected
        if (currentPlant?.id) {
          remisionesQuery = remisionesQuery.eq('plant_id', currentPlant.id);
        }
        
        const { data: remisiones, error: remisionesError } = await remisionesQuery.order('fecha', { ascending: false });
        
        if (remisionesError) throw remisionesError;
        
        // Extract order IDs from remisiones
        const orderIdsFromRemisiones = remisiones?.map(r => r.order_id).filter(Boolean) || [];
        const uniqueOrderIds = Array.from(new Set(orderIdsFromRemisiones));
        
        if (uniqueOrderIds.length === 0) {
          setSalesData([]);
          setRemisionesData([]);
          setLoading(false);
          return;
        }
        
        // 2. Fetch all relevant orders (even those without remisiones in the date range)
        // This ensures we have orders for "vacío de olla" charges
        let ordersQuery = supabase
          .from('orders')
          .select(`
            id, 
            order_number, 
            delivery_date, 
            client_id,
            construction_site,
            requires_invoice,
            clients:clients(business_name)
          `)
          .in('id', uniqueOrderIds)
          .not('order_status', 'eq', 'cancelled');
        
        // Apply plant filter if a plant is selected
        if (currentPlant?.id) {
          ordersQuery = ordersQuery.eq('plant_id', currentPlant.id);
        }
        
        const { data: orders, error: ordersError } = await ordersQuery;
        
        if (ordersError) throw ordersError;
        
        if (!orders || orders.length === 0) {
          setSalesData([]);
          setRemisionesData([]);
          setLoading(false);
          return;
        }
        
        // Extract unique client names for the filter
        const clientMap = new Map();
        orders.forEach(order => {
          if (order.client_id && !clientMap.has(order.client_id)) {
            const businessName = order.clients ? 
              (typeof order.clients === 'object' ? 
                (order.clients as any).business_name || 'Desconocido' : 'Desconocido') 
              : 'Desconocido';
            
            clientMap.set(order.client_id, {
              id: order.client_id,
              name: businessName
            });
          }
        });
        
        // Convert map to array and sort by name
        const uniqueClients = Array.from(clientMap.values());
        uniqueClients.sort((a, b) => a.name.localeCompare(b.name));
        setClients(uniqueClients);
        
        // 3. Fetch order items (products) for these orders
        const orderIds = orders.map(order => order.id);
        let orderItemsQuery = supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);
        
        // Note: order_items don't have plant_id, so no plant filtering needed here
        // Plant filtering is already applied to the orders table above
        
        const { data: orderItems, error: itemsError } = await orderItemsQuery;
        
        if (itemsError) throw itemsError;
        
        // Extract unique values for filters from remisiones
        const uniqueResistances = Array.from(new Set(remisiones?.map(r => r.recipe?.strength_fc?.toString()).filter(Boolean) as string[] || [])).sort();
        const uniqueTipos = Array.from(new Set(remisiones?.map(r => r.tipo_remision).filter(Boolean) as string[] || [])).sort();
        const uniqueProductCodes = Array.from(new Set(remisiones?.map(r => r.recipe?.recipe_code).filter(Boolean) as string[] || [])).sort();

        setResistances(uniqueResistances);
        setTipos(uniqueTipos);
        setProductCodes(uniqueProductCodes);
        
        // Combine orders with their items and remisiones
        const enrichedOrders = orders.map(order => {
          const items = orderItems?.filter(item => item.order_id === order.id) || [];
          const orderRemisiones = remisiones?.filter(r => r.order_id === order.id) || [];
          
          // Extract the client name safely
          let clientName = 'Desconocido';
          if (order.clients) {
            // Handle clients properly whether it's an object or has nested properties
            if (typeof order.clients === 'object') {
              clientName = (order.clients as any).business_name || 'Desconocido';
            }
          }
          
          return {
            ...order,
            items,
            remisiones: orderRemisiones,
            clientName
          };
        });
        
        setSalesData(enrichedOrders);
        setRemisionesData(remisiones || []);
      } catch (error) {
        console.error('Error fetching sales data:', error);
        setError('Error al cargar los datos de ventas. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchSalesData();
  }, [startDate, endDate, currentPlant]);
  
  // Filter remisiones by client and search term
  const filteredRemisiones = useMemo(() => {
    let filtered = [...remisionesData];
    
    // Apply client filter - now using 'all' instead of empty string
    if (clientFilter && clientFilter !== 'all') {
      filtered = filtered.filter(r => r.order?.client_id === clientFilter);
    }
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(r => 
        r.remision_number?.toLowerCase().includes(term) ||
        r.order?.order_number?.toLowerCase().includes(term) ||
        r.order?.clients?.business_name?.toLowerCase().includes(term) ||
        r.recipe?.recipe_code?.toLowerCase().includes(term)
      );
    }
    
    // --- Apply PowerBI Filters ---
    if (layoutType === 'powerbi') {
      // Resistance Filter
      if (resistanceFilter && resistanceFilter !== 'all') {
        filtered = filtered.filter(r => r.recipe?.strength_fc?.toString() === resistanceFilter);
      }

      // Efectivo/Fiscal Filter
      if (efectivoFiscalFilter && efectivoFiscalFilter !== 'all') {
        const requiresInvoice = efectivoFiscalFilter === 'fiscal';
        // Find the corresponding order for each remision to check requires_invoice
        filtered = filtered.filter(r => {
          const order = salesData.find(o => o.id === r.order_id);
          return order?.requires_invoice === requiresInvoice;
        });
      }

      // Tipo Filter
      if (tipoFilter && tipoFilter !== 'all') {
        filtered = filtered.filter(r => r.tipo_remision === tipoFilter);
      }

      // Codigo Producto Filter
      if (codigoProductoFilter && codigoProductoFilter !== 'all') {
        filtered = filtered.filter(r => r.recipe?.recipe_code === codigoProductoFilter);
      }
    }
    // -----------------------------

    return filtered;
  }, [remisionesData, clientFilter, searchTerm, layoutType, resistanceFilter, efectivoFiscalFilter, tipoFilter, codigoProductoFilter, salesData]);
  
  // Create virtual remisiones entries for "vacío de olla" orders so they appear in the list
  const filteredRemisionesWithVacioDeOlla = useMemo(() => {
    // Start with the regular filtered remisiones
    const combinedRemisiones = [...filteredRemisiones];
    
    // Get orders that match current filters
    let filteredOrders = [...salesData];
    
    // Apply client filter to orders
    if (clientFilter && clientFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.client_id === clientFilter);
    }
    
    // Create virtual remisiones for vacío de olla
    filteredOrders.forEach(order => {
      // Find vacío de olla items
      const emptyTruckItem = order.items?.find(
        (item: any) => 
          item.product_type === 'VACÍO DE OLLA' ||
          item.product_type === 'EMPTY_TRUCK_CHARGE' ||
          item.has_empty_truck_charge === true
      );
      
      if (emptyTruckItem) {
        // Find the remision with the lowest volume for this order to assign its number
        const orderRemisiones = remisionesData.filter(r => r.order_id === order.id);
        
        // Only create virtual remision if there are actual remisiones for this order
        if (orderRemisiones.length > 0) {
          // Sort by volume ascending and take the first one (lowest volume)
          const sortedRemisiones = orderRemisiones.sort((a, b) => 
            (a.volumen_fabricado || 0) - (b.volumen_fabricado || 0)
          );
          const assignedRemisionNumber = sortedRemisiones[0].remision_number;
          
                    // Create a virtual remision object for this vacío de olla item
          const virtualRemision = {
            id: `vacio-${order.id}-${emptyTruckItem.id}`, // Generate a unique ID
            remision_number: assignedRemisionNumber, // Use the assigned remision number
            order_id: order.id,
            fecha: order.delivery_date, // Use the order's delivery date
            tipo_remision: 'VACÍO DE OLLA',
            volumen_fabricado: parseFloat(emptyTruckItem.empty_truck_volume) || parseFloat(emptyTruckItem.volume) || 1,
            recipe: { recipe_code: 'SER001' }, // Standard code for vacío de olla
            order: {
              client_id: order.client_id,
              order_number: order.order_number,
              clients: order.clients,
              requires_invoice: order.requires_invoice
            },
            // Flag this as a virtual remision
            isVirtualVacioDeOlla: true,
            // Store the original order item for reference
            originalOrderItem: emptyTruckItem
          };
          
          // Apply search filter if needed
          if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const matchesSearch = 
              virtualRemision.remision_number.toLowerCase().includes(term) ||
              order.order_number.toLowerCase().includes(term) ||
              (order.clientName && order.clientName.toLowerCase().includes(term)) ||
              'VACÍO DE OLLA'.toLowerCase().includes(term) ||
              'SER001'.includes(term);
            
            if (!matchesSearch) {
              return; // Skip if doesn't match search
            }
          }
          
          // Apply tipo filter if needed in PowerBI layout
          if (layoutType === 'powerbi' && tipoFilter && tipoFilter !== 'all' && tipoFilter !== 'VACÍO DE OLLA') {
            return; // Skip if filtered by tipo and not matching
          }
          
          // Apply efectivo/fiscal filter if needed in PowerBI layout
          if (layoutType === 'powerbi' && efectivoFiscalFilter && efectivoFiscalFilter !== 'all') {
            const requiresInvoice = efectivoFiscalFilter === 'fiscal';
            if (order.requires_invoice !== requiresInvoice) {
              return; // Skip if doesn't match efectivo/fiscal filter
            }
          }
          
          // Add the virtual remision to the combined list
          combinedRemisiones.push(virtualRemision);
        }
      }
    });
    
    return combinedRemisiones;
  }, [filteredRemisiones, salesData, clientFilter, searchTerm, layoutType, tipoFilter, efectivoFiscalFilter]);
  
  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    // Initialize results
    const result = {
      concreteVolume: 0,
      pumpVolume: 0,
      emptyTruckVolume: 0, // This will represent a count of "vacio de olla" services
      totalVolume: 0, // This will be sum of m³ for concrete/pump + count for empty truck
      concreteAmount: 0,
      pumpAmount: 0,
      emptyTruckAmount: 0,
      totalAmount: 0,
      cashAmount: 0,
      invoiceAmount: 0,
      weightedConcretePrice: 0,
      weightedPumpPrice: 0,
      weightedEmptyTruckPrice: 0,
      weightedResistance: 0,
      resistanceTooltip: '',
      // VAT-related metrics
      totalAmountWithVAT: 0,
      cashAmountWithVAT: 0,
      invoiceAmountWithVAT: 0,
      weightedConcretePriceWithVAT: 0,
      weightedPumpPriceWithVAT: 0,
      weightedEmptyTruckPriceWithVAT: 0
    };
    
    // Process remisiones (Concrete, Bombeo)
    filteredRemisiones.forEach(remision => {
      const volume = remision.volumen_fabricado || 0;
      let price = 0;
      const orderForRemision = salesData.find(o => o.id === remision.order_id);
      const orderItemsForRemision = orderForRemision?.items || [];
      const recipeCode = remision.recipe?.recipe_code;

      // Find the right order item for this remision, EXCLUDING "Vacío de Olla" types
      const orderItemForRemision = orderItemsForRemision.find((item: any) => {
        // Explicitly skip if this item looks like a "Vacío de Olla" charge
        if (
          item.product_type === 'VACÍO DE OLLA' ||
          item.product_type === 'EMPTY_TRUCK_CHARGE' ||
          (recipeCode === 'SER001' && (item.product_type === recipeCode || item.has_empty_truck_charge)) || // If remision itself is SER001
          item.has_empty_truck_charge === true
        ) {
          return false;
        }
        // Match pump service
        if (remision.tipo_remision === 'BOMBEO' && item.has_pump_service) {
          return true;
        }
        // Match concrete product by recipe code
        if (remision.tipo_remision !== 'BOMBEO' && (item.product_type === recipeCode || (item.recipe_id && item.recipe_id.toString() === recipeCode))) {
          return true;
        }
        return false;
      });
      
              if (orderItemForRemision) {
          if (remision.tipo_remision === 'BOMBEO') {
            price = orderItemForRemision.pump_price || 0;
            result.pumpVolume += volume;
            result.pumpAmount += price * volume;
          } else { // Assumed to be CONCRETO if not BOMBEO and not empty truck
            price = orderItemForRemision.unit_price || 0;
            result.concreteVolume += volume;
            result.concreteAmount += price * volume;
          }

          // Add to cash or invoice amount based on the order's requirement
          if (orderForRemision?.requires_invoice) {
            result.invoiceAmount += price * volume;
            // Add VAT amount for fiscal orders
            result.invoiceAmountWithVAT += (price * volume) * (1 + VAT_RATE);
          } else {
            result.cashAmount += price * volume;
            // Cash orders don't include VAT
            result.cashAmountWithVAT += price * volume;
          }
        }
    });
    
    // Process "Vacío de Olla" charges from filteredOrders that match current client filter
    let filteredOrders = [...salesData];
    
    // Apply client filter to orders
    if (clientFilter && clientFilter !== 'all') {
      filteredOrders = filteredOrders.filter(order => order.client_id === clientFilter);
    }
    
    // Now process vacío de olla items from filtered orders
    filteredOrders.forEach(order => {
      // Find the "Vacío de Olla" item in the order
      const emptyTruckItem = order.items?.find(
        (item: any) => 
          item.product_type === 'VACÍO DE OLLA' ||
          item.product_type === 'EMPTY_TRUCK_CHARGE' ||
          item.has_empty_truck_charge === true
      );
      
      if (emptyTruckItem) {
        // For "vacío de olla" items, use the values directly from the order_item
        // First, get the volume - ensure we're handling numeric types correctly
        const volumeAmount = 
          parseFloat(emptyTruckItem.empty_truck_volume) || 
          parseFloat(emptyTruckItem.volume) || 
          1;
        
        // For the amount, prefer to use the pre-calculated total_price if available
        let chargeAmount;
        if (emptyTruckItem.total_price) {
          // If total_price is available, use it directly (ensure it's a number)
          chargeAmount = parseFloat(emptyTruckItem.total_price);
          // In this case, we don't multiply by volume since total_price already includes that
          result.emptyTruckAmount += chargeAmount;
        } else {
          // Otherwise calculate from unit_price * volume
          const unitPrice = 
            parseFloat(emptyTruckItem.unit_price) || 
            parseFloat(emptyTruckItem.empty_truck_price) || 
            0;
          chargeAmount = unitPrice * volumeAmount;
          result.emptyTruckAmount += chargeAmount;
        }
        
        // Add the volume to the total regardless
        result.emptyTruckVolume += volumeAmount;
        
        // Add to cash or invoice amount based on the order's requirement
        if (order.requires_invoice) {
          result.invoiceAmount += chargeAmount;
          // Add VAT amount for fiscal orders
          result.invoiceAmountWithVAT += chargeAmount * (1 + VAT_RATE);
        } else {
          result.cashAmount += chargeAmount;
          // Cash orders don't include VAT
          result.cashAmountWithVAT += chargeAmount;
        }
      }
    });
    
    // Part 3: Calculate totals
    // totalVolume aggregates m³ and service counts. This might need clarification if "Total Volume" should only be m³.
    // For now, including service counts in totalVolume as per previous structure.
    result.totalVolume = result.concreteVolume + result.pumpVolume + result.emptyTruckVolume;
    result.totalAmount = result.concreteAmount + result.pumpAmount + result.emptyTruckAmount;
    
    // Calculate totals with VAT
    result.totalAmountWithVAT = result.cashAmountWithVAT + result.invoiceAmountWithVAT;
    
    // Part 4: Calculate Weighted Prices
    result.weightedConcretePrice = result.concreteVolume > 0 ? result.concreteAmount / result.concreteVolume : 0;
    result.weightedPumpPrice = result.pumpVolume > 0 ? result.pumpAmount / result.pumpVolume : 0;
    // Calculate weighted price per cubic meter for empty truck service
    result.weightedEmptyTruckPrice = result.emptyTruckVolume > 0 ? result.emptyTruckAmount / result.emptyTruckVolume : 0;
    
    // Calculate weighted prices with VAT
    result.weightedConcretePriceWithVAT = result.concreteVolume > 0 ? 
      (result.concreteAmount + (result.invoiceAmount * VAT_RATE)) / result.concreteVolume : 0;
    result.weightedPumpPriceWithVAT = result.pumpVolume > 0 ? 
      (result.pumpAmount + (result.pumpAmount * VAT_RATE)) / result.pumpVolume : 0;
    result.weightedEmptyTruckPriceWithVAT = result.emptyTruckVolume > 0 ? 
      (result.emptyTruckAmount + (result.emptyTruckAmount * VAT_RATE)) / result.emptyTruckVolume : 0;

    // Part 5: Weighted Resistance (remains based on filteredRemisiones for concrete)
    let totalWeightedResistanceSum = 0;
    let totalConcreteVolumeForResistance = 0;
    const resistanceTooltipNotes: string[] = [];

    filteredRemisiones.forEach(remision => {
      // Only consider concrete for weighted resistance
      if (remision.tipo_remision === 'CONCRETO' || remision.tipo_remision === 'PISO INDUSTRIAL') { // Assuming PISO INDUSTRIAL is concrete type
        const volume = remision.volumen_fabricado || 0;
        const resistance = remision.recipe?.strength_fc;

        if (typeof resistance === 'number' && volume > 0) {
          let adjustedResistance = resistance;
          // Check if recipe code contains 'MR'
          if (remision.recipe?.recipe_code?.toUpperCase().includes('MR')) {
             adjustedResistance = resistance / 0.13;
             if (!resistanceTooltipNotes.includes(`Resistencias "MR" divididas por 0.13`)) {
                resistanceTooltipNotes.push(`Resistencias "MR" divididas por 0.13`);
             }
          }

          totalWeightedResistanceSum += volume * adjustedResistance;
          totalConcreteVolumeForResistance += volume;
        }
      }
    });

    result.weightedResistance = totalConcreteVolumeForResistance > 0
      ? totalWeightedResistanceSum / totalConcreteVolumeForResistance
      : 0;
    result.resistanceTooltip = resistanceTooltipNotes.join('; ');

    return result;
  }, [filteredRemisiones, salesData, clientFilter]);
  
  // Use the enhanced list with vacío de olla items in the remisiones tab
  const concreteRemisiones = filteredRemisionesWithVacioDeOlla.filter(r => 
    r.tipo_remision === 'CONCRETO' || 
    (r.isVirtualVacioDeOlla && r.tipo_remision === 'VACÍO DE OLLA')
  );
  const pumpRemisiones = filteredRemisionesWithVacioDeOlla.filter(r => r.tipo_remision === 'BOMBEO');
  
  // Group concrete remisiones by recipe
  const concreteByRecipe = concreteRemisiones.reduce<Record<string, { volume: number; count: number }>>((acc, remision) => {
    const recipeCode = remision.recipe?.recipe_code || 'Sin receta';
    if (!acc[recipeCode]) {
      acc[recipeCode] = {
        volume: 0,
        count: 0
      };
    }
    acc[recipeCode].volume += remision.volumen_fabricado || 0;
    acc[recipeCode].count += 1;
    return acc;
  }, {});

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Handle client filter change
  const handleClientFilterChange = (value: string) => {
    setClientFilter(value);
  };

  // --- Handlers for new PowerBI Filters ---
  const handleResistanceFilterChange = (value: string) => setResistanceFilter(value);
  const handleEfectivoFiscalFilterChange = (value: string) => setEfectivoFiscalFilter(value);
  const handleTipoFilterChange = (value: string) => setTipoFilter(value);
  const handleCodigoProductoFilterChange = (value: string) => setCodigoProductoFilter(value);

  // --- Data for Power BI Charts ---
  const cashInvoiceData = useMemo(() => [
    { name: 'Efectivo', value: includeVAT ? summaryMetrics.cashAmountWithVAT : summaryMetrics.cashAmount },
    { name: 'Fiscal', value: includeVAT ? summaryMetrics.invoiceAmountWithVAT : summaryMetrics.invoiceAmount },
  ], [summaryMetrics, includeVAT]);

  const cashInvoiceChartOptions = useMemo((): ApexOptions => ({
    chart: {
      type: 'donut' as const,
      background: 'transparent',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        speed: 800
      },
      dropShadow: {
        enabled: true,
        top: 2,
        left: 2,
        blur: 4,
        opacity: 0.1
      }
    },
    colors: ['#10B981', '#3B82F6'], // Enhanced green and blue
    labels: ['Efectivo', 'Fiscal'],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          background: 'transparent',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '16px',
              fontWeight: 700,
              color: '#1F2937',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            value: {
              show: true,
              fontSize: '18px',
              fontWeight: 600,
              color: '#10B981',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            total: {
              show: true,
              showAlways: true,
              fontSize: '20px',
              fontWeight: 700,
              color: '#1F2937',
              label: 'Total',
              fontFamily: 'Inter, system-ui, sans-serif',
              formatter: (w: any) => formatCurrency(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0))
            }
          }
        },
        offsetX: 0,
        offsetY: 0
      }
    },
    stroke: {
      width: 3,
      colors: ['#ffffff']
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => {
        if (val < 5) return ''; // Hide very small percentages
        return `${val.toFixed(1)}%`;
      },
      style: {
        fontSize: '13px',
        fontWeight: 600,
        colors: ['#ffffff'],
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      background: {
        enabled: false
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 2,
        opacity: 0.3
      }
    },
    legend: {
      position: 'bottom',
      fontSize: '14px',
      fontWeight: 600,
      fontFamily: 'Inter, system-ui, sans-serif',
      markers: {
        size: 12
      },
      itemMargin: {
        horizontal: 16,
        vertical: 8
      },
      formatter: (seriesName: string, opts: any) => {
        const percentage = opts.w.globals.series[opts.seriesIndex] / 
          opts.w.globals.series.reduce((a: number, b: number) => a + b, 0) * 100;
        return `${seriesName} (${percentage.toFixed(1)}%)`;
      }
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      style: {
        fontSize: '13px',
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      y: {
        formatter: (val: number) => formatCurrency(val)
      },
      marker: {
        show: true
      }
    },
    states: {
      hover: {
        filter: {
          type: 'darken'
        }
      }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        legend: {
          position: 'bottom',
          fontSize: '12px'
        }
      }
    }]
  }), []);

  const cashInvoiceChartSeries = useMemo(() => 
    [
      includeVAT ? summaryMetrics.cashAmountWithVAT : summaryMetrics.cashAmount, 
      includeVAT ? summaryMetrics.invoiceAmountWithVAT : summaryMetrics.invoiceAmount
    ], 
    [summaryMetrics, includeVAT]
  );

  // Enhanced product code data with VAT support - shows amounts instead of just volume
  const productCodeAmountData = useMemo(() => {
    const grouped = filteredRemisiones.reduce((acc, r) => {
      const recipeCode = r.recipe?.recipe_code || 'N/A';
      if (r.tipo_remision !== 'BOMBEO' && recipeCode !== 'SER001') { // Only concrete
        const volume = r.volumen_fabricado || 0;
        const order = salesData.find(o => o.id === r.order_id);
        const orderItems = order?.items || [];
        
        // Find the order item for this remision
        const orderItem = orderItems.find((item: any) => 
          item.product_type === recipeCode || 
          (item.recipe_id && item.recipe_id.toString() === recipeCode)
        );
        
        const price = orderItem?.unit_price || 0;
        let amount = price * volume;
        
        // Apply VAT if enabled and order requires invoice
        if (includeVAT && order?.requires_invoice) {
          amount *= (1 + VAT_RATE);
        }
        
        if (!acc[recipeCode]) {
          acc[recipeCode] = { volume: 0, amount: 0 };
        }
        acc[recipeCode].volume += volume;
        acc[recipeCode].amount += amount;
      }
      return acc as Record<string, { volume: number; amount: number }>;
    }, {} as Record<string, { volume: number; amount: number }>);

    return Object.entries(grouped)
      .map(([name, data]) => ({ 
        name, 
        volume: (data as { volume: number; amount: number }).volume, 
        amount: (data as { volume: number; amount: number }).amount 
      }))
      .sort((a, b) => b.amount - a.amount); // Sort by amount instead of volume
  }, [filteredRemisiones, salesData, includeVAT]);

  const productCodeVolumeData = useMemo(() => {
    const grouped = filteredRemisiones.reduce((acc, r) => {
      const recipeCode = r.recipe?.recipe_code || 'N/A';
      if (r.tipo_remision !== 'BOMBEO' && recipeCode !== 'SER001') { // Only concrete
        acc[recipeCode] = (acc[recipeCode] || 0) + (r.volumen_fabricado || 0);
      }
      return acc as Record<string, number>;
    }, {} as Record<string, number>);

    // Explicitly type the entries before mapping
    const entries: [string, number][] = Object.entries(grouped);

    return entries
      .map(([name, value]) => ({ name, volume: value }))
      .sort((a, b) => b.volume - a.volume); // Sort descending by volume
  }, [filteredRemisiones]);

  const productCodeChartOptions = useMemo((): ApexOptions => ({
    chart: {
      type: 'bar' as const,
      background: 'transparent',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        speed: 600
      },
      dropShadow: {
        enabled: true,
        top: 1,
        left: 1,
        blur: 3,
        opacity: 0.1
      }
    },
    colors: ['#10B981', '#059669', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#ECFDF5', '#F0FDF4'],
    plotOptions: {
      bar: {
        horizontal: true,
        distributed: true,
        barHeight: '80%',
        borderRadius: 6,
        borderRadiusApplication: 'end',
        dataLabels: {
          position: 'bottom'
        }
      }
    },
    xaxis: {
      categories: (includeVAT ? productCodeAmountData : productCodeVolumeData).slice(0, 8).map(item => item.name),
      labels: {
        style: {
          fontSize: '11px',
          fontWeight: 600,
          colors: '#374151',
          fontFamily: 'Inter, system-ui, sans-serif'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      }
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '11px',
          fontWeight: 500,
          colors: '#6B7280',
          fontFamily: 'Inter, system-ui, sans-serif'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => includeVAT ? formatCurrency(val) : val.toFixed(1) + ' m³',
      offsetX: 8,
      style: {
        fontSize: '11px',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 600,
        colors: ['#1F2937']
      }
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      y: {
        formatter: (val: number) => includeVAT ? formatCurrency(val) : val.toFixed(2) + ' m³'
      },
      marker: {
        show: true
      }
    },
    grid: {
      show: false
    },
    legend: {
      show: false
    }
  }), [includeVAT, productCodeAmountData, productCodeVolumeData]);

  const productCodeChartSeries = useMemo(() => [{
    name: includeVAT ? 'Monto' : 'Volumen',
    data: includeVAT ? 
      productCodeAmountData.slice(0, 8).map(item => item.amount) :
      productCodeVolumeData.slice(0, 8).map(item => item.volume)
  }], [productCodeAmountData, productCodeVolumeData, includeVAT]);

  const clientVolumeData = useMemo(() => {
     const clientSummary = filteredRemisiones.reduce((acc: Record<string, { clientName: string; volume: number }>, remision) => {
        const clientId = remision.order?.client_id || 'unknown';
        const clientName = remision.order.clients ?
          (typeof remision.order.clients === 'object' ?
            (remision.order.clients as any).business_name || 'Desconocido' : 'Desconocido')
          : 'Desconocido';

        if (!acc[clientId]) {
          acc[clientId] = { clientName, volume: 0 };
        }

        const volume = remision.volumen_fabricado || 0;
        acc[clientId].volume += volume;
        return acc;
      }, {} as Record<string, { clientName: string; volume: number }>);

      // Explicitly type the array before sorting
      const clientValues: { clientName: string; volume: number }[] = Object.values(clientSummary);
      const mappedData: { name: string; value: number }[] = clientValues.map(summary => ({ name: summary.clientName, value: summary.volume }));

      return mappedData.sort((a, b) => b.value - a.value);
  }, [filteredRemisiones, salesData]);

  // Enhanced client data with VAT support - shows amounts instead of just volume
  const clientAmountData = useMemo(() => {
    const clientSummary = filteredRemisiones.reduce((acc: Record<string, { clientName: string; volume: number; amount: number }>, remision) => {
      const clientId = remision.order?.client_id || 'unknown';
      const clientName = remision.order.clients ?
        (typeof remision.order.clients === 'object' ?
          (remision.order.clients as any).business_name || 'Desconocido' : 'Desconocido')
        : 'Desconocido';

      if (!acc[clientId]) {
        acc[clientId] = { clientName, volume: 0, amount: 0 };
      }

      const volume = remision.volumen_fabricado || 0;
      const order = salesData.find(o => o.id === remision.order_id);
      const orderItems = order?.items || [];
      const recipeCode = remision.recipe?.recipe_code;
      
      // Find the right order item based on product type
      const orderItem = orderItems.find((item: any) => {
        if (remision.tipo_remision === 'BOMBEO' && item.has_pump_service) {
          return true;
        }
        return item.product_type === recipeCode || 
          (item.recipe_id && item.recipe_id.toString() === recipeCode);
      });
      
      let price = 0;
      if (orderItem) {
        if (remision.tipo_remision === 'BOMBEO') {
          price = orderItem.pump_price || 0;
        } else {
          price = orderItem.unit_price || 0;
        }
      }
      
      let amount = price * volume;
      
      // Apply VAT if enabled and order requires invoice
      if (includeVAT && order?.requires_invoice) {
        amount *= (1 + VAT_RATE);
      }
      
      acc[clientId].volume += volume;
      acc[clientId].amount += amount;
      return acc;
    }, {} as Record<string, { clientName: string; volume: number; amount: number }>);

    return Object.values(clientSummary)
      .map(summary => ({ 
        name: summary.clientName, 
        value: summary.amount, // Use amount instead of volume for better business insight
        volume: summary.volume 
      }))
      .sort((a, b) => b.value - a.value); // Sort by amount
  }, [filteredRemisiones, salesData, includeVAT]);

  const clientChartOptions = useMemo((): ApexOptions => ({
    chart: {
      type: 'pie' as const,
      background: 'transparent',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        speed: 600
      },
      dropShadow: {
        enabled: true,
        top: 2,
        left: 2,
        blur: 4,
        opacity: 0.1
      }
    },
    colors: ['#10B981', '#059669', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#ECFDF5', '#F0FDF4'],
    labels: (includeVAT ? clientAmountData : clientVolumeData).map(item => item.name).slice(0, 6).concat((includeVAT ? clientAmountData : clientVolumeData).length > 6 ? ['Otros'] : []),
    dataLabels: {
      enabled: true,
      formatter: (val: number) => {
        if (val < 4) return ''; // Hide very small percentages
        return `${val.toFixed(1)}%`;
      },
      style: {
        fontSize: '12px',
        fontWeight: 600,
        colors: ['#ffffff'],
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      dropShadow: {
        enabled: true,
        blur: 3,
        opacity: 0.6
      }
    },
    stroke: {
      width: 2,
      colors: ['#ffffff']
    },
    legend: {
      position: 'bottom',
      fontSize: '12px',
      fontWeight: 600,
      fontFamily: 'Inter, system-ui, sans-serif',
      formatter: (seriesName: string, opts: any) => {
        // Truncate long client names and add value
        const name = seriesName.length > 15 ? seriesName.substring(0, 15) + '...' : seriesName;
        const percentage = opts.w.globals.series[opts.seriesIndex] / 
          opts.w.globals.series.reduce((a: number, b: number) => a + b, 0) * 100;
        // Only show percentage for values over 1%
        const percentText = percentage > 1 ? ` (${percentage.toFixed(1)}%)` : '';
        return `${name}${percentText}`;
      },
      markers: {
        size: 10
      },
      itemMargin: {
        horizontal: 12,
        vertical: 6
      }
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      style: {
        fontSize: '12px',
        fontFamily: 'Inter, system-ui, sans-serif'
      },
      y: {
        formatter: (val: number) => includeVAT ? formatCurrency(val) : val.toFixed(2) + ' m³'
      },
      marker: {
        show: true
      }
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '0%' // Solid pie chart
        }
      }
    },
    responsive: [{
      breakpoint: 768,
      options: {
        legend: {
          position: 'bottom',
          fontSize: '11px',
          itemMargin: {
            horizontal: 8,
            vertical: 4
          }
        }
      }
    }]
  }), [includeVAT, clientAmountData, clientVolumeData]);

  const clientChartSeries = useMemo(() => {
    const dataToUse = includeVAT ? clientAmountData : clientVolumeData;
    return dataToUse.slice(0, 6).map(item => item.value).concat(
      dataToUse.length > 6 
        ? [dataToUse.slice(6).reduce((sum, item) => sum + item.value, 0)] 
        : []
    );
  }, [clientAmountData, clientVolumeData, includeVAT]);

  const clientVolumeChartOptions = useMemo((): ApexOptions => ({
    chart: {
      type: 'pie' as const,
      background: 'transparent',
      fontFamily: 'Inter, sans-serif',
      toolbar: {
        show: false
      },
      animations: {
        enabled: true,
        speed: 300
      }
    },
    colors: ['#3EB56D', '#2D8450', '#5DC78A', '#206238', '#83D7A5', '#174D2B'],
    labels: (includeVAT ? clientAmountData : clientVolumeData).map(item => item.name).slice(0, 6).concat((includeVAT ? clientAmountData : clientVolumeData).length > 6 ? ['Otros'] : []),
    dataLabels: {
      enabled: true,
      formatter: (val: number) => {
        if (val < 3) return ''; // Hide very small percentages
        return `${val.toFixed(1)}%`;
      },
      style: {
        fontSize: '11px',
        fontWeight: 500,
        colors: ['#ffffff']
      },
      dropShadow: {
        enabled: true,
        blur: 2,
        opacity: 0.5
      }
    },
    stroke: {
      width: 1,
      colors: ['#ffffff']
    },
    legend: {
      position: 'bottom',
      fontSize: '11px',
      fontWeight: 500,
      formatter: (seriesName: string, opts: any) => {
        // Truncate long client names and add value
        const name = seriesName.length > 15 ? seriesName.substring(0, 15) + '...' : seriesName;
        const percentage = opts.w.globals.series[opts.seriesIndex] / 
          opts.w.globals.series.reduce((a: number, b: number) => a + b, 0) * 100;
        // Only show percentage for values over 1%
        const percentText = percentage > 1 ? ` (${percentage.toFixed(1)}%)` : '';
        return `${name}${percentText}`;
      },
      markers: {
        size: 8
      },
      itemMargin: {
        horizontal: 8,
        vertical: 4
      }
    },
    tooltip: {
      y: {
        formatter: (val: number) => includeVAT ? formatCurrency(val) : val.toFixed(2) + ' m³'
      }
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '0%' // Solid pie chart
        }
      }
    },
    responsive: [{
      breakpoint: 768,
      options: {
        legend: {
          position: 'bottom',
          itemMargin: {
            horizontal: 5,
            vertical: 0
          }
        }
      }
    }]
  }), [includeVAT, clientAmountData, clientVolumeData]);

  const clientVolumeSeries = useMemo(() => {
    // Limit to top 5 clients, and combine the rest as "Others"
    const chartData = includeVAT ? [...clientAmountData] : [...clientVolumeData];
    let series: number[] = [];
    
    if (chartData.length > 5) {
      const top5 = chartData.slice(0, 5);
      const others = chartData.slice(5).reduce((sum, item) => sum + item.value, 0);
      
      series = top5.map(item => item.value);
      
      if (others > 0) {
        series.push(others);
      }
    } else {
      series = chartData.map(item => item.value);
    }
    
    return series;
  }, [clientVolumeData, clientAmountData, includeVAT]);

  const COLORS_CASH = ['#10B981', '#3B82F6']; // Green, Blue
  const COLORS_CLIENTS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#a4de6c', '#d0ed57', '#ff7300'];

  // Add these helper functions
  const handleCurrentMonth = () => {
    setStartDate(startOfMonth(new Date()));
    setEndDate(endOfMonth(new Date()));
  };
  
  const handlePreviousMonth = () => {
    if (startDate) {
      const prevMonth = startOfMonth(addMonths(startDate, -1));
      setStartDate(prevMonth);
      setEndDate(endOfMonth(prevMonth));
    }
  };
  
  const handleDateRangeSelect = (date: Date | undefined) => {
    if (!date) return;
    
    if (!startDate || (startDate && endDate)) {
      // First selection or new selection after a complete range
      setStartDate(date);
      setEndDate(undefined);
    } else {
      // Second selection, complete the range
      if (date < startDate) {
        setEndDate(startDate);
        setStartDate(date);
      } else {
        setEndDate(date);
      }
    }
  };

  // Excel Export Function
  const exportToExcel = () => {
    try {
      // Prepare data for export - same structure as the table
      const excelData = filteredRemisionesWithVacioDeOlla.map((remision, index) => {
        // Find the order for this remision
        const order = salesData.find(o => o.id === remision.order_id);
        
        // Handle virtual vacío de olla entries
        if (remision.isVirtualVacioDeOlla) {
          const orderItem = remision.originalOrderItem;
          const price = parseFloat(orderItem.unit_price) || parseFloat(orderItem.empty_truck_price) || 0;
          const volume = parseFloat(orderItem.empty_truck_volume) || parseFloat(orderItem.volume) || 1;
          const subtotal = parseFloat(orderItem.total_price) || (price * volume);
          
          // The remision number should already be assigned correctly from the virtual remision creation
          const assignedRemisionNumber = remision.remision_number;
          
          const date = order?.delivery_date ? 
            new Date(order.delivery_date + 'T00:00:00') : 
            new Date();
          const formattedDate = isValid(date) ? 
            format(date, 'dd/MM/yyyy', { locale: es }) : 
            'Fecha inválida';
          
          return {
            'Remisión': assignedRemisionNumber,
            'Fecha': formattedDate,
            'Cliente': order?.clientName || remision.order?.clients?.business_name || 'N/A',
            'Código Producto': 'SER001',
            'Producto': 'VACIO DE OLLA',
            'Volumen (m³)': volume.toFixed(1),
            'Precio de Venta': `$${price.toFixed(2)}`,
            'SubTotal': `$${subtotal.toFixed(2)}`,
            'Tipo Facturación': order?.requires_invoice ? 'Fiscal' : 'Efectivo',
            'Número de Orden': order?.order_number || 'N/A'
          };
        }
        
        // Handle regular remisiones
        const orderItems = order?.items || [];
        const recipeCode = remision.recipe?.recipe_code;
        
        const orderItem = orderItems.find((item: any) => {
          if (remision.tipo_remision === 'BOMBEO' && item.has_pump_service) {
            return true;
          }
          return item.product_type === recipeCode || 
            (item.recipe_id && item.recipe_id.toString() === recipeCode);
        });
        
        let price = 0;
        const volume = remision.volumen_fabricado || 0;
        const isEmptyTruck = recipeCode === 'SER001' || orderItem?.product_type === 'VACÍO DE OLLA';
        const displayVolume = isEmptyTruck ? 1 : volume;
        
        if (orderItem) {
          if (remision.tipo_remision === 'BOMBEO') {
            price = orderItem.pump_price || 0;
          } else if (isEmptyTruck) {
            price = orderItem.unit_price || 0;
          } else {
            price = orderItem.unit_price || 0;
          }
        }
        
        const subtotal = price * displayVolume;
        
        // Fix date handling to avoid timezone issues
        const date = remision.fecha ? 
          new Date(remision.fecha + 'T00:00:00') : 
          new Date();
        const formattedDate = isValid(date) ? 
          format(date, 'dd/MM/yyyy', { locale: es }) : 
          'Fecha inválida';
        
        return {
          'Remisión': remision.remision_number,
          'Fecha': formattedDate,
          'Cliente': order?.clientName || remision.order?.clients?.business_name || 'N/A',
          'Código Producto': remision.tipo_remision === 'BOMBEO' ? 'SER002' : 
            recipeCode === 'SER001' || orderItem?.product_type === 'VACÍO DE OLLA' ? 'SER001' : 
            recipeCode || 'N/A',
          'Producto': remision.tipo_remision === 'BOMBEO' ? 'SERVICIO DE BOMBEO' : 
            recipeCode === 'SER001' || orderItem?.product_type === 'VACÍO DE OLLA' ? 'VACIO DE OLLA' : 
            'CONCRETO PREMEZCLADO',
          'Volumen (m³)': displayVolume.toFixed(1),
          'Precio de Venta': `$${price.toFixed(2)}`,
          'SubTotal': `$${subtotal.toFixed(2)}`,
          'Tipo Facturación': order?.requires_invoice ? 'Fiscal' : 'Efectivo',
          'Número de Orden': order?.order_number || 'N/A'
        };
      });

      // Add summary row
      const summaryRow = {
        'Remisión': 'TOTAL',
        'Fecha': '',
        'Cliente': '',
        'Código Producto': '',
        'Producto': '',
        'Volumen (m³)': summaryMetrics.totalVolume.toFixed(1),
        'Precio de Venta': '',
        'SubTotal': `$${includeVAT ? summaryMetrics.totalAmountWithVAT.toFixed(2) : summaryMetrics.totalAmount.toFixed(2)}`,
        'Tipo Facturación': '',
        'Número de Orden': ''
      };

      excelData.push(summaryRow);

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const columnWidths = [
        { wch: 15 }, // Remisión
        { wch: 12 }, // Fecha
        { wch: 25 }, // Cliente
        { wch: 15 }, // Código Producto
        { wch: 20 }, // Producto
        { wch: 12 }, // Volumen
        { wch: 15 }, // Precio de Venta
        { wch: 15 }, // SubTotal
        { wch: 15 }, // Tipo Facturación
        { wch: 15 }  // Número de Orden
      ];
      worksheet['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte de Ventas');

      // Generate filename with date range
      const startDateStr = startDate ? format(startDate, 'dd-MM-yyyy') : 'fecha';
      const endDateStr = endDate ? format(endDate, 'dd-MM-yyyy') : 'fecha';
      const filename = `Reporte_Ventas_${startDateStr}_${endDateStr}.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, filename);

      // Show success message (optional - you might want to add a toast notification)
      console.log('Excel file exported successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      // You might want to show an error notification here
    }
  };

  return (
    <div className="container mx-auto p-6">
      {/* Layout Toggle */}
      <div className="flex items-center justify-end space-x-2 mb-4">
        <Label htmlFor="layout-toggle">Vista Actual</Label>
        <Switch
          id="layout-toggle"
          checked={layoutType === 'powerbi'}
          onCheckedChange={(checked) => setLayoutType(checked ? 'powerbi' : 'current')}
        />
        <Label htmlFor="layout-toggle">Vista PowerBI</Label>
      </div>

      {layoutType === 'current' && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Reporte de Ventas Mensual</CardTitle>
              <CardDescription>
                {dateRangeText}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                {/* Main Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  {/* Plant Context Display */}
                  <div className="flex flex-col">
                    <Label className="mb-1">Planta</Label>
                    <PlantContextDisplay showLabel={false} />
                    {currentPlant && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Filtrando por: {currentPlant.name}
                      </div>
                    )}
                  </div>
                  
                  {/* Date Range Picker */}
                  <div className="flex flex-col flex-1">
                    <Label htmlFor="dateRange" className="mb-1">Rango de Fechas</Label>
                    <DateRangePickerWithPresetsComponent
                      dateRange={{
                        from: startDate || new Date(),
                        to: endDate || new Date()
                      }}
                      onDateRangeChange={(range: DateRange | undefined) => {
                        if (range?.from) setStartDate(range.from);
                        if (range?.to) setEndDate(range.to);
                      }}
                    />
                  </div>
                </div>
                
                {/* Client Filter */}
                <div className="flex flex-col flex-1">
                  <Label htmlFor="clientFilter" className="mb-1">Cliente</Label>
                  <Select value={clientFilter} onValueChange={handleClientFilterChange}>
                    <SelectTrigger id="clientFilter" className="w-full">
                      <SelectValue placeholder="Todos los clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {clients.map((client, index) => (
                        <SelectItem key={`${client.id}-${index}`} value={client.id}> 
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Search Input */}
                <div className="flex flex-col flex-1">
                  <Label htmlFor="search" className="mb-1">Buscar</Label>
                  <div className="relative">
                    <Input
                      id="search"
                      type="text"
                      placeholder="Buscar por remisión, cliente o producto..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="pl-9"
                    />
                    <svg
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>
                
                {/* VAT Toggle for Current Layout */}
                <div className="flex flex-col">
                  <Label className="mb-1">Incluir IVA</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="vat-toggle-current"
                      checked={includeVAT}
                      onCheckedChange={setIncludeVAT}
                    />
                    <Label htmlFor="vat-toggle-current" className="text-sm">
                      {includeVAT ? 'Sí' : 'No'}
                    </Label>
                  </div>
                </div>
              </div>
              
              {/* VAT Status Indicator */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                    <span className="font-medium">
                      📍 Planta: {currentPlant?.name || 'Todas'}
                    </span>
                    {clientFilter !== 'all' && (
                      <span>
                        👤 Cliente: {clients.find(c => c.id === clientFilter)?.name || 'N/A'}
                      </span>
                    )}
                    {includeVAT && (
                      <span className="flex items-center space-x-1">
                        <span>💰 Con IVA</span>
                        <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                          IVA ACTIVO
                        </Badge>
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    📊 {filteredRemisionesWithVacioDeOlla.length} elementos mostrados
                  </div>
                </div>
              </div>
              
              {/* Dashboard Cards - Similar to Power BI */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Total Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Cash Amount */}
                    <Card className="bg-green-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg text-green-800">Efectivo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-700">
                          {includeVAT ? formatCurrency(summaryMetrics.cashAmountWithVAT) : formatCurrency(summaryMetrics.cashAmount)}
                        </div>
                        {includeVAT && (
                          <p className="text-xs text-muted-foreground mt-1">Con IVA</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* Invoice Amount */}
                    <Card className="bg-blue-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg text-blue-800">Fiscal</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-700">
                          {includeVAT ? formatCurrency(summaryMetrics.invoiceAmountWithVAT) : formatCurrency(summaryMetrics.invoiceAmount)}
                        </div>
                        {includeVAT && (
                          <p className="text-xs text-muted-foreground mt-1">Con IVA</p>
                        )}
                      </CardContent>
                    </Card>
                    
                    {/* Total Amount */}
                    <Card className="bg-gray-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg text-gray-800">Total</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-gray-700">
                          {includeVAT ? formatCurrency(summaryMetrics.totalAmountWithVAT) : formatCurrency(summaryMetrics.totalAmount)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {includeVAT ? 'Con IVA' : 'Sin IVA'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Product Type Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                        {/* Concrete */}
                     <Card className="overflow-hidden border-0 shadow-md">
                        <CardHeader className="p-3 pb-1 bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                            <CardTitle className="text-sm font-semibold text-blue-700">CONCRETO PREMEZCLADO</CardTitle>
                        </CardHeader>
                         <CardContent className='p-3'>
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <div className="text-2xl font-bold text-slate-800">
                                         {summaryMetrics.concreteVolume.toFixed(1)}
                                     </div>
                                    <p className="text-xs text-slate-500 font-medium">Volumen (m³)</p>
                                </div>
                                 <div>
                                     <div className="text-2xl font-bold text-slate-800">
                                         ${includeVAT ? summaryMetrics.weightedConcretePriceWithVAT.toFixed(2) : summaryMetrics.weightedConcretePrice.toFixed(2)}
                                     </div>
                                    <p className="text-xs text-slate-500 font-medium text-right">
                                        PRECIO PONDERADO {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
                              {Object.entries(concreteByRecipe)
                                .sort(([, a], [, b]) => b.volume - a.volume)
                                .map(([recipe, data], index) => (
                                  <Badge key={`ventas-recipe-${index}-${recipe}`} variant="outline" className="bg-blue-50 text-xs">
                                    {recipe}: {data.volume.toFixed(1)} m³
                                  </Badge>
                                ))}
                            </div>
                        </CardContent>
                     </Card>
                    
                    {/* Pumping */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">SERVICIO DE BOMBEO</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-3xl font-bold mb-2">
                          {summaryMetrics.pumpVolume.toFixed(1)}
                        </div>
                        <p className="text-sm text-muted-foreground">Volumen (m³)</p>
                      </CardContent>
                      <CardFooter className="pt-0 border-t">
                        <div className="w-full">
                          <span className="text-sm text-muted-foreground">SubTotal</span>
                          <div className="text-lg font-semibold">
                            ${formatNumberWithUnits(includeVAT ? summaryMetrics.pumpAmount * (1 + VAT_RATE) : summaryMetrics.pumpAmount)}
                          </div>
                          {includeVAT && (
                            <p className="text-xs text-muted-foreground mt-1">Con IVA</p>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                    
                    {/* Empty Truck */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">VACIO DE OLLA</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="text-3xl font-bold mb-2">
                          {summaryMetrics.emptyTruckVolume.toFixed(1)} 
                        </div>
                        <p className="text-sm text-muted-foreground">Volumen (m³)</p>
                      </CardContent>
                      <CardFooter className="pt-0 border-t">
                        <div className="w-full">
                          <span className="text-sm text-muted-foreground">SubTotal</span>
                          <div className="text-lg font-semibold">
                            ${formatNumberWithUnits(includeVAT ? summaryMetrics.emptyTruckAmount * (1 + VAT_RATE) : summaryMetrics.emptyTruckAmount)}
                          </div>
                          {includeVAT && (
                            <p className="text-xs text-muted-foreground mt-1">Con IVA</p>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  </div>
                </>
              )}
              
              {/* Detailed Remisiones Table */}
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <Tabs defaultValue="remisiones" className="w-full">
                  <div className="flex justify-between items-center mb-4">
                    <TabsList className="grid grid-cols-2">
                      <TabsTrigger value="remisiones">
                        Remisiones ({filteredRemisionesWithVacioDeOlla.length})
                      </TabsTrigger>
                      <TabsTrigger value="summary">
                        Resumen por Cliente
                      </TabsTrigger>
                    </TabsList>
                    <Button 
                      onClick={exportToExcel} 
                      variant="outline" 
                      size="sm"
                      className="flex items-center gap-2"
                      disabled={filteredRemisionesWithVacioDeOlla.length === 0}
                    >
                      <Download className="h-4 w-4" />
                      Exportar Excel
                    </Button>
                  </div>
                  
                  <TabsContent value="remisiones">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Remisión</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>CODIGO PRODUCTO</TableHead>
                            <TableHead>TIPO</TableHead>
                            <TableHead className="text-right">Volumen (m³)</TableHead>
                            <TableHead className="text-right">Precio de venta</TableHead>
                            <TableHead className="text-right">SubTotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRemisionesWithVacioDeOlla.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center py-4">
                                No se encontraron remisiones
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredRemisionesWithVacioDeOlla.map((remision, index) => {
                              // Find the order for this remision
                              const order = salesData.find(o => o.id === remision.order_id);
                              
                              // Handle differently for virtual vacío de olla entries
                              if (remision.isVirtualVacioDeOlla) {
                                const orderItem = remision.originalOrderItem;
                                const price = parseFloat(orderItem.unit_price) || parseFloat(orderItem.empty_truck_price) || 0;
                                const volume = parseFloat(orderItem.empty_truck_volume) || parseFloat(orderItem.volume) || 1;
                                const subtotal = parseFloat(orderItem.total_price) || (price * volume);
                                
                                // Format date from order delivery_date
                                const date = order?.delivery_date ? 
                                  new Date(order.delivery_date + 'T00:00:00') : 
                                  new Date();
                                const formattedDate = isValid(date) ? 
                                  format(date, 'dd/MM/yyyy', { locale: es }) : 
                                  'Fecha inválida';
                                
                                return (
                                  <TableRow key={`${remision.id}-${index}`} className="bg-amber-50/30">
                                    <TableCell className="font-medium">
                                      <div className="flex items-center">
                                        <span>{remision.remision_number}</span>
                                        {order?.requires_invoice ? 
                                          <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 hover:bg-blue-50">Fiscal</Badge> : 
                                          <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 hover:bg-green-50">Efectivo</Badge>
                                        }
                                      </div>
                                    </TableCell>
                                    <TableCell>{remision.tipo_remision}</TableCell>
                                    <TableCell>{formattedDate}</TableCell>
                                    <TableCell>{order?.clientName || remision.order?.clients?.business_name || 'N/A'}</TableCell>
                                    <TableCell>SER001</TableCell>
                                    <TableCell>VACIO DE OLLA</TableCell>
                                    <TableCell className="text-right">{volume.toFixed(1)}</TableCell>
                                    <TableCell className="text-right">${price.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">${subtotal.toFixed(2)}</TableCell>
                                  </TableRow>
                                );
                              }
                              
                              // Original code for regular remisiones
                              const orderItems = order?.items || [];
                              const recipeCode = remision.recipe?.recipe_code;
                              
                              // Find the right order item based on product type
                              const orderItem = orderItems.find((item: any) => {
                                if (remision.tipo_remision === 'BOMBEO' && item.has_pump_service) {
                                  return true;
                                }
                                return item.product_type === recipeCode || 
                                  (item.recipe_id && item.recipe_id.toString() === recipeCode);
                              });
                              
                              // Calculate price and subtotal
                              let price = 0;
                              const volume = remision.volumen_fabricado || 0;
                              // Use a computed value approach instead of reassigning
                              const isEmptyTruck = recipeCode === 'SER001' || orderItem?.product_type === 'VACÍO DE OLLA';
                              const displayVolume = isEmptyTruck ? 1 : volume;
                              
                              if (orderItem) {
                                if (remision.tipo_remision === 'BOMBEO') {
                                  price = orderItem.pump_price || 0;
                                } else if (isEmptyTruck) {
                                  price = orderItem.unit_price || 0;
                                } else {
                                  price = orderItem.unit_price || 0;
                                }
                              }
                              
                              const subtotal = price * displayVolume;
                              
                              // Format date
                              const date = remision.fecha ? 
                                new Date(remision.fecha + 'T00:00:00') : 
                                new Date();
                              const formattedDate = isValid(date) ? 
                                format(date, 'dd/MM/yyyy', { locale: es }) : 
                                'Fecha inválida';
                              
                              return (
                                <TableRow key={`${remision.id}-${index}`}>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center">
                                      <span>{remision.remision_number}</span>
                                      {order?.requires_invoice ? 
                                        <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 hover:bg-blue-50">Fiscal</Badge> : 
                                        <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 hover:bg-green-50">Efectivo</Badge>
                                      }
                                    </div>
                                  </TableCell>
                                  <TableCell>{remision.tipo_remision}</TableCell>
                                  <TableCell>{formattedDate}</TableCell>
                                  <TableCell>{order?.clientName || remision.order?.clients?.business_name || 'N/A'}</TableCell>
                                  <TableCell>
                                    {remision.tipo_remision === 'BOMBEO' ? 'SER002' : 
                                      recipeCode === 'SER001' || orderItem?.product_type === 'VACÍO DE OLLA' ? 'SER001' : 
                                      recipeCode || 'N/A'}
                                  </TableCell>
                                  <TableCell>
                                    {remision.tipo_remision === 'BOMBEO' ? 'SERVICIO DE BOMBEO' : 
                                      recipeCode === 'SER001' || orderItem?.product_type === 'VACÍO DE OLLA' ? 'VACIO DE OLLA' : 
                                      'CONCRETO PREMEZCLADO'}
                                  </TableCell>
                                  <TableCell className="text-right">{displayVolume.toFixed(1)}</TableCell>
                                  <TableCell className="text-right">${price.toFixed(2)}</TableCell>
                                  <TableCell className="text-right">${subtotal.toFixed(2)}</TableCell>
                                </TableRow>
                              );
                            })
                          )}
                          {filteredRemisionesWithVacioDeOlla.length > 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="font-semibold text-right">
                                Total
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {summaryMetrics.totalVolume.toFixed(1)}
                              </TableCell>
                              <TableCell></TableCell>
                              <TableCell className="text-right font-semibold">
                                ${includeVAT ? summaryMetrics.totalAmountWithVAT.toFixed(2) : summaryMetrics.totalAmount.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="summary">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Remisiones</TableHead>
                            <TableHead className="text-right">Volumen Total (m³)</TableHead>
                            <TableHead className="text-right">Monto Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRemisiones.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4">
                                No se encontraron datos
                              </TableCell>
                            </TableRow>
                          ) : (
                            (() => {
                              // Group remisiones by client
                              const clientSummary = filteredRemisiones.reduce((acc: Record<string, { clientName: string; count: number; volume: number; amount: number }>, remision) => {
                                const clientId = remision.order?.client_id || 'unknown';
                                const clientName = remision.order?.clients ? 
                                  (typeof remision.order.clients === 'object' ? 
                                    (remision.order.clients as any).business_name || 'Desconocido' : 'Desconocido') 
                                  : 'Desconocido';
                                
                                if (!acc[clientId]) {
                                  acc[clientId] = {
                                    clientName,
                                    count: 0,
                                    volume: 0,
                                    amount: 0
                                  };
                                }
                                
                                // Find the order for this remision to get the price
                                const order = salesData.find(o => o.id === remision.order_id);
                                const orderItems = order?.items || [];
                                const recipeCode = remision.recipe?.recipe_code;
                                
                                // Find the right order item based on product type - add type annotation
                                const orderItem = orderItems.find((item: any) => {
                                  if (remision.tipo_remision === 'BOMBEO' && item.has_pump_service) {
                                    return true;
                                  }
                                  return item.product_type === recipeCode || 
                                    (item.recipe_id && item.recipe_id.toString() === recipeCode);
                                });
                                
                                // Calculate price and amount
                                let price = 0;
                                const volume = remision.volumen_fabricado || 0;
                                
                                if (orderItem) {
                                  if (remision.tipo_remision === 'BOMBEO') {
                                    price = orderItem.pump_price || 0;
                                  } else if (recipeCode === 'SER001' || orderItem.product_type === 'VACÍO DE OLLA') {
                                    price = orderItem.unit_price || 0;
                                    acc[clientId].count += 1;
                                    acc[clientId].volume += 1; // Count as 1 unit for empty truck
                                    acc[clientId].amount += price * 1;
                                    return acc;
                                  } else {
                                    price = orderItem.unit_price || 0;
                                  }
                                }
                                
                                acc[clientId].count += 1;
                                acc[clientId].volume += volume;
                                acc[clientId].amount += price * volume;
                                
                                return acc;
                              }, {} as Record<string, { clientName: string; count: number; volume: number; amount: number }>);
                              
                              // Convert to array and sort by amount (descending)
                              return Object.values(clientSummary)
                                .sort((a: any, b: any) => b.amount - a.amount)
                                .map((summary: any, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">
                                      {summary.clientName}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {summary.count}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      {summary.volume.toFixed(1)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      ${summary.amount.toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ));
                            })()
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {layoutType === 'powerbi' && (
        <>
          <Card className="mb-6">
             <CardHeader className='pb-2'>
                <div className='flex justify-between items-center'>
                 <CardTitle className="text-xl font-semibold">REPORTE DE VENTAS MENSUAL</CardTitle>
                 <span className='text-sm text-muted-foreground'>
                    {format(new Date(), 'dd-MMM-yy hh:mm a', { locale: es })} {/* Adjust date format if needed */}
                 </span>
                </div>
             </CardHeader>
            <CardContent>
                {/* Filters Section */}
                <Card className='mb-6 border-gray-300'>
                    <CardHeader className='pb-2 pt-2'>
                        <CardTitle className='text-sm font-medium'>FILTROS</CardTitle>
                    </CardHeader>
                    <CardContent className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pb-4'>
                        {/* Plant Context Display */}
                        <div className="flex flex-col space-y-1">
                            <Label className="text-xs font-semibold">PLANTA</Label>
                            <PlantContextDisplay showLabel={false} />
                            {currentPlant && (
                              <div className="text-xs text-muted-foreground">
                                Filtrando por: {currentPlant.name}
                              </div>
                            )}
                        </div>
                        
                        {/* Date Range Picker */}
                        <div className="flex flex-col space-y-1 lg:col-span-2">
                            <Label htmlFor="dateRange" className="text-xs font-semibold">Rango de Fecha</Label>
                            <DateRangePickerWithPresetsComponent
                                dateRange={{
                                    from: startDate || new Date(),
                                    to: endDate || new Date()
                                }}
                                onDateRangeChange={(range: DateRange | undefined) => {
                                    if (range?.from) setStartDate(range.from);
                                    if (range?.to) setEndDate(range.to);
                                }}
                                className="h-[40px]"
                            />
                        </div>

                        {/* Resistencia Filter */}
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="resistenciaFilter" className="text-xs font-semibold">RESISTENCIA</Label>
                             <Select value={resistanceFilter} onValueChange={handleResistanceFilterChange}>
                                <SelectTrigger id="resistenciaFilter" className="w-full h-8">
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas</SelectItem>
                                    {resistances.map(res => <SelectItem key={res} value={res}>{res}</SelectItem>)}
                                </SelectContent>
                             </Select>
                        </div>
                        
                        {/* Cliente Original Filter */}
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="clientFilterPowerBI" className="text-xs font-semibold">Cliente</Label>
                            <Select value={clientFilter} onValueChange={handleClientFilterChange}>
                                <SelectTrigger id="clientFilterPowerBI" className="w-full h-8">
                                <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {clients.map((client, index) => (
                                    <SelectItem key={`${client.id}`} value={client.id}>
                                    {client.name}
                                    </SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {/* Efectivo/Fiscal Filter (Placeholder - needs data/logic) */}
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="efectivoFiscalFilter" className="text-xs font-semibold">EFECTIVO/FISCAL</Label>
                             <Select value={efectivoFiscalFilter} onValueChange={handleEfectivoFiscalFilterChange}>
                                <SelectTrigger id="efectivoFiscalFilter" className="w-full h-8">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="efectivo">Efectivo</SelectItem>
                                    <SelectItem value="fiscal">Fiscal</SelectItem>
                                </SelectContent>
                             </Select>
                        </div>
                        
                        {/* Tipo Filter (Placeholder) */}
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="tipoFilter" className="text-xs font-semibold">TIPO</Label>
                             <Select value={tipoFilter} onValueChange={handleTipoFilterChange}>
                                <SelectTrigger id="tipoFilter" className="w-full h-8">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {tipos.map(tipo => <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>)}
                                </SelectContent>
                             </Select>
                        </div>
                        
                        {/* Codigo Producto Filter (Placeholder) */}
                        <div className="flex flex-col space-y-1">
                            <Label htmlFor="codigoProductoFilter" className="text-xs font-semibold">CODIGO PRODUCTO</Label>
                             <Select value={codigoProductoFilter} onValueChange={handleCodigoProductoFilterChange}>
                                <SelectTrigger id="codigoProductoFilter" className="w-full h-8">
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    {productCodes.map(code => <SelectItem key={code} value={code}>{code}</SelectItem>)}
                                </SelectContent>
                             </Select>
                        </div>
                        
                        {/* VAT Toggle */}
                        <div className="flex flex-col space-y-1">
                            <Label className="text-xs font-semibold">INCLUIR IVA</Label>
                            <div className="flex items-center space-x-2 h-8">
                                <Switch
                                    id="vat-toggle"
                                    checked={includeVAT}
                                    onCheckedChange={setIncludeVAT}
                                />
                                <Label htmlFor="vat-toggle" className="text-xs">
                                    {includeVAT ? 'Sí' : 'No'}
                                </Label>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                 {/* Top Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Total de Ventas */}
                    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-center text-2xl font-bold text-slate-800">
                            {includeVAT ? formatCurrency(summaryMetrics.totalAmountWithVAT) : formatCurrency(summaryMetrics.totalAmount)}
                         </CardTitle>
                        <CardDescription className='text-center text-xs font-medium text-slate-500'>
                            Total de ventas {includeVAT ? '(Con IVA)' : '(Subtotal)'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className='p-2'></CardContent>
                    </Card>
                     {/* Volumen (m3) */}
                    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="p-4 pb-0">
                         <CardTitle className="text-center text-2xl font-bold text-slate-800">
                             {summaryMetrics.totalVolume.toFixed(2)}
                         </CardTitle>
                        <CardDescription className='text-center text-xs font-medium text-slate-500'>Volumen (m3)</CardDescription>
                    </CardHeader>
                    <CardContent className='p-2'></CardContent>
                    </Card>
                     {/* Resistencia Ponderada */}
                    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="p-4 pb-0">
                         <CardTitle className="text-center text-2xl font-bold text-slate-800 relative">
                              {summaryMetrics.weightedResistance.toFixed(2)}
                              {summaryMetrics.resistanceTooltip && (
                                 <TooltipProvider>
                                     <Tooltip>
                                         <TooltipTrigger asChild>
                                             <Info className="h-3 w-3 text-blue-500 absolute top-0 right-0 mr-1 mt-1 cursor-help" />
                                         </TooltipTrigger>
                                         <TooltipContent>
                                             <p>{summaryMetrics.resistanceTooltip}</p>
                                         </TooltipContent>
                                     </Tooltip>
                                 </TooltipProvider>
                             )}
                          </CardTitle>
                        <CardDescription className='text-center text-xs font-medium text-slate-500'>RESISTENCIA PONDERADA</CardDescription>
                    </CardHeader>
                     <CardContent className='p-2'></CardContent>
                    </Card>
                </div>

                 {/* Product Breakdown Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Concrete */}
                    <Card className="overflow-hidden border-0 shadow-md">
                        <CardHeader className="p-3 pb-1 bg-gradient-to-r from-blue-50 to-blue-100 border-b">
                            <CardTitle className="text-sm font-semibold text-blue-700">CONCRETO PREMEZCLADO</CardTitle>
                        </CardHeader>
                         <CardContent className='p-3'>
                             <div className="flex justify-between items-start mb-2">
                                 <div>
                                     <div className="text-2xl font-bold text-slate-800">
                                         {summaryMetrics.concreteVolume.toFixed(1)}
                                     </div>
                                    <p className="text-xs text-slate-500 font-medium">Volumen (m³)</p>
                                </div>
                                 <div>
                                     <div className="text-2xl font-bold text-slate-800">
                                         ${includeVAT ? summaryMetrics.weightedConcretePriceWithVAT.toFixed(2) : summaryMetrics.weightedConcretePrice.toFixed(2)}
                                     </div>
                                    <p className="text-xs text-slate-500 font-medium text-right">
                                        PRECIO PONDERADO {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto">
                              {Object.entries(concreteByRecipe)
                                .sort(([, a], [, b]) => b.volume - a.volume)
                                .map(([recipe, data], index) => (
                                  <Badge key={`ventas-recipe-${index}-${recipe}`} variant="outline" className="bg-blue-50 text-xs">
                                    {recipe}: {data.volume.toFixed(1)} m³
                                  </Badge>
                                ))}
                            </div>
                        </CardContent>
                     </Card>
                     {/* Pumping */}
                    <Card className="overflow-hidden border-0 shadow-md">
                        <CardHeader className="p-3 pb-1 bg-gradient-to-r from-emerald-50 to-emerald-100 border-b">
                            <CardTitle className="text-sm font-semibold text-emerald-700">SERVICIO DE BOMBEO</CardTitle>
                        </CardHeader>
                        <CardContent className='p-3 flex justify-between items-start'>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                    {summaryMetrics.pumpVolume.toFixed(1)}
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Volumen (m³)</p>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                    ${includeVAT ? summaryMetrics.weightedPumpPriceWithVAT.toFixed(2) : summaryMetrics.weightedPumpPrice.toFixed(2)}
                                </div>
                                <p className="text-xs text-slate-500 font-medium text-right">
                                    PRECIO PONDERADO {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                </p>
                            </div>
                         </CardContent>
                    </Card>
                     {/* Empty Truck */}
                    <Card className="overflow-hidden border-0 shadow-md">
                        <CardHeader className="p-3 pb-1 bg-gradient-to-r from-amber-50 to-amber-100 border-b">
                            <CardTitle className="text-sm font-semibold text-amber-700">VACIO DE OLLA</CardTitle>
                        </CardHeader>
                        <CardContent className='p-3 flex justify-between items-start'>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                     {summaryMetrics.emptyTruckVolume.toFixed(1)}
                                </div>
                                <p className="text-xs text-slate-500 font-medium">Volumen (m³)</p>
                            </div>
                            <div>
                                <div className="text-2xl font-bold text-slate-800">
                                     ${includeVAT ? summaryMetrics.weightedEmptyTruckPriceWithVAT.toFixed(2) : summaryMetrics.weightedEmptyTruckPrice.toFixed(2)}
                                </div>
                                <p className="text-xs text-slate-500 font-medium text-right">
                                    PRECIO PONDERADO {includeVAT ? '(Con IVA)' : '(Sin IVA)'}
                                </p>
                            </div>
                         </CardContent>
                     </Card>
                 </div>

                 {/* Export Button for PowerBI Layout */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <span>
                      {includeVAT ? 
                        '💡 Mostrando montos con IVA (16%) aplicado a órdenes fiscales' : 
                        '💡 Mostrando montos sin IVA (solo subtotales)'
                      }
                    </span>
                    {includeVAT && (
                      <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                        IVA ACTIVO
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                      Efectivo: {formatCurrency(includeVAT ? summaryMetrics.cashAmountWithVAT : summaryMetrics.cashAmount)}
                    </span>
                    <span className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                      Fiscal: {formatCurrency(includeVAT ? summaryMetrics.invoiceAmountWithVAT : summaryMetrics.invoiceAmount)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium">
                      📍 Planta: {currentPlant?.name || 'Todas'}
                    </span>
                    {clientFilter !== 'all' && (
                      <span className="text-xs">
                        👤 Cliente: {clients.find(c => c.id === clientFilter)?.name || 'N/A'}
                      </span>
                    )}
                    <span className="text-xs">
                      📊 {filteredRemisionesWithVacioDeOlla.length} elementos
                    </span>
                  </div>
                </div>
                <Button 
                  onClick={exportToExcel} 
                  variant="outline" 
                  size="sm"
                  className="flex items-center gap-2"
                  disabled={filteredRemisionesWithVacioDeOlla.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Exportar Excel
                </Button>
              </div>

              {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                    {/* Efectivo/Fiscal Donut */}
                    <Card className="lg:col-span-4 overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                        <CardHeader className="p-4 pb-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                            <CardTitle className="text-sm font-bold text-gray-800 flex items-center justify-between">
                                <span>EFECTIVO/FISCAL</span>
                                {includeVAT && (
                                  <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-200">
                                    Con IVA
                                  </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 h-80 flex items-center justify-center">
                            {typeof window !== 'undefined' && (
                                <Chart
                                    options={{
                                        ...cashInvoiceChartOptions,
                                        colors: ['#10B981', '#3B82F6'], // Enhanced green and blue
                                        chart: {
                                            ...cashInvoiceChartOptions.chart,
                                            background: 'transparent',
                                            animations: {
                                                enabled: true,
                                                speed: 800
                                            }
                                        }
                                    }}
                                    series={cashInvoiceChartSeries}
                                    type="donut"
                                    height="100%"
                                />
                            )}
                        </CardContent>
                    </Card>
                    {/* Codigo Producto Bar Chart */}
                    <Card className="lg:col-span-4 overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                         <CardHeader className="p-4 pb-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                            <CardTitle className="text-sm font-bold text-gray-800">CODIGO PRODUCTO</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 h-80"> {/* Increased height */}
                            {typeof window !== 'undefined' && (
                                <Chart 
                                    options={productCodeChartOptions}
                                    series={productCodeChartSeries}
                                    type="bar"
                                    height="100%"
                                />
                            )}
                        </CardContent>
                     </Card>
                     {/* Cliente Original Pie Chart */}
                    <Card className="lg:col-span-4 overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
                        <CardHeader className="p-4 pb-3 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                            <CardTitle className="text-sm font-bold text-gray-800">Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 h-80"> {/* Increased height */}
                            {typeof window !== 'undefined' && (
                                <Chart
                                    options={{
                                        ...clientChartOptions,
                                        legend: {
                                            ...clientChartOptions.legend,
                                            position: 'bottom',
                                            fontSize: '11px',
                                            formatter: (seriesName, opts) => {
                                                const value = opts.w.globals.series[opts.seriesIndex];
                                                const formattedValue = includeVAT ? 
                                                    formatCurrency(value) : 
                                                    `${formatNumberWithUnits(value)} m³`;
                                                return `${seriesName.length > 15 ? seriesName.substring(0, 15) + '...' : seriesName}: ${formattedValue}`;
                                            }
                                        }
                                    }}
                                    series={clientChartSeries}
                                    type="pie"
                                    height="100%"
                                />
                            )}
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// Helper function to add weighted price/resistance to summary (adjust placement if needed)
interface SummaryMetrics {
  concreteVolume: number;
  pumpVolume: number;
  emptyTruckVolume: number;
  totalVolume: number;
  concreteAmount: number;
  pumpAmount: number;
  emptyTruckAmount: number;
  totalAmount: number;
  cashAmount: number;
  invoiceAmount: number;
  weightedConcretePrice: number;
  weightedPumpPrice: number;
  weightedEmptyTruckPrice: number;
  weightedResistance: number;
  resistanceTooltip?: string;
  // VAT-related metrics
  totalAmountWithVAT: number;
  cashAmountWithVAT: number;
  invoiceAmountWithVAT: number;
  weightedConcretePriceWithVAT: number;
  weightedPumpPriceWithVAT: number;
  weightedEmptyTruckPriceWithVAT: number;
} 