'use client'

import React from 'react'
import { Award } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import InformeEmissionPanel from '@/components/quality/informes/InformeEmissionPanel'
import MuestreoInformeFieldsCard from '@/components/quality/muestreos/detail/MuestreoInformeFieldsCard'
import type { MuestreoInformeBundle } from '@/services/muestreoDetailService'
import type { MuestreoWithRelations } from '@/types/quality'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  muestreo: MuestreoWithRelations
  ensayoHasEquipment: boolean
  initialInforme?: MuestreoInformeBundle | null
  onRefresh: () => void
}

export default function MuestreoInformeSheet({
  open,
  onOpenChange,
  muestreo,
  ensayoHasEquipment,
  initialInforme,
  onRefresh,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-[#1B365D]" />
            Informe acreditado
          </SheetTitle>
          <SheetDescription>
            Datos del informe §2 y emisión ISO 7.8 (DC-LC-7.8-01). No afecta el flujo diario de
            muestreo y ensayos.
          </SheetDescription>
        </SheetHeader>

        {open ? (
          <div className="space-y-6 pb-6">
            <MuestreoInformeFieldsCard muestreo={muestreo} onSaved={onRefresh} />
            <InformeEmissionPanel
              muestreo={muestreo}
              ensayoHasEquipment={ensayoHasEquipment}
              initialInforme={initialInforme}
              onRefresh={onRefresh}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
