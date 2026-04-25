import assert from 'node:assert';
import type { VerificacionTemplateItem } from '@/types/ema';
import { previewSectionMeasurements, missingSectionFormulaVariableNames } from './measurementCompute';

const sec = (items: VerificacionTemplateItem[]) => ({
  id: 's1',
  titulo: 'Test',
  layout: 'stack',
  repetible: false,
  items,
});

const med = (over: Partial<VerificacionTemplateItem> & Pick<VerificacionTemplateItem, 'id' | 'orden' | 'punto'>): VerificacionTemplateItem => ({
  id: over.id,
  orden: over.orden,
  punto: over.punto,
  tipo: 'medicion',
  item_role: 'input_medicion',
  primitive: 'numero',
  variable_name: over.variable_name ?? 'x',
  formula: null,
  valor_esperado: over.valor_esperado ?? 10,
  contributes_to_cumple: over.contributes_to_cumple ?? false,
  pass_fail_rule: over.pass_fail_rule ?? { kind: 'none' },
  ...over,
} as VerificacionTemplateItem);

const der = (over: Partial<VerificacionTemplateItem> & Pick<VerificacionTemplateItem, 'id' | 'orden' | 'punto' | 'formula' | 'variable_name'>): VerificacionTemplateItem => ({
  id: over.id,
  orden: over.orden,
  punto: over.punto,
  tipo: 'calculado',
  item_role: 'derivado',
  primitive: 'numero',
  variable_name: over.variable_name,
  formula: over.formula,
  valor_esperado: over.valor_esperado ?? 10,
  contributes_to_cumple: over.contributes_to_cumple ?? true,
  pass_fail_rule: over.pass_fail_rule ?? { kind: 'tolerance_abs', expected: 10, tolerance: 1 },
  ...over,
} as VerificacionTemplateItem);

{
  const items: VerificacionTemplateItem[] = [
    med({ id: 'a', orden: 1, punto: 'L1', variable_name: 'a' }),
    med({ id: 'b', orden: 2, punto: 'L2', variable_name: 'b' }),
    der({ id: 'c', orden: 3, punto: 'Prom', variable_name: 'p', formula: 'avg(a,b)' }),
  ];
  const { rows, warnings } = previewSectionMeasurements(
    sec(items),
    1,
    [
      { item_id: 'a', valor_observado: 8, valor_booleano: null, valor_texto: null, observacion: null, instance_code: null },
      { item_id: 'b', valor_observado: 12, valor_booleano: null, valor_texto: null, observacion: null, instance_code: null },
    ],
    {},
  );
  assert.strictEqual(warnings.length, 0);
  const derRow = rows.find(r => r.item_id === 'c');
  assert.ok(derRow);
  assert.strictEqual(derRow!.valor_observado, 10);
  assert.strictEqual(derRow!.cumple, true);
}

{
  const items: VerificacionTemplateItem[] = [
    med({ id: 'a', orden: 1, punto: 'L1', variable_name: 'a' }),
    der({ id: 'c', orden: 2, punto: 'X2', variable_name: 'p', formula: 'a + missing' }),
  ];
  const miss = missingSectionFormulaVariableNames(
    sec(items),
    1,
    [{ item_id: 'a', valor_observado: 1, valor_booleano: null, valor_texto: null, observacion: null, instance_code: null }],
    {},
  );
  assert.ok(miss.includes('missing'));
}

console.log('measurementCompute.preview tests OK');
