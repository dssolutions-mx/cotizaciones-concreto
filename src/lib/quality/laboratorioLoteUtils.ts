import type { LaboratorioLote } from '@/types/laboratorioLote';

export function concreteSpecsFromRecipe(recipe: {
  strength_fc?: number | null;
  age_days?: number | null;
  age_hours?: number | null;
}): LaboratorioLote['concrete_specs'] {
  const unidad_edad =
    recipe.age_hours != null && recipe.age_hours > 0 && (!recipe.age_days || recipe.age_days === 0)
      ? 'HORA'
      : 'DÍA';
  const valor_edad =
    unidad_edad === 'HORA' ? (recipe.age_hours ?? 14) : (recipe.age_days ?? 28);

  return {
    clasificacion: 'FC',
    unidad_edad,
    valor_edad,
  };
}

export function computeMixKpis(
  materials: Array<{
    cantidad_real?: number | null;
    cantidad_teorica?: number | null;
    category?: string;
  }>,
  volumenM3: number
): { cementKgM3: number | null; waterLm3: number | null } {
  if (volumenM3 <= 0) return { cementKgM3: null, waterLm3: null };

  let cement = 0;
  let water = 0;
  for (const m of materials) {
    const qty = Number(m.cantidad_real ?? m.cantidad_teorica ?? 0);
    const cat = (m.category ?? '').toLowerCase();
    if (cat === 'cemento') cement += qty;
    else if (cat === 'agua') water += qty;
  }

  return {
    cementKgM3: cement > 0 ? cement / volumenM3 : null,
    waterLm3: water > 0 ? water / volumenM3 : null,
  };
}
