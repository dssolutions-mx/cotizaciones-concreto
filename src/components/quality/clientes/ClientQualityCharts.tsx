'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from 'recharts';
import type { ClientQualityData, ClientQualitySummary } from '@/types/clientQuality';

interface ClientQualityChartsProps {
  data: ClientQualityData;
  summary: ClientQualitySummary;
  chartType: 'overview' | 'volume' | 'compliance' | 'performance';
}

export function ClientQualityCharts({ data, summary, chartType }: ClientQualityChartsProps) {
  // Monthly trend datasets removed by request

  const formatNumber = (num: number, decimals: number = 1) => {
    return num.toFixed(decimals);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return React.createElement('div', {
        className: "bg-white p-3 border border-gray-200 rounded shadow-lg"
      }, [
        React.createElement('p', { key: 'label', className: "font-medium" }, label),
        ...payload.map((entry: any, index: number) =>
          React.createElement('p', {
            key: index,
            style: { color: entry.color }
          }, `${entry.name}: ${entry.value}${entry.name.includes('Rate') || entry.name.includes('cumplimiento') ? '%' : ''}`)
        )
      ]);
    }
    return null;
  };

  // Simple return for now - will implement charts later
  return React.createElement('div', {
    className: "p-4 bg-gray-50 rounded-lg"
  }, [
    React.createElement('h3', {
      key: 'title',
      className: "text-lg font-semibold mb-2"
    }, `Gráficos de Calidad - ${chartType.charAt(0).toUpperCase() + chartType.slice(1)}`),
    React.createElement('p', {
      key: 'description',
      className: "text-gray-600"
    }, `Datos disponibles: ${data.remisiones.length} remisiones, ${summary.totals.muestreos} muestreos, ${summary.totals.ensayos} ensayos`),
    React.createElement('div', {
      key: 'stats',
      className: "grid grid-cols-2 md:grid-cols-4 gap-4 mt-4"
    }, [
      React.createElement('div', {
        key: 'volume',
        className: "text-center p-2 bg-blue-50 rounded"
      }, [
        React.createElement('div', {
          key: 'value',
          className: "text-xl font-bold text-blue-600"
        }, `${formatNumber(summary.totals.volume)} m³`),
        React.createElement('div', {
          key: 'label',
          className: "text-sm text-gray-600"
        }, 'Volumen Total')
      ]),
      React.createElement('div', {
        key: 'compliance',
        className: "text-center p-2 bg-green-50 rounded"
      }, [
        React.createElement('div', {
          key: 'value',
          className: "text-xl font-bold text-green-600"
        }, `${formatNumber(summary.averages.complianceRate)}%`),
        React.createElement('div', {
          key: 'label',
          className: "text-sm text-gray-600"
        }, 'Cumplimiento')
      ]),
      React.createElement('div', {
        key: 'resistance',
        className: "text-center p-2 bg-yellow-50 rounded"
      }, [
        React.createElement('div', {
          key: 'value',
          className: "text-xl font-bold text-yellow-600"
        }, `${formatNumber(summary.averages.resistencia)} kg/cm²`),
        React.createElement('div', {
          key: 'label',
          className: "text-sm text-gray-600"
        }, 'Resistencia Promedio')
      ]),
      React.createElement('div', {
        key: 'tests',
        className: "text-center p-2 bg-purple-50 rounded"
      }, [
        React.createElement('div', {
          key: 'value',
          className: "text-xl font-bold text-purple-600"
        }, summary.totals.ensayos),
        React.createElement('div', {
          key: 'label',
          className: "text-sm text-gray-600"
        }, 'Ensayos')
      ])
    ])
  ]);
}
