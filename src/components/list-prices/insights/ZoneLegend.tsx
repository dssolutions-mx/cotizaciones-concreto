'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ZONE_DIVERGENCE_THRESHOLD_MXN } from '../shared';

export function ZoneLegend() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <Info className="h-3.5 w-3.5" />
            Cómo leer zonas
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs leading-relaxed">
          <p className="font-semibold mb-1">Delta por zona (AB, C, D, E)</p>
          <p>
            Promedio ponderado por volumen de (precio cotizado − precio lista) en cotizaciones
            APPROVED. Si la zona C es mucho menor que AB, puede indicar concesión de precio en
            entregas lejanas.
          </p>
          <p className="mt-2">
            Resaltado en tabla: diferencia &gt; ${ZONE_DIVERGENCE_THRESHOLD_MXN}/m³ vs zona AB.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
