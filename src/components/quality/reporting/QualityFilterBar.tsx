'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type QualityFilterBarProps = {
  title?: string;
  /** Always visible row (e.g. cliente, obra, receta, planta) */
  primary: React.ReactNode;
  /** Expandable advanced filters */
  secondary?: React.ReactNode;
  /** Active filter chips below the bar */
  activeChips?: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
};

export function QualityFilterBar({
  title = 'Filtros',
  primary,
  secondary,
  activeChips,
  className,
  defaultOpen = false,
}: QualityFilterBarProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn('rounded-lg border border-stone-200 bg-white shadow-sm', className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
            {secondary && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-stone-600">
                  {open ? (
                    <>
                      Ocultar filtros avanzados
                      <ChevronUp className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Más filtros
                      <ChevronDown className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
          <div className="mt-3">{primary}</div>
          {secondary && (
            <CollapsibleContent className="mt-4 space-y-4 border-t border-stone-100 pt-4">
              {secondary}
            </CollapsibleContent>
          )}
        </div>
      </Collapsible>
      {activeChips && <div className="px-4 py-2 bg-stone-50/80">{activeChips}</div>}
    </div>
  );
}
