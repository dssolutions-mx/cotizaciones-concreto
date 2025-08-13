## Guía de alta masiva de muestreos (Planta 3)

### Contexto
- Proyecto: `cotizador` (Supabase)
- Tablas involucradas: `public.muestreos`, `public.muestras`, `public.remisiones` (opcional), `public.plants`
- Planta: "Planta 3" corresponde a `plants.code = P003`
  - `plant_id` de P003: `baf175a7-fcf7-4e71-b18f-e952d8802129`
- Página/función: alta en "Nuevo Muestreo" (crea 1 registro en `muestreos` y N en `muestras`)

### Esquema relevante (campos usados)
- `muestreos`
  - `fecha_muestreo` (date)
  - `hora_muestreo` (time, nullable)
  - `planta` (varchar: 'P1'|'P2'|'P3'|'P4')
  - `plant_id` (uuid → `plants.id`)
  - `revenimiento_sitio` (numeric)
  - `masa_unitaria` (numeric)
  - `temperatura_ambiente` (numeric)
  - `temperatura_concreto` (numeric)
  - `sampling_type` (varchar: 'REMISION_LINKED'|'STANDALONE'|'PROVISIONAL')
  - `manual_reference` (varchar)
  - `concrete_specs` (jsonb) → se guarda `clasificacion`, `unidad_edad`, `valor_edad`
  - `sampling_notes` (text, opcional)
- `muestras`
  - `muestreo_id` (uuid → `muestreos.id`)
  - `tipo_muestra` ('CILINDRO'|'VIGA'|'CUBO')
  - `identificacion` (varchar)
  - `fecha_programada_ensayo` (date)
  - `estado` ('PENDIENTE'|'ENSAYADO'|'DESCARTADO')
  - `plant_id` (uuid)
  - Dimensiones: `cube_side_cm` (numeric), `diameter_cm` (numeric) según aplique

### Mapeo CSV → BD
CSV columnas (encabezados):
- `Planta` → `muestreos.planta` ('P3') y `muestreos.plant_id` (uuid P003)
- `Número de remisión` → si existe `remisiones` se usa `remision_id`; si no existe, `sampling_type = 'STANDALONE'` y `manual_reference = remisión`
- `Clasificación` → `muestreos.concrete_specs.clasificacion`
- `Edad (DÍA / HORA)` → `muestreos.concrete_specs.unidad_edad` ('DÍA'|'HORA')
- `VALOR EDAD` → `muestreos.concrete_specs.valor_edad` (int)
- `Fecha muestreo` (serial Excel) → `muestreos.fecha_muestreo = date '1899-12-30' + serial`
- `Hora de Muestreo` (texto) → `muestreos.hora_muestreo` si coincide con regex HH:MM; si no, NULL
- `Cantidad de Muestras` → número de filas en `muestras`
- `TIPO DE MUESTRA i` (ej. "CUBO 10 X 10") → `muestras.tipo_muestra = 'CUBO'`, `muestras.cube_side_cm = 10`
- `Revenimiento/Extensibilidad de Muestreo` → `muestreos.revenimiento_sitio`
- `Masa Unitaria` → `muestreos.masa_unitaria`
- `Temperatura ambiente` → `muestreos.temperatura_ambiente`
- `Temperatura del concreto` → `muestreos.temperatura_concreto`
- Columnas `EDAD 1..4` → se ignoran; se usa la edad general del muestreo para programar el ensayo

### Reglas de normalización y validación
- Fecha Excel: `fecha = date '1899-12-30' + excel_serial`
- Hora: válida si coincide con `^[0-2]?[0-9]:[0-5][0-9]$`; si no, `hora_muestreo = NULL` y se documenta en `sampling_notes`
- `temperatura_concreto`: si viene vacía, usar `temperatura_ambiente` como fallback y documentarlo en `sampling_notes`
- `sampling_type`:
  - Si no se encuentra `remisiones.remision_number = Número de remisión` para fecha/planta, usar `STANDALONE` y `manual_reference`
  - Si se cargan `remisiones` después, se puede actualizar `remision_id` posteriormente

### Programación de fecha de ensayo (en `muestras`)
- Si `unidad_edad = 'DÍA'`: `fecha_programada_ensayo = fecha_muestreo + valor_edad días`
- Si `unidad_edad = 'HORA'`: `fecha_programada_ensayo = date((fecha_muestreo::timestamp + valor_edad horas))`
- La hora del ensayo la maneja la app/ops; solo se registra la fecha

### Idempotencia y duplicados
- Para evitar duplicados en cargas repetidas, usar una llave lógica: `(plant_id, manual_reference, fecha_muestreo)`
- Antes de insertar, validar si ya existe un `muestreo` con esos 3 campos

### Estrategia de ejecución por lotes
- Ejecutar en lotes pequeños (p. ej., 10–20 muestreos) y validar conteos de `muestreos` y `muestras`
- Documentar cualquier fallback (horas inválidas, temperatura faltante) en `sampling_notes`

### Plantillas SQL útiles

1) Inserción de muestreos y muestras en bloque a partir de un CTE `src` (valores de ejemplo):

```sql
with plant as (
  select 'baf175a7-fcf7-4e71-b18f-e952d8802129'::uuid as plant_id
),
src(remision_num, clasificacion, unidad_edad, valor_edad, fecha_serial, hora_txt,
    cantidad, tipo_muestra_lbl, cube_cm, revenimiento, masa_unitaria, temp_amb, temp_conc) as (
  values
    (2930,'F''c','DÍA',1,45846,'5:50',3,'CUBO',10,20::numeric,2347.35::numeric,17::numeric,23::numeric)
    -- Agregar más filas aquí
),
ins_m as (
  insert into public.muestreos (
    remision_id, fecha_muestreo, planta, revenimiento_sitio, masa_unitaria, temperatura_ambiente,
    temperatura_concreto, created_by, plant_id, sampling_type, manual_reference, sampling_notes,
    concrete_specs, hora_muestreo
  )
  select
    null,
    (date '1899-12-30' + s.fecha_serial),
    'P3',
    s.revenimiento,
    s.masa_unitaria,
    s.temp_amb,
    coalesce(s.temp_conc, s.temp_amb),
    null,
    plant.plant_id,
    'STANDALONE',
    s.remision_num::text,
    case when s.temp_conc is null then 'Temperatura concreto faltante: se usó temperatura ambiente' else null end,
    jsonb_build_object('clasificacion', s.clasificacion, 'unidad_edad', s.unidad_edad, 'valor_edad', s.valor_edad),
    (case when s.hora_txt ~ '^[0-2]?[0-9]:[0-5][0-9]$' then s.hora_txt::time else null end)
  from src s cross join plant
  returning id, plant_id, manual_reference, fecha_muestreo, concrete_specs
),
ins_samples as (
  insert into public.muestras (
    muestreo_id, tipo_muestra, identificacion, fecha_programada_ensayo, estado, plant_id, cube_side_cm
  )
  select
    m.id,
    'CUBO',
    format('CUBO-%sX%s-%s', 10, 10, gs.idx),
    case
      when (m.concrete_specs->>'unidad_edad') = 'DÍA'
        then (m.fecha_muestreo + ((m.concrete_specs->>'valor_edad')||' days')::interval)::date
      when (m.concrete_specs->>'unidad_edad') = 'HORA'
        then (m.fecha_muestreo::timestamp + ((m.concrete_specs->>'valor_edad')||' hours')::interval)::date
      else (m.fecha_muestreo + interval '0 day')::date
    end,
    'PENDIENTE',
    m.plant_id,
    10
  from ins_m m
  cross join lateral (select generate_series(1,3) as idx) gs
  returning 1
)
select (select count(*) from ins_m) as muestreos_creados,
       (select count(*) from ins_samples) as muestras_creadas;
```

2) Consulta de verificación básica (conteos por día y por remisión manual):

```sql
select fecha_muestreo, count(*) as muestreos, sum(x.cant_muestras) as muestras
from muestreos m
join (
  select muestreo_id, count(*) as cant_muestras from muestras group by muestreo_id
) x on x.muestreo_id = m.id
where m.plant_id = 'baf175a7-fcf7-4e71-b18f-e952d8802129'
group by fecha_muestreo
order by fecha_muestreo;
```

3) Ejemplo de idempotencia (omitir si ya existe registro lógico):

```sql
-- Antes de insertar, filtra las filas de src que NO existen aún
-- usando llave lógica (plant_id, manual_reference, fecha_muestreo)
-- Esto se puede hacer con un left join contra muestreos y conservando solo NULLs.
```

### Decisiones y consideraciones tomadas
- No se encontraron `remisiones` en julio 2025 para P003, por lo que se usó `sampling_type = 'STANDALONE'` y `manual_reference` con el número de remisión
- Cuando faltó `temperatura_concreto` (p. ej., remisión 3287), se utilizó `temperatura_ambiente` como fallback y se dejó nota en `sampling_notes`
- Las columnas `EDAD 1..4` se ignoraron por no existir un campo por muestra en `muestras`; todas las muestras del muestreo se programaron con la edad general
- `hora_muestreo` se carga solo si es HH:MM válida; de lo contrario se deja NULL

### Resultado de la carga realizada (referencia)
- Muestreos creados: 69
- Muestras creadas: 213
- Planta: P003

### Próximos pasos/futuras mejoras
- Si se cargan `remisiones`, agregar script para enlazar `muestreos.remision_id` por `manual_reference` y fecha
- Extender plantilla para manejar también `CILINDRO` y dimensiones de cilindros si aparecen en el CSV
- Generar exportes (CSV/Views) con `muestreo_id`, `manual_reference`, fechas de ensayo y estado


