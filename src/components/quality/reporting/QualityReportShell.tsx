'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type QualityReportShellProps = {
  /** e.g. breadcrumb row */
  headerTop?: React.ReactNode;
  title: string;
  subtitle?: string;
  /** Right side: date picker, export, etc. */
  actions?: React.ReactNode;
  /** Optional KPI strip directly under title */
  kpiStrip?: React.ReactNode;
  /** Filters block */
  filters?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Use warm canvas like QualityHubShell */
  warmCanvas?: boolean;
};

export function QualityReportShell({
  headerTop,
  title,
  subtitle,
  actions,
  kpiStrip,
  filters,
  children,
  className,
  contentClassName,
  warmCanvas = false,
}: QualityReportShellProps) {
  return (
    <div
      className={cn(
        warmCanvas && 'min-h-[calc(100vh-2rem)] bg-[#f5f3f0] -m-4 md:-m-6 p-4 md:p-6',
        className
      )}
    >
      <div className={cn('mx-auto max-w-7xl', contentClassName)}>
        {headerTop && <div className="mb-4">{headerTop}</div>}

        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-stone-600">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>

        {kpiStrip && <div className="mb-4">{kpiStrip}</div>}
        {filters && <div className="mb-4">{filters}</div>}

        {children}
      </div>
    </div>
  );
}
