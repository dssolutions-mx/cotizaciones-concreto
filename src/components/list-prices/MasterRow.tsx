'use client';

import { useState } from 'react';
import { AlertCircle, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { MasterRecipeRow } from '@/lib/services/listPriceWorkspaceService';
import { MasterBreakdownDialog } from './MasterBreakdownDialog';
import {
  type ListPriceRow,
  type MasterDraft,
  type RowSaveStatus,
  fmtMXN,
  computeMarginPct,
  placementLabel,
} from './shared';

interface Props {
  master: MasterRecipeRow;
  plantId: string;
  cost: number | undefined;
  costsLoading: boolean;
  draft: MasterDraft | undefined;
  status: RowSaveStatus;
  currentLp: ListPriceRow | undefined;
  onPriceChange: (masterId: string, value: string) => void;
  onSave: (masterId: string) => void;
}

function SaveStatusIcon({ status }: { status: RowSaveStatus }) {
  if (status === 'saving') return <Loader2 className="h-4 w-4 text-systemBlue animate-spin" />;
  if (status === 'saved')  return <span className="text-caption font-semibold text-systemGreen">Guardado</span>;
  if (status === 'error')  return <AlertCircle className="h-4 w-4 text-systemRed" />;
  if (status === 'dirty')  return <span className="h-2 w-2 rounded-full bg-systemOrange shrink-0" />;
  return null;
}

export function MasterRow({
  master,
  plantId,
  cost,
  costsLoading,
  draft,
  status,
  currentLp,
  onPriceChange,
  onSave,
}: Props) {
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  const listPrice = Number(draft?.listPrice || 0);
  const margin    = cost && listPrice ? computeMarginPct(cost, listPrice) : null;
  const belowCost = cost != null && listPrice > 0 && listPrice < cost;
  const isDirecta = master.placement_type.toUpperCase().startsWith('D');
  const tma       = master.max_aggregate_size != null ? `${master.max_aggregate_size} mm` : '—';

  return (
    <>
      {/* Grid row — 6 cols: Identity | Costo | Precio | Margen | Anterior | Acciones */}
      <div
        className={cn(
          'grid items-center gap-x-4 px-4 py-3 transition-colors duration-150',
          'grid-cols-[minmax(160px,1fr)_120px_136px_72px_104px_auto]',
          status === 'dirty' && 'bg-systemOrange/5',
          status === 'saved' && 'bg-systemGreen/5',
          status === 'error' && 'bg-systemRed/5',
          status === 'idle'  && 'hover:bg-gray-50/60',
        )}
      >
        {/* ① Identity — code + placement + TMA */}
        <div className="min-w-0">
          <button
            onClick={() => setBreakdownOpen(true)}
            className="group flex items-center gap-1 text-left"
            title="Ver desglose de materiales"
          >
            <span className="text-callout font-semibold font-mono text-gray-900 group-hover:underline underline-offset-2">
              {master.master_code}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-systemBlue transition-colors shrink-0" />
          </button>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={cn(
              'inline-block text-caption px-1.5 py-0.5 rounded-full font-medium leading-none',
              isDirecta
                ? 'bg-systemBlue/10 text-systemBlue'
                : 'bg-purple-500/10 text-purple-600',
            )}>
              {placementLabel(master.placement_type)}
            </span>
            {master.max_aggregate_size != null && (
              <span className="text-caption text-gray-400">{tma}</span>
            )}
          </div>
        </div>

        {/* ② Costo materiales */}
        <div>
          {costsLoading && !cost ? (
            <Skeleton className="h-4 w-20 rounded-lg" />
          ) : cost != null ? (
            <button
              onClick={() => setBreakdownOpen(true)}
              className="text-callout font-medium text-gray-800 tabular-nums hover:underline underline-offset-2 hover:text-systemBlue transition-colors"
              title="Ver desglose"
            >
              {fmtMXN(cost)}
            </button>
          ) : (
            <span className="text-footnote text-gray-300">Sin datos</span>
          )}
        </div>

        {/* ③ Precio de lista (input) */}
        <div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-caption select-none">$</span>
            <input
              type="number"
              value={draft?.listPrice ?? ''}
              onChange={(e) => onPriceChange(master.id, e.target.value)}
              placeholder="0.00"
              aria-label={`Precio lista para ${master.master_code}`}
              className={cn(
                'h-8 w-full rounded-xl border pl-5 pr-2 text-callout tabular-nums text-gray-900',
                'focus:outline-none focus:ring-2 focus:ring-systemBlue/40 focus:border-systemBlue/40',
                'transition-colors duration-150',
                belowCost
                  ? 'border-systemRed/40 bg-systemRed/5'
                  : 'border-gray-200 bg-white',
              )}
            />
          </div>
          {belowCost && (
            <p className="flex items-center gap-0.5 text-caption text-systemRed mt-0.5">
              <AlertCircle className="h-3 w-3" /> Bajo costo
            </p>
          )}
        </div>

        {/* ④ Margen */}
        <div className="text-callout font-semibold tabular-nums">
          {margin != null ? (
            <span className={margin >= 0 ? 'text-systemGreen' : 'text-systemRed'}>
              {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </div>

        {/* ⑤ Precio anterior */}
        <div>
          {currentLp ? (
            <>
              <p className="text-footnote font-medium text-gray-700 tabular-nums">{fmtMXN(currentLp.base_price)}</p>
              <p className="text-caption text-gray-400">{currentLp.effective_date.slice(0, 10)}</p>
            </>
          ) : (
            <span className="text-footnote text-gray-300">Sin precio</span>
          )}
        </div>

        {/* ⑥ Acciones */}
        <div className="flex items-center gap-2">
          <SaveStatusIcon status={status} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onSave(master.id)}
            disabled={status === 'saving' || !draft?.listPrice}
            className={cn(
              'h-7 px-3 text-caption rounded-xl transition-all duration-150',
              status === 'dirty'
                ? 'border-gray-800 text-gray-800 hover:bg-gray-900 hover:text-white'
                : 'border-gray-200 text-gray-500',
            )}
          >
            {status === 'saving' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      </div>

      <MasterBreakdownDialog
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        master={master}
        plantId={plantId}
      />
    </>
  );
}

/** Column header row — must match MasterRow grid exactly */
export function MasterTableHeader() {
  return (
    <div className={cn(
      'grid gap-x-4 px-4 py-2.5',
      'grid-cols-[minmax(160px,1fr)_120px_136px_72px_104px_auto]',
      'bg-gray-50 border-b border-gray-200 sticky top-0 z-10',
    )}>
      {['Código maestro', 'Costo mat.', 'Precio lista', 'Margen', 'Anterior', ''].map((h) => (
        <span key={h} className="text-caption font-semibold uppercase tracking-wider text-gray-500">
          {h}
        </span>
      ))}
    </div>
  );
}
