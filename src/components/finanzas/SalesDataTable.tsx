'use client';

import React from 'react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";

interface SalesDataTableProps {
  loading: boolean;
  filteredRemisionesWithVacioDeOlla: any[];
  filteredRemisiones: any[];
  salesData: any[];
  summaryMetrics: any;
  includeVAT: boolean;
  onExportToExcel: () => void;
}

export const SalesDataTable: React.FC<SalesDataTableProps> = ({
  loading,
  filteredRemisionesWithVacioDeOlla,
  filteredRemisiones,
  salesData,
  summaryMetrics,
  includeVAT,
  onExportToExcel,
}) => {
  if (loading) {
    return <div className="h-64 w-full animate-pulse bg-gray-200 rounded" />;
  }

  return (
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
          onClick={onExportToExcel}
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
                <>
                  {filteredRemisionesWithVacioDeOlla.map((remision, index) => {
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
                  })}
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
                </>
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

                    // Find the right order item based on product type
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
  );
};
