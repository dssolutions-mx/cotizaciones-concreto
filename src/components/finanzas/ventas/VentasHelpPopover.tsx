'use client';

import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function VentasHelpPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-9 w-9 shrink-0 rounded-full border-label-tertiary/20 bg-label-tertiary/5"
          aria-label="Guía de interpretación"
        >
          <Info className="h-4 w-4 text-label-secondary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(80vh,560px)] w-[min(92vw,440px)] overflow-y-auto border-label-tertiary/10 p-0"
      >
        <div className="glass-thick border-0 p-5">
          <h3 className="text-title-3 font-semibold text-label-primary">Guía de interpretación</h3>
          <p className="mt-1 text-caption text-label-tertiary">
            Cómo leer el reporte de ventas y las métricas mostradas
          </p>

          <div className="mt-4 grid gap-6">
            <section>
              <h4 className="text-callout font-semibold text-label-primary">Métricas de ventas</h4>
              <ul className="mt-2 space-y-1 text-caption text-label-secondary">
                <li>
                  <strong className="text-label-primary">Ventas totales:</strong> suma del período según el
                  toggle de IVA.
                </li>
                <li>
                  <strong className="text-label-primary">Volumen:</strong> concreto, bombeo y vacío de olla.
                </li>
                <li>
                  <strong className="text-label-primary">Resistencia ponderada:</strong> promedio por volumen.
                </li>
                <li>
                  <strong className="text-label-primary">Edad de garantía:</strong> ponderada por volumen de
                  recetas con edad declarada.
                </li>
              </ul>
            </section>

            <section>
              <h4 className="text-callout font-semibold text-label-primary">Facturación</h4>
              <ul className="mt-2 space-y-1 text-caption text-label-secondary">
                <li>
                  <strong className="text-label-primary">Efectivo:</strong> órdenes marcadas como pago al
                  contado.
                </li>
                <li>
                  <strong className="text-label-primary">Fiscal:</strong> órdenes con factura (IVA aplicado al
                  activar el toggle).
                </li>
              </ul>
            </section>

            <section>
              <h4 className="text-callout font-semibold text-label-primary">Histórico y clientes</h4>
              <ul className="mt-2 space-y-1 text-caption text-label-secondary">
                <li>
                  <strong className="text-label-primary">Volumen / ingresos:</strong> agregación mensual por
                  plantas en alcance; bombeo proviene de remisiones tipo BOMBEO.
                </li>
                <li>
                  <strong className="text-label-primary">Clientes activos:</strong> clientes únicos con
                  remisión en cada mes (ventana de 24 meses).
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-systemBlue/20 bg-systemBlue/5 p-3 text-caption text-label-secondary">
              Los saldos y cobranza detallada viven en{' '}
              <strong className="text-label-primary">Finanzas → Clientes</strong>, no en este reporte.
            </section>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
