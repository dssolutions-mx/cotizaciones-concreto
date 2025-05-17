import { Suspense } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';
import KPICard from '@/components/finanzas/KPICard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinancialDashboardSkeleton } from '@/components/finanzas/FinancialDashboardSkeleton';
import { Beaker, FileCheck, DollarSign, Pipette, Calendar } from 'lucide-react';

// Enable ISR with 5-minute revalidation interval
export const revalidate = 300; // 5 minutes in seconds

export default async function DailySalesReportPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Get the date from query params or use today's date
  const dateParam = searchParams.date ? String(searchParams.date) : format(new Date(), 'yyyy-MM-dd');
  
  return (
    <Suspense fallback={<FinancialDashboardSkeleton />}>
      <div className="container mx-auto p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Reporte de Ventas Diarias</h1>
          <div className="flex items-center gap-2">
            <DatePickerWithButton currentDate={dateParam} />
          </div>
        </div>
        
        <RoleProtectedSection
          allowedRoles={['PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
          action="ver información de ventas diarias"
        >
          <div className="space-y-8">
            {/* Sales metrics summary cards with separate suspense boundary */}
            <Suspense fallback={<SalesMetricsSkeleton />}>
              <SalesMetrics date={dateParam} />
            </Suspense>
            
            {/* Daily sales table */}
            <Suspense fallback={<DailySalesTableSkeleton />}>
              <DailySalesTable date={dateParam} />
            </Suspense>
          </div>
        </RoleProtectedSection>
      </div>
    </Suspense>
  );
}

// Date Picker with Button Component
function DatePickerWithButton({ currentDate }: { currentDate: string }) {
  return (
    <form className="flex items-center space-x-2">
      <div className="flex items-center space-x-2 bg-muted p-2 rounded-md">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <input 
          type="date" 
          name="date" 
          defaultValue={currentDate}
          className="bg-transparent text-sm outline-none"
        />
      </div>
      <button 
        type="submit"
        className="bg-primary text-primary-foreground px-3 py-2 text-sm rounded-md hover:bg-primary/90"
      >
        Filtrar
      </button>
    </form>
  );
}

// Sales Metrics Section Skeleton
function SalesMetricsSkeleton() {
  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Ventas Diarias</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="h-full border-s-4 border-s-gray-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-sm font-medium">Cargando...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-1">--</div>
              <p className="text-xs text-muted-foreground">Cargando datos...</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// Daily Sales Table Skeleton
function DailySalesTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Ventas</CardTitle>
        <CardDescription>
          Cargando detalles de ventas...
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full flex items-center justify-center">
          <p className="text-muted-foreground">Cargando datos de ventas...</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Sales Metrics Section - Displays KPI cards
async function SalesMetrics({ date }: { date: string }) {
  // Initialize metrics with default values
  let metricsData = {
    totalConcreteVolume: 0,
    totalPumpingVolume: 0,
    totalSubtotal: 0,
    totalWithVAT: 0,
    totalOrders: 0
  };
  
  try {
    // Create a service client for data fetching
    const serviceClient = createServiceClient();
    
    // Fetch orders for the selected date with final_amount
    // Using more inclusive filtering to ensure data shows up
    const { data: orders, error } = await serviceClient
      .from('orders')
      .select(`
        id,
        order_number,
        requires_invoice,
        final_amount,
        invoice_amount,
        total_amount,
        order_status
      `)
      .eq('delivery_date', date)
      .not('order_status', 'eq', 'CANCELLED');
    
    if (error) throw error;
    
    console.log(`Found ${orders?.length || 0} orders for date ${date}`, 
                orders?.map(o => ({ id: o.id, status: o.order_status, final: o.final_amount })));
    
    // If we have orders, fetch their items to calculate volumes and amounts
    if (orders && orders.length > 0) {
      // Filter orders to only include those with a final_amount
      const validOrders = orders.filter(order => order.final_amount !== null);
      console.log(`${validOrders.length} orders have final_amount`);
      
      // Store the total orders count
      metricsData.totalOrders = validOrders.length;
      
      // Get order IDs to fetch items
      const orderIds = validOrders.map(order => order.id);
      
      // Fetch all order items for these orders
      const { data: orderItems, error: itemsError } = await serviceClient
        .from('order_items')
        .select('*')
        .in('order_id', orderIds);
      
      if (itemsError) throw itemsError;
      
      console.log(`Found ${orderItems?.length || 0} order items`);
      
      // Calculate metrics from order items - USE DELIVERED VOLUMES
      if (orderItems && orderItems.length > 0) {
        // Process each order item
        orderItems.forEach(item => {
          // Add concrete volume (prefer concrete_volume_delivered if available)
          if (!item.has_empty_truck_charge) {
            const concreteVolume = item.concrete_volume_delivered || item.volume || 0;
            metricsData.totalConcreteVolume += Number(concreteVolume);
          }
          
          // Add pumping volume (prefer pump_volume_delivered if available)
          if (item.has_pump_service) {
            const pumpVolume = item.pump_volume_delivered || item.pump_volume || 0;
            metricsData.totalPumpingVolume += Number(pumpVolume);
          }
        });
        
        // Calculate financial totals from orders directly
        validOrders.forEach(order => {
          // Add subtotal (final_amount is the actual delivered amount)
          if (order.final_amount) {
            metricsData.totalSubtotal += Number(order.final_amount);
          }
          
          // Add total with VAT (invoice_amount already includes VAT if applicable)
          if (order.invoice_amount) {
            // If invoice_amount is available, use it (it includes VAT)
            metricsData.totalWithVAT += Number(order.invoice_amount);
          } else if (order.final_amount) {
            // Otherwise use final_amount (for cash orders without VAT)
            metricsData.totalWithVAT += Number(order.final_amount);
          }
        });
      }
    }
    
    console.log("Final metrics data:", metricsData);
  } catch (error) {
    console.error("Error fetching sales metrics:", error);
  }

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-4">Resumen de Ventas Entregadas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Concrete Volume */}
        <KPICard
          title="Volumen de Concreto Entregado"
          value={`${metricsData.totalConcreteVolume.toFixed(2)} m³`}
          description={`${metricsData.totalOrders} órdenes entregadas`}
          icon={<Beaker className="h-5 w-5 text-blue-500" />}
          className="border-s-4 border-s-blue-500"
        />
        
        {/* Pumping Volume */}
        <KPICard
          title="Volumen de Bombeo Entregado"
          value={`${metricsData.totalPumpingVolume.toFixed(2)} m³`}
          description="Servicios de bombeo realizados"
          icon={<Pipette className="h-5 w-5 text-purple-500" />}
          className="border-s-4 border-s-purple-500"
        />
        
        {/* Subtotal */}
        <KPICard
          title="Subtotal"
          value={formatCurrency(metricsData.totalSubtotal)}
          description="Monto antes de impuestos"
          icon={<FileCheck className="h-5 w-5 text-green-500" />}
          className="border-s-4 border-s-green-500"
        />
        
        {/* Total with VAT */}
        <KPICard
          title="Total con IVA"
          value={formatCurrency(metricsData.totalWithVAT)}
          description="Monto total incluidos impuestos"
          icon={<DollarSign className="h-5 w-5 text-red-500" />}
          className="border-s-4 border-s-red-500"
        />
      </div>
    </section>
  );
}

// Daily Sales Table - Shows detailed information for each order
async function DailySalesTable({ date }: { date: string }) {
  // Initialize orders array
  let orders: any[] = [];
  let fetchError: Error | null = null;
  
  try {
    // Create a server-side Supabase client
    const supabase = await createServerSupabaseClient();
    
    // Fetch orders for the selected date
    // Using more inclusive filtering to ensure data shows up
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        requires_invoice,
        delivery_date,
        final_amount,
        invoice_amount,
        total_amount,
        credit_status,
        order_status,
        clients (
          id,
          business_name
        )
      `)
      .eq('delivery_date', date)
      .not('order_status', 'eq', 'CANCELLED')
      .order('delivery_time', { ascending: true });
    
    if (error) throw error;
    
    console.log(`DailySalesTable - Found ${data?.length || 0} orders for ${date}`);
    
    // If we have orders, fetch their items for detailed information
    if (data && data.length > 0) {
      // Filter orders to only include those with a final_amount
      const validData = data.filter(order => order.final_amount !== null);
      console.log(`DailySalesTable - ${validData.length} orders have final_amount`);
      
      // Enhanced orders with items
      orders = await Promise.all(validData.map(async (order) => {
        // Fetch order items for this order
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id);
        
        if (itemsError) throw itemsError;
        
        // Calculate totals for this order - USE DELIVERED VOLUMES
        let concreteVolume = 0;
        let pumpingVolume = 0;
        
        // Get amounts directly from the order
        let subtotal = Number(order.final_amount || 0);
        let totalWithVAT = Number(order.invoice_amount || order.final_amount || 0);
        let vat = totalWithVAT - subtotal; // Calculate VAT as the difference
        
        // Product names
        let productNames: string[] = [];
        
        // Process items to get volumes and product names - USE DELIVERED VOLUMES when available
        if (items && items.length > 0) {
          items.forEach(item => {
            // Add concrete volume (prefer concrete_volume_delivered if available)
            if (!item.has_empty_truck_charge) {
              const concreteVol = item.concrete_volume_delivered || item.volume || 0;
              concreteVolume += Number(concreteVol);
              
              // Add product name if not already included
              if (item.product_type && !productNames.includes(item.product_type)) {
                productNames.push(item.product_type);
              }
            }
            
            // Add pumping volume (prefer pump_volume_delivered if available)
            if (item.has_pump_service) {
              const pumpVol = item.pump_volume_delivered || item.pump_volume || 0;
              pumpingVolume += Number(pumpVol);
            }
          });
        }
        
        return {
          ...order,
          concreteVolume,
          pumpingVolume,
          subtotal,
          vat,
          totalWithVAT,
          productNames: productNames.join(', ')
        };
      }));
    }
  } catch (error) {
    console.error("Error loading daily sales data:", error);
    fetchError = error as Error;
  }
  
  if (fetchError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>
            No se pudieron cargar los datos de ventas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-600">
            <h3 className="font-semibold mb-1">Error al cargar los datos</h3>
            <p className="text-sm">Por favor, intente más tarde o contacte a soporte.</p>
            {process.env.NODE_ENV === 'development' && <pre className="mt-2 text-xs text-left text-red-500 overflow-auto max-h-40">{JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError), 2)}</pre>}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Detalle de Ventas Entregadas</CardTitle>
          <CardDescription>
            No hay ventas entregadas registradas para la fecha seleccionada
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-gray-500">
            <p>No hay órdenes entregadas para mostrar en la fecha seleccionada.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Ventas Entregadas</CardTitle>
        <CardDescription>
          Concreto entregado en órdenes del {date}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="cash">Efectivo</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
          </TabsList>
          
          {/* All Orders */}
          <TabsContent value="all">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden #</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Volumen Concreto</TableHead>
                  <TableHead className="text-right">Volumen Bombeo</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.clients?.business_name}</TableCell>
                    <TableCell>{order.requires_invoice ? 'Fiscal' : 'Efectivo'}</TableCell>
                    <TableCell>{order.productNames || 'N/A'}</TableCell>
                    <TableCell className="text-right">{order.concreteVolume.toFixed(2)} m³</TableCell>
                    <TableCell className="text-right">{order.pumpingVolume.toFixed(2)} m³</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.subtotal)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.vat)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(order.totalWithVAT)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
          
          {/* Cash Orders */}
          <TabsContent value="cash">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden #</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Volumen Concreto</TableHead>
                  <TableHead className="text-right">Volumen Bombeo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders
                  .filter(order => !order.requires_invoice)
                  .map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.clients?.business_name}</TableCell>
                      <TableCell>{order.productNames || 'N/A'}</TableCell>
                      <TableCell className="text-right">{order.concreteVolume.toFixed(2)} m³</TableCell>
                      <TableCell className="text-right">{order.pumpingVolume.toFixed(2)} m³</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.subtotal)}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TabsContent>
          
          {/* Fiscal Orders */}
          <TabsContent value="fiscal">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden #</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Volumen Concreto</TableHead>
                  <TableHead className="text-right">Volumen Bombeo</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders
                  .filter(order => order.requires_invoice)
                  .map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number}</TableCell>
                      <TableCell>{order.clients?.business_name}</TableCell>
                      <TableCell>{order.productNames || 'N/A'}</TableCell>
                      <TableCell className="text-right">{order.concreteVolume.toFixed(2)} m³</TableCell>
                      <TableCell className="text-right">{order.pumpingVolume.toFixed(2)} m³</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.subtotal)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.vat)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.totalWithVAT)}</TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
} 