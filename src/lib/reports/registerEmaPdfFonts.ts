/**
 * Register DejaVu Sans for EMA metrology PDFs (@react-pdf/renderer).
 * Helvetica omits or drops glyphs such as √, ν, and subscripts — unsuitable for GUM reports.
 *
 * Fonts live in public/fonts/dejavu/ (see LICENSE) — not bundled as JS modules (Turbopack-safe).
 */
import { Font } from '@react-pdf/renderer';
import { EMA_PDF_FONT_FAMILY } from '@/lib/reports/branding';

const DEJAVU_FONT_DIR = '/fonts/dejavu';

function emaPdfFontSrc(filename: string): string {
  const path = `${DEJAVU_FONT_DIR}/${filename}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

let registered = false;

export function registerEmaPdfFonts(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: EMA_PDF_FONT_FAMILY,
    fonts: [
      { src: emaPdfFontSrc('DejaVuSans.ttf'), fontWeight: 400 },
      { src: emaPdfFontSrc('DejaVuSans-Bold.ttf'), fontWeight: 700 },
    ],
  });
}
