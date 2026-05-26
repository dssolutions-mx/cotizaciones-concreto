'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { EmaFichaPrintToolbar } from '@/components/ema/EmaFichaPrintToolbar'
import { TemplateFicha } from '@/components/ema/TemplateFicha'
import type {
  VerificacionTemplateHeaderField,
  VerificacionTemplateItem,
  VerificacionTemplateSection,
} from '@/types/ema'

type TemplatePayload = {
  id: string
  codigo: string
  nombre: string
  norma_referencia: string | null
  descripcion: string | null
  sections: Array<VerificacionTemplateSection & { items: VerificacionTemplateItem[] }>
  header_fields?: VerificacionTemplateHeaderField[]
}

export default function PlantillaImprimirPage() {
  const { id: conjuntoId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const templateId = searchParams.get('template')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [template, setTemplate] = useState<TemplatePayload | null>(null)

  useEffect(() => {
    if (!templateId) {
      setError('Falta el parámetro template en la URL.')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/ema/templates/${templateId}`)
        const j = await res.json()
        if (!res.ok) throw new Error(j.error ?? 'No se pudo cargar la plantilla')
        if (!cancelled) {
          setTemplate(j.data as TemplatePayload)
          setError(null)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error')
          setTemplate(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [templateId])

  const title = template?.nombre ?? 'Vista previa de ficha'

  return (
    <div className="-m-4 md:-m-6 min-h-screen bg-white print:m-0">
      <EmaFichaPrintToolbar
        backHref={`/quality/conjuntos/${conjuntoId}/plantilla?template=${templateId ?? ''}`}
        backLabel="Constructor de plantilla"
        title={title}
      />

      <div className="mx-auto max-w-4xl px-4 py-6 print:px-0 print:py-0">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}

        {template && !loading && !error && (
          <>
            <p className="print:hidden mb-4 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Vista del borrador actual (puede diferir de la versión publicada). Para la hoja oficial del instrumento use
              Imprimir ficha desde la ficha del equipo tipo C/D.
            </p>
            <TemplateFicha
              template={{
                codigo: template.codigo,
                nombre: template.nombre,
                norma_referencia: template.norma_referencia,
                descripcion: template.descripcion,
              }}
              sections={template.sections}
              header_fields={template.header_fields}
            />
          </>
        )}
      </div>
    </div>
  )
}
