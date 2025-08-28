'use client';

import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApexOptions } from 'apexcharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import { usePlantContext } from '@/contexts/PlantContext';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamically import ApexCharts with SSR disabled
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface SalesChartsProps {
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

export const SalesCharts: React.FC<SalesChartsProps> = ({
  includeVAT,
  formatNumberWithUnits,
  formatCurrency,
}) => {
  const { currentPlant } = usePlantContext();
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [historicalRemisiones, setHistoricalRemisiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch historical sales data (last 24 months, independent of date filters)
  useEffect(() => {
    async function fetchHistoricalData() {
      setLoading(true);
      setError(null);

      try {
        // Calculate date range for last 24 months (2 years of historical data)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 24);

        const formattedStartDate = format(startDate, 'yyyy-MM-dd');
        const formattedEndDate = format(endDate, 'yyyy-MM-dd');

        console.log('🔍 SalesCharts: Fetching historical data for period:', {
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          currentPlant: currentPlant?.id || 'ALL PLANTS'
        });

        // Test query to see what's in the database
        const testQuery = supabase
          .from('remisiones')
          .select('fecha, plant_id, volumen_fabricado, tipo_remision')
          .limit(5);
        
        const { data: testData, error: testError } = await testQuery;
        console.log('🧪 SalesCharts: Test query result:', {
          testData,
          testError,
          hasData: testData && testData.length > 0
        });

        // 1. Fetch remisiones directly by their fecha field (matching sales API logic)
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
          console.log('🏭 SalesCharts: Filtering by plant:', currentPlant.id);
        } else {
          console.log('🏭 SalesCharts: No plant filter applied - fetching all plants');
        }

        const { data: remisiones, error: remisionesError } = await remisionesQuery.order('fecha', { ascending: true });

        if (remisionesError) {
          console.error('❌ SalesCharts: Error fetching remisiones:', remisionesError);
          throw remisionesError;
        }

        // Validate data structure
        if (remisiones && remisiones.length > 0) {
          const sampleRemision = remisiones[0];
          console.log('🔍 SalesCharts: Sample remision structure:', {
            id: sampleRemision.id,
            fecha: sampleRemision.fecha,
            plant_id: sampleRemision.plant_id,
            volumen_fabricado: sampleRemision.volumen_fabricado,
            tipo_remision: sampleRemision.tipo_remision,
            order_id: sampleRemision.order_id,
            hasRecipe: !!sampleRemision.recipe,
            hasOrder: !!sampleRemision.order,
            recipeCode: sampleRemision.recipe?.recipe_code,
            orderNumber: sampleRemision.order?.order_number
          });
        }

        console.log('📊 SalesCharts: Remisiones fetched:', {
          count: remisiones?.length || 0,
          sampleData: remisiones?.slice(0, 3) || [],
          dateRange: remisiones?.length > 0 ? {
            first: remisiones[0]?.fecha,
            last: remisiones[remisiones.length - 1]?.fecha
          } : 'No data'
        });

        // Extract order IDs from remisiones
        const orderIdsFromRemisiones = remisiones?.map(r => r.order_id).filter(Boolean) || [];
        const uniqueOrderIds = Array.from(new Set(orderIdsFromRemisiones));

        console.log('📋 SalesCharts: Order IDs extracted:', {
          total: orderIdsFromRemisiones.length,
          unique: uniqueOrderIds.length,
          sampleIds: uniqueOrderIds.slice(0, 5)
        });

        if (uniqueOrderIds.length === 0) {
          console.warn('⚠️ SalesCharts: No orders found for remisiones');
          setHistoricalData([]);
          setHistoricalRemisiones([]);
          setLoading(false);
          return;
        }

        // 2. Fetch all relevant orders (matching sales API logic)
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
            plant_id
          `)
          .in('id', uniqueOrderIds)
          .not('order_status', 'eq', 'cancelled');

        // Apply plant filter if a plant is selected
        if (currentPlant?.id) {
          ordersQuery = ordersQuery.eq('plant_id', currentPlant.id);
        }

        const { data: orders, error: ordersError } = await ordersQuery;

        if (ordersError) {
          console.error('❌ SalesCharts: Error fetching orders:', ordersError);
          throw ordersError;
        }

        console.log('📋 SalesCharts: Orders fetched:', {
          count: orders?.length || 0,
          sampleData: orders?.slice(0, 3) || [],
          plantDistribution: orders?.reduce((acc: any, order) => {
            acc[order.plant_id] = (acc[order.plant_id] || 0) + 1;
            return acc;
          }, {}) || {}
        });

        if (!orders || orders.length === 0) {
          console.warn('⚠️ SalesCharts: No orders found after filtering');
          setHistoricalData([]);
          setHistoricalRemisiones([]);
          setLoading(false);
          return;
        }

        // 3. Fetch order items (matching sales API logic)
        const orderIds = orders.map(order => order.id);
        let orderItemsQuery = supabase
          .from('order_items')
          .select('*')
          .in('order_id', orderIds);

        const { data: orderItems, error: itemsError } = await orderItemsQuery;

        if (itemsError) {
          console.error('❌ SalesCharts: Error fetching order items:', itemsError);
          throw itemsError;
        }

        console.log('📦 SalesCharts: Order items fetched:', {
          count: orderItems?.length || 0,
          sampleData: orderItems?.slice(0, 3) || [],
          priceRanges: orderItems?.reduce((acc: any, item) => {
            if (item.unit_price) {
              const price = parseFloat(item.unit_price);
              if (!acc.min || price < acc.min) acc.min = price;
              if (!acc.max || price > acc.max) acc.max = price;
            }
            return acc;
          }, { min: null, max: null }) || {}
        });

        // 4. Create virtual remisiones for vacío de olla (matching sales API logic)
        const allRemisiones = [...(remisiones || [])];

        // Process each order to create virtual remisiones for vacío de olla
        orders.forEach(order => {
          const items = orderItems?.filter(item => item.order_id === order.id) || [];

          // Find vacío de olla items
          const emptyTruckItem = items.find(
            (item: any) =>
              item.product_type === 'VACÍO DE OLLA' ||
              item.product_type === 'EMPTY_TRUCK_CHARGE' ||
              item.has_empty_truck_charge === true
          );

          if (emptyTruckItem) {
            // Find the remision with the lowest volume for this order to assign its number
            const orderRemisiones = remisiones?.filter(r => r.order_id === order.id) || [];

            // Only create virtual remision if there are actual remisiones for this order
            if (orderRemisiones.length > 0) {
              // Sort by volume ascending and take the first one (lowest volume)
              const sortedRemisiones = orderRemisiones.sort((a, b) =>
                (a.volumen_fabricado || 0) - (b.volumen_fabricado || 0)
              );
              const assignedRemisionNumber = sortedRemisiones[0].remision_number;

              // Create a virtual remision object for this vacío de olla item
              const virtualRemision = {
                id: `vacio-${order.id}-${emptyTruckItem.id}`,
                remision_number: assignedRemisionNumber,
                order_id: order.id,
                fecha: order.delivery_date,
                tipo_remision: 'VACÍO DE OLLA',
                volumen_fabricado: parseFloat(emptyTruckItem.empty_truck_volume) || parseFloat(emptyTruckItem.volume) || 1,
                recipe: { recipe_code: 'SER001' },
                order: {
                  client_id: order.client_id,
                  order_number: order.order_number,
                  requires_invoice: order.requires_invoice
                },
                isVirtualVacioDeOlla: true,
                originalOrderItem: emptyTruckItem
              };

              allRemisiones.push(virtualRemision);
            }
          }
        });

        console.log('🔄 SalesCharts: Virtual remisiones created:', {
          originalCount: remisiones?.length || 0,
          totalCount: allRemisiones.length,
          virtualCount: allRemisiones.length - (remisiones?.length || 0)
        });

        // 5. Combine orders with their items and ALL remisiones (including virtual ones)
        const enrichedOrders = orders.map(order => {
          const items = orderItems?.filter(item => item.order_id === order.id) || [];
          const orderRemisiones = allRemisiones?.filter(r => r.order_id === order.id) || [];

          return {
            ...order,
            items,
            remisiones: orderRemisiones
          };
        });

        console.log('✅ SalesCharts: Data processing complete:', {
          orders: enrichedOrders.length,
          remisiones: allRemisiones.length,
          orderItems: orderItems?.length || 0,
          dateRange: allRemisiones.length > 0 ? {
            first: allRemisiones[0]?.fecha,
            last: allRemisiones[allRemisiones.length - 1]?.fecha
          } : 'No data'
        });

        setHistoricalData(enrichedOrders);
        setHistoricalRemisiones(allRemisiones);
      } catch (error) {
        console.error('❌ SalesCharts: Error fetching historical sales data:', error);
        setError('Error al cargar los datos históricos de ventas. Por favor, intente nuevamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchHistoricalData();
  }, [currentPlant]);

  // Process historical data into monthly series
  const monthlyData = useMemo((): MonthlyData[] => {
    console.log('🔄 SalesCharts: Processing monthly data:', {
      historicalDataLength: historicalData.length,
      historicalRemisionesLength: historicalRemisiones.length
    });

    if (!historicalData.length || !historicalRemisiones.length) {
      console.warn('⚠️ SalesCharts: No data available for monthly processing');
      return [];
    }

    // Get last 24 months for comprehensive historical view
    const months: string[] = [];
    const monthDates: Date[] = [];
    for (let i = 23; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push(format(date, 'MMM yyyy', { locale: es }));
      monthDates.push(new Date(date));
    }

    console.log('📅 SalesCharts: Generated month range:', {
      months: months.slice(0, 5), // Show first 5 months
      totalMonths: months.length
    });

    return months.map((month, index) => {
      // Calculate data for each month based on historical remisiones
      const monthStart = new Date(monthDates[index]);
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      // Filter historical remisiones for this month (including virtual ones)
      const monthRemisiones = historicalRemisiones.filter(remision => {
        if (!remision.fecha) return false;
        const remisionDate = new Date(remision.fecha + 'T00:00:00');
        return remisionDate >= monthStart && remisionDate <= monthEnd;
      });

      // Calculate totals using the same logic as sales API
      let monthTotal = 0;
      let concreteVolume = 0;
      let pumpVolume = 0;
      let vacioVolume = 0;

      // Process each remision (including virtual ones)
      monthRemisiones.forEach(remision => {
        const volume = remision.volumen_fabricado || 0;
        const orderForRemision = historicalData.find(order => order.id === remision.order_id);

        // Find the corresponding order item for pricing
        let orderItemForRemision = null;
        if (orderForRemision?.items) {
          if (remision.isVirtualVacioDeOlla) {
            // For virtual vacío de olla remisiones, use the original order item
            orderItemForRemision = remision.originalOrderItem;
          } else {
            // For regular remisiones, find the matching order item
            const recipeCode = remision.recipe?.recipe_code;
            orderItemForRemision = orderForRemision.items.find((item: any) => {
              if (remision.tipo_remision !== 'BOMBEO' && (item.product_type === recipeCode || (item.recipe_id && item.recipe_id.toString() === recipeCode))) {
                return true;
              }
              return false;
            });
          }
        }

        if (orderItemForRemision) {
          let price = 0;

          if (remision.tipo_remision === 'BOMBEO') {
            price = orderItemForRemision.pump_price || 0;
            pumpVolume += volume;
          } else if (remision.isVirtualVacioDeOlla) {
            // Handle vacío de olla pricing (matching sales API logic)
            if (orderItemForRemision.total_price) {
              // If total_price is available, use it directly (already includes volume)
              price = parseFloat(orderItemForRemision.total_price);
              // Don't multiply by volume since total_price already includes it
              monthTotal += price;
              vacioVolume += volume;
            } else {
              // Otherwise calculate from unit_price * volume
              price = parseFloat(orderItemForRemision.unit_price) ||
                      parseFloat(orderItemForRemision.empty_truck_price) || 0;
              vacioVolume += volume;
            }
          } else {
            // Regular concrete pricing
            price = orderItemForRemision.unit_price || 0;
            concreteVolume += volume;
          }

          // Only add to monthTotal if we haven't already handled it (for vacío de olla with total_price)
          if (!(remision.isVirtualVacioDeOlla && orderItemForRemision.total_price)) {
            monthTotal += price * volume;
          }
        }
      });

      // Log detailed information for months with data
      if (monthRemisiones.length > 0) {
        console.log(`📊 SalesCharts: Month ${month} processing:`, {
          remisionesCount: monthRemisiones.length,
          monthTotal,
          concreteVolume,
          pumpVolume,
          vacioVolume,
          dateRange: `${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]}`
        });
      }

      return {
        month,
        sales: monthTotal,
        concreteVolume,
        pumpVolume,
        vacioVolume,
        hasData: monthTotal > 0 || concreteVolume > 0 || pumpVolume > 0 || vacioVolume > 0
      };
    });
  }, [historicalData, historicalRemisiones]);

  // Create chart series data
  const salesTrendChartSeries = useMemo(() => {
    console.log('📊 SalesCharts: Creating chart series from monthly data:', {
      monthlyDataLength: monthlyData.length,
      monthlyDataSample: monthlyData.slice(0, 3),
      hasDataItems: monthlyData.filter(item => item.hasData).length
    });

    if (!monthlyData.length) {
      console.warn('⚠️ SalesCharts: No monthly data available for chart series');
      return [
        { name: 'Ventas Históricas', data: [] },
        { name: 'Volumen Concreto (m³)', data: [] },
        { name: 'Volumen Bombeo (m³)', data: [] },
        { name: 'Volumen Vacío (m³)', data: [] }
      ];
    }

    // Filter out months with no data
    const filteredData = monthlyData.filter(item => item.hasData);

    console.log('🔍 SalesCharts: Filtered data for chart:', {
      totalMonths: monthlyData.length,
      monthsWithData: filteredData.length,
      sampleFilteredData: filteredData.slice(0, 3)
    });

    // If no data, return empty arrays
    if (filteredData.length === 0) {
      console.warn('⚠️ SalesCharts: No months have data after filtering - using sample data for testing');
      
      // Return sample data for testing purposes
      const sampleData = new Array(24).fill(0).map((_, index) => {
        if (index >= 18) { // Last 6 months
          return Math.random() * 1000 + 500; // Random values between 500-1500
        }
        return 0;
      });
      
      return [
        { name: 'Ventas Históricas (Sin IVA) - MUESTRA', data: sampleData, type: 'line', yAxisIndex: 0 },
        { name: 'Volumen Concreto (m³) - MUESTRA', data: sampleData.map(v => v / 100), type: 'line', yAxisIndex: 1 },
        { name: 'Volumen Bombeo (m³) - MUESTRA', data: sampleData.map(v => v / 200), type: 'line', yAxisIndex: 1 },
        { name: 'Volumen Vacío (m³) - MUESTRA', data: sampleData.map(v => v / 500), type: 'line', yAxisIndex: 1 }
      ];
    }

    // Create historical data series mapped to 24-month categories
    const historicalSalesData = new Array(24).fill(0);
    const concreteVolumeData = new Array(24).fill(0);
    const pumpVolumeData = new Array(24).fill(0);
    const vacioVolumeData = new Array(24).fill(0);

    // Map filtered data to the correct month positions
    monthlyData.forEach((item, index) => {
      if (item.hasData) {
        historicalSalesData[index] = includeVAT ? item.sales * 1.16 : item.sales; // 16% VAT
        concreteVolumeData[index] = item.concreteVolume;
        pumpVolumeData[index] = item.pumpVolume;
        vacioVolumeData[index] = item.vacioVolume;
      }
    });

    console.log('📈 SalesCharts: Chart series data created:', {
      salesData: historicalSalesData.filter(val => val > 0).length,
      concreteData: concreteVolumeData.filter(val => val > 0).length,
      pumpData: pumpVolumeData.filter(val => val > 0).length,
      vacioData: vacioVolumeData.filter(val => val > 0).length,
      sampleSalesData: historicalSalesData.slice(0, 5),
      sampleConcreteData: concreteVolumeData.slice(0, 5)
    });

    return [
      {
        name: includeVAT ? 'Ventas Históricas (Con IVA)' : 'Ventas Históricas (Sin IVA)',
        data: historicalSalesData,
        type: 'line',
        yAxisIndex: 0
      },
      {
        name: 'Volumen Concreto (m³)',
        data: concreteVolumeData,
        type: 'line',
        yAxisIndex: 1
      },
      {
        name: 'Volumen Bombeo (m³)',
        data: pumpVolumeData,
        type: 'line',
        yAxisIndex: 1
      },
      {
        name: 'Volumen Vacío (m³)',
        data: vacioVolumeData,
        type: 'line',
        yAxisIndex: 1
      }
    ];
  }, [monthlyData, includeVAT]);

  // Chart options for historical trends
  const salesTrendChartOptions = useMemo((): ApexOptions => {
    // Always generate 24-month categories for comprehensive historical view
    const categories = [];
    for (let i = 23; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      categories.push(format(date, 'MMM yyyy', { locale: es }));
    }

    return {
      chart: {
        type: 'line' as const,
        background: 'transparent',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
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
          top: 3,
          left: 3,
          blur: 6,
          opacity: 0.2
        }
      },
      colors: ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B'],
      stroke: {
        curve: 'smooth',
        width: [4, 3, 3, 3],
        dashArray: [0, 0, 0, 0]
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.2,
          opacityFrom: 0.6,
          opacityTo: 0.1,
          stops: [0, 100]
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
        }
      },
      grid: {
        borderColor: '#E5E7EB',
        strokeDashArray: 5,
        xaxis: {
          lines: {
            show: true
          }
        },
        yaxis: {
          lines: {
            show: true
          }
        }
      }
    };
  }, [includeVAT]);

  if (loading) {
    return (
      <div className="space-y-12 mt-12">
        <div className="grid grid-cols-1 gap-8">
          <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
            <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
              <CardTitle className="text-lg font-bold text-gray-800">TENDENCIA DE VENTAS HISTÓRICA</CardTitle>
              <p className="text-xs text-gray-500 mt-1">📊 24 meses históricos | Ventas + Volúmenes (Concreto, Bombeo, Vacío) | Independiente del filtro de fecha</p>
            </CardHeader>
            <CardContent className="p-6 h-96">
              <div className="h-full flex items-center justify-center">
                <Skeleton className="w-full h-full" />
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
              <CardTitle className="text-lg font-bold text-gray-800">TENDENCIA DE VENTAS HISTÓRICA</CardTitle>
              <p className="text-xs text-gray-500 mt-1">📊 24 meses históricos | Ventas + Volúmenes (Concreto, Bombeo, Vacío) | Independiente del filtro de fecha</p>
            </CardHeader>
            <CardContent className="p-6 h-96">
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
            <CardTitle className="text-lg font-bold text-gray-800">TENDENCIA DE VENTAS HISTÓRICA</CardTitle>
            <p className="text-xs text-gray-500 mt-1">📊 24 meses históricos | Ventas + Volúmenes (Concreto, Bombeo, Vacío) | Independiente del filtro de fecha</p>
            {currentPlant && (
              <p className="text-xs text-blue-600 mt-1">🏭 Planta: {currentPlant.name}</p>
            )}
            
            {/* Debug Information */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                <p className="font-semibold text-yellow-800">🔍 DEBUG INFO:</p>
                <p>Historical Data: {historicalData.length} orders</p>
                <p>Remisiones: {historicalRemisiones.length} items</p>
                <p>Monthly Data: {monthlyData.length} months</p>
                <p>Loading: {loading ? 'Yes' : 'No'}</p>
                <p>Error: {error || 'None'}</p>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-6 h-96">
            {typeof window !== 'undefined' && salesTrendChartSeries.length > 0 && salesTrendChartSeries[0].data.length > 0 ? (
              <div className="h-full">
                <Chart
                  options={salesTrendChartOptions}
                  series={salesTrendChartSeries}
                  type="line"
                  height="100%"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos históricos</div>
                  <div className="text-sm">No se encontraron datos de ventas para el período seleccionado</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
