import type { DesignParams, DesignType, FCROverrides, RecipeParams } from '@/types/calculator';

export const CALCULATOR_DRAFT_STORAGE_KEY = 'matriz.calculator.draft.v1';

export const CALCULATOR_DRAFT_SCHEMA_VERSION = 1;

export interface CalculatorDraftPayload {
  version: typeof CALCULATOR_DRAFT_SCHEMA_VERSION;
  savedAt: string;
  designType: DesignType;
  designParams: DesignParams;
  recipeParams: RecipeParams;
  fcrOverrides?: FCROverrides;
}

export function loadCalculatorDraft(): CalculatorDraftPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CALCULATOR_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CalculatorDraftPayload;
    if (data?.version !== CALCULATOR_DRAFT_SCHEMA_VERSION || !data.designParams || !data.recipeParams) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function saveCalculatorDraft(payload: Omit<CalculatorDraftPayload, 'version' | 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  const full: CalculatorDraftPayload = {
    ...payload,
    version: CALCULATOR_DRAFT_SCHEMA_VERSION,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(CALCULATOR_DRAFT_STORAGE_KEY, JSON.stringify(full));
}

export function clearCalculatorDraft(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CALCULATOR_DRAFT_STORAGE_KEY);
}
