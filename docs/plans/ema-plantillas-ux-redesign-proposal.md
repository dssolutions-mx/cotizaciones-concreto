# EMA Plantillas UX/UI Redesign Proposal

## Executive Summary

The current EMA plantilla builder looks organized, but it behaves like a thin UI over database primitives. It asks quality staff to understand variables, formulas, pass/fail rules, section layouts, computed headers, and publishing snapshots without giving them the tools to see whether the resulting verification will actually work.

The redesign should not start as a cosmetic pass. The first goal is functional trust: a user should be able to translate an Excel or paper ficha into an executable verification procedure, preview how it will behave, and publish only when the system can prove the template is internally consistent.

The biggest product risk is calculated fields. The code supports parsing and evaluating formulas, but the UI does not show available variables, dependency scope, sample evaluation, or failure states. In execution, some formula errors are caught and converted into missing/null values. That means a template can look complete, publish successfully in some cases, and later fail to produce reliable calculated results.

## What The Screenshots Show

The screenshots show a builder with calm styling, status cards, cabecera fields, sections, point forms, badges, and publish actions. The visual system is not the main problem. The workflow is.

Observed issues:

- The page does not communicate “publish readiness.” It shows counts and actions, but not whether the template is safe to execute.
- `Campos de cabecera (ficha)` asks for `Clave`, `Etiqueta`, and `Origen`, but does not explain runtime behavior.
- Almost every point type exposes `Nombre de variable (fórmulas)`, even when the user is adding a text, reference, or simple informational field.
- `Calculado` accepts a raw formula such as `d3/d4`, but the user cannot see whether `d3` or `d4` exist, where they came from, or whether they are in scope.
- `Cuenta para resultado global` appears as a simple checkbox, but it carries compliance meaning.
- The section list shows badges and expected values, but not dependencies or unresolved rules.
- The UI has large empty space and low contrast hierarchy while the task itself is high consequence.
- Save/add/publish actions can feel like validation, even when they are only persistence actions.

Likely user behavior:

- Users will paste labels from Excel and invent variable names because the form asks for them.
- Users will pick the first plausible point type, then change it later when they realize the behavior differs.
- Users will ignore helper text if the system lets them save or publish anyway.
- Users will use preview as proof that the ficha works, even if preview is only visual.
- Users will assume a saved point is valid.

## Current Technical Reality

Important code paths:

- Builder page: `src/app/quality/conjuntos/[id]/plantilla/page.tsx`
- Execution page: `src/app/quality/instrumentos/[id]/verificar/page.tsx`
- Preview component: `src/components/ema/TemplateFicha.tsx`
- Formula parser/evaluator: `src/lib/ema/formula.ts`
- Measurement computation: `src/lib/ema/measurementCompute.ts`
- Template publish validation: `src/lib/ema/templateValidate.ts`
- Header fields API: `src/app/api/ema/templates/[id]/header-fields/route.ts`
- Publish API: `src/app/api/ema/templates/[id]/publish/route.ts`

Live Supabase findings from the `cotizador` project:

- 15 templates.
- 32 sections.
- 147 template items.
- 3 header fields.
- 20 template versions.
- 14 templates published and 1 draft.
- 31 measurement/boolean items contribute to the global result while having no pass/fail rule.
- 1 computed cabecera field has no usable formula/variable.
- Most sections are `linear`; only a few use `instrument_grid`; no active `reference_series` usage was found in the layout count.

Interpretation:

The system already has meaningful data and published usage, so the redesign must preserve history. But the live records also prove the current UI lets users create definitions that are semantically weak or incomplete.

## Core Product Diagnosis

The builder currently exposes implementation primitives instead of authoring intent.

Current user-facing concepts:

- `variable_name`
- `formula`
- `contributes_to_cumple`
- `pass_fail_rule`
- `source`
- `layout`
- `computed`
- `repetible`

Better user-facing concepts:

- `Datos iniciales`
- `Mediciones`
- `Criterios de aceptación`
- `Datos informativos`
- `Cálculos automáticos`
- `Resultado global`
- `Vista previa de ejecución`
- `Listo para publicar`

The system should keep database primitives internally, but the builder should speak the language of the work: verifying equipment against a ficha and producing a trustworthy result.

## Proposed UX Model

The builder should become a guided ficha authoring workspace.

Primary areas:

- `Configuración`: name, code, norma, description, current version, draft/published state.
- `Datos iniciales`: values needed before measurements, replacing most visible use of “cabecera”.
- `Secciones`: groups of measurements or checks.
- `Cálculos`: automatic outputs, dependencies, formula health, sample evaluation.
- `Vista previa`: execution-style rehearsal, not only print layout.
- `Publicación`: validation summary, blockers, warnings, version impact.

Supporting layout:

- Main editor focused on one area at a time.
- Right-side readiness panel on desktop.
- Sticky bottom action bar for save/publish/preview.
- Inline validation that distinguishes warnings from publish blockers.
- Advanced panel for raw technical details.

## Point Type Redesign

Each point type should have a distinct authoring pattern.

`Medir y comparar`:

- Use for physical measurements.
- Ask for label, unit, expected value/range/tolerance, and result contribution.
- Show the acceptance rule in plain language.
- Generate or suggest a variable only if the point is referenced by a calculation.

`Pregunta sí/no`:

- Use for visual or procedural checks.
- Ask for the question and expected answer.
- Show how the answer affects the result.

`Dato informativo`:

- Use for notes or values recorded for traceability.
- Hide result contribution by default.
- Hide variable names unless explicitly needed by a calculation.

`Referencia de equipo`:

- Use for equipment, standards, or reference instruments.
- Focus on traceability.
- Hide formula fields by default.

`Cálculo automático`:

- Use for derived values.
- Require output label, output variable, formula, and sample evaluation.
- Show dependencies before save.
- If it contributes to the result, require an acceptance rule.

## Variables And Formulas

This is the most important redesign area.

Required capabilities:

- A visible list of available variables.
- Variable picker/autocomplete in formula fields.
- Source labels for each variable: dato inicial, measurement, calculated point, reference value, or system/instrument value.
- Scope labels: current section, current repetition, datos iniciales, reference series, or global.
- Sample values for testing formulas before publish.
- Dependency graph or simple “uses / used by” badges.
- Blocking errors for unknown variables, circular dependencies, missing formulas, missing output variables, and invalid syntax.
- Clear warnings when changing a point label or variable would break formulas.

Formula authoring should answer:

- What variables can I use?
- Where do they come from?
- Are they numeric?
- Are they available at the time this calculation runs?
- What happens if one is blank?
- Which other fields depend on this one?

Without those answers, calculated fields are not a real feature.

## Preview And Validation

The current preview should be reframed as a runtime rehearsal.

Preview should show:

- The same order and labels the verifier will see.
- Required indicators.
- Datos iniciales fields.
- Sample input fields for formulas.
- Calculated outputs.
- Missing dependencies.
- Which points contribute to the global result.
- Whether the result can be computed.

Validation should have three levels:

- Informational: helpful hints, naming suggestions, unused variables.
- Warning: questionable but allowed, such as an informational point with a variable.
- Blocking: cannot publish, such as unknown formula variable or contributing point without rule.

Publishing should never be the first moment a user learns the template is broken.

## Execution Behavior

The execution flow needs a stronger trust model.

Rules to define:

- Required blanks should block section advancement or final close.
- `No aplica` should be explicit, permission-aware, and require a reason.
- Formula failures should be shown as calculation errors, not silent blanks.
- If any required or contributing value is unresolved, the global result should be indeterminate or blocked.
- Manual override of the global result should require an explanation.
- The close screen should show why the result is conforme, no conforme, indeterminado, or overridden.

This matters because the verification record is not just UI output. It is quality/compliance evidence.

## Versioning And Historical Safety

Published versions should be immutable and self-sufficient.

Requirements:

- Published snapshots should include header fields, sections, items, formulas, variables, rules, and layouts.
- Runtime should not depend on mutable draft/header rows to reconstruct old versions.
- Completed verifications should remain tied to the exact version used.
- Editing a published template should create a draft/new version path, not mutate history.
- Old versions should remain readable even if new validation rules become stricter.

Current fallback behavior that merges missing header fields into snapshots should be treated as legacy compatibility, not the target architecture.

## Data Quality And Remediation

Before strict validation becomes blocking, existing data should be audited and classified.

Audit output should identify:

- Affected template.
- Affected version.
- Affected section and point.
- Issue severity.
- User-visible impact.
- Whether historical completed verifications may be affected.
- Recommended remediation.

Seed issues already found:

- Contributing points without pass/fail rules.
- Computed header without formula/variable.
- Potential formula failures that return null.
- Header fields not guaranteed to be embedded in published snapshots.

Suggested severity:

- Critical: can produce wrong or indeterminate compliance result.
- High: can block execution or publish.
- Medium: confusing authoring behavior.
- Low: naming/consistency cleanup.

## Scalable Architecture Direction

The UI should not keep growing as one large form.

Recommended direction:

- Define a domain-level plantilla model in product terms.
- Keep adapters that map that model to the existing database tables.
- Centralize formula and variable validation.
- Share validation between builder, preview, publish, and execution.
- Move invariants to server APIs, not only client-side forms.
- Preserve existing published records through compatibility rules.

This allows the system to support more ficha patterns without exposing every database field to every user.

## Phased Plan

### Phase 1: Audit And Safety Contract

Deliverables:

- Field dictionary in Spanish.
- Live data issue report.
- Published snapshot contract.
- Formula/variable scope rules.
- Execution failure-mode rules.

Outcome:

The team agrees what a valid plantilla means before redesigning screens.

### Phase 2: Validation And Formula Foundation

Deliverables:

- Shared validation model.
- Variable registry concept.
- Formula dependency and sample evaluation behavior.
- Server-side publish blockers.
- Legacy compatibility strategy.

Outcome:

The system can detect broken templates before users rely on them.

### Phase 3: Builder IA Redesign

Deliverables:

- New authoring structure.
- Progressive disclosure rules.
- Distinct point-type forms.
- Readiness panel.
- Sticky actions.
- Runtime rehearsal preview.

Outcome:

Users author fichas in domain language, not database language.

### Phase 4: Execution Trust Improvements

Deliverables:

- Required-field behavior.
- No aplica behavior.
- Calculation error display.
- Result explanation.
- Override workflow.

Outcome:

Verifiers can trust the final result and understand unresolved states.

### Phase 5: Data Remediation And Rollout

Deliverables:

- Existing template issue list.
- Remediation plan for drafts/new publishes.
- Compatibility policy for historical versions.
- Role-aware rollout notes.

Outcome:

The redesign improves safety without corrupting or invalidating historical records.

## Recommended First Implementation Slice

Start with safety and visibility, not visual redesign.

First slice:

- Add a read-only readiness/validation summary to the current builder.
- Surface formula variable availability and missing-variable errors.
- Identify contributing points without pass/fail rules.
- Show computed cabecera fields missing formula/variable as blockers.
- Make publish blockers visible before clicking publish.

Why this first:

- It addresses the highest-risk failure mode.
- It helps validate the new product model using the current UI.
- It avoids a large redesign before the team agrees on validity rules.
- It gives immediate value for the existing draft template.

## Open Questions

- Should required blanks block section advancement, final close, or both?
- Should `No aplica` exist, and who can use it?
- Can formulas reference only the current section/repetition, or also prior sections?
- Are datos iniciales formula inputs by default, or only when explicitly marked as variables?
- For grid sections, does configured max count mean “always verify this many” or “up to this many”?
- What determines the recommended template when multiple published templates exist?
- Who can override a global result, and what explanation is required?

## Success Criteria

The redesign succeeds when:

- A user can build a simple ficha without learning variable names.
- A user can build a calculated ficha and see exactly what each formula depends on.
- Broken formulas cannot be published unknowingly.
- Preview predicts execution behavior.
- The final result explains itself.
- Historical verifications remain accurate.
- The UI can support new template families without becoming another generic form builder.

## Audit artifacts (repo)

Structured outputs from the UX audit plan live under [docs/ema/README.md](../ema/README.md) (lifecycle map, Spanish field dictionary, Supabase data audit, UX audit, formula model, runtime failure modes, versioned snapshot contract, scalable IA, implementation priorities).
