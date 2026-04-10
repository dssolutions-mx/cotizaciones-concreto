'use client'

import React from 'react'
import Link from 'next/link'
import { Beaker, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { MuestraWithRelations } from '@/types/quality'
import { cn, formatDate } from '@/lib/utils'
import { qualityHubOutlineNeutralClass, qualityHubPrimaryButtonClass } from '../../qualityHubUi'

type Props = {
  muestrasOrdenadas: MuestraWithRelations[]
  displayNameById: Map<string, string>
  onAddSample: () => void
  onRequestDelete: (muestraId: string) => void
}

function tipoLabel(tipo: string) {
  if (tipo === 'CILINDRO') return 'Cilindro'
  if (tipo === 'VIGA') return 'Viga'
  return 'Cubo'
}

export default function MuestreoSpecimenGrid({
  muestrasOrdenadas,
  displayNameById,
  onAddSample,
  onRequestDelete,
}: Props) {
  return (
    <Card className="mb-6 border border-stone-200/90 bg-white shadow-sm ring-1 ring-stone-950/[0.02]">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Beaker className="h-5 w-5 text-stone-600" />
              Especímenes de Ensayo
            </CardTitle>
            <CardDescription>Muestras registradas para este muestreo</CardDescription>
          </div>
          <Button
            type="button"
            onClick={onAddSample}
            size="sm"
            variant="primary"
            className={cn(
              qualityHubPrimaryButtonClass,
              'flex items-center gap-2 h-9 w-full sm:w-auto'
            )}
          >
            <Plus className="h-4 w-4" />
            Agregar Muestra
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {muestrasOrdenadas.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-lg border border-dashed border-stone-200 bg-stone-50/50">
            <Beaker className="h-12 w-12 text-stone-300 mx-auto mb-3" />
            <p className="text-stone-600 font-medium mb-1">No hay muestras registradas</p>
            <p className="text-sm text-stone-500 mb-4">Agrega especímenes para programar ensayos.</p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className={cn(qualityHubPrimaryButtonClass, 'h-9')}
              onClick={onAddSample}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar primera muestra
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {muestrasOrdenadas.map((muestra) => (
              <Card
                key={muestra.id}
                className="overflow-hidden transition-all duration-200 hover:shadow-md hover:border-sky-200/50 border border-stone-200 bg-white ring-1 ring-stone-950/[0.02]"
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="bg-stone-50 text-stone-700 border-stone-300">
                      {tipoLabel(muestra.tipo_muestra)}
                    </Badge>
                    <div className="flex gap-1">
                      <Badge
                        variant={
                          muestra.estado === 'ENSAYADO'
                            ? 'default'
                            : muestra.estado === 'DESCARTADO'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className={`text-xs ${
                          muestra.estado === 'ENSAYADO'
                            ? 'bg-green-100 text-green-800 border-green-300'
                            : muestra.estado === 'DESCARTADO'
                              ? ''
                              : muestra.estado === 'NO_REALIZADO'
                                ? 'bg-stone-200 text-stone-800 border-stone-400'
                                : 'bg-stone-100 text-stone-800 border-stone-300'
                        }`}
                      >
                        {muestra.estado === 'NO_REALIZADO' ? 'No realizado' : muestra.estado}
                      </Badge>
                      {(muestra.estado === 'PENDIENTE' || muestra.estado === 'DESCARTADO') && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onRequestDelete(muestra.id)}
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          aria-label="Eliminar muestra"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-semibold text-stone-900 mb-1">
                    {displayNameById.get(muestra.id) || muestra.identificacion}
                  </h3>

                  {(() => {
                    const ensayo =
                      muestra.ensayos && muestra.ensayos.length > 0 ? muestra.ensayos[0] : null
                    const realTs = ensayo ? ((ensayo as { fecha_ensayo_ts?: string }).fecha_ensayo_ts as string | undefined) : undefined
                    const realDateStr = realTs || (ensayo ? ensayo.fecha_ensayo : undefined)
                    const schedTs = (muestra as { fecha_programada_ensayo_ts?: string }).fecha_programada_ensayo_ts
                    const schedDateStr = schedTs || muestra.fecha_programada_ensayo
                    if (muestra.estado === 'ENSAYADO' && realDateStr) {
                      return (
                        <div className="text-xs text-stone-600 mb-2">
                          Ensayo realizado: {formatDate(realDateStr, 'PPP')}
                        </div>
                      )
                    }
                    return schedDateStr ? (
                      <div className="text-xs text-stone-600 mb-2">
                        Ensayo programado: {formatDate(schedDateStr, 'PPP')}
                      </div>
                    ) : null
                  })()}

                  {muestra.estado === 'NO_REALIZADO' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(qualityHubOutlineNeutralClass, 'w-full h-9')}
                      disabled
                    >
                      No realizado
                    </Button>
                  ) : muestra.estado === 'PENDIENTE' ? (
                    <Link href={`/quality/ensayos/new?muestra=${muestra.id}`}>
                      <Button
                        size="sm"
                        variant="primary"
                        className={cn(qualityHubPrimaryButtonClass, 'w-full h-9')}
                      >
                        Registrar Ensayo
                      </Button>
                    </Link>
                  ) : muestra.ensayos && muestra.ensayos.length > 0 ? (
                    (() => {
                      const sorted = [...muestra.ensayos].sort((a, b) => {
                        const at = (a as { fecha_ensayo_ts?: string }).fecha_ensayo_ts || a.fecha_ensayo || ''
                        const bt = (b as { fecha_ensayo_ts?: string }).fecha_ensayo_ts || b.fecha_ensayo || ''
                        return new Date(at).getTime() - new Date(bt).getTime()
                      })
                      const targetId = sorted[0]?.id
                      if (!targetId) {
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(qualityHubOutlineNeutralClass, 'w-full h-9')}
                            disabled
                          >
                            Ver Ensayo
                          </Button>
                        )
                      }
                      return (
                        <Link href={`/quality/ensayos/${targetId}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn(qualityHubOutlineNeutralClass, 'w-full h-9')}
                          >
                            Ver Ensayo
                          </Button>
                        </Link>
                      )
                    })()
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className={cn(qualityHubOutlineNeutralClass, 'w-full h-9')}
                      disabled
                    >
                      Ver Ensayo
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
