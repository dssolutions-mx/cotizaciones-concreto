'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  CONFORMIDAD_LABELS,
  type LoteConformidadStatus,
} from '@/lib/quality/laboratorioConformidad';

const STYLES: Record<LoteConformidadStatus, string> = {
  sin_ensayos: 'bg-stone-100 text-stone-600 border-stone-200',
  sin_referencia: 'bg-stone-100 text-stone-600 border-stone-200',
  cumple: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  parcial: 'bg-amber-100 text-amber-800 border-amber-200',
  no_cumple: 'bg-red-100 text-red-800 border-red-200',
};

type Props = {
  status: LoteConformidadStatus;
  className?: string;
  showDetail?: string;
};

export default function ExperimentoConformidadBadge({ status, className, showDetail }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <Badge variant="outline" className={cn('text-xs font-medium', STYLES[status])}>
        {CONFORMIDAD_LABELS[status]}
      </Badge>
      {showDetail && <span className="text-xs text-stone-500">{showDetail}</span>}
    </span>
  );
}
