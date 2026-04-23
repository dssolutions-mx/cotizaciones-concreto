import type {
  ItemPrimitive,
  ItemRole,
  PassFailRule,
  VerificacionTemplateItem,
} from '@/types/ema';

export type NormalizedTemplateItem = VerificacionTemplateItem & {
  primitive: ItemPrimitive;
  item_role: ItemRole;
  pass_fail_rule: PassFailRule;
  variable_name: string;
  contributes_to_cumple: boolean;
};

function slugify(s: string): string {
  const x = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return x || 'var';
}

export function primitiveForRole(role: ItemRole): ItemPrimitive {
  if (role === 'input_booleano') return 'booleano';
  if (role === 'input_texto' || role === 'input_referencia') return 'texto';
  return 'numero';
}

function inferRolePrimitive(tipo: VerificacionTemplateItem['tipo']): { role: ItemRole; prim: ItemPrimitive } {
  switch (tipo) {
    case 'medicion':
      return { role: 'input_medicion', prim: 'numero' };
    case 'booleano':
      return { role: 'input_booleano', prim: 'booleano' };
    case 'numero':
      return { role: 'input_numero', prim: 'numero' };
    case 'texto':
      return { role: 'input_texto', prim: 'texto' };
    case 'calculado':
      return { role: 'derivado', prim: 'numero' };
    case 'referencia_equipo':
      return { role: 'input_referencia', prim: 'texto' };
    default:
      return { role: 'input_texto', prim: 'texto' };
  }
}

function inferPassFailFromLegacy(item: VerificacionTemplateItem): PassFailRule {
  if (item.tipo === 'booleano') return { kind: 'expected_bool', value: true };
  if (item.tipo === 'medicion' && item.tolerancia_tipo === 'rango') {
    return { kind: 'range', min: item.tolerancia_min, max: item.tolerancia_max, unit: item.unidad };
  }
  if (
    item.tipo === 'medicion' &&
    item.tolerancia_tipo === 'porcentual' &&
    item.valor_esperado != null &&
    item.tolerancia != null
  ) {
    return {
      kind: 'tolerance_pct',
      expected: item.valor_esperado,
      tolerance_pct: item.tolerancia,
      unit: item.unidad,
    };
  }
  if (
    item.tipo === 'medicion' &&
    item.valor_esperado != null &&
    item.tolerancia != null
  ) {
    return {
      kind: 'tolerance_abs',
      expected: item.valor_esperado,
      tolerance: item.tolerancia,
      unit: item.unidad,
    };
  }
  return { kind: 'none' };
}

function defaultContributes(role: ItemRole): boolean {
  return !['input_texto', 'input_referencia', 'input_numero'].includes(role);
}

/** Normalize snapshot / DB row into v2 shape (supports legacy-only rows). */
export function normalizeTemplateItem(raw: VerificacionTemplateItem): NormalizedTemplateItem {
  const role = (raw.item_role as ItemRole | undefined) ?? inferRolePrimitive(raw.tipo).role;
  const prim =
    (raw.primitive as ItemPrimitive | undefined) ??
    (raw.item_role ? primitiveForRole(raw.item_role as ItemRole) : inferRolePrimitive(raw.tipo).prim);

  const pass_fail_rule: PassFailRule =
    (raw.pass_fail_rule as PassFailRule | undefined) ?? inferPassFailFromLegacy(raw);

  const variable_name =
    raw.variable_name?.trim() ||
    `${slugify(raw.punto)}_${raw.id.replace(/-/g, '').slice(0, 10)}`;

  const contributes_to_cumple =
    raw.contributes_to_cumple !== undefined && raw.contributes_to_cumple !== null
      ? raw.contributes_to_cumple
      : defaultContributes(role);

  return {
    ...raw,
    item_role: role,
    primitive: prim,
    pass_fail_rule,
    variable_name,
    contributes_to_cumple,
  };
}
