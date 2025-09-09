'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { formatCurrency } from '@/lib/utils';

interface SalesVATIndicatorsProps {
  layoutType: 'current' | 'powerbi';
  includeVAT: boolean;
  currentPlant: any;
  clientFilter: string;
  clients: { id: string; name: string }[];
  filteredRemisionesWithVacioDeOlla: any[];
  summaryMetrics: {
    cashAmount: number;
    invoiceAmount: number;
    cashAmountWithVAT: number;
    invoiceAmountWithVAT: number;
    totalAmount: number;
    totalAmountWithVAT: number;
  };
}

export const SalesVATIndicators: React.FC<SalesVATIndicatorsProps> = ({
  layoutType,
  includeVAT,
  currentPlant,
  clientFilter,
  clients,
  filteredRemisionesWithVacioDeOlla,
  summaryMetrics,
}) => {
  return (
    <div className="space-y-6">
      {/* VAT Status Indicator */}
      {layoutType === 'current' && (
        <div className="p-3 bg-gray-50 rounded-lg border">
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
      )}

      {/* PowerBI Layout VAT Status */}
      {layoutType === 'powerbi' && (
        <div className="flex justify-between items-center">
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
        </div>
      )}
    </div>
  );
};

interface SalesInfoGuideProps {
  // Props for the information guide section
}

export const SalesInfoGuide: React.FC<SalesInfoGuideProps> = () => {
  return (
    <Card className="mt-8 border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
      <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
        <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Info className="h-5 w-5 text-blue-600" />
          Guía de Interpretación del Dashboard
        </CardTitle>
        <CardDescription>
          Información para entender las métricas, gráficos y análisis comercial
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">📊 Métricas de Ventas</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>Total de Ventas:</strong> Monto total facturado en el período seleccionado</li>
                <li><strong>Volumen Total:</strong> Cantidad total de concreto vendido en m³</li>
                <li><strong>Precio Ponderado:</strong> Promedio ponderado por volumen de cada producto</li>
                <li><strong>Resistencia Ponderada:</strong> Promedio ponderado de resistencias por volumen</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">💰 Análisis de Facturación</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>Efectivo:</strong> Órdenes pagadas al contado (sin IVA)</li>
                <li><strong>Fiscal:</strong> Órdenes con factura (incluyen 16% IVA)</li>
                <li><strong>Toggle IVA:</strong> Cambia entre mostrar montos con o sin impuestos</li>
              </ul>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">📈 Análisis Histórico</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>Tendencia de Ventas:</strong> Evolución mensual de ventas y volumen</li>
                <li><strong>Clientes Activos:</strong> Número de clientes únicos por mes</li>
                <li><strong>Rendimiento de Cobro:</strong> Porcentaje de facturación cobrada</li>
                <li><strong>Montos Pendientes:</strong> Cantidades por cobrar por mes</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">🎯 KPIs Comerciales</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>Tasa de Cobro:</strong> Eficiencia en la recuperación de facturación</li>
                <li><strong>Clientes Activos:</strong> Retención y crecimiento de cartera</li>
                <li><strong>Distribución por Producto:</strong> Performance de diferentes tipos de concreto</li>
                <li><strong>Análisis por Cliente:</strong> Concentración de ventas por cliente</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h5 className="font-semibold text-blue-800 mb-2">💡 Insights para la Gestión</h5>
          <div className="text-sm text-blue-700 space-y-1">
            <p><strong>• Eficiencia Operativa:</strong> Monitoree la tendencia de ventas para identificar patrones estacionales</p>
            <p><strong>• Gestión de Cartera:</strong> Analice la concentración de clientes para diversificar riesgos</p>
            <p><strong>• Performance Comercial:</strong> Evalúe la tasa de cobro para optimizar políticas de crédito</p>
            <p><strong>• Mix de Productos:</strong> Identifique los productos más rentables para enfocar esfuerzos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
