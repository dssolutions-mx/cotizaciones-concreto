'use client';

import { useEffect, useState } from 'react';
import ConstructionSiteForm from '@/components/clients/ConstructionSiteForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const FORM_ID = 'construction-site-create-form';

export interface ConstructionSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  onSiteCreated: (
    siteId: string,
    siteName: string,
    siteLocation?: string,
    siteLat?: number,
    siteLng?: number
  ) => void;
}

/** Modal estándar para registrar una obra (cotizador y otros flujos comerciales). */
export function ConstructionSiteDialog({
  open,
  onOpenChange,
  clientId,
  onSiteCreated,
}: ConstructionSiteDialogProps) {
  const [formKey, setFormKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setFormKey((k) => k + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,840px)] w-[min(100vw-2rem,42rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1.5 border-b px-6 py-5 pr-12 text-left">
          <DialogTitle>Nueva obra</DialogTitle>
          <DialogDescription>
            Registre la obra del cliente. Quedará pendiente de autorización en Finanzas antes de poder usarla en
            cotizaciones.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {!clientId ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Seleccione un cliente antes de registrar una obra.
            </p>
          ) : (
            <ConstructionSiteForm
              key={formKey}
              formId={FORM_ID}
              clientId={clientId}
              hideFooter
              onSubmittingChange={setIsSubmitting}
              onCancel={() => onOpenChange(false)}
              onSiteCreated={(...args) => {
                onSiteCreated(...args);
                onOpenChange(false);
              }}
            />
          )}
        </div>

        {clientId ? (
          <DialogFooter className="shrink-0 gap-2 border-t bg-muted/20 px-6 py-4 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" form={FORM_ID} disabled={isSubmitting}>
              {isSubmitting ? 'Creando…' : 'Crear obra'}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
