import type { DesignParams, Materials, RecipeParams, WaterDefinition } from '@/types/calculator';
import {
  validateAdditiveSystemConfig,
  validateWaterDefinitions
} from '@/lib/calculator/calculations';

export type CalculatorValidationSeverity = 'blocking' | 'warning';

export interface CalculatorValidationIssue {
  id: string;
  message: string;
  severity: CalculatorValidationSeverity;
  /** Optional UI anchor (e.g. combination label) */
  field?: string;
}

export interface CalculatorValidationResult {
  blocking: CalculatorValidationIssue[];
  warnings: CalculatorValidationIssue[];
}

function sumCombination(values: number[], label: string): CalculatorValidationIssue[] {
  if (values.length === 0) return [];
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.5) {
    return [
      {
        id: `combination-${label}`,
        field: label,
        severity: 'blocking',
        message: `${label}: la suma debe ser 100% (actual: ${sum.toFixed(1)}%).`
      }
    ];
  }
  return [];
}

/** Duplicate enabled slump + placement pairs in water definitions */
function duplicateWaterCombos(defs: WaterDefinition[]): CalculatorValidationIssue[] {
  const seen = new Map<string, number>();
  const issues: CalculatorValidationIssue[] = [];
  defs.forEach((def, idx) => {
    if (!def.enabled) return;
    const key = `${def.slump}-${def.placement}`;
    if (seen.has(key)) {
      issues.push({
        id: `water-dup-${idx}`,
        field: `waterDefinitions[${idx}]`,
        severity: 'blocking',
        message: `Definición de agua duplicada: revenimiento ${def.slump} cm, colocación ${def.placement === 'D' ? 'directo' : 'bombeo'}.`
      });
    } else {
      seen.set(key, idx);
    }
  });
  return issues;
}

function mrAdjustmentIssues(designParams: DesignParams): CalculatorValidationIssue[] {
  const adj = designParams.mrFcrAdjustment;
  if (!adj) return [];
  if (adj.divideAmount === 0 || !Number.isFinite(adj.divideAmount)) {
    return [
      {
        id: 'mr-divide',
        field: 'mrFcrAdjustment.divideAmount',
        severity: 'blocking',
        message: 'Ajuste MR: el divisor debe ser distinto de cero.'
      }
    ];
  }
  return [];
}

/**
 * Aggregates water/additive validation plus combination sums and MR guards.
 * Does not replace material completeness checks (density, etc.).
 */
export function runCalculatorValidation(
  recipeParams: RecipeParams,
  designParams: DesignParams,
  materials: Materials
): CalculatorValidationResult {
  const blocking: CalculatorValidationIssue[] = [];
  const warnings: CalculatorValidationIssue[] = [];

  blocking.push(...duplicateWaterCombos(recipeParams.waterDefinitions));

  const waterMsgs = validateWaterDefinitions(recipeParams.waterDefinitions);
  waterMsgs.forEach((msg, i) =>
    blocking.push({ id: `water-${i}`, severity: 'blocking', message: msg, field: 'waterDefinitions' })
  );

  const additiveMsgs = validateAdditiveSystemConfig(recipeParams.additiveSystemConfig, materials);
  additiveMsgs.forEach((msg, i) =>
    blocking.push({ id: `additive-${i}`, severity: 'blocking', message: msg, field: 'additiveSystemConfig' })
  );

  blocking.push(
    ...sumCombination(designParams.sandCombinationTD, 'Combinación arena tiro directo'),
    ...sumCombination(designParams.sandCombinationBomb, 'Combinación arena bombeo'),
    ...sumCombination(designParams.gravelCombinationTD, 'Combinación grava tiro directo'),
    ...sumCombination(designParams.gravelCombinationBomb, 'Combinación grava bombeo')
  );

  blocking.push(...mrAdjustmentIssues(designParams));

  return { blocking, warnings };
}
