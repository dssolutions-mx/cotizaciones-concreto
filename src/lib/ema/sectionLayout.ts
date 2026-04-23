import type { VerificacionTemplateSection } from '@/types/ema';

/** Effective layout (legacy snapshots use repetible only). */
export function effectiveLayout(section: VerificacionTemplateSection & { layout?: string }): string {
  if (section.layout && section.layout !== 'linear') return section.layout;
  if (section.repetible) return 'instrument_grid';
  return 'linear';
}

/** Number of UI rows / repetitions for a section step. */
export function effectiveSectionRepetitions(section: VerificacionTemplateSection & {
  layout?: string;
  instances_config?: { min_count?: number; max_count?: number };
  series_config?: { points?: number[] };
}): number {
  const layout = effectiveLayout(section);
  if (layout === 'reference_series') {
    const n = section.series_config?.points?.length ?? 0;
    return n > 0 ? n : 1;
  }
  if (layout === 'instrument_grid') {
    const max = section.instances_config?.max_count ?? section.instances_config?.min_count;
    if (max != null && max > 0) return max;
    return section.repeticiones_default > 0 ? section.repeticiones_default : 1;
  }
  return section.repetible ? Math.max(1, section.repeticiones_default) : 1;
}

/** Reference point value for reference_series row `rep` (1-based). */
export function referencePointForRow(
  section: VerificacionTemplateSection & { series_config?: { points?: number[] } },
  rep: number,
): number | null {
  const pts = section.series_config?.points;
  if (!pts || pts.length === 0) return null;
  return pts[rep - 1] ?? null;
}
