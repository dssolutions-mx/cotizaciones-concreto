'use client'

import React from 'react'
import { HelpCircle, Info, ExternalLink, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import Link from 'next/link'
import ProcurementFlowNav from '@/components/procurement/ProcurementFlowNav'

export default function ProcurementHelpSheet({ plantId }: { plantId?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-stone-500 hover:text-stone-700 hover:bg-stone-100"
          aria-label="Ayuda — cómo funciona el centro de compras"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base">¿Cómo funciona el centro de compras?</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 text-sm">
          <ProcurementFlowNav plantId={plantId} />

          <div className="rounded-lg border border-stone-200 bg-[#faf9f7] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-sky-100 p-2 text-sky-800">
                <Info className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 space-y-2 text-sm text-stone-600">
                <p className="font-medium text-stone-800">Coordinación del flujo de materiales</p>
                <ol className="list-decimal list-inside space-y-1.5 text-stone-600">
                  <li>
                    <span className="text-stone-700">Dosificador</span> confirma existencia física y pasa a validación.
                  </li>
                  <li>
                    <span className="text-stone-700">Jefe de planta / unidad</span> valida, vincula OC existente o marca
                    que hace falta una nueva.
                  </li>
                  <li>
                    <span className="text-stone-700">Usted (operaciones)</span> crea o vincula la OC, programa la entrega y
                    da seguimiento hasta el cierre en inventario.
                  </li>
                  <li>
                    La entrada de material puede cerrar la alerta; puede abrirse desde Control de producción o al registrar
                    la recepción.
                  </li>
                </ol>
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs">
                  <Link
                    href="/production-control"
                    className="inline-flex items-center gap-1 text-sky-800 hover:text-sky-950 font-medium"
                  >
                    Control de producción <ExternalLink className="h-3 w-3" />
                  </Link>
                  <Link
                    href="/production-control/alerts"
                    className="inline-flex items-center gap-1 text-sky-800 hover:text-sky-950 font-medium"
                  >
                    Alertas (detalle) <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
