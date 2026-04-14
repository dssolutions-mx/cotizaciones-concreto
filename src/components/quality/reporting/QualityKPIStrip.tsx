'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type QualityKPIItem = {
  id: string;
  label: string;
  value: string;
  hint?: string;
  sublabel?: string;
};

export function QualityKPIStrip({
  items,
  loading,
  className,
}: {
  items: QualityKPIItem[];
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          'flex flex-wrap gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm md:flex-nowrap',
          className
        )}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="min-w-[100px] flex-1 space-y-2 border-stone-100 md:border-l md:pl-3 first:md:border-l-0 first:md:pl-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'flex flex-wrap gap-2 rounded-lg border border-stone-200 bg-white p-3 shadow-sm md:gap-0 md:flex-nowrap',
          className
        )}
      >
        {items.map((item, idx) => {
          const inner = (
            <div
              className={cn(
                'min-w-[108px] flex-1 px-2 py-1 md:border-l md:border-stone-100',
                idx === 0 && 'md:border-l-0 md:pl-0'
              )}
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">{item.label}</div>
              <div className="text-title-1 font-semibold tabular-nums text-stone-900">{item.value}</div>
              {item.sublabel && <div className="text-[11px] text-stone-500">{item.sublabel}</div>}
            </div>
          );

          if (item.hint) {
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button type="button" className="flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-stone-400 rounded-md">
                    {inner}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {item.hint}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.id}>{inner}</div>;
        })}
      </div>
    </TooltipProvider>
  );
}
