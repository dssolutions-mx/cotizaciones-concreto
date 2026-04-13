'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseMonthStart } from '@/lib/materialPricePeriod';
import { toast } from 'sonner';
import { priceService } from '@/lib/supabase/prices';

const MONTH_FMT = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' });

function formatPeriod(periodStart: string) {
  return MONTH_FMT.format(parseMonthStart(periodStart));
}

export type CopyPricesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string;
  fromPeriodStart: string;
  toPeriodStart: string;
  createdBy?: string;
  onCopied?: () => void;
};

export function CopyPricesDialog({
  open,
  onOpenChange,
  plantId,
  fromPeriodStart,
  toPeriodStart,
  createdBy,
  onCopied,
}: CopyPricesDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleCopy = async () => {
    setLoading(true);
    try {
      const { error } = await priceService.copyPricesForward({
        plant_id: plantId,
        from_period_start: fromPeriodStart,
        to_period_start: toPeriodStart,
        created_by: createdBy,
      });
      if (error) {
        toast.error('No se pudieron copiar los precios');
        console.error(error);
        return;
      }
      toast.success('Precios copiados al mes seleccionado');
      onCopied?.();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar precios entre meses</DialogTitle>
          <DialogDescription>
            Se copiarán todos los precios de materiales de{' '}
            <span className="font-medium text-foreground">{formatPeriod(fromPeriodStart)}</span> hacia{' '}
            <span className="font-medium text-foreground">{formatPeriod(toPeriodStart)}</span>. Los registros existentes
            del mes destino con el mismo material se sobrescribirán.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleCopy} disabled={loading || fromPeriodStart === toPeriodStart}>
            {loading ? 'Copiando…' : 'Copiar precios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
