/**
 * Extract remisión / albarán numbers from Arkik-style remisión PDF text (multi-page).
 * Client-only: uses dynamic import of pdfjs in callers.
 */

const FECHA_REMISION_RE = /FECHA\s*:\s*(\d+)\s+(\d{2}:\d{2})\s+(\d{2}\/\d{2}\/\d{4})/gi;

export function extractRemisionNumbersFromRemisionPdfText(fullText: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(FECHA_REMISION_RE);
  while ((m = re.exec(fullText)) !== null) {
    const num = (m[1] || '').trim();
    if (num && !seen.has(num)) {
      seen.add(num);
      out.push(num);
    }
  }
  return out;
}

/** Normalize for loose comparison (trim; numeric strings without spurious leading zeros). */
export function normalizeRemisionNumberToken(s: string): string {
  const t = String(s || '').trim();
  if (/^\d+$/.test(t)) {
    const stripped = t.replace(/^0+/, '');
    return stripped.length ? stripped : '0';
  }
  return t;
}

export function compareRemisionSets(dbNumbers: string[], pdfNumbers: string[]) {
  const dbNorm = new Map<string, string>();
  for (const n of dbNumbers) {
    dbNorm.set(normalizeRemisionNumberToken(n), n);
  }
  const pdfNorm = new Map<string, string>();
  for (const n of pdfNumbers) {
    pdfNorm.set(normalizeRemisionNumberToken(n), n);
  }
  const matched: string[] = [];
  const inPdfNotDb: string[] = [];
  const inDbNotPdf: string[] = [];

  for (const [norm, raw] of pdfNorm) {
    if (dbNorm.has(norm)) matched.push(raw);
    else inPdfNotDb.push(raw);
  }
  for (const [norm, raw] of dbNorm) {
    if (!pdfNorm.has(norm)) inDbNotPdf.push(raw);
  }
  matched.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  inPdfNotDb.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  inDbNotPdf.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { matched, inPdfNotDb, inDbNotPdf };
}

export async function extractFullTextFromPdfArrayBuffer(data: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const loadTask = pdfjsLib.getDocument({ data }).promise;
  const timeoutMs = 30000;
  const pdf = (await Promise.race([
    loadTask,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('PDF loading timeout')), timeoutMs)
    ),
  ])) as { numPages: number; getPage: (i: number) => Promise<unknown> };

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = (await pdf.getPage(i)) as {
      getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
    };
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str || '').join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

export async function extractRemisionNumbersFromPdfArrayBuffer(
  data: ArrayBuffer
): Promise<{ numbers: string[]; textLength: number; hadText: boolean }> {
  const fullText = await extractFullTextFromPdfArrayBuffer(data);
  const trimmed = fullText.trim();
  if (!trimmed) {
    return { numbers: [], textLength: 0, hadText: false };
  }
  const numbers = extractRemisionNumbersFromRemisionPdfText(fullText);
  return { numbers, textLength: fullText.length, hadText: true };
}
