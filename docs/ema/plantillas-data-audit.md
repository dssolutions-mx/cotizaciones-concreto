# Auditoría de datos — Plantillas EMA (hosted Supabase)

Auditoría **solo lectura** contra el proyecto Supabase **`cotizador`** (`project_id` / ref: `pkjqznogflgbnwzkzmpg`). Fecha de referencia: implementación del todo **data-audit**.

## Conteos globales

| Entidad | Cantidad |
|---------|------------|
| `verificacion_templates` | 15 |
| `verificacion_template_sections` | 32 |
| `verificacion_template_items` | 147 |
| `verificacion_template_header_fields` | 3 |
| `verificacion_template_versions` | 20 |
| `completed_verificaciones` | 7 |
| `completed_verificacion_measurements` | 47 |

## Plantillas por estado

| `estado` | Cantidad |
|----------|----------|
| `borrador` | 1 |
| `publicado` | 14 |

## Secciones por layout

| `layout` | `repetible` | Cantidad |
|----------|-------------|----------|
| `linear` | false | 29 |
| `instrument_grid` | true | 3 |
| `reference_series` | — | 0 filas en este conteo |

Interpretación: casi todo es `linear`; pocas grillas; **no hay uso activo** de `reference_series` en los datos actuales (puede existir en borradores con otro `repetible` — revisar caso a caso si hace falta).

## Hallazgos de calidad / riesgo

### 1. Ítems que aportan a cumple sin regla (`pass_fail_rule` ausente o `none`)

- **31** filas en `verificacion_template_items` con `contributes_to_cumple = true` y `item_role` en `('input_medicion','input_booleano')` y `pass_fail_rule` nulo o `kind = 'none'`.

**Impacto:** el resultado global puede quedar **indeterminado** o depender de lógica que el usuario no ve en el constructor. Alineado con `validateTemplateForPublish` (debería bloquear publicación en borradores nuevos), pero **plantillas ya publicadas** pueden conservar este estado hasta remediación.

**Remediación sugerida:** clasificar por plantilla/versión; corregir borradores; para publicados, documentar excepción o republicar versión corregida sin romper historial.

### 2. Cabecera calculada sin fórmula ni variable

- **1** fila en `verificacion_template_header_fields`:

| `codigo` | `nombre` | `field_key` | `label` | `source` | `variable_name` | `formula` |
|----------|----------|-------------|---------|----------|-----------------|-----------|
| DC-LC-6.4-07 | Almohadilla de neopreno | dc-lc-6.4-08 | dureza | computed | null | null |

**Impacto:** el campo no puede evaluarse; en UI de ejecución puede mostrarse como “—” o omitirse según rama.

**Remediación:** completar `variable_name` + `formula` o cambiar `source` / eliminar fila en borrador.

### 3. Derivados sin fórmula

- **0** ítems con `item_role = 'derivado'` y `formula` vacía.

### 4. Distribución de `pass_fail_rule` (muestra útil)

Los datos muestran mezcla de `tolerance_abs`, `none`, `expected_bool`, `range`, `formula_bound`, etc. El volumen de `none` en mediciones con `contributes_to_cumple` confirma el hallazgo (1).

## Coherencia con el repo

- La documentación [EMA_PLANTILLAS_V2.md](../EMA_PLANTILLAS_V2.md) referencia la migración `supabase/migrations/20260425100000_ema_plantillas_v2.sql`.

- **En este checkout** ese archivo **no está presente** (búsqueda en repo sin resultados). La auditoría debe asumir que el esquema ya está aplicado en hosted DB y que la fuente de verdad para columnas es `src/types/database.types.generated.ts` + MCP.

## Consultas SQL reutilizables

Conteos:

```sql
select 'templates' k, count(*)::int v from public.verificacion_templates
union all select 'sections', count(*)::int from public.verificacion_template_sections
union all select 'items', count(*)::int from public.verificacion_template_items
union all select 'header_fields', count(*)::int from public.verificacion_template_header_fields
union all select 'versions', count(*)::int from public.verificacion_template_versions;
```

Contribuye sin regla:

```sql
select count(*)::int
from public.verificacion_template_items
where contributes_to_cumple = true
  and item_role in ('input_medicion','input_booleano')
  and (pass_fail_rule is null or pass_fail_rule->>'kind' = 'none');
```

Cabecera computada incompleta:

```sql
select t.codigo, t.nombre, h.*
from public.verificacion_template_header_fields h
join public.verificacion_templates t on t.id = h.template_id
where h.source = 'computed'
  and (h.formula is null or btrim(h.formula) = ''
    or h.variable_name is null or btrim(h.variable_name) = '');
```

## Siguiente paso recomendado

Generar un **informe por plantilla** (lista de violaciones por `template_id` / `codigo`) antes de endurecer validación en publicación — ver [plantillas-implementation-priorities.md](./plantillas-implementation-priorities.md).
