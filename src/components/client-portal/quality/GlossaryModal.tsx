'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

interface GlossaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlossaryModal({ open, onOpenChange }: GlossaryModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-thick rounded-3xl border border-white/20">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-label-primary">
            <Info className="w-5 h-5 text-systemBlue" />
            Glosario de Calidad
          </DialogTitle>
          <DialogDescription className="text-label-secondary">
            Explicaciones rápidas para ayudarte a interpretar los indicadores clave
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Rendimiento Volumétrico */}
          <div className="glass-thin rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-callout font-semibold text-label-primary">Rendimiento volumétrico</h3>
              <Badge variant="primary">%</Badge>
            </div>
            <p className="text-body text-label-secondary">
              Indica qué tan cerca está el volumen producido del volumen teórico esperado.
              Valores entre 98% y 102% suelen considerarse normales; ≥100% es ideal.
            </p>
          </div>

          {/* Coeficiente de Variación */}
          <div className="glass-thin rounded-2xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-callout font-semibold text-label-primary">Coeficiente de variación (CV)</h3>
              <Badge variant="neutral">%</Badge>
            </div>
            <p className="text-body text-label-secondary">
              Mide la variabilidad relativa de la resistencia. Mientras menor, mejor.
              Referencias típicas: ≤10% excelente, 10–15% muy bueno, >15% revisar variabilidad.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


