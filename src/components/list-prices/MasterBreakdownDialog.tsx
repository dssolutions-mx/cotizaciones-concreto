'use client';

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import {
  getMasterMaterialLineItems,
  type MaterialLineItem,
  type MasterRecipeRow,
} from '@/lib/services/listPriceWorkspaceService';
import { fmtMXN, placementLabel } from './shared';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  master: MasterRecipeRow;
  plantId: string;
}

export function MasterBreakdownDialog({ open, onOpenChange, master, plantId }: Props) {
  const [items, setItems]     = useState<MaterialLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    getMasterMaterialLineItems(master.id, plantId)
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error al calcular'))
      .finally(() => setLoading(false));
  }, [open, master.id, plantId]);

  const total    = items.reduce((s, i) => s + i.lineTotal, 0);
  const tma      = master.max_aggregate_size != null ? `TMA ${master.max_aggregate_size} mm` : null;
  const subtitle = [placementLabel(master.placement_type), `Rev. ${master.slump} cm`, tma].filter(Boolean).join(' · ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-callout tracking-wide text-gray-900">
            {master.master_code}
          </DialogTitle>
          <DialogDescription className="text-footnote text-gray-500">{subtitle}</DialogDescription>
          {master.display_name && (
            <p className="text-caption text-gray-400 -mt-1">{master.display_name}</p>
          )}
        </DialogHeader>

        <div className="pt-1">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-callout text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin text-systemBlue" />
              Calculando desglose de materiales…
            </div>
          ) : error ? (
            <p className="py-4 text-callout text-systemRed">{error}</p>
          ) : items.length === 0 ? (
            <p className="py-4 text-callout text-gray-400">
              Sin variante de receta o precios disponibles para esta planta.
            </p>
          ) : (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-1 pb-1.5">
                {['Material', 'Cantidad', 'Precio unit.', 'Subtotal'].map((h) => (
                  <span key={h} className="text-caption font-semibold uppercase tracking-wider text-gray-400 last:text-right">
                    {h}
                  </span>
                ))}
              </div>

              {/* Material rows */}
              <div className="divide-y divide-gray-100/80 rounded-xl border border-gray-100 overflow-hidden">
                {items.map((item) => (
                  <div
                    key={item.materialId}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-2.5 hover:bg-gray-50/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-callout font-medium text-gray-900 truncate">{item.name}</p>
                      {item.category && (
                        <p className="text-caption text-gray-400 uppercase tracking-wide">{item.category}</p>
                      )}
                    </div>

                    <div className="text-right text-footnote text-gray-600 tabular-nums whitespace-nowrap self-center">
                      {item.quantity % 1 === 0
                        ? item.quantity.toFixed(0)
                        : item.quantity.toFixed(3)}{' '}
                      <span className="text-caption text-gray-400">{item.unit}</span>
                    </div>

                    <div className="text-right text-footnote text-gray-500 tabular-nums whitespace-nowrap self-center">
                      {fmtMXN(item.unitPrice)}
                    </div>

                    <div className="text-right text-callout font-semibold text-gray-900 tabular-nums whitespace-nowrap self-center">
                      {fmtMXN(item.lineTotal)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-between items-center mt-3 px-3 py-2.5 rounded-xl bg-gray-900 text-white">
                <span className="text-callout font-semibold">Total costo de materiales</span>
                <span className="text-callout font-bold tabular-nums">{fmtMXN(total)}</span>
              </div>

              <p className="text-caption text-gray-400 mt-2.5 px-1">
                Basado en la última variante activa y precios vigentes de la planta.
                Costos de transporte y administrativos no incluidos.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
