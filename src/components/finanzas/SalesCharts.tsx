'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ApexOptions } from 'apexcharts';

// Dynamically import ApexCharts with SSR disabled
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface SalesChartsProps {
  includeVAT: boolean;
  formatNumberWithUnits: (value: number) => string;
  formatCurrency: (value: number) => string;

  // Chart Options
  cashInvoiceChartOptions: ApexOptions;
  productCodeChartOptions: ApexOptions;
  clientChartOptions: ApexOptions;
  salesTrendChartOptions: ApexOptions;
  activeClientsChartOptions: ApexOptions;
  paymentPerformanceChartOptions: ApexOptions;
  outstandingAmountsChartOptions: ApexOptions;

  // Chart Series
  cashInvoiceChartSeries: number[];
  productCodeChartSeries: any[];
  clientChartSeries: any[];
  salesTrendChartSeries: any[];
  activeClientsChartSeries: any[];
  paymentPerformanceChartSeries: any[];
  outstandingAmountsChartSeries: any[];
}

export const SalesCharts: React.FC<SalesChartsProps> = ({
  includeVAT,
  formatNumberWithUnits,
  formatCurrency,
  cashInvoiceChartOptions,
  productCodeChartOptions,
  clientChartOptions,
  salesTrendChartOptions,
  activeClientsChartOptions,
  paymentPerformanceChartOptions,
  outstandingAmountsChartOptions,
  cashInvoiceChartSeries,
  productCodeChartSeries,
  clientChartSeries,
  salesTrendChartSeries,
  activeClientsChartSeries,
  paymentPerformanceChartSeries,
  outstandingAmountsChartSeries,
}) => {
  return (
    <div className="space-y-12 mt-12">
      {/* Row 1: Key Performance Indicators - Full Width Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Distribution - Professional Donut */}
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500" />
          <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-800 flex items-center justify-between">
              <span>EFECTIVO/FISCAL</span>
              {includeVAT && (
                <Badge variant="default" className="text-xs bg-green-100 text-green-700 border-green-200">
                  Con IVA
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 h-96">
            {typeof window !== 'undefined' && cashInvoiceChartSeries.length > 0 ? (
              <div className="h-full">
                <Chart
                  options={{
                    ...cashInvoiceChartOptions,
                    colors: ['#10B981', '#3B82F6'],
                    chart: {
                      ...cashInvoiceChartOptions.chart,
                      background: 'transparent',
                      animations: { enabled: true, speed: 800 }
                    }
                  }}
                  series={cashInvoiceChartSeries}
                  type="donut"
                  height="100%"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos de facturación</div>
                  <div className="text-sm">Selecciona un período con datos de ventas</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Product Performance - Enhanced Bar Chart */}
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
          <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-800">RENDIMIENTO POR PRODUCTO</CardTitle>
          </CardHeader>
          <CardContent className="p-6 h-96">
            {typeof window !== 'undefined' && productCodeChartSeries.length > 0 && productCodeChartSeries[0].data.length > 0 ? (
              <div className="h-full">
                <Chart
                  options={productCodeChartOptions}
                  series={productCodeChartSeries}
                  type="bar"
                  height="100%"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos de productos</div>
                  <div className="text-sm">Selecciona un período con datos de ventas</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Client Distribution - Full Width */}
      <div className="grid grid-cols-1 gap-8">
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />
          <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-800">DISTRIBUCIÓN DE CLIENTES</CardTitle>
          </CardHeader>
          <CardContent className="p-6 h-96">
            {typeof window !== 'undefined' && clientChartSeries.length > 0 ? (
              <div className="h-full">
                <Chart
                  options={{
                    ...clientChartOptions,
                    legend: {
                      ...clientChartOptions.legend,
                      position: 'bottom',
                      fontSize: '13px',
                      formatter: (seriesName: string, opts: any) => {
                        const value = opts.w.globals.series[opts.seriesIndex];
                        const formattedValue = includeVAT ?
                          formatCurrency(value) :
                          `${formatNumberWithUnits(value)} m³`;
                        return `${seriesName.length > 25 ? seriesName.substring(0, 25) + '...' : seriesName}: ${formattedValue}`;
                      }
                    }
                  }}
                  series={clientChartSeries}
                  type="pie"
                  height="100%"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos de clientes</div>
                  <div className="text-sm">Selecciona un período con datos de ventas</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Historical Trends - Full Width */}
      <div className="grid grid-cols-1 gap-8">
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500" />
          <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-800">TENDENCIA DE VENTAS HISTÓRICA</CardTitle>
            <p className="text-xs text-gray-500 mt-1">📊 Datos históricos independientes del filtro de fecha</p>
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
                  <div className="text-sm">Selecciona un período con datos de ventas</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Commercial Performance KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Clients Monthly */}
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-blue-500" />
          <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-800">CLIENTES ACTIVOS MENSUALES</CardTitle>
            <p className="text-xs text-gray-500 mt-1">👥 Datos históricos independientes del filtro de fecha</p>
          </CardHeader>
          <CardContent className="p-6 h-80">
            {typeof window !== 'undefined' && activeClientsChartSeries.length > 0 && activeClientsChartSeries[0].data.length > 0 ? (
              <div className="h-full">
                <Chart
                  options={activeClientsChartOptions}
                  series={activeClientsChartSeries}
                  type="bar"
                  height="100%"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos de clientes</div>
                  <div className="text-sm">Selecciona un período con datos de ventas</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Performance */}
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500" />
          <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-800">RENDIMIENTO DE COBRO</CardTitle>
            <p className="text-xs text-gray-500 mt-1">💰 Datos históricos independientes del filtro de fecha</p>
          </CardHeader>
          <CardContent className="p-6 h-80">
            {typeof window !== 'undefined' && paymentPerformanceChartSeries.length > 0 ? (
              <div className="h-full">
                <Chart
                  options={paymentPerformanceChartOptions}
                  series={paymentPerformanceChartSeries}
                  type="radialBar"
                  height="100%"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos de cobro</div>
                  <div className="text-sm">Selecciona un período con datos de ventas</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Outstanding Amounts */}
        <Card className="relative overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-lg bg-gradient-to-br from-white to-gray-50/30">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-pink-500" />
          <CardHeader className="p-6 pb-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <CardTitle className="text-lg font-bold text-gray-800">MONTOS PENDIENTES</CardTitle>
            <p className="text-xs text-gray-500 mt-1">📈 Datos históricos independientes del filtro de fecha</p>
          </CardHeader>
          <CardContent className="p-6 h-80">
            {typeof window !== 'undefined' && outstandingAmountsChartSeries.length > 0 && outstandingAmountsChartSeries[0].data.length > 0 ? (
              <div className="h-full">
                <Chart
                  options={outstandingAmountsChartOptions}
                  series={outstandingAmountsChartSeries}
                  type="bar"
                  height="100%"
                />
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-lg font-semibold mb-2">No hay datos de montos</div>
                  <div className="text-sm">Selecciona un período con datos de ventas</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
