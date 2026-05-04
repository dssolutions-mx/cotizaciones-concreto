import { z } from 'zod';

const decisionNote = z.string().nullable().optional();
const unit = z.string().nullable().optional();

const formulaBoundSchema = z.object({
  kind: z.literal('formula_bound'),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  min_formula: z.string().nullable().optional(),
  max_formula: z.string().nullable().optional(),
  unit,
  decision_note: decisionNote,
});

const passFailRuleUnion = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none'), decision_note: decisionNote }),
  z.object({
    kind: z.literal('expected_bool'),
    value: z.boolean(),
    decision_note: decisionNote,
  }),
  z.object({
    kind: z.literal('tolerance_abs'),
    expected: z.number(),
    tolerance: z.number(),
    unit,
    decision_note: decisionNote,
  }),
  z.object({
    kind: z.literal('tolerance_pct'),
    expected: z.number(),
    tolerance_pct: z.number(),
    unit,
    decision_note: decisionNote,
  }),
  z.object({
    kind: z.literal('range'),
    min: z.number().nullable(),
    max: z.number().nullable(),
    unit,
    decision_note: decisionNote,
  }),
  z.object({
    kind: z.literal('expression'),
    expr: z.string().min(1),
    decision_note: decisionNote,
  }),
  formulaBoundSchema,
]);

export const passFailRuleSchema = passFailRuleUnion
  .superRefine((v, ctx) => {
    if (v.kind !== 'formula_bound') return;
    const hasMinFormula = !!v.min_formula && v.min_formula.trim().length > 0;
    const hasMaxFormula = !!v.max_formula && v.max_formula.trim().length > 0;
    const hasMin = v.min != null;
    const hasMax = v.max != null;
    if (!hasMinFormula && !hasMaxFormula && !hasMin && !hasMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'formula_bound requiere al menos un límite (min/max o min_formula/max_formula).',
      });
    }
  })
  .nullable();

export const toleranciaTipoSchema = z.enum(['absoluta', 'porcentual', 'rango', 'formula_bound']);
