'use client';

import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type TripsByDayChartProps = {
  data: Array<{ date: string; trips: number; volume: number }>;
};

export default function TripsByDayChart({ data }: TripsByDayChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: (() => {
      try {
        return format(new Date(`${d.date}T12:00:00`), 'EEE dd', { locale: es });
      } catch {
        return d.date;
      }
    })(),
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900">Viajes por día</CardTitle>
      </CardHeader>
      <CardContent className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(value: any, name: any, props: any) => {
                if (name === 'trips') return [value, 'Viajes'];
                if (name === 'volume') return [`${Number(value).toFixed(2)} m³`, 'Volumen'];
                return [value, name];
              }}
              labelFormatter={(label) => `Día: ${label}`}
            />
            <Bar dataKey="trips" fill="#16a34a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

