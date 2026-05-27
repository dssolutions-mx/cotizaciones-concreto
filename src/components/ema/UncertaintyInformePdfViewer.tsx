'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { UncertaintyInformePDFProps } from '@/components/ema/pdf/UncertaintyInformePDF'

/**
 * Preview via blob URL + iframe. PDFViewer from @react-pdf/renderer is incompatible
 * with React 19 (internal reconciler throws "is not a function").
 */
export function UncertaintyInformePdfViewer(props: UncertaintyInformePDFProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const propsRef = useRef(props)
  propsRef.current = props

  const renderKey = useMemo(() => {
    const lab = props.lab ?? props.informe.lab
    return [
      props.informe.study.id,
      props.informe.budget_computed_at,
      props.generatedAt ?? '',
      lab?.plantName ?? '',
      lab?.acreditacionEma ?? '',
    ].join('|')
  }, [props.informe.study.id, props.informe.budget_computed_at, props.generatedAt, props.lab, props.informe.lab])

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    async function renderPreview() {
      setLoading(true)
      setError(null)
      try {
        const [{ pdf }, { UncertaintyInformePDF }] = await Promise.all([
          import('@react-pdf/renderer'),
          import('@/components/ema/pdf/UncertaintyInformePDF'),
        ])

        const current = propsRef.current
        const generatedAt =
          current.generatedAt ??
          new Date().toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })

        const blob = await pdf(
          <UncertaintyInformePDF {...current} generatedAt={generatedAt} />,
        ).toBlob()

        if (cancelled) return

        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return objectUrl
        })
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'No se pudo generar la vista previa')
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return null
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void renderPreview()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [renderKey])

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-100 overflow-hidden shadow-sm min-h-[70vh]">
      {loading && (
        <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Generando vista previa PDF…
        </div>
      )}

      {error && !loading && (
        <div className="p-4 text-sm text-red-800 bg-red-50">{error}</div>
      )}

      {previewUrl && !loading && !error && (
        <iframe
          src={previewUrl}
          title="Vista previa del informe de incertidumbre"
          className="w-full min-h-[70vh] border-0 bg-white"
        />
      )}
    </div>
  )
}
