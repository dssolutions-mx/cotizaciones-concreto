'use client'

import type { CompletedVerificacionDetalle } from '@/types/ema'
import type {
  VerificacionInformePDFProps,
  VerificacionPdfLabContext,
} from '@/components/ema/pdf/VerificacionInformePDF'

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.-]+/g, '_').slice(0, 48)
}

export function buildVerificacionInformeFilename(
  items: CompletedVerificacionDetalle[],
): string {
  const date = new Date().toISOString().slice(0, 10)
  if (items.length === 1) {
    const v = items[0]
    const codigo = sanitizeFilenamePart(v.instrumento?.codigo ?? 'instrumento')
    const fecha = v.fecha_verificacion ?? date
    return `Verificacion_${codigo}_${fecha}.pdf`
  }
  return `Informe_Verificaciones_${items.length}_${date}.pdf`
}

export async function downloadVerificacionInformePdf(
  items: CompletedVerificacionDetalle[],
  options?: {
    lab?: VerificacionPdfLabContext
    includeCover?: boolean
    filename?: string
  },
): Promise<void> {
  if (!items.length) {
    throw new Error('No hay verificaciones para exportar.')
  }

  const [{ pdf }, { VerificacionInformePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/ema/pdf/VerificacionInformePDF'),
  ])

  const props: VerificacionInformePDFProps = {
    items,
    lab: options?.lab,
    includeCover: options?.includeCover ?? items.length > 1,
    generatedAt: new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  }

  const blob = await pdf(<VerificacionInformePDF {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = options?.filename ?? buildVerificacionInformeFilename(items)
  a.click()
  URL.revokeObjectURL(url)
}

export async function openVerificacionInformePdfInNewTab(
  items: CompletedVerificacionDetalle[],
  options?: {
    lab?: VerificacionPdfLabContext
    includeCover?: boolean
  },
): Promise<void> {
  if (!items.length) {
    throw new Error('No hay verificaciones para exportar.')
  }

  const [{ pdf }, { VerificacionInformePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/ema/pdf/VerificacionInformePDF'),
  ])

  const blob = await pdf(
    <VerificacionInformePDF
      items={items}
      lab={options?.lab}
      includeCover={options?.includeCover ?? items.length > 1}
    />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
