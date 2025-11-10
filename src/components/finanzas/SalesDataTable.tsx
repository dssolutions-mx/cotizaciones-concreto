'use client';

import React, { useMemo } from 'react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { findProductPrice } from '@/utils/salesDataProcessor';

interface SalesDataTableProps {
  loading: boolean;
  filteredRemisionesWithVacioDeOlla: any[];
  filteredRemisiones: any[];
  salesData: any[];
  summaryMetrics: any;
  includeVAT: boolean;
  onExportToExcel: () => void;
  pricingMap?: Map<string, { subtotal_amount: number; volumen_fabricado: number }>;
}

export const SalesDataTable: React.FC<SalesDataTableProps> = ({
  loading,
  filteredRemisionesWithVacioDeOlla,
  filteredRemisiones,
  salesData,
  summaryMetrics,
  includeVAT,
  onExportToExcel,
  pricingMap,
}) => {
  // Extract all order items from salesData for sophisticated price matching
  // Note: order items include quote_details relationship which contains recipe_id
  // when the order_item.recipe_id is null. The findProductPrice utility prioritizes
  // quote_details.recipe_id as the first matching strategy.
  const allOrderItems = useMemo(() => {
    return salesData.flatMap(order => 
      (order.items || []).map((item: any) => ({
        ...item,
        order_id: order.id // Ensure order_id is present
      }))
    );
  }, [salesData]);

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
                    const recipeCode = remision.recipe?.recipe_code;
                    const recipeId = remision.recipe?.id; // Use the UUID for proper matching
                    const volume = remision.volumen_fabricado || 0;

                    // Determine product type for price lookup
                    let productType = recipeCode || 'PRODUCTO';
                    let displayVolume = volume;
                    
                    const isEmptyTruck = recipeCode === 'SER001';
                    const isBombeo = remision.tipo_remision === 'BOMBEO';
                    
                    if (isBombeo) {
                      productType = 'SER002'; // Bombeo service code
                    } else if (isEmptyTruck) {
                      productType = 'SER001'; // Empty truck code
                      displayVolume = 1; // Empty truck is counted as 1 unit
                    }

                    // Use sophisticated price matching (same as remisiones page)
                    // Pass pricing map and remision info to respect zero prices from view
                    const remisionMasterRecipeId = (remision as any).master_recipe_id || remision.recipe?.master_recipe_id;
                    const price = findProductPrice(
                      productType, 
                      remision.order_id, 
                      recipeId, 
                      allOrderItems,
                      pricingMap,
                      remision.id,
                      remisionMasterRecipeId
                    );
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
                          {isBombeo ? 'SER002' :
                            isEmptyTruck ? 'SER001' :
                            recipeCode || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {isBombeo ? 'SERVICIO DE BOMBEO' :
                            isEmptyTruck ? 'VACIO DE OLLA' :
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

                    // Use the same sophisticated price matching as the main table
                    const recipeCode = remision.recipe?.recipe_code;
                    const recipeId = remision.recipe?.id;
                    const volume = remision.volumen_fabricado || 0;
                    
                    // Determine product type for price lookup
                    let productType = recipeCode || 'PRODUCTO';
                    let displayVolume = volume;
                    
                    const isEmptyTruck = recipeCode === 'SER001';
                    const isBombeo = remision.tipo_remision === 'BOMBEO';
                    
                    if (isBombeo) {
                      productType = 'SER002';
                    } else if (isEmptyTruck) {
                      productType = 'SER001';
                      displayVolume = 1; // Empty truck is counted as 1 unit
                    }

                    // Use sophisticated price matching
                    // Pass pricing map and remision info to respect zero prices from view
                    const remisionMasterRecipeId = (remision as any).master_recipe_id || remision.recipe?.master_recipe_id;
                    const price = findProductPrice(
                      productType, 
                      remision.order_id, 
                      recipeId, 
                      allOrderItems,
                      pricingMap,
                      remision.id,
                      remisionMasterRecipeId
                    );
                    const amount = price * displayVolume;

                    acc[clientId].count += 1;
                    acc[clientId].volume += displayVolume;
                    acc[clientId].amount += amount;

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
