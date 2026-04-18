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
              Agrupa la evidencia (PDF o imágenes) por <strong>pedido</strong> y permite contrastarla con
              las remisiones de concreto del sistema. En escritorio, el panel de detalle permanece fijo al
              hacer scroll en la tabla.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-stone-800">Estados en tabla</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                <span className="text-emerald-800">Con evidencia</span>: hay al menos un archivo para el
                pedido.
              </li>
              <li>
                <span className="text-amber-800">Falta evidencia</span>: hay remisiones de concreto pero no
                hay archivos.
              </li>
              <li>
                <span className="text-muted-foreground">Sin remisiones</span>: no hay remisiones de concreto
                registradas.
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-stone-800">Filtros</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>
                Rango por <strong>fecha de entrega</strong>.
              </li>
              <li>
                <strong>Planta</strong>, <strong>cliente</strong> y <strong>estado evidencia</strong>{' '}
                (todos, con/sin archivos, sin remisiones).
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-stone-800">Vista previa y PDF</p>
            <p>
              En PDFs con texto, el cuadro lateral intenta detectar números de remisión (patrón «FECHA :
              número»). Los PDF escaneados sin texto requieren revisión visual. Si el análisis falla, use
              Abrir o Descargar.
            </p>
            <p>
              En el <strong>panel del pedido</strong> puede marcar <strong>PDFs e imágenes</strong> (PNG, JPG,
              GIF, WebP) y generar un <strong>ZIP</strong>. En la <strong>tabla principal</strong>, use la primera
              columna para elegir varios pedidos con evidencia y <strong>ZIP pedidos</strong> en la cabecera: se
              descargan todos los PDF/imágenes de esos pedidos, organizados en carpetas por pedido (límites de
              cantidad en el botón).
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium text-stone-800">Exportar Excel</p>
            <p>
              <strong>Descargar Excel</strong> descarga <strong>todos los pedidos que cumplen los filtros</strong>{' '}
              (no solo la página visible), hasta un límite de seguridad. El archivo incluye:{' '}
              <strong>Resumen</strong> (filtros y contexto), <strong>Pedidos</strong> (una fila por pedido, alineado
              a la tabla), <strong>Remisiones</strong> (una fila por número de remisión para cruzar en Excel) y{' '}
              <strong>Archivos_evidencia</strong> (una fila por archivo con ruta de almacenamiento). Las hojas de
              datos tienen autofiltro y anchos razonables.
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
