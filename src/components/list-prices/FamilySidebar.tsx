'use client';

import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PricingFamily } from '@/lib/services/listPriceWorkspaceService';
import type { ListPriceRow } from './shared';
import { fmtMXN } from './shared';

interface Props {
  familiesByStrength: [number, PricingFamily[]][];
  currentLpByMaster: Map<string, ListPriceRow>;
  selectedFamilyKey: string | null;
  onSelect: (key: string) => void;
}

export function FamilySidebar({ familiesByStrength, currentLpByMaster, selectedFamilyKey, onSelect }: Props) {
  return (
    <div className="w-64 shrink-0 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
      {familiesByStrength.map(([strengthFc, fams]) => (
        <div key={strengthFc} className="space-y-1">
          {fams.map((fam) => {
            const anchorM   = fam.masters.find((m) => m.id === fam.anchorMasterId);
            const anchorLp  = anchorM ? currentLpByMaster.get(anchorM.id) : null;
            const withPrice = fam.masters.filter((m) => currentLpByMaster.has(m.id)).length;
            const isSelected = selectedFamilyKey === fam.key;
            const allPriced  = withPrice === fam.masters.length && fam.masters.length > 0;

            return (
              <button
                key={fam.key}
                onClick={() => onSelect(fam.key)}
                className={cn(
                  'w-full text-left rounded-xl transition-all duration-200 overflow-hidden border',
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                )}
              >
                <div className="flex items-stretch">
                  {/* f'c pill — hero number on the left */}
                  <div className={cn(
                    'flex flex-col items-center justify-center px-3 py-3 border-r shrink-0 min-w-[64px]',
                    isSelected ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50',
                  )}>
                    <span className={cn(
                      'text-caption font-bold uppercase tracking-widest leading-none',
                      isSelected ? 'text-white/50' : 'text-gray-400',
                    )}>
                      f&apos;c
                    </span>
                    <span className={cn(
                      'text-title-2 tabular-nums leading-tight mt-0.5',
                      isSelected ? 'text-white' : 'text-gray-900',
                    )}>
                      {strengthFc}
                    </span>
                    <span className={cn(
                      'text-caption leading-none mt-0.5',
                      isSelected ? 'text-white/50' : 'text-gray-500',
                    )}>
                      kg/cm²
                    </span>
                  </div>

                  {/* Right: age + meta */}
                  <div className="flex-1 px-3 py-2.5 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className={cn(
                        'text-callout font-semibold leading-tight',
                        isSelected ? 'text-white' : 'text-gray-900',
                      )}>
                        {fam.ageLabel}
                      </span>

                      {allPriced ? (
                        <CheckCircle2 className={cn(
                          'h-4 w-4 shrink-0 mt-0.5',
                          isSelected ? 'text-white/40' : 'text-systemGreen',
                        )} />
                      ) : (
                        <span className={cn(
                          'text-caption px-1.5 py-0.5 rounded-full font-semibold shrink-0',
                          isSelected
                            ? 'bg-white/15 text-white/70'
                            : 'bg-systemOrange/15 text-systemOrange',
                        )}>
                          {withPrice}/{fam.masters.length}
                        </span>
                      )}
                    </div>

                    <div className={cn(
                      'flex items-center gap-1.5 mt-1 text-footnote',
                      isSelected ? 'text-white/50' : 'text-gray-500',
                    )}>
                      <span>{fam.masters.length} maestros</span>
                      {anchorLp && (
                        <>
                          <span>·</span>
                          <span className={cn(
                            'font-medium',
                            isSelected ? 'text-white/70' : 'text-gray-700',
                          )}>
                            {fmtMXN(anchorLp.base_price)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
