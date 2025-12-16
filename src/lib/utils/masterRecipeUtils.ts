import { ConcreteTypeCode, CONCRETE_TYPES } from '@/config/concreteTypes';

export function parseMasterAndVariantFromRecipeCode(recipeCode: string): { masterCode: string; variantSuffix: string | null } {
  if (!recipeCode || typeof recipeCode !== 'string') {
    return { masterCode: recipeCode || '', variantSuffix: null };
  }
  const parts = recipeCode.split('-');
  if (parts.length < 3) {
    return { masterCode: recipeCode, variantSuffix: null };
  }
  // Variant suffix is last two segments (e.g., '2-PCM')
  const variantSuffix = `${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
  const masterCode = parts.slice(0, -2).join('-');
  return { masterCode, variantSuffix };
}


export function computeArkikCodes(input: {
  strength: number;
  age: number;
  ageUnit: 'D' | 'H';
  slump: number;
  aggregateSize: number;
  placement: string; // 'D' | 'B'
  recipeType: 'FC' | 'MR';
  typeCode?: string; // e.g., 'B'
  num?: string; // e.g., '2'
  variante?: string; // default '000' unless detection says PCE
  detectPCEFromAdditiveNames?: string[]; // optional list of additive names for PCE detection
  concreteTypeCode?: ConcreteTypeCode; // prefix code from concrete types
  hasNonZeroPCEQuantity?: boolean; // true if additive quantity > 0
}): { longCode: string; shortCode: string } {
  const fcCode = String(input.strength).padStart(3, '0');
  const edadCode = String(input.age).padStart(2, '0');
  const revCode = String(input.slump).padStart(2, '0');
  // TMA Factor: < 7mm = '0', >= 7mm and < 20mm = '1', >= 20mm and < 40mm = '2', >= 40mm = '4'
  const tmaFactor = input.aggregateSize >= 40 ? '4' : (input.aggregateSize >= 20 ? '2' : (input.aggregateSize >= 7 ? '1' : '0'));
  const coloc = input.placement; // 'D' or 'B'
  const prefix = input.concreteTypeCode || (input.recipeType === 'MR' ? 'P' : '6');
  const typeCode = input.typeCode || 'B';
  const numSeg = input.num || '2';

  // Detect variante PCE if any additive names contain PCE AND quantity > 0
  let variante = (input.variante || '000').toUpperCase();
  try {
    if (input.hasNonZeroPCEQuantity && input.detectPCEFromAdditiveNames && input.detectPCEFromAdditiveNames.length > 0) {
      const anyPCE = input.detectPCEFromAdditiveNames
        .map(n => (n || '').toUpperCase())
        .some(n => n.includes('PCE'));
      if (anyPCE) variante = 'PCE';
    }
  } catch {
    // keep default variante
  }

  const longCode = `${prefix}-${fcCode}-${tmaFactor}-${typeCode}-${edadCode}-${revCode}-${coloc}-${numSeg}-${variante}`;
  const shortCode = `${fcCode}${edadCode}${tmaFactor}${revCode}${coloc}`;
  return { longCode, shortCode };
}

