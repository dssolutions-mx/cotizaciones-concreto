/**
 * Evaluate pass/fail rules for EMA verification template items.
 */

import { evaluateFormula, parseFormula } from './formula';
import type { PassFailRule } from '@/types/ema';

export function evaluatePassFailRule(
  rule: PassFailRule | null | undefined,
  ctx: {
    valor_observado: number | null;
    valor_booleano: boolean | null;
    scope?: Record<string, number>;
  },
): boolean | null {
  if (!rule || rule.kind === 'none') return null;

  const scope = ctx.scope ?? {};

  switch (rule.kind) {
    case 'tolerance_abs': {
      if (ctx.valor_observado == null) return null;
      const err = Math.abs(ctx.valor_observado - rule.expected);
      return err <= rule.tolerance;
    }
    case 'tolerance_pct': {
      if (ctx.valor_observado == null) return null;
      if (rule.expected === 0) return null;
      const err = Math.abs(ctx.valor_observado - rule.expected);
      return (err / Math.abs(rule.expected)) * 100 <= rule.tolerance_pct;
    }
    case 'range': {
      if (ctx.valor_observado == null) return null;
      const okMin = rule.min == null || ctx.valor_observado >= rule.min;
      const okMax = rule.max == null || ctx.valor_observado <= rule.max;
      return okMin && okMax;
    }
    case 'expected_bool': {
      if (ctx.valor_booleano === null || ctx.valor_booleano === undefined) return null;
      return ctx.valor_booleano === rule.value;
    }
    case 'expression': {
      try {
        const ast = parseFormula(rule.expr);
        const n = evaluateFormula(ast, scope);
        return n !== 0 && !Number.isNaN(n);
      } catch {
        return null;
      }
    }
    default:
      return null;
  }
}
