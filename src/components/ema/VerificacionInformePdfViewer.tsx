'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import type { VerificacionInformePDFProps } from '@/components/ema/pdf/VerificacionInformePDF'

const PDFViewer = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] items-center justify-center gap-2 text-sm text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        Generando vista previa PDF…
      </div>
    ),
  },
)

const VerificacionInformePDF = dynamic(
  () =>
    import('@/components/ema/pdf/VerificacionInformePDF').then((mod) => mod.VerificacionInformePDF),
  { ssr: false },
)

export function VerificacionInformePdfViewer(props: VerificacionInformePDFProps) {
  const generatedAt =
    props.generatedAt ??
    new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })

  return (
    <div className="rounded-lg border border-stone-300 bg-stone-300 overflow-hidden shadow-sm">
      <PDFViewer width="100%" height="100%" showToolbar className="min-h-[70vh] w-full">
        <VerificacionInformePDF {...props} generatedAt={generatedAt} />
      </PDFViewer>
    </div>
  )
}
