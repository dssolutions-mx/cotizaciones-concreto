'use client'

import React from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Calendar,
  Clock,
  Factory,
  FlaskConical,
  Gauge,
  Package,
  Truck,
  User,
  Waves,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type ProductionRemision = {
  remision_number?: string | null
  fecha?: string | null
  hora_carga?: string | null
  volumen_fabricado?: number | null
  conductor?: string | null
  unidad?: string | null
  plant?: { name?: string | null; code?: string | null } | null
  recipe?: {
    recipe_code?: string | null
    strength_fc?: number | null
    slump?: number | null
    age_days?: number | null
    age_hours?: number | null
    tma?: number | null
  } | null
}

type Props = {
  productionRemision: ProductionRemision
}

export default function CrossPlantProductionCard({ productionRemision }: Props) {
  const pr = productionRemision

  return (
    <Card className="border border-orange-200/90 bg-orange-50/30 shadow-sm ring-1 ring-orange-950/[0.04]">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Factory className="h-4 w-4 text-orange-500 shrink-0" />
          <span>Datos de Producción — Remisión #{pr.remision_number ?? '—'}</span>
          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300 font-normal">
            {pr.plant?.name || pr.plant?.code || 'Planta externa'}
          </Badge>
        </CardTitle>
        <CardDescription className="text-orange-700/70">
          Este concreto fue fabricado en otra planta. Los datos siguientes corresponden a la remisión de producción
          real.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Fecha</p>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-stone-400 shrink-0" />
              <span className="text-sm font-semibold text-stone-900">
                {pr.fecha ? format(new Date(`${pr.fecha}T12:00:00`), 'dd MMM yyyy', { locale: es }) : '—'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Hora de Carga</p>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0" />
              <span
                className={`text-sm font-mono font-semibold ${pr.hora_carga ? 'text-stone-900' : 'text-stone-300'}`}
              >
                {pr.hora_carga || '—'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Volumen Fabricado</p>
            <div className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-stone-400 shrink-0" />
              <span className="text-sm font-semibold text-stone-900">
                {pr.volumen_fabricado != null ? `${pr.volumen_fabricado} m³` : '—'}
              </span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Conductor</p>
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-stone-400 shrink-0" />
              <span className="text-sm text-stone-900">{pr.conductor || '—'}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Unidad</p>
            <div className="flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-stone-400 shrink-0" />
              <span className="text-sm font-mono text-stone-900">{pr.unidad || '—'}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1">Planta Productora</p>
            <div className="flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5 text-orange-500 shrink-0" />
              <span className="text-sm font-semibold text-orange-800">
                {pr.plant?.name || pr.plant?.code || '—'}
              </span>
            </div>
          </div>
          {pr.recipe && (
            <div className="col-span-2 sm:col-span-3 lg:col-span-6 border-t border-orange-100 pt-3 mt-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-3">
                Fórmula de Producción
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-3">
                <div>
                  <p className="text-[10px] text-stone-400 mb-0.5">Código</p>
                  <Badge variant="outline" className="bg-white text-stone-700 border-stone-300 font-mono text-xs">
                    {pr.recipe.recipe_code || '—'}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 mb-0.5">Resistencia f&apos;c</p>
                  <div className="flex items-center gap-1">
                    <Gauge className="h-3.5 w-3.5 text-stone-400" />
                    <span className="text-sm font-bold text-stone-900">
                      {pr.recipe.strength_fc != null ? `${pr.recipe.strength_fc} kg/cm²` : '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 mb-0.5">Revenimiento teórico</p>
                  <div className="flex items-center gap-1">
                    <Waves className="h-3.5 w-3.5 text-stone-400" />
                    <span className="text-sm font-semibold text-stone-900">
                      {pr.recipe.slump != null ? `${pr.recipe.slump} cm` : '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 mb-0.5">TMA</p>
                  <div className="flex items-center gap-1">
                    <FlaskConical className="h-3.5 w-3.5 text-stone-400" />
                    <span className="text-sm font-semibold text-stone-900">
                      {pr.recipe.tma != null ? `${pr.recipe.tma} mm` : '—'}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-stone-400 mb-0.5">Edad garantía</p>
                  <span className="text-sm font-semibold text-stone-900">
                    {pr.recipe.age_hours
                      ? `${pr.recipe.age_hours} hrs`
                      : pr.recipe.age_days != null
                        ? `${pr.recipe.age_days} días`
                        : '—'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
