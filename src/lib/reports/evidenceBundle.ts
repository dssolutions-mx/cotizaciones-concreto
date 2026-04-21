/**
 * Evidence batch bundler for `/finanzas/reportes-clientes`.
 *
 * Produces a single ZIP blob per user request. For every order touched by the
 * user's remisión selection:
 *   - Concrete evidence PDFs/images are merged into ONE PDF
 *     (`evidencia-concreto-{orderNumber}.pdf`).
 *   - Pumping evidence (`remision_documents` where category='pumping_remision')
 *     is copied through as-is into a `bombeo/` subfolder, one file per remisión.
 *
 * Layout:
 *   {bundleRoot}/
 *     {orderNumber}/
 *       evidencia-concreto-{orderNumber}.pdf
 *       bombeo/
 *         R6704-original-name.pdf
 *         R6696-ticket.jpg
 */

import { PDFDocument } from 'pdf-lib'
import type { ReportRemisionData } from '@/types/pdf-reports'
import { supabase } from '@/lib/supabase/client'
import {
  downloadStorageFileArrayBuffer,
  REMISION_DOCUMENTS_BUCKET,
} from '@/lib/supabase/storageDownload'
import {
  sanitizeZipPathSegment,
  uniqueZipPath,
  isConcreteEvidenceFileZippable,
} from '@/lib/finanzas/concreteEvidenceZipUtils'

export const MAX_BUNDLE_ORDERS = 50
export const MAX_BUNDLE_FILES = 500

export interface EvidenceCounts {
  orders: number
  concreteFiles: number
  pumpingFiles: number
  totalFiles: number
}

export interface BundleProgress {
  done: number
  total: number
  currentLabel?: string
}

export interface BuildBundleArgs {
  remisiones: ReportRemisionData[]
  bundleRoot?: string
  onProgress?: (p: BundleProgress) => void
  signal?: AbortSignal
}

export interface BundleResult {
  blob: Blob
  orderCount: number
  fileCount: number
  capped: boolean
}

type OrderGroup = {
  orderId: string
  orderNumber: string
  remisionIds: string[]
  pumpingRemisiones: Array<{ id: string; remision_number: string | number }>
}

function groupByOrder(remisiones: ReportRemisionData[]): OrderGroup[] {
  const by = new Map<string, OrderGroup>()
  for (const r of remisiones) {
    const orderId = r.order?.id ?? r.order_id
    if (!orderId) continue
    const key = String(orderId)
    let g = by.get(key)
    if (!g) {
      g = {
        orderId: key,
        orderNumber: String(r.order?.order_number ?? key.slice(0, 8)),
        remisionIds: [],
        pumpingRemisiones: [],
      }
      by.set(key, g)
    }
    g.remisionIds.push(r.id)
    const tipo = String(r.tipo_remision ?? '').toUpperCase()
    if (tipo === 'BOMBEO' || tipo === 'VACÍO DE OLLA' || tipo === 'VACIO DE OLLA') {
      g.pumpingRemisiones.push({ id: r.id, remision_number: r.remision_number })
    }
  }
  return Array.from(by.values())
}

async function chunkedIn<T>(
  table: string,
  column: string,
  ids: string[],
  select: string
): Promise<T[]> {
  const CHUNK = 120
  const out: T[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK)
    const { data, error } = await supabase.from(table).select(select).in(column, slice)
    if (error) {
      console.warn(`[evidenceBundle] ${table}.${column}:`, error.message)
      continue
    }
    if (data) out.push(...(data as unknown as T[]))
  }
  return out
}

/** Lightweight preflight count (concrete + pumping files across selected orders). */
export async function countEvidenceFiles(
  remisiones: ReportRemisionData[]
): Promise<EvidenceCounts> {
  const groups = groupByOrder(remisiones)
  if (groups.length === 0) {
    return { orders: 0, concreteFiles: 0, pumpingFiles: 0, totalFiles: 0 }
  }

  const orderIds = groups.map((g) => g.orderId)
  const allPumpRemIds = groups.flatMap((g) => g.pumpingRemisiones.map((p) => p.id))

  const [concrete, pumping] = await Promise.all([
    chunkedIn<{ order_id: string }>(
      'order_concrete_evidence',
      'order_id',
      orderIds,
      'order_id'
    ),
    allPumpRemIds.length
      ? chunkedIn<{ remision_id: string; document_category: string | null }>(
          'remision_documents',
          'remision_id',
          allPumpRemIds,
          'remision_id, document_category'
        )
      : Promise.resolve([]),
  ])

  const pumpingFiles = pumping.filter(
    (d) => (d.document_category ?? '') === 'pumping_remision'
  ).length

  return {
    orders: groups.length,
    concreteFiles: concrete.length,
    pumpingFiles,
    totalFiles: concrete.length + pumpingFiles,
  }
}

async function buildMergedConcretePdf(
  files: Array<{ file_path: string; original_name: string; mime_type: string | null }>,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  if (files.length === 0) return null
  const merged = await PDFDocument.create()
  let pagesAdded = 0

  for (const ev of files) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const buf = await downloadStorageFileArrayBuffer(REMISION_DOCUMENTS_BUCKET, ev.file_path)
    if (!buf) continue
    const mime = (ev.mime_type ?? '').toLowerCase()
    const name = (ev.original_name ?? '').toLowerCase()

    try {
      if (mime === 'application/pdf' || name.endsWith('.pdf')) {
        const src = await PDFDocument.load(buf, { ignoreEncryption: true })
        const copied = await merged.copyPages(src, src.getPageIndices())
        copied.forEach((p) => merged.addPage(p))
        pagesAdded += copied.length
      } else if (
        mime === 'image/jpeg' ||
        mime === 'image/jpg' ||
        name.endsWith('.jpg') ||
        name.endsWith('.jpeg')
      ) {
        const img = await merged.embedJpg(buf)
        const page = merged.addPage([img.width, img.height])
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
        pagesAdded += 1
      } else if (mime === 'image/png' || name.endsWith('.png')) {
        const img = await merged.embedPng(buf)
        const page = merged.addPage([img.width, img.height])
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
        pagesAdded += 1
      } else {
        // skip unsupported (gif, webp, etc)
      }
    } catch (e) {
      console.warn('[evidenceBundle] could not embed', ev.original_name, e)
    }
  }

  if (pagesAdded === 0) return null
  return await merged.save()
}

export async function buildEvidenceBundle(args: BuildBundleArgs): Promise<BundleResult> {
  const { remisiones, onProgress, signal } = args
  const groups = groupByOrder(remisiones)
  if (groups.length === 0) {
    throw new Error('No hay pedidos en la selección')
  }
  if (groups.length > MAX_BUNDLE_ORDERS) {
    throw new Error(
      `La selección incluye ${groups.length} pedidos. El máximo por descarga es ${MAX_BUNDLE_ORDERS}.`
    )
  }

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const bundleRoot = args.bundleRoot
    ? sanitizeZipPathSegment(args.bundleRoot, 'evidencia')
    : null
  const root = bundleRoot ? zip.folder(bundleRoot)! : zip
  const usedPaths = new Set<string>()

  let fileCount = 0
  let capped = false
  const total = groups.length

  for (let i = 0; i < groups.length; i += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    if (fileCount >= MAX_BUNDLE_FILES) {
      capped = true
      break
    }
    const g = groups[i]
    const orderFolder = sanitizeZipPathSegment(g.orderNumber, 'pedido')
    onProgress?.({ done: i, total, currentLabel: `Pedido ${g.orderNumber}` })

    // --- Concrete evidence: merge into single PDF -------------------------
    try {
      const { data: evidence, error } = await supabase
        .from('order_concrete_evidence')
        .select('file_path, original_name, mime_type')
        .eq('order_id', g.orderId)
        .order('created_at', { ascending: true })

      if (!error && evidence && evidence.length > 0) {
        const mergeable = (evidence as Array<{
          file_path: string
          original_name: string
          mime_type: string | null
        }>).filter((e) => isConcreteEvidenceFileZippable(e.mime_type, e.original_name))

        const pdfBytes = await buildMergedConcretePdf(mergeable, signal)
        if (pdfBytes && fileCount < MAX_BUNDLE_FILES) {
          const rel = uniqueZipPath(
            `${orderFolder}/evidencia-concreto-${orderFolder}.pdf`,
            usedPaths
          )
          root.file(rel, pdfBytes)
          fileCount += 1
        }
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') throw e
      console.warn('[evidenceBundle] concrete merge failed for', g.orderNumber, e)
    }

    // --- Pumping evidence: one file per remisión (no merge) --------------
    if (g.pumpingRemisiones.length > 0 && fileCount < MAX_BUNDLE_FILES) {
      try {
        const pumpIds = g.pumpingRemisiones.map((p) => p.id)
        const remNumberById = new Map(
          g.pumpingRemisiones.map((p) => [p.id, String(p.remision_number)])
        )
        const pumpDocs = await chunkedIn<{
          remision_id: string
          file_path: string | null
          original_name: string | null
          mime_type: string | null
          document_category: string | null
        }>(
          'remision_documents',
          'remision_id',
          pumpIds,
          'remision_id, file_path, original_name, mime_type, document_category'
        )
        const filtered = pumpDocs.filter(
          (d) =>
            (d.document_category ?? '') === 'pumping_remision' &&
            !!d.file_path &&
            isConcreteEvidenceFileZippable(d.mime_type, d.original_name ?? '')
        )

        for (const doc of filtered) {
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
          if (fileCount >= MAX_BUNDLE_FILES) {
            capped = true
            break
          }
          const buf = await downloadStorageFileArrayBuffer(
            REMISION_DOCUMENTS_BUCKET,
            doc.file_path!
          )
          if (!buf) continue
          const remNo = remNumberById.get(doc.remision_id) ?? 'REM'
          const baseName = sanitizeZipPathSegment(
            `R${remNo}-${doc.original_name ?? 'archivo'}`,
            'archivo'
          )
          const rel = uniqueZipPath(`${orderFolder}/bombeo/${baseName}`, usedPaths)
          root.file(rel, buf)
          fileCount += 1
        }
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') throw e
        console.warn('[evidenceBundle] pumping copy failed for', g.orderNumber, e)
      }
    }
  }

  onProgress?.({ done: total, total, currentLabel: 'Generando ZIP…' })

  if (fileCount === 0) {
    throw new Error('No se encontraron archivos de evidencia para la selección')
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, orderCount: groups.length, fileCount, capped }
}
