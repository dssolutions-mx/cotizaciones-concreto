import { validateDerivadoDAG } from './formula';
import { normalizeTemplateItem } from './templateItem';
import type { VerificacionTemplateSnapshot } from '@/types/ema';

export interface TemplateValidationResult {
  ok: boolean;
  errors: string[];
}

/** Validate draft template before publish (cycles, unknown vars, duplicate variable names per section). */
export function validateTemplateForPublish(snapshot: VerificacionTemplateSnapshot): TemplateValidationResult {
  const errors: string[] = [];

  for (const sec of snapshot.sections ?? []) {
    const items = (sec.items ?? []).map(normalizeTemplateItem);
    const names = new Set<string>();
    for (const it of items) {
      if (names.has(it.variable_name)) {
        errors.push(`Variable duplicada «${it.variable_name}» en sección «${sec.titulo}»`);
      }
      names.add(it.variable_name);
    }

    const inputVars = new Set(
      items.filter(i => i.item_role !== 'derivado').map(i => i.variable_name),
    );

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
    }
  }

  return { ok: errors.length === 0, errors };
}
