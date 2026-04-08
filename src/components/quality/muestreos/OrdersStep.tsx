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

const outlineBtn =
  "h-9 border-stone-300 bg-white px-3 shadow-none hover:bg-stone-50";
const primaryBtn =
  "h-9 bg-sky-700 px-3 text-sm text-white shadow-none hover:bg-sky-800";

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
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-500" />
              <Input
                type="text"
                placeholder="Buscar por cliente, obra, número de orden o remisión"
                className="pl-9 border-stone-300"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex-shrink-0">
              <DatePickerWithRange value={dateRange} onChange={setDateRange} className="w-auto" />
            </div>
            <Button variant="outline" className={cn("flex-shrink-0", outlineBtn)} onClick={resetFilters}>
              Limpiar filtros
            </Button>
          </div>
          {(searchTerm || dateRange?.from) && (
            <div className="flex flex-wrap gap-2">
              {searchTerm && (
                <Badge variant="outline" className="border-stone-200 bg-stone-100 text-stone-800">
                  Búsqueda: {searchTerm}
                  <button className="ml-1 hover:text-destructive" onClick={() => setSearchTerm("")}>×</button>
                </Badge>
              )}
              {dateRange?.from && dateRange?.to && (
                <Badge variant="outline" className="border-stone-200 bg-stone-100 text-stone-800">
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
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
            <span className="ml-2 text-stone-600">Cargando órdenes...</span>
          </div>
        ) : Object.keys(groupedOrders).length === 0 ? (
          <div className="text-center p-8 bg-stone-50 rounded-lg border border-stone-200">
            <Package className="h-12 w-12 text-stone-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2 text-stone-900">No hay órdenes disponibles</h3>
            <p className="text-stone-500 max-w-md mx-auto">No se encontraron órdenes activas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedOrders).map(([date, ordersGroup]) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-stone-500" />
                  <h3 className="font-medium text-lg text-stone-900">
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
                        "cursor-pointer transition-all border-stone-200 hover:border-sky-600",
                        selectedOrder === order.id && "border-sky-600 ring-2 ring-sky-600 ring-opacity-50"
                      )}
                      onClick={() => onSelect(order.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="bg-sky-50 p-2 rounded-full">
                            <Package className="h-5 w-5 text-sky-700" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-stone-900">{order.order_number || `Orden #${order.id.substring(0, 8)}`}</h4>
                            <p className="text-sm text-stone-500">
                              Entrega: {order.delivery_date ? formatDate(adjustDateForTimezone(order.delivery_date) || new Date(), "dd/MM/yyyy") : "Sin fecha"}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1 mt-3">
                          <p className="text-sm text-stone-800">
                            <span className="font-medium">Cliente:</span> {order.clients?.business_name || "N/A"}
                          </p>
                          <p className="text-sm text-stone-800">
                            <span className="font-medium">Obra:</span> {order.construction_site || "N/A"}
                          </p>

                          <div className="mt-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                                order.order_status === "validated"
                                  ? "bg-emerald-600 text-white"
                                  : order.order_status === "created"
                                  ? "bg-sky-600 text-white"
                                  : order.order_status === "scheduled"
                                  ? "bg-violet-600 text-white"
                                  : "bg-stone-500 text-white"
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
      <CardFooter className="justify-between gap-2">
        <Button variant="outline" className={outlineBtn} onClick={onCancel}>Cancelar</Button>
        <Button className={primaryBtn} onClick={onContinue} disabled={!selectedOrder || isLoadingOrders}>Continuar</Button>
      </CardFooter>
    </Card>
  );
}

export default OrdersStep;
