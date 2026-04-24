import { extractVariables, parseFormula, validateDerivadoDAG } from './formula';
import { normalizeTemplateItem } from './templateItem';
import type { PassFailRule, VerificacionTemplateHeaderField, VerificacionTemplateSnapshot } from '@/types/ema';

export interface TemplateValidationResult {
  ok: boolean;
  errors: string[];
}

function collectPassFailFormulaVars(rule: PassFailRule | null | undefined): string[] {
  if (!rule || rule.kind === 'none') return [];
  if (rule.kind === 'expression') return [rule.expr];
  if (rule.kind === 'formula_bound') {
    const parts: string[] = [];
    if (rule.min_formula) parts.push(rule.min_formula);
    if (rule.max_formula) parts.push(rule.max_formula);
    return parts;
  }
  return [];
}

function validateHeaderFieldsChain(
  headerFields: VerificacionTemplateHeaderField[] | undefined,
  errors: string[],
): Set<string> {
  const headerVarNames = new Set<string>();
  if (!headerFields?.length) return headerVarNames;

  const sorted = [...headerFields].sort((a, b) => a.orden - b.orden);
  const seenNames = new Set<string>();
  for (const h of sorted) {
    const vn = h.variable_name?.trim() || h.field_key.trim();
    if (vn) {
      if (seenNames.has(vn)) {
        errors.push(`Cabecera: variable duplicada «${vn}»`);
      }
      seenNames.add(vn);
      headerVarNames.add(vn);
    }

    if (h.source === 'computed') {
      errors.push(
        `Cabecera «${h.label}»: no debe ser calculada; cambia el origen a Manual/Instrumento o crea un punto calculado en una sección`,
      );
    }
  }

  return headerVarNames;
}

/** Validate draft template before publish (cycles, unknown vars, duplicate variable names per section). */
export function validateTemplateForPublish(snapshot: VerificacionTemplateSnapshot): TemplateValidationResult {
  const errors: string[] = [];

  const headerVarNames = validateHeaderFieldsChain(snapshot.header_fields, errors);

  for (const sec of snapshot.sections ?? []) {
    const items = (sec.items ?? []).map(normalizeTemplateItem);
    const names = new Set<string>();
    for (const it of items) {
      if (names.has(it.variable_name)) {
        errors.push(`Variable duplicada «${it.variable_name}» en sección «${sec.titulo}»`);
      }
      names.add(it.variable_name);
      if (headerVarNames.has(it.variable_name)) {
        errors.push(
          `La variable «${it.variable_name}» en «${sec.titulo}» coincide con un campo de cabecera; use otro nombre`,
        );
      }
    }

    const sectionVarNames = new Set(items.map(i => i.variable_name));

    const inputVars = new Set(
      items.filter(i => i.item_role !== 'derivado').map(i => i.variable_name),
    );
    for (const h of headerVarNames) inputVars.add(h);

    for (const it of items) {
      if (it.item_role === 'derivado' && !it.formula?.trim()) {
        errors.push(`«${it.punto}» (calculado) requiere fórmula`);
      }
    }

    const derivados = items
      .filter(i => i.item_role === 'derivado')
      .map(i => ({ id: i.id, variable_name: i.variable_name, formula: i.formula }));

    const dag = validateDerivadoDAG(derivados, inputVars);
    if (!dag.ok) {
      for (const v of dag.unknownVars) {
        errors.push(`Fórmula: variable desconocida «${v.varName}» (ítem ${v.itemId.slice(0, 8)}…)`);
      }
      for (const c of dag.cycles) {
        errors.push(`Dependencia circular entre ítems: ${c.join(' → ')}`);
      }
      for (const d of dag.duplicateVars) {
        errors.push(`Nombre de variable duplicado en derivados: «${d}»`);
      }
    }

    for (const it of items) {
      if (
        it.contributes_to_cumple &&
        it.pass_fail_rule?.kind === 'none' &&
        (it.item_role === 'input_medicion' || it.item_role === 'input_booleano')
      ) {
        errors.push(`«${it.punto}» requiere regla de cumplimiento (tolerancia o respuesta esperada)`);
      }

      const allowedInRules = new Set<string>([...sectionVarNames, ...headerVarNames]);
      for (const expr of collectPassFailFormulaVars(it.pass_fail_rule)) {
        try {
          const ast = parseFormula(expr);
          for (const v of extractVariables(ast)) {
            if (!allowedInRules.has(v)) {
              errors.push(
                `«${it.punto}»: regla de cumplimiento referencia variable desconocida «${v}»`,
              );
            }
          }
        } catch (e: unknown) {
          errors.push(
            `«${it.punto}»: expresión de cumplimiento inválida — ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
