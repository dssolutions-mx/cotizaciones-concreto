/** Conformity rules for ISO 7.8 informe — read tolerances from lab config JSON. */

export type InformeTolerancias = {
  revenimiento_mm?: number;
};

const DEFAULT_TOLERANCIAS: InformeTolerancias = { revenimiento_mm: 10 };

export function parseTolerancias(json: unknown): InformeTolerancias {
  if (!json || typeof json !== 'object') return DEFAULT_TOLERANCIAS;
  const o = json as Record<string, unknown>;
  return {
    revenimiento_mm:
      typeof o.revenimiento_mm === 'number' ? o.revenimiento_mm : DEFAULT_TOLERANCIAS.revenimiento_mm,
  };
}

export function conformidadRevenimiento(
  medido: number | null | undefined,
  especificado: number | null | undefined,
  tolerancias: InformeTolerancias = DEFAULT_TOLERANCIAS
): 'C' | 'NC' | 'N/A' {
  if (medido == null || especificado == null) return 'N/A';
  const tol = tolerancias.revenimiento_mm ?? 10;
  return Math.abs(medido - especificado) <= tol ? 'C' : 'NC';
}

export function conformidadFc(porcentajeCumplimiento: number | null | undefined): 'C' | 'NC' | 'N/A' {
  if (porcentajeCumplimiento == null || !Number.isFinite(porcentajeCumplimiento)) return 'N/A';
  return porcentajeCumplimiento >= 100 ? 'C' : 'NC';
}

export function kgToKn(kg: number | null | undefined): number | null {
  if (kg == null || !Number.isFinite(kg)) return null;
  return Math.round((kg / 101.97) * 100) / 100;
}

export function kgCm2ToMpa(kgCm2: number | null | undefined): number | null {
  if (kgCm2 == null || !Number.isFinite(kgCm2)) return null;
  return Math.round(kgCm2 * 0.0980665 * 100) / 100;
}

export function formatUncertaintyDisplay(u: number, unidad: string, k: number): string {
  return `± ${u} ${unidad} (k=${k}, 95 %)`;
}
