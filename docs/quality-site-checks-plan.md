### Quality: On‑site Slump/Extensibilidad + Temperature Form (separate flow)

This document proposes a new, mobile‑first form to capture on‑site checks performed at the construction site (revenimiento/extensibilidad, temperatures, observations, and optional adjustments). This flow is intentionally separate from the existing lab-oriented muestreo flow (which creates samples and schedules tests).

### Context and goals

- **Today**: `Nuevo Muestreo` focuses on creating samples (cilindros/vigas), tied to a `remision` and later lab `ensayos`. It includes fields like `masa unitaria` and generates a sample plan.
- **Need**: A lightweight, on‑site capture used by field staff at time of pouring. Frequently the `remision` does not yet exist in the system, but its number is known. No samples or tests will be created from this form.
- **Goals**:
  - **Mobile‑first UI** optimized for one‑hand use, large targets, numeric keypad, minimal taps.
  - **Standalone data model** to avoid coupling with the lab muestreo/ensayo pipeline.
  - Allow capture with either an existing `remision` or a manual `remision_number` to link later.
  - Track optional adjustments: initial measurement, what was adjusted, final measurement.
  - Safe validation ranges for temperatures and measurements.

### Scope (MVP)

- Create a new entity for on‑site checks; no `muestras` or `ensayos` are created.
- Fields captured: remisión (existing or manual), planta, fecha/hora, salida de planta, llegada a obra, tipo de prueba (SLUMP/EXTENSIBILIDAD), medición inicial, ajuste aplicado (opcional), medición final, temperatura ambiente, temperatura del concreto, observaciones.
- Ability to later link to the canonical `remisiones` row when it becomes available.

### Data model options

- **Option A: Reuse `muestreos` with a `tipo` column**
  - Pros: Fewer tables; some fields already exist (temperatures, planta).
  - Cons: Coupling with sample/ensayo logic; existing queries, metrics, and UI assume testable samples; higher regression risk.

- **Option B: New table dedicated to on‑site checks (RECOMMENDED)**
  - Pros: Clear separation of concerns; no impact on lab metrics/flows; simpler permissions and future evolution (photos, GPS, offline, etc.).
  - Cons: One more table and service.

We will implement Option B.

### Proposed schema (Supabase/Postgres)

Table: `site_checks` (Spanish alias in UI: "Registro en obra")

```sql
create table if not exists public.site_checks (
  id uuid primary key default gen_random_uuid(),
  -- Link to remision when available (optional at creation time)
  remision_id uuid null references public.remisiones(id) on delete set null,
  -- Manual remision number for on‑site capture (kept even after linking)
  remision_number_manual text not null,
  -- Core context
  plant_id uuid not null references public.plants(id),
  fecha_muestreo timestamptz not null default now(),
  hora_salida_planta time null,
  hora_llegada_obra time null,
  -- Measurement type and values
  test_type text not null check (test_type in ('SLUMP','EXTENSIBILIDAD')),
  valor_inicial_cm numeric(5,2) null,
  fue_ajustado boolean not null default false,
  detalle_ajuste text null,
  valor_final_cm numeric(5,2) null,
  -- Temperatures and notes
  temperatura_ambiente numeric(5,2) null,
  temperatura_concreto numeric(5,2) null,
  observaciones text null,
  -- Audit
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_checks enable row level security;
```

Indexes and helpers:

```sql
create index if not exists site_checks_created_at_idx on public.site_checks (created_at desc);
create index if not exists site_checks_plant_id_idx on public.site_checks (plant_id);
create index if not exists site_checks_remision_id_idx on public.site_checks (remision_id);
create index if not exists site_checks_remision_number_manual_idx on public.site_checks (remision_number_manual);
```

RLS policies (align with quality roles used elsewhere):

```sql
-- Roles: QUALITY_TEAM, PLANT_MANAGER, LABORATORY, EXECUTIVE
-- Read
create policy site_checks_select on public.site_checks
  for select to authenticated
  using (exists (
    select 1 from user_profiles p
    where p.id = auth.uid()
      and p.role in ('QUALITY_TEAM','PLANT_MANAGER','LABORATORY','EXECUTIVE')
  ));

-- Insert
create policy site_checks_insert on public.site_checks
  for insert to authenticated
  with check (exists (
    select 1 from user_profiles p
    where p.id = auth.uid()
      and p.role in ('QUALITY_TEAM','PLANT_MANAGER','LABORATORY','EXECUTIVE')
  ));

-- Update (creator or same role set)
create policy site_checks_update on public.site_checks
  for update to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from user_profiles p
      where p.id = auth.uid()
        and p.role in ('QUALITY_TEAM','PLANT_MANAGER','LABORATORY','EXECUTIVE')
    )
  )
  with check (true);
```

Auto‑link to `remisiones` when it becomes available (background consistency):

```sql
-- When a remision is inserted, try to link pending site_checks by matching number
create or replace function public.link_site_checks_to_remision()
returns trigger language plpgsql as $$
begin
  update public.site_checks sc
  set remision_id = new.id
  where sc.remision_id is null
    and sc.remision_number_manual = new.remision_number::text;
  return new;
end;
$$;

drop trigger if exists trg_link_site_checks on public.remisiones;
create trigger trg_link_site_checks
after insert on public.remisiones
for each row execute function public.link_site_checks_to_remision();
```

Implementation note: All DB changes should be applied via Supabase MCP migrations, not manual SQL in app code.

### Services (frontend)

Create `src/services/siteChecksService.ts` with:

- `createSiteCheck(input)` – inserts one `site_checks` row using the Supabase JS client.
- `listSiteChecks(filters)` – filters by date range, planta, test_type, and whether linked.
- `getSiteCheckById(id)` – fetches details, including joined `remisiones` if linked.
- `linkSiteCheckToExistingRemision(id, remision_id)` – manual linking helper.

### Routes and pages

- New route: `app/quality/site-checks/new/page.tsx`
  - Mobile‑first form with two modes surfaced via segmented control:
    - `Remisión existente` (scheduler‑style, same pattern as current muestreo): Steps → 1) Seleccionar Orden → 2) Seleccionar Remisión → 3) Capturar datos en obra. On Step 3, prefill fields from remisión (plant via `plant_id`, date, etc.) and lock any that must come from the remisión.
    - `Remisión manual` (single‑step capture): inputs for `remision_number_manual` and `plant_id` are enabled; later auto‑link will associate the remisión.
  - Inputs (order optimized for field staff):
    1) Número de remisión (search or manual)  2) Planta (via `plant_id`)  3) Fecha y hora del muestreo  4) Salida de planta (hora)  5) Llegada a obra (hora)
    6) Tipo de prueba (SLUMP/EXTENSIBILIDAD)  7) Medición inicial (cm)
    8) Toggle "¿Se realizó ajuste?" → if true: `detalle_ajuste` + `Medición final (cm)`
    9) Temperatura ambiente  10) Temperatura del concreto  11) Observaciones
  - Large inputs (`inputMode="decimal"`, `step` control), sticky submit bar, clear validation messages.

- Detail page: `app/quality/site-checks/[id]/page.tsx`
  - Read‑only view with link‑to‑remisión action if not yet linked.

- Optional list: `app/quality/site-checks/page.tsx` with filters and quick actions.

### Validation (zod)

- Temperatures: ambiente −10..60°C; concreto 5..60°C.
- Measurement ranges depend on `test_type`:
  - `SLUMP`: default 0..25 cm.
  - `EXTENSIBILIDAD`: default 30..100 cm.
  - Both ranges must be configurable (constants or settings table) to match plant policy.
- If `fue_ajustado = true` then require `detalle_ajuste` and `valor_final_cm`.

### UX details (mobile‑first)

- One column layout, max‑width for readability, sticky header with page title and back action.
- Numeric fields: `inputMode="decimal"` and `pattern` for iOS numeric keypad.
- Time fields use native `<input type="time">` to minimize taps; show helpful examples (e.g., "6 pm se registra como 18:00").
- Contextual help tooltips using existing `Tooltip` patterns.
- Fast actions: "Usar hora actual" for fields `fecha_muestreo` and times.
- Error prevention: preview card summarizing captured values before submit.

### Reporting and dashboard impact

- These entries do not participate in resistance metrics. Consider adding a small section under `Quality` → "Registros en obra (slump/extensibilidad)" with basic stats (promedios, rangos por planta).

### Implementation steps (high level)

1) DB migration with Supabase MCP
   - Add `site_checks` table, indexes, RLS policies, and trigger to auto‑link by `remision_number_manual`.
2) Services
   - Implement `siteChecksService.ts` with typed DTOs and simple Supabase queries.
3) UI
   - Build `app/quality/site-checks/new/page.tsx` using shadcn components. Reuse patterns from `MeasurementsFields` where sensible, but keep the form minimal.
4) Navigation
   - Add quick link from `Quality` dashboard → "Nuevo registro en obra".
5) QA
   - Validate creation in both modes (existing vs manual remisión). Test auto‑link when a remisión is later inserted.

### Supabase MCP notes (how we will apply DB changes)

- Use the MCP functions to apply a migration in the current project. Example flow:

```text
1) Prepare SQL shown above as a migration file.
2) Use the MCP call to apply migration to the desired project (we will ask for the organization/project ids):
   - mcp_supabase_apply_migration { project_id, name: "add_site_checks_table", query: "<SQL>" }
3) Verify with mcp_supabase_list_tables and rudimentary inserts/selects.
```

### Open questions

- Do we need to capture photos or operator name now?
- Should we persist GPS/location for the pour location?
- Should the allowed range for extensibilidad differ from slump, and do we need per‑recipe targets for on‑site checks?


