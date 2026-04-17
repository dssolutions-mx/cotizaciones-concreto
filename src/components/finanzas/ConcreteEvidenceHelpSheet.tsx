'use client'

import React from 'react'
import { HelpCircle, FileText, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import Link from 'next/link'

export default function ConcreteEvidenceHelpSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-stone-500 hover:text-stone-700 hover:bg-stone-100"
          aria-label="Ayuda — evidencia de remisiones de concreto"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base">Evidencia de remisiones (concreto)</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 text-sm text-stone-600">
          <div className="rounded-lg border border-stone-200 bg-[#faf9f7] p-4 space-y-2">
            <div className="flex items-center gap-2 font-medium text-stone-800">
              <FileText className="h-4 w-4 text-stone-500" />
              Qué es esta vista
            </div>
            <p>
              Aquí se agrupa la evidencia documental (PDF o imágenes) por <strong>pedido</strong>, para
              comprobar que exista respaldo de las remisiones de concreto registradas en el sistema.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-stone-800">Estados</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                <span className="text-emerald-800">Con evidencia</span>: hay al menos un archivo cargado
                para el pedido.
              </li>
              <li>
                <span className="text-amber-800">Falta evidencia</span>: hay remisiones de concreto pero
                aún no hay archivos.
              </li>
              <li>
                <span className="text-muted-foreground">Sin remisiones</span>: no aplica revisión de
                evidencia de concreto para ese pedido en el periodo.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-stone-800">Filtros</p>
            <p>
              Use el rango de fechas según la <strong>fecha de entrega</strong> del pedido. Puede filtrar
              por planta (según sus permisos) y marcar solo pedidos con remisiones y sin evidencia para
              priorizar pendientes.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-stone-800">Descarga y revisión</p>
            <p>
              En el panel derecho (o en la hoja en móvil) puede abrir o descargar cada archivo. El CSV
              exporta metadatos del listado actual para auditoría (rutas internas de almacenamiento, sin
              enlaces firmados).
            </p>
          </div>

          <div className="pt-2 border-t border-stone-200">
            <Link
              href="/production-control/evidencia-concreto"
              className="inline-flex items-center gap-1.5 text-sky-800 hover:text-sky-950 font-medium text-sm"
            >
              Carga de evidencia (operaciones) <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
