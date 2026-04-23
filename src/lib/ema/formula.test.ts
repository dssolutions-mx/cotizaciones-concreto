import assert from 'node:assert';
import {
  evaluateFormula,
  extractVariables,
  parseFormula,
  topoSortDerivados,
  validateDerivadoDAG,
} from './formula';

function approx(a: number, b: number, eps = 1e-9) {
  assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
}

// Basic arithmetic
approx(evaluateFormula(parseFormula('2 + 3 * 4'), {}), 14);
approx(evaluateFormula(parseFormula('(2+3)*4'), {}), 20);
approx(evaluateFormula(parseFormula('2^3'), {}), 8);

// Variables
approx(evaluateFormula(parseFormula('a + b'), { a: 1, b: 2 }), 3);

// Comparisons (numeric 1/0)
assert.strictEqual(evaluateFormula(parseFormula('3 <= 4'), {}), 1);
assert.strictEqual(evaluateFormula(parseFormula('5 <= 4'), {}), 0);

// Functions
approx(evaluateFormula(parseFormula('abs(-3)'), {}), 3);
approx(evaluateFormula(parseFormula('min(1,2,3)'), {}), 1);
approx(evaluateFormula(parseFormula('max(1,2,3)'), {}), 3);
approx(evaluateFormula(parseFormula('avg(2,4,6)'), {}), 4);
approx(evaluateFormula(parseFormula('sum(1,2,3)'), {}), 6);
approx(evaluateFormula(parseFormula('sqrt(9)'), {}), 3);
approx(evaluateFormula(parseFormula('pi'), {}), Math.PI);

// extractVariables
{
  const ast = parseFormula('abs(lectura - carga)');
  const v = extractVariables(ast);
  assert.ok(v.has('lectura'));
  assert.ok(v.has('carga'));
}

// DAG
{
  const known = new Set(['x']);
  const d = [
    { id: '1', variable_name: 'y', formula: 'x * 2' },
    { id: '2', variable_name: 'z', formula: 'y + 1' },
  ];
  const val = validateDerivadoDAG(d, known);
  assert.strictEqual(val.ok, true);
  const order = topoSortDerivados(d, known);
  assert.deepStrictEqual(order, ['1', '2']);
}

{
  const known = new Set<string>();
  const d = [
    { id: '1', variable_name: 'a', formula: 'b + 1' },
    { id: '2', variable_name: 'b', formula: 'a + 1' },
  ];
  const val = validateDerivadoDAG(d, known);
  assert.strictEqual(val.ok, false);
  assert.ok(val.cycles.length > 0 || val.unknownVars.length > 0);
}

console.log('formula.test.ts: OK');
