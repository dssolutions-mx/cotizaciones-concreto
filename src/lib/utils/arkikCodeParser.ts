import { parseMasterAndVariantFromRecipeCode } from './masterRecipeUtils';
import type { RecipeSpecification } from '@/types/recipes';

/** TMA factor to max_aggregate_size (mm). From computeArkikCodes inverse. */
const TMA_FACTOR_TO_MM: Record<string, number> = {
  '0': 6,   // < 7mm
  '1': 13,  // 7-19mm
  '2': 20,  // 20-39mm (20mm es el valor típico)
  '4': 40,  // >= 40mm
};

export interface ParseArkikResult {
  specification: RecipeSpecification;
  masterCode: string;
  variantSuffix: string | null;
}

/**
 * Parses an Arkik long code to extract recipe specification and master/variant.
 * Format: prefix-fc-tma-typeCode-age-slump-placement-num-variante
 * Prefix: P or PAV → MR (pavimento), else FC.
 * Recognizes PAV for legacy master search; new creation uses P.
 */
export function parseArkikCodeToSpecs(recipeCode: string): ParseArkikResult | null {
  if (!recipeCode || typeof recipeCode !== 'string') return null;
  const trimmed = recipeCode.trim();
  if (!trimmed) return null;

  const parts = trimmed.split('-');
  if (parts.length < 9) return null;

  const prefix = parts[0]?.toUpperCase() || '';
  const fcStr = parts[1];
  const tmaFactor = parts[2];
  const ageStr = parts[4];
  const slumpStr = parts[5];
  const placement = parts[6];

  const strength_fc = parseInt(fcStr || '0', 10);
  if (!Number.isFinite(strength_fc) || strength_fc <= 0) return null;

  const slump = parseInt(slumpStr || '0', 10);
  if (!Number.isFinite(slump) || slump < 0) return null;

  const max_aggregate_size = TMA_FACTOR_TO_MM[tmaFactor] ?? 19;
  const placement_type = placement === 'D' ? 'DIRECTO' : placement === 'B' ? 'BOMBEADO' : 'DIRECTO';
  const recipe_type = prefix === 'P' || prefix === 'PAV' ? 'MR' : 'FC';

  let age_days: number | undefined;
  let age_hours: number | undefined;

  const ageVal = parseInt(ageStr || '28', 10);
  if (!Number.isFinite(ageVal)) return null;

  if (ageStr && /^0\d$/.test(ageStr)) {
    age_hours = ageVal;
  } else {
    age_days = ageVal;
  }

  const specification: RecipeSpecification = {
    strength_fc,
    age_days: age_hours !== undefined ? 0 : (age_days ?? 28),
    ...(age_hours !== undefined && { age_hours }),
    placement_type,
    max_aggregate_size,
    slump,
    application_type: recipe_type === 'MR' ? 'pavimento' : 'standard',
    recipe_type,
  };

  const { masterCode, variantSuffix } = parseMasterAndVariantFromRecipeCode(trimmed);
  return { specification, masterCode, variantSuffix };
}
