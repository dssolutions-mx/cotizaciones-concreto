'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
} from 'recharts';

interface Period {
  label: string;
  avgCostPerM3: number;
  volume: number;
  cement?: number;
  sands?: number;
  gravels?: number;
  additives?: number;
  efficiencyMean?: number | null;
  passRate?: number | null;
  avgYield?: number | null;
}

export function CostsChart({ byPeriod }: { byPeriod: Period[] }) {
  const data = useMemo(
    () =>
      [...byPeriod]
        .reverse()
        .map((p) => ({
          label: p.label,
          cement: p.cement || 0,
          sands: p.sands || 0,
          gravels: p.gravels || 0,
          additives: p.additives || 0,
          avgCostPerM3: p.avgCostPerM3,
        })),
    [byPeriod]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Costos por período</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-gray-500">Sin datos</div>
        ) : (
          <div className="h-[480px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis yAxisId="cost" tick={{ fontSize: 11 }} label={{ value: 'Costo total', angle: -90, position: 'insideLeft' }} />
                <YAxis
                  yAxisId="unit"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Costo/m³', angle: 90, position: 'insideRight' }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Costo/m³') return [`${value.toFixed(2)}`, name];
                    return [`${value.toFixed(2)}`, name];
                  }}
                />
                <Legend />
                <Bar yAxisId="cost" dataKey="cement" name="Cemento" stackId="mat" fill="#6b7280" />
                <Bar yAxisId="cost" dataKey="sands" name="Arenas" stackId="mat" fill="#94a3b8" />
                <Bar yAxisId="cost" dataKey="gravels" name="Gravas" stackId="mat" fill="#cbd5e1" />
                <Bar yAxisId="cost" dataKey="additives" name="Aditivos" stackId="mat" fill="#a3e635" />
                <Line yAxisId="unit" type="monotone" dataKey="avgCostPerM3" name="Costo/m³" stroke="#0d9488" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EfficiencyChart({ byPeriod }: { byPeriod: Period[] }) {
  const data = useMemo(
    () =>
      [...byPeriod]
        .reverse()
        .map((p) => ({
          label: p.label,
          efficiencyMean: p.efficiencyMean ?? 0,
          passRate: p.passRate ?? 0,
        })),
    [byPeriod]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eficiencia y cumplimiento</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-gray-500">Sin datos</div>
        ) : (
          <div className="h-[420px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis yAxisId="eff" tick={{ fontSize: 11 }} label={{ value: 'Eficiencia', angle: -90, position: 'insideLeft' }} />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Cumplimiento %', angle: 90, position: 'insideRight' }}
                />
                <Tooltip />
                <Legend />
                <Line yAxisId="eff" type="monotone" dataKey="efficiencyMean" name="Eficiencia media" stroke="#6366f1" strokeWidth={2} dot />
                <Line yAxisId="rate" type="monotone" dataKey="passRate" name="Cumplimiento %" stroke="#059669" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function YieldChart({ byPeriod }: { byPeriod: Period[] }) {
  const data = useMemo(
    () =>
      [...byPeriod]
        .reverse()
        .map((p) => ({
          label: p.label,
          avgYield: p.avgYield ?? 0,
        })),
    [byPeriod]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rendimiento volumétrico</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-gray-500">Sin datos</div>
        ) : (
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} label={{ value: 'Rendimiento', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(2)}`, 'Rendimiento']} />
                <Legend />
                <Line type="monotone" dataKey="avgYield" name="Rendimiento" stroke="#b45309" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
