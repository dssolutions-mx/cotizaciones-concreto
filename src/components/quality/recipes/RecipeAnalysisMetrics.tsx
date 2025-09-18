'use client';

import React from 'react';

interface Summary {
  totalVolume: number;
  avgCostPerM3: number;
  cementSharePct: number;
  passRate: number | null;
  efficiencyMean: number | null;
  efficiencyCOV: number | null;
  avgYield: number | null;
}

export function RecipeAnalysisMetrics({ summary }: { summary: Summary | null }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
      <div className="p-3 rounded bg-white shadow-sm border">
        <div className="text-xs text-gray-500">Volumen total</div>
        <div className="text-xl font-semibold">{summary ? (Math.round((summary.totalVolume || 0) * 10) / 10) : 0} m³</div>
      </div>
      <div className="p-3 rounded bg-white shadow-sm border">
        <div className="text-xs text-gray-500">Costo promedio</div>
        <div className="text-xl font-semibold">${summary ? (summary.avgCostPerM3 || 0).toFixed(2) : '0.00'}/m³</div>
      </div>
      <div className="p-3 rounded bg-white shadow-sm border">
        <div className="text-xs text-gray-500">% Cemento</div>
        <div className="text-xl font-semibold">{summary ? `${(summary.cementSharePct || 0).toFixed(1)}%` : '0.0%'}</div>
      </div>
      <div className="p-3 rounded bg-white shadow-sm border">
        <div className="text-xs text-gray-500">Cumplimiento</div>
        <div className="text-xl font-semibold">{summary?.passRate != null ? `${summary.passRate.toFixed(1)}%` : '—'}</div>
      </div>
      <div className="p-3 rounded bg-white shadow-sm border">
        <div className="text-xs text-gray-500">Eficiencia media</div>
        <div className="text-xl font-semibold">{summary?.efficiencyMean != null ? summary.efficiencyMean.toFixed(3) : '—'}</div>
      </div>
      <div className="p-3 rounded bg-white shadow-sm border">
        <div className="text-xs text-gray-500">COV eficiencia</div>
        <div className="text-xl font-semibold">{summary?.efficiencyCOV != null ? (summary.efficiencyCOV * 100).toFixed(1) + '%' : '—'}</div>
      </div>
    </div>
  );
}


