export type RawConcreteSpecs = {
  clasificacion?: string | null;
  unidad_edad?: string | null; // 'DÍA' | 'HORA' | 'D' | 'H' | others
  valor_edad?: number | null;
  fc?: number | null;
} | null | undefined;

export type RecipeAge = {
  age_days?: number | null;
  age_hours?: number | null;
  notes?: string | null;
};

export type NormalizedSpecs = {
  clasificacion: 'FC' | 'MR';
  plannedAgeValue: number | null;
  plannedAgeUnit: 'D' | 'H';
};

export function normalizeClasificacion(raw: string | null | undefined, recipeNotes?: string | null): 'FC' | 'MR' {
  const val = (raw || '').toString().trim().toUpperCase();
  if (val === 'MR') return 'MR';
  if (val === 'FC') return 'FC';
  const notes = (recipeNotes || '').toUpperCase();
  return notes.includes('MR') ? 'MR' : 'FC';
}

export function normalizeAgeUnit(raw?: string | null): 'D' | 'H' | null {
  if (!raw) return null;
  const v = raw.toString().trim().toUpperCase();
  if (v === 'D' || v === 'DIA' || v === 'DÍA' || v === 'DIAS' || v === 'DÍAS') return 'D';
  if (v === 'H' || v === 'HORA' || v === 'HORAS') return 'H';
  return null;
}

export function normalizePlannedAge(specs: RawConcreteSpecs, recipeAge: RecipeAge): { value: number | null; unit: 'D' | 'H' } {
  const unitFromSpecs = normalizeAgeUnit(specs?.unidad_edad);
  const valueFromSpecs = typeof specs?.valor_edad === 'number' && isFinite(specs.valor_edad!) ? specs!.valor_edad! : null;

  // Prefer fully specified pair from specs
  if (unitFromSpecs && valueFromSpecs !== null) {
    return { value: valueFromSpecs, unit: unitFromSpecs };
  }

  // Otherwise, prefer recipe hours if present, else recipe days
  if (typeof recipeAge.age_hours === 'number' && isFinite(recipeAge.age_hours!)) {
    return { value: recipeAge.age_hours!, unit: 'H' };
  }
  if (typeof recipeAge.age_days === 'number' && isFinite(recipeAge.age_days!)) {
    return { value: recipeAge.age_days!, unit: 'D' };
  }

  // As last resort, if only one of unit/value from specs exists, make them consistent
  if (unitFromSpecs && valueFromSpecs !== null) {
    return { value: valueFromSpecs, unit: unitFromSpecs };
  }

  // Default
  return { value: null, unit: 'D' };
}

export function formatAgeUnitLabel(unit: 'D' | 'H'): 'días' | 'horas' {
  return unit === 'H' ? 'horas' : 'días';
}

export function getNormalizedSpecs(specs: RawConcreteSpecs, recipe: RecipeAge): NormalizedSpecs {
  const clasificacion = normalizeClasificacion(specs?.clasificacion, recipe.notes);
  const { value, unit } = normalizePlannedAge(specs, recipe);
  return { clasificacion, plannedAgeValue: value, plannedAgeUnit: unit };
}


