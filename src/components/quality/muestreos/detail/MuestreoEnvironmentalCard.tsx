'use client'

import React from 'react'
import { Thermometer, Wind } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { MuestreoWithRelations } from '@/types/quality'

type Props = {
  muestreo: MuestreoWithRelations
}

export default function MuestreoEnvironmentalCard({ muestreo }: Props) {
  const hasAmbient = typeof muestreo.temperatura_ambiente === 'number'
  const hasConcrete = typeof muestreo.temperatura_concreto === 'number'
  const hasAir = muestreo.contenido_aire != null

  if (!hasAmbient && !hasConcrete && !hasAir) {
    return (
      <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Thermometer className="h-5 w-5 text-stone-600" />
            Condiciones Ambientales
          </CardTitle>
          <CardDescription>Sin mediciones registradas</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Thermometer className="h-5 w-5 text-stone-600" />
          Condiciones Ambientales
        </CardTitle>
        <CardDescription>Temperatura y condiciones durante el muestreo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasAmbient && (
          <div>
            <p className="text-sm font-medium text-stone-500 mb-2">Temperatura Ambiente</p>
            <div className="text-3xl font-bold text-stone-900">
              {muestreo.temperatura_ambiente}
              <span className="text-sm font-normal text-stone-500 ml-1">°C</span>
            </div>
          </div>
        )}
        {hasAmbient && hasConcrete && <Separator />}
        {hasConcrete && (
          <div>
            <p className="text-sm font-medium text-stone-500 mb-2">Temperatura Concreto</p>
            <div className="text-3xl font-bold text-stone-900">
              {muestreo.temperatura_concreto}
              <span className="text-sm font-normal text-stone-500 ml-1">°C</span>
            </div>
          </div>
        )}
        {(hasAmbient || hasConcrete) && hasAir && <Separator />}
        {hasAir && (
          <div>
            <p className="text-sm font-medium text-stone-500 mb-2">Contenido de aire</p>
            <div className="flex items-center gap-2">
              <Wind className="h-6 w-6 text-stone-500" />
              <div className="text-3xl font-bold text-stone-900">
                {muestreo.contenido_aire}
                <span className="text-sm font-normal text-stone-500 ml-1">%</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
