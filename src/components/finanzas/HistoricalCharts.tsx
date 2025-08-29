'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApexOptions } from 'apexcharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { usePlantContext } from '@/contexts/PlantContext';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import ApexCharts with SSR disabled
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface HistoricalChartsProps {
  includeVAT: boolean;
  formatNumberWithUnits: (value: number) => string;
  formatCurrency: (value: number) => string;
}

interface MonthlyData {
  month: string;
  sales: number;
  concreteVolume: number;
  pumpVolume: number;
  vacioVolume: number;
  hasData: boolean;
}

export const HistoricalCharts: React.FC<HistoricalChartsProps> = ({
  includeVAT,
  formatNumberWithUnits,
  formatCurrency,
}) => {
  const { currentPlant } = usePlantContext();
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [historicalRemisiones, setHistoricalRemisiones] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchProgress, setFetchProgress] = useState<string>('');

  // Fetch historical sales data (all available data, independent of date filters)
  useEffect(() => {
    async function fetchHistoricalData() {
      setLoading(true);
      setError(null);

      try {
        console.log('🔍 HistoricalCharts: Fetching historical data with SAME logic as ventas page:', {
          currentPlant: currentPlant?.id || 'ALL PLANTS'
        });

        // Use the SAME approach as ventas page: get MARCH 2025 data specifically
        const startOfMonth = new Date(2025, 2, 1); // March 1, 2025 (month is 0-indexed)
        const endOfMonth = new Date(2025, 2, 31); // March 31, 2025
        
        const formattedStartDate = format(startOfMonth, 'yyyy-MM-dd');
        const formattedEndDate = format(endOfMonth, 'yyyy-MM-dd');
        
        console.log('📅 HistoricalCharts: Using MARCH 2025 date range:', { formattedStartDate, formattedEndDate });

        // 1. Fetch remisiones for current month (SAME as ventas page)
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

        if (remisionesError) {
          console.error('❌ HistoricalCharts: Error fetching remisiones:', remisionesError);
          throw remisionesError;
        }

        console.log('✅ HistoricalCharts: Remisiones fetched for current month:', remisiones?.length || 0);

        if (!remisiones || remisiones.length === 0) {
          console.warn('⚠️ HistoricalCharts: No remisiones found for current month');
          setHistoricalData([]);
          setHistoricalRemisiones([]);
          setLoading(false);
          return;
        }

        // Extract order IDs from remisiones (SAME as ventas page)
        const orderIdsFromRemisiones = remisiones?.map(r => r.order_id).filter(Boolean) || [];
        const uniqueOrderIds = Array.from(new Set(orderIdsFromRemisiones));

        console.log('📋 HistoricalCharts: Order IDs extracted:', {
          total: orderIdsFromRemisiones.length,
          unique: uniqueOrderIds.length,
          sampleIds: uniqueOrderIds.slice(0, 5)
        });

        if (uniqueOrderIds.length === 0) {
          console.warn('⚠️ HistoricalCharts: No orders found for remisiones');
          setHistoricalData([]);
          setHistoricalRemisiones([]);
          setLoading(false);
          return;
        }

        // 2. Fetch all relevant orders (SAME as ventas page)
        let ordersQuery = supabase
          .from('orders')
          .select(`
            id,
            order_number,
            delivery_date,
            client_id,
            construction_site,
            requires_invoice,
            order_status,
            plant_id,
            final_amount
          `)
          .in('id', uniqueOrderIds)
          .not('order_status', 'eq', 'cancelled');

        // Apply plant filter if a plant is selected
        if (currentPlant?.id) {
          ordersQuery = ordersQuery.eq('plant_id', currentPlant.id);
        }

        const { data: orders, error: ordersError } = await ordersQuery;
        
        if (ordersError) {
          console.error('❌ HistoricalCharts: Error fetching orders:', ordersError);
          throw ordersError;
        }
        
        const allOrders = orders || [];

        console.log('📋 HistoricalCharts: Orders fetched:', {
          count: allOrders.length,
          sampleData: allOrders.slice(0, 3)
        });

        if (allOrders.length === 0) {
          console.warn('⚠️ HistoricalCharts: No orders found after filtering');
          setHistoricalData([]);
          setHistoricalRemisiones([]);
          setLoading(false);
          return;
        }

        // 3. Fetch order items (SAME as ventas page)
        const orderIds = allOrders.map(order => order.id);
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            id,
            order_id,
            product_type,
            unit_price,
            volume,
            concrete_volume_delivered,
            pump_volume_delivered,
            has_pump_service,
            pump_price,
            has_empty_truck_charge,
            empty_truck_price,
            empty_truck_volume,
            recipe_id
          `)
          .in('order_id', orderIds);

        if (itemsError) {
          console.error('❌ HistoricalCharts: Error fetching order items:', itemsError);
          throw itemsError;
        }

        console.log('📦 HistoricalCharts: Order items fetched:', {
          count: orderItems?.length || 0,
          sampleData: orderItems?.slice(0, 3) || []
        });

        // 4. Combine orders with their items and remisiones (SAME as ventas page)
        const enrichedOrders = allOrders.map(order => {
          const items = orderItems?.filter(item => item.order_id === order.id) || [];
          const orderRemisiones = remisiones?.filter(r => r.order_id === order.id) || [];

          return {
            ...order,
            items,
            remisiones: orderRemisiones
          };
        });

        console.log('✅ HistoricalCharts: Data processing complete:', {
          orders: enrichedOrders.length,
          remisiones: remisiones.length,
          orderItems: orderItems?.length || 0
        });

        setHistoricalData(enrichedOrders);
        setHistoricalRemisiones(remisiones);
        setOrderItems(orderItems || []);
        setFetchProgress('');
      } catch (error) {
        console.error('❌ HistoricalCharts: Error fetching historical sales data:', error);
        setError('Error al cargar los datos históricos de ventas. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchHistoricalData();
  }, [currentPlant]);

  // Process monthly data from historical remisiones
  const monthlyData = useMemo(() => {
    console.log('🔄 HistoricalCharts: Processing monthly data:', {
      historicalDataLength: historicalData.length,
      historicalRemisionesLength: historicalRemisiones.length
    });

    if (historicalData.length === 0) {
      console.warn('⚠️ HistoricalCharts: No historical data available for monthly processing');
      return [];
    }

    // Create month buckets from orders (using the EXACT SAME logic as ventas page)
    const monthBuckets = new Map<string, {
      month: string;
      monthKey: string;
      orders: any[];
      totalSales: number;
      concreteVolume: number;
      hasData: boolean;
    }>();

    // Process each order and group by month using the EXACT SAME logic as ventas page
    historicalData.forEach(order => {
      if (!order.delivery_date) return;

      const date = new Date(order.delivery_date + 'T00:00:00');
      const monthKey = format(date, 'yyyy-MM');
      const monthLabel = format(date, 'MMM yyyy', { locale: es });

      // ONLY PROCESS MARCH 2025 DATA - skip other months
      if (monthKey !== '2025-03') {
        console.log(`⏭️ Skipping order ${order.order_number} - not March 2025 (${monthKey})`);
        return;
      }

      if (!monthBuckets.has(monthKey)) {
        monthBuckets.set(monthKey, {
          month: monthLabel,
          monthKey,
          orders: [],
          totalSales: 0,
          concreteVolume: 0,
          hasData: false
        });
      }

      const bucket = monthBuckets.get(monthKey)!;
      bucket.orders.push(order);
      bucket.hasData = true;

      // Use the EXACT SAME calculation logic as ventas page - ONLY CONCRETE for now
      const orderItemsForOrder = orderItems.filter(oi => oi.order_id === order.id);
      
      // ONLY CONCRETE VOLUME & SALES for debugging
      let orderConcreteVolume = 0;
      let orderConcreteAmount = 0;
      
      // Get remisiones for this order - ONLY MARCH 2025 REMISIONES
      const orderRemisiones = historicalRemisiones.filter(r => {
        if (r.order_id === order.id) {
          // Check if remision fecha is actually in March 2025
          const remisionDate = new Date(r.fecha + 'T00:00:00');
          const remisionMonthKey = format(remisionDate, 'yyyy-MM');
          
          if (remisionMonthKey !== '2025-03') {
            console.log(`⏭️ Skipping remision ${r.id} - not March 2025 (${remisionMonthKey})`);
            return false;
          }
          return true;
        }
        return false;
      });
      
      console.log(`📊 Order ${order.order_number}: Found ${orderRemisiones.length} March 2025 remisiones`);
      
      // Process remisiones for concrete ONLY (same as ventas page)
      orderRemisiones.forEach(remision => {
        // Skip BOMBEO and VACIO for now - only CONCRETO
        if (remision.tipo_remision === 'BOMBEO' || remision.tipo_remision === 'VACIO') {
          return;
        }
        
        const volume = remision.volumen_fabricado || 0;
        const recipeCode = remision.recipe?.recipe_code;
        
        // Find the right order item for this remision, EXCLUDING "Vacío de Olla" types
        const orderItemForRemision = orderItemsForOrder.find((item: any) => {
          // Explicitly skip if this item looks like a "Vacío de Olla" charge
          if (
            item.product_type === 'VACÍO DE OLLA' ||
            item.product_type === 'EMPTY_TRUCK_CHARGE' ||
            (recipeCode === 'SER001' && (item.product_type === recipeCode || item.has_empty_truck_charge)) ||
            item.has_empty_truck_charge === true
          ) {
            return false;
          }
          // Match concrete product by recipe code
          if (item.product_type === recipeCode || (item.recipe_id && item.recipe_id.toString() === recipeCode)) {
            return true;
          }
          return false;
        });
        
        if (orderItemForRemision) {
          const price = orderItemForRemision.unit_price || 0;
          orderConcreteVolume += volume;
          orderConcreteAmount += price * volume;
          
          console.log(`🔍 Concrete calculation for order ${order.order_number}:`, {
            remisionId: remision.id,
            remisionType: remision.tipo_remision,
            recipeCode,
            volume,
            unitPrice: price,
            amount: price * volume,
            runningTotal: orderConcreteAmount
          });
        } else {
          console.warn(`⚠️ No order item found for remision ${remision.id} with recipe ${recipeCode}`);
        }
      });

      // TOTAL SALES = only concrete for now
      let orderTotalSales = orderConcreteAmount;
      
      // Validate final calculations
      if (isNaN(orderTotalSales) || orderTotalSales < 0) {
        console.warn(`⚠️ Invalid sales calculation for order ${order.order_number}: ${orderTotalSales}`);
        orderTotalSales = 0;
      }

      // Add to bucket totals
      bucket.totalSales += orderTotalSales;
      bucket.concreteVolume += orderConcreteVolume;

      console.log(`📊 Order ${order.order_number} (${monthLabel}): Sales=${orderTotalSales.toFixed(2)}, Concrete=${orderConcreteVolume.toFixed(1)}`);
    });

    // Convert to array and sort by month key
    const monthlyDataArray = Array.from(monthBuckets.values())
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Clean and validate the data
    const cleanedMonthlyData = monthlyDataArray.map(month => ({
      ...month,
      totalSales: Math.max(0, month.totalSales || 0),
      concreteVolume: Math.max(0, month.concreteVolume || 0)
    }));

    console.log('📅 HistoricalCharts: Monthly data processed (CONCRETE ONLY):', {
      totalMonths: cleanedMonthlyData.length,
      months: cleanedMonthlyData.map(m => m.month),
      sampleData: cleanedMonthlyData.slice(0, 3).map(m => ({
        month: m.month,
        orders: m.orders.length,
        sales: m.totalSales,
        concrete: m.concreteVolume
      }))
    });

    // Confirm we only have March data
    if (cleanedMonthlyData.length > 0) {
      console.log('✅ HistoricalCharts: Confirmed - Only processing March 2025 data');
      console.log('📊 March 2025 Summary:', {
        totalOrders: cleanedMonthlyData[0].orders.length,
        totalSales: cleanedMonthlyData[0].totalSales,
        totalConcreteVolume: cleanedMonthlyData[0].concreteVolume
      });
      
      // Compare with reference KPIs
      const referenceTotal = 3128.0 * 1925.16;
      const difference = cleanedMonthlyData[0].totalSales - referenceTotal;
      console.log('🔍 Comparison with Reference KPIs:', {
        referenceVolume: '3,128.0 m³',
        referencePrice: '$1,925.16/m³',
        referenceTotal: `$${referenceTotal.toFixed(2)}`,
        calculatedTotal: `$${cleanedMonthlyData[0].totalSales.toFixed(2)}`,
        difference: `$${difference.toFixed(2)}`,
        percentageDiff: `${((difference / referenceTotal) * 100).toFixed(2)}%`
      });
    }

    return cleanedMonthlyData;
  }, [historicalData, orderItems, historicalRemisiones]);

  // Create chart series data
  const salesTrendChartSeries = useMemo(() => {
    console.log('📊 HistoricalCharts: Creating chart series from monthly data:', {
      monthlyDataLength: monthlyData.length,
      monthlyDataSample: monthlyData.slice(0, 3)
    });

    if (monthlyData.length === 0) {
      console.warn('⚠️ HistoricalCharts: No monthly data available for chart series');
      return [];
    }

    // Filter only months with data
    const filteredMonthlyData = monthlyData.filter(item => item.hasData);
    
    console.log('🔍 HistoricalCharts: Filtered data for chart:', {
      totalMonths: monthlyData.length,
      monthsWithData: filteredMonthlyData.length
    });

    if (filteredMonthlyData.length === 0) {
      console.warn('⚠️ HistoricalCharts: No months with data available for chart');
      return [];
    }

    // Create data arrays for each series - ONLY CONCRETE for debugging
    const historicalSalesData = filteredMonthlyData.map(item => 
      includeVAT ? item.totalSales * 1.16 : item.totalSales
    );
    const concreteVolumeData = filteredMonthlyData.map(item => item.concreteVolume);

    console.log('📈 HistoricalCharts: Chart series data created (CONCRETE ONLY):', {
      salesData: historicalSalesData.filter(val => val > 0).length,
      concreteData: concreteVolumeData.filter(val => val > 0).length,
      sampleSales: historicalSalesData.slice(0, 3),
      sampleConcrete: concreteVolumeData.slice(0, 3),
      totalSalesSum: historicalSalesData.reduce((sum, val) => sum + val, 0),
      totalConcreteSum: concreteVolumeData.reduce((sum, val) => sum + val, 0)
    });

    const chartSeries = [
      {
        name: includeVAT ? 'Ventas Históricas (Con IVA)' : 'Ventas Históricas (Sin IVA)',
        data: historicalSalesData,
        type: 'line' as const,
        yAxisIndex: 0
      },
      {
        name: 'Volumen Concreto (m³)',
        data: concreteVolumeData,
        type: 'line' as const,
        yAxisIndex: 1
      }
    ];

    return chartSeries;
  }, [monthlyData, includeVAT]);

  // Chart options for historical trends
  const salesTrendChartOptions = useMemo((): ApexOptions => {
    // Generate categories from months with actual data
    const categories = monthlyData.filter(item => item.hasData).map(item => item.month);

    console.log('📊 HistoricalCharts: Chart options created with categories:', {
      categoryCount: categories.length,
      categories: categories.slice(0, 5)
    });

    // Ensure we have at least one category
    if (categories.length === 0) {
      console.warn('⚠️ HistoricalCharts: No categories available for chart options');
      return {
        chart: { type: 'line' as const },
        series: [],
        xaxis: { categories: [] }
      };
    }

    return {
      chart: {
        type: 'line' as const,
        background: 'transparent',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        height: 400,
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        animations: {
          enabled: true,
          speed: 1000,
          animateGradually: {
            enabled: true,
            delay: 150
          }
        },
        dropShadow: {
          enabled: true,
          top: 2,
          left: 2,
          blur: 4,
          opacity: 0.3
        },
        foreColor: '#374151'
      },
      colors: ['#059669', '#2563EB', '#7C3AED', '#D97706'],
      stroke: {
        curve: 'smooth',
        width: [5, 4, 4, 4],
        dashArray: [0, 0, 0, 0]
      },
      fill: {
        type: 'solid',
        opacity: [0.1, 0.1, 0.1, 0.1]
      },
      markers: {
        size: [6, 5, 5, 5],
        colors: ['#059669', '#2563EB', '#7C3AED', '#D97706'],
        strokeColors: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'],
        strokeWidth: 2,
        hover: {
          size: 8
        }
      },
      xaxis: {
        categories,
        labels: {
          style: {
            fontSize: '12px',
            fontWeight: 500,
            colors: '#374151',
            fontFamily: 'Inter, system-ui, sans-serif'
          },
          rotate: -45,
          rotateAlways: false,
          hideOverlappingLabels: true
        },
        axisBorder: {
          show: true,
          color: '#D1D5DB'
        },
        axisTicks: {
          show: true,
          color: '#D1D5DB'
        },
        crosshairs: {
          show: true,
          width: 1,
          position: 'back',
          opacity: 0.9,
          stroke: {
            color: '#775DD0',
            width: 1,
            dashArray: 3
          }
        }
      },
      yaxis: [
        {
          // Primary y-axis for sales (currency)
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#10B981',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) {
                return 'Sin datos';
              }
              return formatCurrency(val);
            }
          },
          axisBorder: {
            show: true,
            color: '#10B981'
          },
          title: {
            text: includeVAT ? 'Ventas (Con IVA)' : 'Ventas (Sin IVA)',
            style: {
              color: '#10B981',
              fontSize: '12px',
              fontWeight: '600'
            }
          }
        },
        {
          // Secondary y-axis for volumes (m³)
          opposite: true,
          labels: {
            style: {
              fontSize: '12px',
              fontWeight: 500,
              colors: '#3B82F6',
              fontFamily: 'Inter, system-ui, sans-serif'
            },
            formatter: (val: number) => {
              if (val === null || val === undefined || isNaN(val)) {
                return 'Sin datos';
              }
              return `${val.toFixed(0)} m³`;
            }
          },
          axisBorder: {
            show: true,
            color: '#3B82F6'
          },
          title: {
            text: 'Volumen (m³)',
            style: {
              color: '#3B82F6',
              fontSize: '12px',
              fontWeight: '600'
            }
          }
        }
      ],
      dataLabels: {
        enabled: false
      },
      tooltip: {
        enabled: true,
        theme: 'light',
        style: {
          fontSize: '14px',
          fontFamily: 'Inter, system-ui, sans-serif'
        },
        y: {
          formatter: (val: number, { seriesIndex }: any) => {
            if (val === null || val === undefined || isNaN(val)) {
              return 'Sin datos';
            }
            
            // First series (index 0) is sales - format as currency
            if (seriesIndex === 0) {
              return formatCurrency(val);
            }
            
            // Other series (index 1-3) are volumes - format as m³
            return `${val.toFixed(1)} m³`;
          }
        },
        x: {
          formatter: (val: any) => String(val)
        }
      },
      legend: {
        position: 'top',
        horizontalAlign: 'left',
        fontSize: '14px',
        fontFamily: 'Inter, system-ui, sans-serif',
        markers: {
          size: 12
        },
        itemMargin: {
          horizontal: 20,
          vertical: 8
        },
        onItemClick: {
          toggleDataSeries: true
        },
        onItemHover: {
          highlightDataSeries: true
        }
      },
      grid: {
        borderColor: '#E5E7EB',
        strokeDashArray: 3,
        xaxis: {
          lines: {
            show: true
          }
        },
        yaxis: {
          lines: {
            show: true
          }
        },
        padding: {
          top: 10,
          right: 10,
          bottom: 10,
          left: 10
        }
      },
      responsive: [
        {
          breakpoint: 768,
          options: {
            chart: {
              height: 300
            },
            legend: {
              position: 'bottom'
            }
          }
        }
      ]
    };
  }, [monthlyData, includeVAT]);

  if (loading) {
    return (
      <div className="space-y-12 mt-12">
        <div className="grid grid-cols-1 gap-8">
          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
            <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-800">VENTAS DE CONCRETO - MARZO 2025</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                🔍 Solo concreto de MARZO 2025 | Debug | Misma lógica que ventas page
              </p>
            </CardHeader>
            <CardContent className="p-6 min-h-[500px]">
              <div className="h-full flex flex-col items-center justify-center space-y-4">
                <Skeleton className="w-full h-32" />
                {fetchProgress && (
                  <div className="text-center text-sm text-blue-600">
                    {fetchProgress}
                  </div>
                )}
                <div className="text-center text-xs text-gray-500">
                  Cargando datos históricos...
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-12 mt-12">
        <div className="grid grid-cols-1 gap-8">
          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
            <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-800">VENTAS DE CONCRETO - MARZO 2025</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                🔍 Solo concreto de MARZO 2025 | Debug | Misma lógica que ventas page
              </p>
            </CardHeader>
            <CardContent className="p-6 min-h-[500px]">
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-red-500">
                  <div className="text-lg font-semibold mb-2">Error al cargar datos</div>
                  <div className="text-sm">{error}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 mt-12">
      {/* Historical Trends - Full Width */}
      <div className="grid grid-cols-1 gap-8">
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500" />
          <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-800">VENTAS DE CONCRETO - MARZO 2025</CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              🔍 Solo concreto de MARZO 2025 | Debug | Misma lógica que ventas page
            </p>
            {currentPlant && (
              <p className="text-xs text-blue-600 mt-1">🏭 Planta: {currentPlant.name}</p>
            )}
            
            {/* Debug Information */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <p className="font-semibold text-yellow-800">🔍 DEBUG INFO:</p>
                <p>Historical Data: {historicalData.length} orders</p>
                <p>Order Items: {orderItems.length} items</p>
                <p>Monthly Data: {monthlyData.length} months</p>
                <p>Loading: {loading ? 'Yes' : 'No'}</p>
                <p>Error: {error || 'None'}</p>
                <p className="font-semibold text-green-700">✅ Using SAME calculation as sales system</p>
                {monthlyData.length > 0 && (
                  <p>Data Range: {monthlyData[0]?.month} to {monthlyData[monthlyData.length - 1]?.month}</p>
                )}
                {monthlyData.length > 0 && (
                  <p>Total Sales: {formatCurrency(monthlyData.reduce((sum, m) => sum + m.totalSales, 0))}</p>
                )}
                <p className="font-semibold text-blue-700">📊 Using KPI calculation logic (volume × unit_price)</p>
                <p className="font-semibold text-purple-700">🎯 Using EXACT SAME logic as ventas page (remisiones + order_items)</p>
                <p className="font-semibold text-orange-700">📅 Only fetching current month data (same as ventas page)</p>
                <p className="font-semibold text-red-700">🔍 DEBUG MODE: Only concrete data</p>
                <p className="font-semibold text-purple-700">📅 Fetching MARCH 2025 data specifically</p>
                <p className="font-semibold text-green-700">🎯 Only processing March 2025 orders</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-6 min-h-[500px]">
            {typeof window !== 'undefined' && 
             salesTrendChartSeries.length > 0 && 
             salesTrendChartSeries[0]?.data && 
             salesTrendChartSeries[0].data.length > 0 &&
             monthlyData.filter(item => item.hasData).length > 0 ? (
              <div className="h-full">
                {/* Debug chart data */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                    <p className="font-semibold text-blue-800">📊 CHART DATA DEBUG:</p>
                    <p>Series Count: {salesTrendChartSeries.length}</p>
                    <p>Categories: {salesTrendChartOptions.xaxis?.categories?.join(', ') || 'None'}</p>
                    <p>First Series Data: {salesTrendChartSeries[0]?.data?.slice(0, 5).join(', ')}</p>
                    <p>Monthly Data: {monthlyData.length} months total</p>
                    <p>Months with Data: {monthlyData.filter(item => item.hasData).length}</p>
                    <p>Total Sales: {formatCurrency(monthlyData.reduce((sum, m) => sum + m.totalSales, 0))}</p>
                    <p>Total Concrete Volume: {monthlyData.reduce((sum, m) => sum + m.concreteVolume, 0).toFixed(1)} m³</p>
                    <p className="font-semibold text-green-700">✅ Using concrete_volume_delivered & pump_volume_delivered</p>
                    <p className="font-semibold text-blue-700">📊 Using KPI logic: volume × unit_price (not *_delivered fields)</p>
                    <p className="font-semibold text-purple-700">🎯 Using EXACT SAME logic as ventas page</p>
                    <p className="font-semibold text-red-700">🔍 DEBUG MODE: Only concrete data</p>
                  </div>
                )}
                
                <Chart
                  key={`chart-${monthlyData.length}-${currentPlant?.id || 'all'}-${salesTrendChartSeries[0]?.data?.length || 0}`}
                  options={salesTrendChartOptions}
                  series={salesTrendChartSeries}
                  type="line"
                  height={400}
                />
                {monthlyData.length > 0 && (
                  <div className="mt-2 text-center text-xs text-gray-500">
                    Datos disponibles: {monthlyData[0]?.month} a {monthlyData[monthlyData.length - 1]?.month}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos históricos</div>
                  <div className="text-sm">
                    {monthlyData.length === 0 
                      ? 'No se encontraron datos de ventas para el período seleccionado'
                      : 'Los datos están siendo procesados, por favor espere...'
                    }
                  </div>
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mt-2 text-xs text-gray-400">
                      Debug: Series={salesTrendChartSeries.length}, 
                      Data={salesTrendChartSeries[0]?.data?.length || 0}, 
                      Months={monthlyData.length}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
