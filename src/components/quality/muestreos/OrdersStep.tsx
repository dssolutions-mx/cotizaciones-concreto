"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { CalendarDays, Loader2, Package, Search } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { adjustDateForTimezone } from "./dateUtils";

type OrdersStepProps = {
  isLoadingOrders: boolean;
  groupedOrders: Record<string, any[]>;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  dateRange?: DateRange | undefined;
  setDateRange: (v: DateRange | undefined) => void;
  resetFilters: () => void;
  selectedOrder: string | null;
  onSelect: (orderId: string) => void;
  onCancel: () => void;
  onContinue: () => void;
};

export function OrdersStep({
  isLoadingOrders,
  groupedOrders,
  searchTerm,
  setSearchTerm,
  dateRange,
  setDateRange,
  resetFilters,
  selectedOrder,
  onSelect,
  onCancel,
  onContinue,
}: OrdersStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seleccionar Orden</CardTitle>
        <CardDescription>Elige la orden para la que deseas crear el muestreo</CardDescription>
        <div className="mt-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Buscar por cliente, obra, número de orden o remisión"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-shrink-0">
              <DatePickerWithRange value={dateRange} onChange={setDateRange} className="w-auto" />
            </div>
            <Button variant="outline" className="flex-shrink-0" onClick={resetFilters}>
              Limpiar filtros
            </Button>
          </div>
          {(searchTerm || dateRange?.from) && (
            <div className="flex flex-wrap gap-2">
              {searchTerm && (
                <Badge variant="outline" className="bg-gray-100">
                  Búsqueda: {searchTerm}
                  <button className="ml-1 hover:text-destructive" onClick={() => setSearchTerm("")}>×</button>
                </Badge>
              )}
              {dateRange?.from && dateRange?.to && (
                <Badge variant="outline" className="bg-gray-100">
                  Fecha: {formatDate(dateRange.from, "dd/MM/yyyy")} - {formatDate(dateRange.to, "dd/MM/yyyy")}
                  <button className="ml-1 hover:text-destructive" onClick={() => setDateRange(undefined)}>×</button>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoadingOrders ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Cargando órdenes...</span>
          </div>
        ) : Object.keys(groupedOrders).length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No hay órdenes disponibles</h3>
            <p className="text-gray-500 max-w-md mx-auto">No se encontraron órdenes activas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([date, ordersGroup]) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-gray-500" />
                  <h3 className="font-medium text-lg">
                    {date === "Sin fecha de entrega"
                      ? date
                      : (() => {
                          const [year, month, day] = date.split("-").map((num) => parseInt(num, 10));
                          const headerDate = new Date(year, month - 1, day, 12, 0, 0);
                          return new Intl.DateTimeFormat("es-MX", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }).format(headerDate);
                        })()}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ordersGroup.map((order: any) => (
                    <Card
                      key={order.id}
                      className={cn(
                        "cursor-pointer transition-all hover:border-primary",
                        selectedOrder === order.id && "border-primary ring-2 ring-primary ring-opacity-50"
                      )}
                      onClick={() => onSelect(order.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="bg-primary-50 p-2 rounded-full">
                            <Package className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{order.order_number || `Orden #${order.id.substring(0, 8)}`}</h4>
                            <p className="text-sm text-gray-500">
                              Entrega: {order.delivery_date ? formatDate(adjustDateForTimezone(order.delivery_date) || new Date(), "dd/MM/yyyy") : "Sin fecha"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1 mt-3">
                          <p className="text-sm">
                            <span className="font-medium">Cliente:</span> {order.clients?.business_name || "N/A"}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Obra:</span> {order.construction_site || "N/A"}
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Monto:</span> {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(order.total_amount || 0)}
                          </p>
                          <div className="mt-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                                order.order_status === "validated"
                                  ? "bg-green-500 text-white"
                                  : order.order_status === "created"
                                  ? "bg-blue-500 text-white"
                                  : order.order_status === "scheduled"
                                  ? "bg-purple-500 text-white"
                                  : "bg-gray-500 text-white"
                              }`}
                            >
                              {order.order_status === "validated"
                                ? "Validada"
                                : order.order_status === "created"
                                ? "Creada"
                                : order.order_status === "scheduled"
                                ? "Programada"
                                : order.order_status}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onContinue} disabled={!selectedOrder || isLoadingOrders}>Continuar</Button>
      </CardFooter>
    </Card>
  );
}

export default OrdersStep;


