/** Reference row in guided "Elemento" builder (client portal orders). */

export type ElementoReferenceKind = 'cadenamiento' | 'tramo' | 'pk' | 'estacion' | 'otro';

export type GuidedElementoParts = {
  referenceKind: ElementoReferenceKind;
  /** When referenceKind is "otro", label for the first segment (e.g. "Sección"). */
  customReferenceLabel: string;
  /** Freeform value for tramo, estación, otro; optional fallback when chainage is empty. */
  referenceValue: string;
  /** Enter only digits for km (cadenamiento / pk structured UI). */
  chainageKm: string;
  /** Enter only digits for metros after + (cadenamiento / pk). */
  chainageMeters: string;
  elementoStructural: string;
  description: string;
};

export const ELEMENTO_REFERENCE_OPTIONS: ReadonlyArray<{
  value: ElementoReferenceKind;
  label: string;
}> = [
  { value: 'cadenamiento', label: 'Cadenamiento' },
  { value: 'tramo', label: 'Tramo' },
  { value: 'pk', label: 'PK / Kilometraje' },
  { value: 'estacion', label: 'Estación' },
  { value: 'otro', label: 'Otro' },
];

export function usesStructuredChainage(kind: ElementoReferenceKind): boolean {
  return kind === 'cadenamiento' || kind === 'pk';
}

/** Try to split "KM 12+380", "12+380", "KM12+380" into km / metros for structured fields. */
export function parseKmPlusPattern(raw: string): { km: string; meters: string } | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/^KM\s*(\d+)\s*\+\s*(\d+)\s*$/i);
  if (m) return { km: m[1], meters: m[2] };
  const m2 = t.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (m2) return { km: m2[1], meters: m2[2] };
  return null;
}

/**
 * Builds the reference segment value shown after "Cadenamiento:" / "PK:".
 * For cadenamiento/pk: prefers digit fields → standardized "KM km+m" or "km+m".
 */
export function formatChainageSegment(kind: ElementoReferenceKind, km: string, meters: string): string {
  const k = km.trim().replace(/\D/g, '');
  const m = meters.trim().replace(/\D/g, '');
  if (!k && !m) return '';
  if (kind === 'cadenamiento') {
    if (k && m) return `KM ${k}+${m}`;
    if (k) return `KM ${k}`;
    return `KM +${m}`;
  }
  /* pk */
  if (k && m) return `${k}+${m}`;
  if (k) return k;
  return `+${m}`;
}

export function referenceKindToLabel(kind: ElementoReferenceKind, customLabel: string): string {
  if (kind === 'otro') {
    const t = customLabel.trim();
    return t.length > 0 ? t : 'Referencia';
  }
  const opt = ELEMENTO_REFERENCE_OPTIONS.find((o) => o.value === kind);
  return opt?.label ?? 'Referencia';
}

/** Maps PK option to the prefix used in the composed string (compact, common on site). */
function referenceKindToOutputPrefix(kind: ElementoReferenceKind, customLabel: string): string {
  if (kind === 'otro') {
    const t = customLabel.trim();
    return t.length > 0 ? t : 'Referencia';
  }
  switch (kind) {
    case 'cadenamiento':
      return 'Cadenamiento';
    case 'tramo':
      return 'Tramo';
    case 'pk':
      return 'PK';
    case 'estacion':
      return 'Estación';
    default:
      return 'Referencia';
  }
}

export function effectiveReferenceValue(parts: GuidedElementoParts): string {
  if (usesStructuredChainage(parts.referenceKind)) {
    const structured = formatChainageSegment(
      parts.referenceKind,
      parts.chainageKm,
      parts.chainageMeters
    );
    if (structured.length > 0) return structured;
  }
  return parts.referenceValue.trim();
}

/**
 * Builds the single `elemento` string for the API.
 * Omits segments whose values are empty; includes Elemento / Descripción only when non-empty.
 */
export function formatElementoGuided(parts: GuidedElementoParts): string {
  const chunks: string[] = [];
  const prefix = referenceKindToOutputPrefix(parts.referenceKind, parts.customReferenceLabel);
  const refVal = effectiveReferenceValue(parts);
  if (refVal.length > 0) {
    chunks.push(`${prefix}: ${refVal}`);
  }
  const elem = parts.elementoStructural.trim();
  if (elem.length > 0) {
    chunks.push(`Elemento: ${elem}`);
  }
  const desc = parts.description.trim();
  if (desc.length > 0) {
    chunks.push(`Descripción: ${desc}`);
  }
  return chunks.join(' ');
}

export const EMPTY_GUIDED_ELEMENTO_PARTS: GuidedElementoParts = {
  referenceKind: 'cadenamiento',
  customReferenceLabel: '',
  referenceValue: '',
  chainageKm: '',
  chainageMeters: '',
  elementoStructural: '',
  description: '',
};

export type ElementoQuickExample = {
  id: string;
  /** Short label for chip */
  chipLabel: string;
  parts: GuidedElementoParts;
};

/** Static presets (no DB). First entry matches the product example. */
export const ELEMENTO_QUICK_EXAMPLES: ReadonlyArray<ElementoQuickExample> = [
  {
    id: 'cadenamiento-muro2',
    chipLabel: 'Cadenamiento + muro',
    parts: {
      referenceKind: 'cadenamiento',
      customReferenceLabel: '',
      referenceValue: '',
      chainageKm: '3',
      chainageMeters: '944',
      elementoStructural: 'Muro 2',
      description: 'cabecero aguas abajo/ eje 2/ paso ganadero',
    },
  },
  {
    id: 'losa',
    chipLabel: 'Losa',
    parts: {
      referenceKind: 'tramo',
      customReferenceLabel: '',
      referenceValue: 'Eje A–B',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: 'Losa nivel 1',
      description: 'Entrepiso zona norte',
    },
  },
  {
    id: 'columna',
    chipLabel: 'Columna',
    parts: {
      referenceKind: 'estacion',
      customReferenceLabel: '',
      referenceValue: 'E-03',
      chainageKm: '',
      chainageMeters: '',
      elementoStructural: 'Columna C-12',
      description: 'Montantes cara exterior',
    },
  },
  {
    id: 'muro',
    chipLabel: 'Muro',
    parts: {
      referenceKind: 'pk',
      customReferenceLabel: '',
      referenceValue: '',
      chainageKm: '12',
      chainageMeters: '400',
      elementoStructural: 'Muro de contención',
      description: 'Paramento lado camino',
    },
  },
];
