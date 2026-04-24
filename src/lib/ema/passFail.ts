/**
 * Evaluate pass/fail rules for EMA verification template items.
 */

import { evaluateFormula, parseFormula } from './formula';
import type { PassFailRule } from '@/types/ema';

export type PassFailDiagnostics = { warnings?: string[]; itemLabel?: string };

export function evaluatePassFailRule(
  rule: PassFailRule | null | undefined,
  ctx: {
    valor_observado: number | null;
    valor_booleano: boolean | null;
    scope?: Record<string, number>;
  },
  diag?: PassFailDiagnostics,
): boolean | null {
  if (!rule || rule.kind === 'none') return null;

  const scope = ctx.scope ?? {};
  const warn = (msg: string) => {
    const prefix = diag?.itemLabel ? `«${diag.itemLabel}»` : 'Cumplimiento';
    diag?.warnings?.push(`${prefix}: ${msg}`);
  };

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
      } catch (e: unknown) {
        warn(`expresión no evaluable — ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    }
    case 'formula_bound': {
      if (ctx.valor_observado == null) return null;
      const v = ctx.valor_observado;

      // Resolve min — fixed value takes priority; fall back to formula
      let min: number | null = rule.min ?? null;
      if (min == null && rule.min_formula) {
        try {
          min = evaluateFormula(parseFormula(rule.min_formula), scope);
        } catch (e: unknown) {
          warn(`límite inferior (fórmula) no evaluable — ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Resolve max — same pattern
      let max: number | null = rule.max ?? null;
      if (max == null && rule.max_formula) {
        try {
          max = evaluateFormula(parseFormula(rule.max_formula), scope);
        } catch (e: unknown) {
          warn(`límite superior (fórmula) no evaluable — ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      const okMin = min == null || v >= min;
      const okMax = max == null || v <= max;
      return okMin && okMax;
    }
    default:
      return null;
  }
}
