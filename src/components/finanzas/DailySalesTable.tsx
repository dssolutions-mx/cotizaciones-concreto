'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlantAwareDailySalesTable } from '@/hooks/usePlantAwareDailySalesTable';
import { formatCurrency } from '@/lib/utils';

interface DailySalesTableProps {
  date: string;
}

export function DailySalesTable({ date }: DailySalesTableProps) {
  const { orders, isLoading, error, currentPlant } = usePlantAwareDailySalesTable({ date });
  
  if (isLoading) {
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
  
  if (error) {
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
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-2 text-xs text-left text-red-500 overflow-auto max-h-40">
                {error}
              </pre>
            )}
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
            {currentPlant && ` en ${currentPlant.name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-8 text-gray-500">
            <p>No hay órdenes entregadas para mostrar en la fecha seleccionada.</p>
            {currentPlant && (
              <p className="text-sm mt-2">Filtrando por planta: {currentPlant.name}</p>
            )}
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
          {currentPlant && ` - Planta: ${currentPlant.name}`}
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
