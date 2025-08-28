'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SalesCharts } from '@/components/finanzas/SalesCharts';
import { formatNumberWithUnits, formatCurrency } from '@/lib/sales-utils';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';

export default function SalesChartsDemoPage() {
  const [includeVAT, setIncludeVAT] = useState<boolean>(false);

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Demo: Gráficos de Ventas Mejorados</h1>
          <p className="text-muted-foreground mt-2">
            Componente SalesCharts con lógica de datos simplificada y independiente de filtros de fecha
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Switch
            id="vat-toggle"
            checked={includeVAT}
            onCheckedChange={setIncludeVAT}
          />
          <Label htmlFor="vat-toggle">
            {includeVAT ? 'Con IVA (16%)' : 'Sin IVA'}
          </Label>
        </div>
      </div>

      {/* Plant Context Display */}
      <div className="mb-6">
        <PlantContextDisplay showLabel={true} />
      </div>

      {/* Demo Information Card */}
      <Card className="mb-8 border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50/30">
        <CardHeader className="p-6 pb-4 bg-gradient-to-r from-blue-50 to-indigo-100 border-b border-blue-200">
          <CardTitle className="text-lg font-bold text-blue-800 flex items-center gap-2">
            🚀 Características del Componente Mejorado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">📊 Lógica de Datos Simplificada</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li><strong>•</strong> Basado en la API de ventas actual</li>
                  <li><strong>•</strong> No afectado por filtros de fecha</li>
                  <li><strong>•</strong> Mantiene filtrado por planta</li>
                  <li><strong>•</strong> Segmentación de volúmenes (Concreto, Bombeo, Vacío)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">🔧 Cálculos de Montos</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li><strong>•</strong> Mimica la lógica de cálculo de la API de ventas</li>
                  <li><strong>•</strong> Manejo correcto de vacío de olla</li>
                  <li><strong>•</strong> Soporte para IVA (16%)</li>
                  <li><strong>•</strong> Procesamiento de remisiones virtuales</li>
                </ul>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">📈 Visualización de Datos</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li><strong>•</strong> 24 meses de datos históricos</li>
                  <li><strong>•</strong> Gráfico de líneas con doble eje Y</li>
                  <li><strong>•</strong> Ventas (moneda) y Volúmenes (m³)</li>
                  <li><strong>•</strong> Tooltips informativos y leyendas claras</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 mb-2">⚡ Rendimiento</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li><strong>•</strong> Carga de datos optimizada</li>
                  <li><strong>•</strong> Estados de carga y error</li>
                  <li><strong>•</strong> Memoización de cálculos</li>
                  <li><strong>•</strong> Filtrado eficiente por planta</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales Charts Component */}
      <SalesCharts 
        includeVAT={includeVAT}
        formatNumberWithUnits={formatNumberWithUnits}
        formatCurrency={formatCurrency}
      />

      {/* Technical Details Card */}
      <Card className="mt-8 border-0 shadow-lg bg-gradient-to-br from-gray-50 to-slate-50/30">
        <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-slate-100 border-b border-gray-200">
          <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
            🔧 Detalles Técnicos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Base de Datos</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>Tabla principal:</strong> remisiones (con fecha, plant_id, volumen_fabricado, tipo_remision)</li>
                <li><strong>Relaciones:</strong> orders, order_items, recipes</li>
                <li><strong>Filtros:</strong> plant_id (si está seleccionada una planta)</li>
                <li><strong>Rango:</strong> Últimos 24 meses (independiente de filtros de fecha)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Lógica de Cálculo</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>Concreto:</strong> volumen_fabricado × unit_price (excluyendo BOMBEO)</li>
                <li><strong>Bombeo:</strong> volumen_fabricado × pump_price</li>
                <li><strong>Vacío de Olla:</strong> total_price o unit_price × volumen (remisiones virtuales)</li>
                <li><strong>IVA:</strong> Aplicado al 16% cuando includeVAT es true</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Componentes Utilizados</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><strong>UI:</strong> Card, Skeleton, Badge de shadcn/ui</li>
                <li><strong>Gráficos:</strong> ApexCharts (react-apexcharts)</li>
                <li><strong>Estado:</strong> React hooks (useState, useEffect, useMemo)</li>
                <li><strong>Contexto:</strong> PlantContext para filtrado por planta</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
