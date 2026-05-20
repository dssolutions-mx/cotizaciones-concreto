'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from '@/lib/utils';
import { finanzasHubCardClass } from '@/components/finanzas/finanzasHubUi';

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  valueClassName?: string;
}

export default function KPICard({
  title,
  value,
  description,
  icon,
  trend,
  className,
  valueClassName,
}: KPICardProps) {
  return (
    <Card className={cn(finanzasHubCardClass, 'h-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4 sm:px-5">
        <CardTitle className="text-xs sm:text-sm font-medium text-stone-600">{title}</CardTitle>
        {icon ? <div className="h-4 w-4 text-stone-500 shrink-0">{icon}</div> : null}
      </CardHeader>
      <CardContent className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="text-lg sm:text-xl font-semibold font-mono tabular-nums text-stone-900 mb-1">
          <span className={valueClassName}>{value}</span>
        </div>
        {description ? <p className="text-xs text-stone-500">{description}</p> : null}
        {trend ? (
          <div className="flex items-center mt-1.5">
            <span
              className={cn(
                'text-xs font-medium',
                trend.isPositive ? 'text-emerald-700' : 'text-red-700'
              )}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
