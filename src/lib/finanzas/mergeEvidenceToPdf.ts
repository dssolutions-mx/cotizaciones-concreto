/**
 * Merge PDFs and raster evidence into one PDF.
 * - PDF files: pages are copied as-is.
 * - Images (JPEG/PNG/WebP/GIF, etc.): each becomes **one PDF page whose size matches the image**
 *   (full-bleed, no A4 canvas or margins) — equivalent to “image → single-page PDF”, then concatenate.
 */

import type { PDFDocument, PDFImage } from 'pdf-lib'

export type EvidencePartInput = {
  buffer: ArrayBuffer
  mimeType: string
  name: string
}

function isPdfBuffer(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf.slice(0, 5))
  return u[0] === 0x25 && u[1] === 0x50 && u[2] === 0x44 && u[3] === 0x46
}

function sniffJpeg(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf.slice(0, 2))
  return u[0] === 0xff && u[1] === 0xd8
}

function sniffPng(buf: ArrayBuffer): boolean {
  const u = new Uint8Array(buf.slice(0, 4))
  return u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47
}

async function rasterToPngBuffer(buf: ArrayBuffer, mimeGuess: string): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  try {
    const type =
      mimeGuess && mimeGuess.startsWith('image/') ? mimeGuess : 'application/octet-stream'
    const blob = new Blob([buf], { type })
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bmp.close()
      return null
    }
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
    const pngBlob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/png')
    )
    if (!pngBlob) return null
    return pngBlob.arrayBuffer()
  } catch {
    return null
  }
}

/** One page, same width/height as the bitmap in PDF points; image drawn edge-to-edge (y=0 = bottom in PDF coords). */
function addImageAsNativePdfPage(merged: PDFDocument, img: PDFImage): void {
  const w = Math.max(1, img.width)
  const h = Math.max(1, img.height)
  const page = merged.addPage([w, h])
  page.drawImage(img, {
    x: 0,
    y: 0,
    width: w,
    height: h,
  })
}

export async function mergeEvidencePartsToPdf(parts: EvidencePartInput[]): Promise<Uint8Array> {
  if (parts.length === 0) throw new Error('Sin archivos para unir')

  const { PDFDocument } = await import('pdf-lib')
  const merged = await PDFDocument.create()

  for (const part of parts) {
    const { buffer, mimeType, name } = part
    const mime = (mimeType || '').toLowerCase()
    const lowerName = (name || '').toLowerCase()

    const treatAsPdf =
      mime.includes('pdf') || lowerName.endsWith('.pdf') || isPdfBuffer(buffer)

    if (treatAsPdf) {
      try {
        const src = await PDFDocument.load(buffer, { ignoreEncryption: true })
        const copied = await merged.copyPages(src, src.getPageIndices())
        copied.forEach((p) => merged.addPage(p))
      } catch (e) {
        console.warn('mergeEvidencePartsToPdf: PDF omitido', name, e)
      }
      continue
    }

    let embedded: PDFImage | null = null

    if (sniffJpeg(buffer) || mime.includes('jpeg') || mime.includes('jpg') || /\.jpe?g$/i.test(lowerName)) {
      try {
        embedded = await merged.embedJpg(buffer)
      } catch {
        /* try PNG / raster */
      }
    }

    if (
      !embedded &&
      (sniffPng(buffer) || mime.includes('png') || lowerName.endsWith('.png'))
    ) {
      try {
        embedded = await merged.embedPng(buffer)
      } catch {
        /* raster fallback */
      }
    }

    if (!embedded) {
      const pngBuf = await rasterToPngBuffer(buffer, mimeType || 'image/webp')
      if (pngBuf) {
        try {
          embedded = await merged.embedPng(pngBuf)
        } catch {
          /* noop */
        }
      }
    }

    if (embedded) {
      addImageAsNativePdfPage(merged, embedded)
    } else {
      console.warn('mergeEvidencePartsToPdf: imagen omitida', name)
    }
  }

  if (merged.getPageCount() === 0) {
    throw new Error('No se pudo generar ninguna página en el PDF')
  }

  return merged.save()
}
