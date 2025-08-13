## Procedimiento de carga de ensayos (Planta 3)

Guía operativa para cargar resultados de muestreo (cargas en KG) desde `archivoexcel/Carga P3.csv` hacia la tabla `public.ensayos`, manteniendo consistencia con `muestreos` y `muestras`, y aprovechando el disparador `public.calculate_resistance_on_ensayo()`.

### Objetivo
- Cargar las columnas `CARGA 1–4 (KG)` del CSV como registros en `public.ensayos`, uno por muestra, en el orden en que aparecen por remisión.
- Ajustar edad del ensayo a partir de `Edad (DÍA / HORA)` y `VALOR EDAD` del CSV.
- Depurar muestras sobrantes cuando haya menos cargas que muestras.
- Eliminar muestreos sin ninguna carga.

### Tablas y campos clave
- `muestreos`: `planta`, `manual_reference` (remisión), `fecha_muestreo`, `hora_muestreo`, `concrete_specs` (JSONB: `fc`, `unidad_edad`, `valor_edad`).
- `muestras`: `muestreo_id`, `created_at` (para ordenar), estado/identificación según exista.
- `ensayos`: `muestra_id`, `fecha_ensayo`, `fecha_ensayo_ts`, `carga_kg`, `plant_id`, `event_timezone`. Campos calculados por trigger: `resistencia_calculada`, `porcentaje_cumplimiento`.

### Comportamiento del trigger `calculate_resistance_on_ensayo`
- Calcula resistencia y porcentaje automáticamente en `BEFORE INSERT` de `ensayos`.
- Si existe receta a través de `remisiones.recipe_id`, usa `recipes.strength_fc` y edad de receta.
- Fallback: si no hay receta, usa `muestreos.concrete_specs` para `fc`, `unidad_edad` y `valor_edad`.
- Requisito: asegurar que antes de insertar en `ensayos`, el `muestreo` tenga `concrete_specs` con:
  - `fc` (se usó 350 por defecto cuando falta),
  - `unidad_edad` ∈ {`"HORA"`, `"DÍA"`},
  - `valor_edad` (entero, horas o días según unidad).

### Mapeo CSV → BD
- Remisión: `Número de remisión` → `muestreos.manual_reference`.
- Edad: `Edad (DÍA / HORA)` y `VALOR EDAD` → `concrete_specs.unidad_edad` y `concrete_specs.valor_edad`.
- Cargas: `CARGA 1..4 (KG)` → `ensayos.carga_kg` por cada muestra ordenada.
- Fecha/hora de ensayo: `fecha_ensayo_ts = (fecha_muestreo + hora_muestreo) + intervalo(edad)`.

### Plantilla SQL por remisión (universal)
Reemplazar valores marcados y la lista de `cargas` según el CSV de la remisión objetivo.

```sql
-- Params a sustituir:
--   :PLANTA := 'P3'
--   :REMISION := 'NNNN'
--   :UNIDAD := 'HORA' | 'DÍA'
--   :VALOR_EDAD := entero (horas o días)
--   VALUES (...) := (1, c1), (2, c2), ... con las cargas reales

with sel as (
  select m.id as muestreo_id,
         (m.fecha_muestreo::timestamptz + coalesce(m.hora_muestreo,'00:00'::time)) as base_ts,
         m.plant_id
  from public.muestreos m
  where m.planta = :PLANTA and m.manual_reference = :REMISION
  order by coalesce(m.fecha_muestreo_ts,
                    m.fecha_muestreo::timestamptz + coalesce(m.hora_muestreo,'00:00'::time),
                    m.created_at)
  limit 1
), upd as (
  update public.muestreos m
  set concrete_specs = coalesce(m.concrete_specs,'{}'::jsonb)
                        || jsonb_build_object('fc', 350, 'unidad_edad', :UNIDAD, 'valor_edad', :VALOR_EDAD)
  from sel s
  where m.id = s.muestreo_id
  returning m.id
), plan as (
  select s.muestreo_id,
         s.plant_id,
         case when :UNIDAD = 'HORA'
              then s.base_ts + make_interval(hours => :VALOR_EDAD)
              else s.base_ts + make_interval(days  => :VALOR_EDAD) end as ensayo_ts
  from sel s
), cargas as (
  select * from (values
    -- SUSTITUIR: índice 1..n y carga_kg reales
    (1, 00000::numeric)
  ) v(idx, carga_kg)
), muestras as (
  select mu.id as muestra_id,
         row_number() over(order by mu.created_at asc) as idx
  from public.muestras mu
  join sel s on s.muestreo_id = mu.muestreo_id
), ins as (
  insert into public.ensayos (muestra_id, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)
  select m.muestra_id,
         p.ensayo_ts::date,
         p.ensayo_ts,
         c.carga_kg,
         p.plant_id,
         'America/Mexico_City'
  from plan p
  join cargas c on true
  join muestras m on m.idx = c.idx
  where not exists (
    select 1 from public.ensayos e where e.muestra_id = m.muestra_id
  )
  returning muestra_id
), del as (
  delete from public.muestras x
  where x.id in (
    select m.muestra_id from muestras m
    where m.idx > (select max(idx) from cargas)
  )
  returning x.id
)
select
  (select count(*) from ins)  as inserted,
  (select count(*) from del)  as deleted_extras;
```

Notas:
- Cambiar el bloque `values (...)` en `cargas` con las cargas reales por remisión: `(1, CARGA 1)`, `(2, CARGA 2)`, `(3, CARGA 3)`, `(4, CARGA 4)` según existan.
- Ajustar `:UNIDAD` y `:VALOR_EDAD` desde el CSV: si `Edad (DÍA / HORA) = HORA` usar `'HORA'` y horas; si es `DÍA` usar `'DÍA'` y días.
- El `order by mu.created_at` garantiza que `CARGA 1` vaya a la primera muestra creada, y así sucesivamente.

### Eliminación de muestreo sin cargas
Si una remisión no tiene ninguna carga en el CSV, eliminar el muestreo y sus dependencias:

```sql
with sel as (
  select m.id as muestreo_id
  from public.muestreos m
  where m.planta = 'P3' and m.manual_reference = :REMISION
  limit 1
), del_ens as (
  delete from public.ensayos e
  where e.muestra_id in (
    select id from public.muestras where muestreo_id in (select muestreo_id from sel)
  ) returning e.id
), del_muestras as (
  delete from public.muestras mu
  where mu.muestreo_id in (select muestreo_id from sel)
  returning mu.id
)
delete from public.muestreos m
where m.id in (select muestreo_id from sel)
returning m.id;
```

### Trabajo por bloques (recomendado)
- Procesar 5–10 remisiones por tanda para acotar errores.
- Para cada remisión del bloque:
  1) Actualizar `concrete_specs` con unidad y valor de edad.
  2) Insertar `ensayos` con la plantilla.
  3) Eliminar muestras sobrantes.
  4) Si no hay cargas, eliminar el muestreo.

### Validaciones y conciliación
Comparar cargas esperadas vs ensayos cargados por remisión.

```sql
-- Ensayos por remisión (desde BD)
select mu.manual_reference as remision,
       count(e.id)          as ensayos_cargados
from public.muestreos mu
left join public.muestras m on m.muestreo_id = mu.id
left join public.ensayos  e on e.muestra_id = m.id
where mu.planta = 'P3'
group by mu.manual_reference
order by mu.manual_reference::int;
```

Si se tiene el CSV en una tabla externa/temporal (opcional), generar un conteo de cargas no nulas por remisión y hacer un `join` para detectar diferencias.

### Checklist rápido
- Identificar remisión en CSV y sus cargas no vacías.
- Determinar `UNIDAD` y `VALOR_EDAD` a partir de CSV.
- Ejecutar plantilla SQL por remisión ajustando cargas y edad.
- Confirmar filas insertadas y muestras sobrantes eliminadas.
- Si no hay cargas, eliminar muestreo.
- Correr validación global del bloque.

### Notas operativas
- `fc` por defecto 350 en `concrete_specs` funciona con el fallback del trigger cuando no hay `recipe_id` en `remisiones`.
- `event_timezone` se fija a `'America/Mexico_City'` para homogeneidad.
- La clave de orden es `muestras.created_at` para respetar el mapeo `CARGA i → muestra i`.


