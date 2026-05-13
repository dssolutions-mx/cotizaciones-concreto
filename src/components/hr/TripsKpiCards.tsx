'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Users, Truck, Route, Box, Droplets } from 'lucide-react';

export type HrWeeklyProductTypeFilter = 'all' | 'CONCRETO' | 'BOMBEO';

type TripsKpiCardsProps = {
  trips: number;
  uniqueDrivers: number;
  uniqueTrucks: number;
  volumeConcreto: number;
  volumeBombeo: number;
  productTypeFilter: HrWeeklyProductTypeFilter;
  className?: string;
};

function volumeValueNode(n: number) {
  return (
    <span>
      {n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}
      <span className="ml-1 text-sm font-medium text-gray-600">m³</span>
    </span>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ElementType;
  tone: 'blue' | 'green' | 'purple' | 'orange' | 'amber';
}) {
  const tones: Record<typeof tone, { bg: string; fg: string }> = {
    blue: { bg: 'bg-blue-50 border-blue-200', fg: 'text-blue-700' },
    green: { bg: 'bg-green-50 border-green-200', fg: 'text-green-700' },
    purple: { bg: 'bg-purple-50 border-purple-200', fg: 'text-purple-700' },
    orange: { bg: 'bg-orange-50 border-orange-200', fg: 'text-orange-700' },
    amber: { bg: 'bg-amber-50 border-amber-200', fg: 'text-amber-800' },
  };

  return (
    <Card className={cn('border', tones[tone].bg)}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-gray-600">{label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">{value}</div>
          </div>
          <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center bg-white/70 border', tones[tone].fg)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TripsKpiCards({
  trips,
  uniqueDrivers,
  uniqueTrucks,
  volumeConcreto,
  volumeBombeo,
  productTypeFilter,
  className,
}: TripsKpiCardsProps) {
  const showConcreto = productTypeFilter === 'all' || productTypeFilter === 'CONCRETO';
  const showBombeo = productTypeFilter === 'all' || productTypeFilter === 'BOMBEO';
  const volumeCards = (showConcreto ? 1 : 0) + (showBombeo ? 1 : 0);

  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3',
        volumeCards === 2 ? 'sm:grid-cols-3 lg:grid-cols-5' : 'lg:grid-cols-4',
        className,
      )}
    >
      <KpiCard label="Viajes (remisiones)" value={trips.toLocaleString('es-MX')} icon={Route} tone="blue" />
      <KpiCard label="Conductores" value={uniqueDrivers.toLocaleString('es-MX')} icon={Users} tone="green" />
      <KpiCard label="Unidades" value={uniqueTrucks.toLocaleString('es-MX')} icon={Truck} tone="purple" />
      {showConcreto && (
        <KpiCard
          label="Volumen concreto"
          value={volumeValueNode(volumeConcreto)}
          icon={Box}
          tone="orange"
        />
      )}
      {showBombeo && (
        <KpiCard
          label="Volumen bombeo"
          value={volumeValueNode(volumeBombeo)}
          icon={Droplets}
          tone="amber"
        />
      )}
    </div>
  );
}
