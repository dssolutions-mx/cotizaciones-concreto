/**
 * Multi-order pumping evidence: one cover page per pedido, then merged PDF/images
 * for that order's remisiones de bombeo (client-only; uses mergeEvidencePartsToPdf).
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { mergeEvidencePartsToPdf, type EvidencePartInput } from '@/lib/finanzas/mergeEvidenceToPdf'

const PAGE_W = 595.28
const PAGE_H = 841.89

export type PumpingOrderSection = {
  orderNumber: string
  parts: EvidencePartInput[]
}

/**
 * Single PDF: for each order with at least one part, inserts a title page
 * "Pedido {orderNumber}" then all merged evidence pages for that order.
 */
export async function buildPumpingMultiOrderPdf(sections: PumpingOrderSection[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  const bodyFont = await out.embedFont(StandardFonts.Helvetica)
  const titleFont = await out.embedFont(StandardFonts.HelveticaBold)
  let any = false

  for (const sec of sections) {
    if (sec.parts.length === 0) continue
    any = true
    const cover = out.addPage([PAGE_W, PAGE_H])
    cover.drawText(`Pedido ${sec.orderNumber}`, {
      x: 50,
      y: PAGE_H - 72,
      size: 16,
      font: titleFont,
      color: rgb(0.12, 0.12, 0.12),
    })
    cover.drawText(
      'Evidencia de bombeo: documentos de remisiones de bombeo (orden de registro en sistema).',
      {
        x: 50,
        y: PAGE_H - 100,
        size: 10,
        font: bodyFont,
        color: rgb(0.35, 0.35, 0.35),
        maxWidth: PAGE_W - 100,
      }
    )
    const merged = await mergeEvidencePartsToPdf(sec.parts)
    const src = await PDFDocument.load(merged, { ignoreEncryption: true })
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }

  if (!any) {
    throw new Error('Sin evidencia de bombeo en la selección')
  }
  return out.save()
}
