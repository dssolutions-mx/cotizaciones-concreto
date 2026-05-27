/**
 * Register DejaVu Sans for EMA metrology PDFs (@react-pdf/renderer).
 * Helvetica omits or drops glyphs such as √, ν, and subscripts — unsuitable for GUM reports.
 */
import { Font } from '@react-pdf/renderer';
import DejaVuSans from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf';
import DejaVuSansBold from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf';
import { EMA_PDF_FONT_FAMILY } from '@/lib/reports/branding';

let registered = false;

export function registerEmaPdfFonts(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: EMA_PDF_FONT_FAMILY,
    fonts: [
      { src: DejaVuSans, fontWeight: 400 },
      { src: DejaVuSansBold, fontWeight: 700 },
    ],
  });
}
