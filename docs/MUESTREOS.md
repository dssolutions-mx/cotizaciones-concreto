## MUESTREOS

Guía operativa para generar muestreos, crear muestras y programar ensayos a partir de archivos CSV, con énfasis en Planta 3. Incluye reglas de mapeo, lógica de edades por muestra (14h/36h/3d), plantillas SQL e indicaciones de validación.

### Objetivo
- Cargar registros en `public.muestreos` desde CSV (uno por remisión/fecha/hora)
- Crear `muestras` asociadas por remisión aplicando la lógica 14h/36h/3d
- Programar `fecha_programada_ensayo(_ts)` respetando edad de muestreo + delta por muestra
- Mantener idempotencia y evitar duplicados en cargas por bloques

### Tablas clave
- `muestreos` (base del muestreo y mediciones de sitio)
  - Campos relevantes: `planta`, `plant_id`, `manual_reference` (remisión), `fecha_muestreo`, `hora_muestreo`, `revenimiento_sitio`, `masa_unitaria`, `temperatura_ambiente`, `temperatura_concreto`, `concrete_specs` (JSONB: `fc`, `unidad_edad`, `valor_edad`), `fecha_muestreo_ts`, `event_timezone`, `sampling_type` ('REMISION_LINKED'|'STANDALONE'|'PROVISIONAL')
- `muestras` (especímenes a ensayar)
  - Campos relevantes: `muestreo_id`, `tipo_muestra` ('CUBO'|'CILINDRO'|'VIGA'), `identificacion`, `fecha_programada_ensayo`, `fecha_programada_ensayo_ts`, `cube_side_cm`/`diameter_cm`, `estado`, `plant_id`, `event_timezone`
- `ensayos` (resultados de laboratorio)
  - Se pueblan en una etapa posterior (ver guía de ensayos)

### Mapeo CSV → BD (Planta 3)
Archivo de ejemplo: `archivoexcel/Planta 3.csv`

- `Planta` → `muestreos.planta` ('P3') y `muestreos.plant_id` (uuid de P003)
- `Número de remisión` → `muestreos.manual_reference` (y `sampling_type='REMISION_LINKED'` si hay remisiones, o `STANDALONE` en su ausencia)
- `Clasificación` → `muestreos.concrete_specs.clasificacion` (opcional)
- `Edad (DÍA / HORA)` → `muestreos.concrete_specs.unidad_edad` ('DÍA'|'HORA')
- `VALOR EDAD` → `muestreos.concrete_specs.valor_edad` (int)
- `Fecha muestreo` (serial Excel) → `muestreos.fecha_muestreo = date '1899-12-30' + serial`
- `Hora de Muestreo` (texto) → `muestreos.hora_muestreo` si tiene formato HH:MM; si no, dejar NULL y anotar en `sampling_notes`
- `Revenimiento/Extensibilidad de Muestreo` → `muestreos.revenimiento_sitio`
- `Masa Unitaria` → `muestreos.masa_unitaria`
- `Temperatura ambiente` → `muestreos.temperatura_ambiente`
- `Temperatura del concreto` → `muestreos.temperatura_concreto` (si falta, se puede usar `temperatura_ambiente` como fallback y documentarlo)
- `TIPO DE MUESTRA i` (p. ej., "CUBO 10 X 10") → `muestras.tipo_muestra='CUBO'` y `muestras.cube_side_cm=10`

### Lógica de edades por muestra (14h/36h/3d)
En el CSV, los últimos indicadores de cada renglón determinan las muestras a crear y su edad de ensayo relativa:

- Secuencia de banderas típicas: valores al final del renglón, p. ej. `..., 0,0,1,1` o `..., 1,1,3`
- Regla:
  - Cada `1` corresponde a una muestra adicional; la primera `1` es 14 horas, la segunda `1` es 36 horas
  - Si aparece un `3`, crear además la muestra de 3 días
  - Zeros implican que no se crea muestra en esa posición

Ejemplos:
- `1,1,3` ⇒ crear 3 muestras: 14 h, 36 h y 3 días
- `0,0,1,1` ⇒ crear 2 muestras: 14 h y 36 h (sin 3 días)

### Programación de fecha de ensayo (por muestra)
- Definir `base_ts = (fecha_muestreo + hora_muestreo) + (valor_edad según unidad_edad)`
- Por cada muestra:
  - 14 h ⇒ `fecha_programada_ensayo_ts = base_ts + 14 horas`
  - 36 h ⇒ `fecha_programada_ensayo_ts = base_ts + 36 horas`
  - 3 d  ⇒ `fecha_programada_ensayo_ts = base_ts + 3 días`
- Persistir también `fecha_programada_ensayo = date(fecha_programada_ensayo_ts)` y `event_timezone = 'America/Mexico_City'`

### Idempotencia y duplicados
- Llave lógica sugerida: `(planta/plants.code, manual_reference, fecha_muestreo_ts)`
- Antes de insertar, validar inexistencia de un `muestreo` con esos valores
- Antes de crear muestras, validar que no existan ya para ese `muestreo_id`

### Procedimiento por bloques (recomendado)
1) Seleccionar 10–20 remisiones del CSV
2) Normalizar `fecha_muestreo` (serial Excel) y `hora_muestreo` (HH:MM)
3) Insertar/actualizar `muestreos` con `concrete_specs` (`fc` por defecto 350 si no se conoce)
4) Derivar `base_ts` y crear `muestras` según banderas (14h/36h/3d)
5) Validar conteos por remisión y por día; corregir anomalías antes de continuar

### Plantilla SQL (universal por bloque)
Reemplazar los valores del CTE `csv` con las filas objetivo del CSV.

```sql
with plant as (
  select id as plant_id from public.plants where code = 'P003' limit 1
), csv as (
  -- remision, fecha_serial_excel, hora_text, unidad_edad, valor_edad, revenimiento, masa, temp_amb, temp_conc, e1, e2, e3, e4
  select * from (values
    ('2954', 45846::int, '23:00', 'HORA', 14::int, 76::numeric, 2393.53::numeric, 23::numeric, 31::numeric, 0::int, 0::int, 1::int, 1::int)
  ) as t(remision, fecha_serial, hora_text, unidad_edad, valor_edad, revenimiento, masa, temp_amb, temp_conc, e1, e2, e3, e4)
), csv_norm as (
  select c.*,
         (date '1899-12-30' + (c.fecha_serial || ' days')::interval)::date as fecha_muestreo,
         case when c.hora_text ~ '^\\d{1,2}:\\d{2}$' then c.hora_text::time else '00:00'::time end as hora_muestreo,
         case when upper(c.unidad_edad) in ('HORA','HORAS') then 'HORA' else 'DÍA' end as unidad_edad_norm,
         ((date '1899-12-30' + (c.fecha_serial || ' days')::interval)::timestamptz
           + case when c.hora_text ~ '^\\d{1,2}:\\d{2}$' then c.hora_text::time else '00:00'::time end) as fecha_muestreo_ts
  from csv c
), ins_muestreos as (
  insert into public.muestreos (
    remision_id, fecha_muestreo, numero_muestreo, planta, revenimiento_sitio, masa_unitaria,
    temperatura_ambiente, temperatura_concreto, plant_id, sampling_type, manual_reference,
    concrete_specs, fecha_muestreo_ts, event_timezone, hora_muestreo
  )
  select null::uuid,
         n.fecha_muestreo,
         n.remision::int,
         'P3',
         n.revenimiento,
         n.masa,
         n.temp_amb,
         n.temp_conc,
         p.plant_id,
         'REMISION_LINKED',
         n.remision,
         jsonb_build_object('fc', 350, 'unidad_edad', n.unidad_edad_norm, 'valor_edad', n.valor_edad),
         n.fecha_muestreo_ts,
         'America/Mexico_City',
         n.hora_muestreo
  from csv_norm n
  cross join plant p
  where not exists (
    select 1 from public.muestreos m
    where m.planta = 'P3' and m.manual_reference = n.remision and m.fecha_muestreo_ts = n.fecha_muestreo_ts
  )
  returning id, manual_reference, fecha_muestreo_ts
), flags as (
  select n.remision, n.fecha_muestreo_ts,
         (case when coalesce(n.e1,0)=1 then 1 else 0 end
        + case when coalesce(n.e2,0)=1 then 1 else 0 end
        + case when coalesce(n.e3,0)=1 then 1 else 0 end
        + case when coalesce(n.e4,0)=1 then 1 else 0 end) as ones_count,
         (case when 3 in (coalesce(n.e1,0), coalesce(n.e2,0), coalesce(n.e3,0), coalesce(n.e4,0)) then true else false end) as has_3d
  from csv_norm n
), plan as (
  select m.id as muestreo_id,
         m.manual_reference as remision,
         m.plant_id,
         case when (m.concrete_specs->>'unidad_edad') = 'HORA'
              then m.fecha_muestreo_ts + make_interval(hours => (m.concrete_specs->>'valor_edad')::int)
              else m.fecha_muestreo_ts + make_interval(days  => (m.concrete_specs->>'valor_edad')::int) end as base_ts,
         f.ones_count,
         f.has_3d
  from ins_muestreos m
  join flags f on f.remision = m.manual_reference and f.fecha_muestreo_ts = m.fecha_muestreo_ts
), sample_rows as (
  select p.muestreo_id, 1 as idx, make_interval(hours => 14) as delta from plan p where p.ones_count >= 1
  union all
  select p.muestreo_id, 2 as idx, make_interval(hours => 36) as delta from plan p where p.ones_count >= 2
  union all
  select p.muestreo_id, 3 as idx, make_interval(days => 3)  as delta from plan p where p.has_3d
), ins_muestras as (
  insert into public.muestras (
    muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo,
    fecha_programada_ensayo_ts, event_timezone, estado, plant_id, cube_side_cm
  )
  select p.muestreo_id,
         'CUBO',
         ('M' || s.idx)::varchar,
         (p.base_ts + s.delta)::date,
         (p.base_ts + s.delta),
         'America/Mexico_City',
         'PENDIENTE',
         p.plant_id,
         10
  from plan p
  join sample_rows s on s.muestreo_id = p.muestreo_id
  where not exists (
    select 1 from public.muestras mu where mu.muestreo_id = p.muestreo_id
  )
)
select (select count(*) from ins_muestreos) as muestreos_insertados,
       (select count(*) from ins_muestras)  as muestras_insertadas;
```

### Validaciones
- Conteo de `muestras` por remisión:

```sql
select mu.manual_reference as remision, count(ms.id) as num_muestras
from public.muestreos mu
left join public.muestras ms on ms.muestreo_id = mu.id
where mu.planta = 'P3'
group by mu.manual_reference
order by mu.manual_reference::int;
```

- Ensayos cargados por remisión (cuando aplique): ver guía `docs/carga_ensayos_planta3.md`

### UI (consulta)
- En `quality/muestreos/[id]` se visualizan los campos: `Revenimiento en Sitio`, `Masa Unitaria`, `Temperatura Ambiente` y `Temperatura del Concreto` desde `public.muestreos`.

### Notas
- Usar bloques pequeños (10–20 remisiones) facilita detectar y corregir problemas a tiempo
- Documentar cualquier fallback (hora inválida, temperatura faltante) en `sampling_notes`
- Mantener `event_timezone` homogéneo (p. ej., `'America/Mexico_City'`)


