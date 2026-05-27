'use client'

import type { UncertaintyStudyInformeDetalle } from '@/types/ema-uncertainty'
import type {
  UncertaintyInformePDFProps,
  UncertaintyPdfLabContext,
} from '@/components/ema/pdf/UncertaintyInformePDF'

function sanitizeFilenamePart(value: string): string {
  return value.replace(/[^\w.-]+/g, '_').slice(0, 48)
}

export function buildUncertaintyInformeFilename(informe: UncertaintyStudyInformeDetalle): string {
  const code = sanitizeFilenamePart(
    informe.study.documento_codigo ??
      `${informe.measurand.codigo}_${informe.study.fecha_estudio}`,
  )
  return `Incertidumbre_${informe.measurand.codigo}_${code}.pdf`
}

export async function downloadUncertaintyInformePdf(
  informe: UncertaintyStudyInformeDetalle,
  options?: {
    lab?: UncertaintyPdfLabContext
    filename?: string
  },
): Promise<void> {
  const [{ pdf }, { UncertaintyInformePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/ema/pdf/UncertaintyInformePDF'),
  ])

  const props: UncertaintyInformePDFProps = {
    informe,
    lab: options?.lab,
    generatedAt: new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
  }

  const blob = await pdf(<UncertaintyInformePDF {...props} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = options?.filename ?? buildUncertaintyInformeFilename(informe)
  a.click()
  URL.revokeObjectURL(url)
}

export async function openUncertaintyInformePdfInNewTab(
  informe: UncertaintyStudyInformeDetalle,
  options?: { lab?: UncertaintyPdfLabContext },
): Promise<void> {
  const [{ pdf }, { UncertaintyInformePDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/ema/pdf/UncertaintyInformePDF'),
  ])

  const blob = await pdf(
    <UncertaintyInformePDF
      informe={informe}
      lab={options?.lab}
      generatedAt={new Date().toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })}
    />,
  ).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
