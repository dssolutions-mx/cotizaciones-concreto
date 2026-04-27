import {
  linearUncertaintyMicrometersAtLmm,
  linearUncertaintyMicrometersMaxOnClosedInterval,
  parseMedicionIntervalMinMaxMm,
} from '@/lib/ema/calibrationUncertaintyLinear';

/** Convert expanded uncertainty U to micrometres when unit is mm or µm/um. */
export function uncertaintyUToMicrometers(u: number, unitRaw: string): number | null {
  const t = unitRaw
    .trim()
    .toLowerCase()
    .replace(/\u03bc/g, 'µ')
    .replace('μ', 'µ');
  if (t === 'mm') return u * 1000;
  if (t === 'µm' || t === 'um') return u;
  return null;
}

/**
 * Detects common certificate wording: ± [ a + ( b * L ) ] with L in mm, result in µm.
 * Accepts decimal comma or point for a and b.
 */
export function tryParseLinearUmLawFromText(text: string | null | undefined): { aUm: number; bUmPerMm: number } | null {
  if (!text?.trim()) return null;
  const compact = text.replace(/\s+/g, ' ');
  /** Accept * or × between coefficient and L (certificate typography). */
  const re = /±\s*\[\s*([\d.,]+)\s*\+\s*\(\s*([\d.,]+)\s*[\*×x]\s*L\s*\)\s*\]/i;
  const m = compact.match(re);
  if (!m) return null;
  const aUm = parseFloat(m[1].replace(',', '.'));
  const bUm = parseFloat(m[2].replace(',', '.'));
  if (!Number.isFinite(aUm) || !Number.isFinite(bUm)) return null;
  return { aUm, bUmPerMm: bUm };
}

export type CalibrationCertificateSanityInput = {
  incertidumbre_expandida: number;
  incertidumbre_unidad: string;
  rango_medicion?: string | null;
  observaciones?: string | null;
  metodo_calibracion?: string | null;
};

/**
 * Validates that U, unit, range, and optional U(L) formula text are mutually coherent.
 * Used on certificate POST and certificar form (tipo A/B).
 */
export function validateCalibrationCertificateSanity(
  input: CalibrationCertificateSanityInput,
): { ok: true } | { ok: false; message: string } {
  const { incertidumbre_expandida: u, incertidumbre_unidad: unitRaw } = input;
  const combinedText = [input.observaciones, input.metodo_calibracion].filter(Boolean).join('\n');
  const law = tryParseLinearUmLawFromText(combinedText);
  const interval = parseMedicionIntervalMinMaxMm(input.rango_medicion ?? null);
  const uUm = uncertaintyUToMicrometers(u, unitRaw);

  const unitNorm = unitRaw.trim().toLowerCase().replace(/\u03bc/g, 'µ').replace('μ', 'µ');
  if (interval && unitNorm === 'mm' && u > interval.max) {
    return {
      ok: false,
      message: `La U en mm no puede ser mayor que el extremo superior del rango (${interval.max} mm). Revise unidades (¿debe ser µm?).`,
    };
  }

  if (law != null && uUm == null) {
    return {
      ok: false,
      message:
        'Se detectó una fórmula de incertidumbre U(L) en observaciones/método; use unidad «mm» o «µm» para U para poder validar coherencia.',
    };
  }

  if (law != null && uUm != null) {
    if (!interval) {
      return {
        ok: false,
        message:
          'Hay una fórmula U(L) en observaciones o método, pero el rango calibrado no se pudo interpretar. Use un formato como «0 mm-600 mm» o «0–600 mm».',
      };
    }
    const lo = linearUncertaintyMicrometersAtLmm(law.aUm, law.bUmPerMm, interval.min);
    const hi = linearUncertaintyMicrometersAtLmm(law.aUm, law.bUmPerMm, interval.max);
    const uMinTheory = Math.min(lo, hi);
    const uMaxTheory = linearUncertaintyMicrometersMaxOnClosedInterval(
      law.aUm,
      law.bUmPerMm,
      interval.min,
      interval.max,
    );
    const eps = 0.02;
    if (uUm > uMaxTheory + eps) {
      return {
        ok: false,
        message: `La U registrada (${u} ${unitRaw.trim()}) supera el máximo del modelo del certificado (${uMaxTheory.toFixed(2)} µm) sobre el rango ${interval.min}–${interval.max} mm. Use la U en el extremo superior del intervalo o corrija rango/fórmula.`,
      };
    }
    if (uUm + eps < uMinTheory) {
      return {
        ok: false,
        message: `La U registrada (${u} ${unitRaw.trim()}) queda por debajo del mínimo del modelo (${uMinTheory.toFixed(2)} µm) en el intervalo indicado. Revise unidades o el texto de la fórmula.`,
      };
    }
  }

  return { ok: true };
}
