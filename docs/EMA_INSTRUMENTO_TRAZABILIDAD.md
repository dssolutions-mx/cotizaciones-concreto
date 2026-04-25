# Módulo EMA — Trazabilidad de Instrumentos de Medición

> **Propósito:** Dar cumplimiento a los requisitos de la Entidad Mexicana de Acreditación (EMA). Cada resultado de ensayo debe estar vinculado a los instrumentos calibrados que lo generaron, con un registro inmutable del estado de calibración en el momento del uso.

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Esquema de base de datos](#2-esquema-de-base-de-datos)
3. [Lógica de negocio y triggers](#3-lógica-de-negocio-y-triggers)
4. [Clasificación de instrumentos](#4-clasificación-de-instrumentos)
5. [Máquina de estados del instrumento](#5-máquina-de-estados-del-instrumento)
6. [Trazabilidad en dos niveles](#6-trazabilidad-en-dos-niveles)
7. [Servicios backend](#7-servicios-backend)
8. [API Routes](#8-api-routes)
9. [Páginas UI](#9-páginas-ui)
10. [Componentes reutilizables](#10-componentes-reutilizables)
11. [Integración con calidad (muestreos y ensayos)](#11-integración-con-calidad)
12. [Sistema de notificaciones](#12-sistema-de-notificaciones)
13. [Configuración EMA](#13-configuración-ema)
14. [Permisos por rol](#14-permisos-por-rol)
15. [Flujo completo end-to-end](#15-flujo-completo-end-to-end)
16. [Verificación del sistema](#16-verificación-del-sistema)

---

## 1. Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│                     MÓDULO EMA                                  │
│                                                                 │
│  Modelos de          Instrumentos         Programa de           │
│  instrumento  ────▶  físicos       ────▶  calibraciones         │
│  (templates)         (catálogo)           (calendario)          │
│                           │                     │               │
│                    Paquetes de             Notificaciones        │
│                    equipo                 SendGrid              │
│                           │                                     │
│              ┌────────────┼────────────┐                        │
│              ▼            ▼            ▼                        │
│        Certificados  Verificaciones  Incidentes                 │
│        (ext. EMA)    (internas TC)   + Checklists               │
│                                                                 │
│  ════════════════════════════════════════════════════           │
│                   SNAPSHOTS INMUTABLES                          │
│  muestreo_instrumentos    ensayo_instrumentos                   │
│  (equipo en campo)        (equipo en laboratorio)               │
└─────────────────────────────────────────────────────────────────┘
```

**Stack:** Next.js App Router · Supabase PostgreSQL · RLS · pg_cron · Deno Edge Functions · SendGrid

---

## 2. Esquema de base de datos

### 2.1 `modelos_instrumento` — Plantilla de modelo

Define el tipo y período de calibración por defecto para una familia de instrumentos.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | `gen_random_uuid()` |
| `nombre_modelo` | VARCHAR NOT NULL | Nombre descriptivo del modelo |
| `categoria` | VARCHAR NOT NULL | Categoría libre (ej. "Equipo de compresión") |
| `tipo_defecto` | CHAR(1) CHECK ('A','B','C') | Tipo de instrumento por defecto |
| `periodo_calibracion_dias` | INT NOT NULL | Intervalo de calibración en días |
| `descripcion` | TEXT | Descripción opcional |
| `business_unit_id` | UUID → `business_units` | Alcance de unidad de negocio (NULL = global) |
| `manual_path` | TEXT | Storage path: `instrument-models-docs/` |
| `instrucciones_path` | TEXT | Storage path: `instrument-models-docs/` |
| `documentos_adicionales` | JSONB default `[]` | Array `[{nombre, path}]` |
| `is_active` | BOOLEAN default true | Soft delete |
| `created_by` | UUID → `auth.users` | Auditoría |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auto-gestionados |

---

### 2.2 `instrumentos` — Catálogo de instrumentos físicos

Un registro por cada instrumento físico en planta.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `codigo` | VARCHAR UNIQUE NOT NULL | Código interno (ej. `INS-P001-001`) |
| `nombre` | VARCHAR NOT NULL | Nombre descriptivo |
| `modelo_id` | UUID NOT NULL → `modelos_instrumento` | Template del instrumento |
| `tipo` | CHAR(1) CHECK ('A','B','C') | Tipo de instrumento |
| `plant_id` | UUID NOT NULL → `plants` | Planta propietaria |
| `numero_serie` | VARCHAR | Número de serie fabricante |
| `marca` | VARCHAR | Marca comercial |
| `modelo_comercial` | VARCHAR | Modelo comercial |
| `instrumento_maestro_id` | UUID → `instrumentos` | Solo Tipo C: instrumento Tipo A que lo verifica |
| `periodo_calibracion_dias` | INT | Override del modelo; NULL = usa modelo |
| `estado` | VARCHAR CHECK enum | Estado actual del instrumento |
| `fecha_proximo_evento` | DATE | Próxima calibración/verificación programada |
| `motivo_inactivo` | TEXT | Razón de inactivación |
| `notas` | TEXT | Notas libres |
| `incertidumbre_expandida` | DOUBLE PRECISION NULL | U del patrón en ficha (sincronizada con certificado vigente o manual) |
| `incertidumbre_k` | DOUBLE PRECISION NULL | Factor de cobertura k asociado a U |
| `incertidumbre_unidad` | TEXT NULL | Unidad de U (mm, °C, …) |
| `created_by` | UUID → `auth.users` | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Incertidumbre (NMX-EC-17025-IMNC):** el certificado de calibración conserva U y k en `certificados_calibracion`. Al registrar un certificado vigente, la aplicación copia esos valores a `instrumentos` para cálculos internos (p. ej. cociente TUR orientativo en verificación). El laboratorio sigue siendo la fuente normativa; la ficha permite ajuste manual si hace falta sin reemplazar el PDF.

**Constraints:**
- `chk_tipo_c_necesita_maestro`: Tipo C requiere `instrumento_maestro_id NOT NULL`
- `chk_tipos_ab_sin_maestro`: Tipos A y B deben tener `instrumento_maestro_id IS NULL`

**Índices:**
```sql
idx_instrumentos_plant_estado  ON instrumentos(plant_id, estado)
idx_instrumentos_proximo       ON instrumentos(fecha_proximo_evento)
  WHERE estado NOT IN ('inactivo','en_revision')
```

**Estados válidos:** `vigente` | `proximo_vencer` | `vencido` | `en_revision` | `inactivo`

---

### 2.3 `certificados_calibracion` — Certificados externos (Tipo A/B)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `instrumento_id` | UUID NOT NULL → `instrumentos` | Instrumento calibrado |
| `numero_certificado` | VARCHAR | Número de certificado EMA |
| `laboratorio_externo` | VARCHAR NOT NULL | Nombre del laboratorio acreditado |
| `fecha_emision` | DATE NOT NULL | Fecha de emisión |
| `fecha_vencimiento` | DATE NOT NULL | Fecha de vencimiento |
| `archivo_path` | TEXT NOT NULL | Storage: `calibration-certificates/` |
| `observaciones` | TEXT | |
| `is_vigente` | BOOLEAN default true | Solo el más reciente = true |
| `created_by` | UUID → `auth.users` | |
| `created_at` | TIMESTAMPTZ | |

**Índice:** `idx_certs_instrumento ON (instrumento_id, is_vigente)`

**Campos de incertidumbre (resultados):** `incertidumbre_expandida`, `incertidumbre_unidad`, `factor_cobertura` (k), `rango_medicion`, etc., según el certificado emitido por laboratorio acreditado.

**Trigger al INSERT:**
1. Marca certificados anteriores `is_vigente = false`
2. Actualiza `instrumentos.fecha_proximo_evento = fecha_vencimiento`
3. Recalcula `instrumentos.estado` vía `compute_instrumento_estado()`
4. Crea siguiente entrada en `programa_calibraciones`

---

### 2.4 `verificaciones_internas` — Verificaciones internas (Tipo C)

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `instrumento_id` | UUID NOT NULL → `instrumentos` | Tipo C verificado |
| `instrumento_maestro_id` | UUID NOT NULL → `instrumentos` | Tipo A utilizado |
| `fecha_verificacion` | DATE NOT NULL | Fecha de la verificación |
| `fecha_proxima_verificacion` | DATE NOT NULL | Calculado: fecha + período |
| `resultado` | VARCHAR CHECK ('conforme','no_conforme','condicional') | Resultado |
| `observaciones` | TEXT | |
| `realizado_por` | UUID → `auth.users` | Técnico responsable |
| `created_at` | TIMESTAMPTZ | |

**Trigger al INSERT:**
1. Actualiza `instrumentos.fecha_proximo_evento`
2. Recalcula `instrumentos.estado`
3. Crea siguiente entrada en `programa_calibraciones`
4. Marca entrada anterior como `completado`

---

### 2.4 bis — Metrología ISO / tablas `ema_*` (auditoría y TUR indicativo)

| Tabla | Rol |
|-------|-----|
| `ema_instrumento_calibraciones` | Historial de eventos de calibración (API en `emaMetrologyService`). |
| `ema_verificacion_metrologia` | Una fila por `completed_verificaciones.id` de instrumento **tipo C** (PK = `completed_verificacion_id`): al cerrar la verificación se persiste `tur_min_observado` (indicativo) y metadatos en `presupuesto_json`. |
| `ema_incertidumbre_componentes` | Presupuesto de incertidumbre por verificación o por evento de calibración; reservado para captura detallada futura. |

**Vínculo operativo:** `ensayo_instrumentos.completed_verificacion_id` y `muestreo_instrumentos.completed_verificacion_id` apuntan a la **última verificación interna cerrada** del instrumento tipo C al guardar el snapshot de uso (tipos A/B: `NULL`).

**RLS:** políticas en migración `20260424200000_ema_metrology_rls.sql` (mismo criterio de roles de calidad que el resto del módulo EMA).

---

### 2.5 `programa_calibraciones` — Calendario unificado

Centraliza todos los eventos futuros de calibración/verificación.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `instrumento_id` | UUID NOT NULL → `instrumentos` | |
| `tipo_evento` | VARCHAR CHECK enum | `calibracion_externa` \| `verificacion_interna` \| `verificacion_post_incidente` |
| `fecha_programada` | DATE NOT NULL | Fecha objetivo |
| `estado` | VARCHAR CHECK enum | `pendiente` \| `completado` \| `vencido` \| `cancelado` |
| `certificado_id` | UUID → `certificados_calibracion` | Enlace al certificado completado |
| `verificacion_id` | UUID → `verificaciones_internas` | Enlace a la verificación completada |
| `notif_7dias_enviada` | BOOLEAN default false | Control de notificación |
| `notif_1dia_enviada` | BOOLEAN default false | Control de notificación |
| `roles_notificar` | TEXT[] | Roles que reciben el email |
| `completado_en` | TIMESTAMPTZ | |
| `completado_por` | UUID → `auth.users` | |
| `notas` | TEXT | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Índices:**
```sql
idx_programa_pendiente ON programa_calibraciones(fecha_programada)
  WHERE estado = 'pendiente'

idx_programa_notif ON programa_calibraciones(fecha_programada, notif_7dias_enviada)
  WHERE estado = 'pendiente'
```

---

### 2.6 `paquetes_equipo` — Conjuntos predefinidos

Agrupa instrumentos por tipo de prueba para agilizar el registro.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `nombre` | VARCHAR NOT NULL | Nombre del paquete (ej. "FC-Cilindros") |
| `descripcion` | TEXT | |
| `tipo_prueba` | VARCHAR | Tipo de prueba asociada (ej. `FC_cilindros`) |
| `business_unit_id` | UUID → `business_units` | Alcance BU (NULL = global) |
| `plant_id` | UUID → `plants` | Alcance planta (NULL = aplica a BU) |
| `is_active` | BOOLEAN default true | Soft delete |
| `created_by` | UUID → `auth.users` | |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Constraint:** `chk_paquete_scope`: si hay `plant_id`, debe haber `business_unit_id`

### 2.7 `paquete_instrumentos` — Relación paquete ↔ instrumentos

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `paquete_id` | UUID NOT NULL → `paquetes_equipo` ON DELETE CASCADE | |
| `instrumento_id` | UUID NOT NULL → `instrumentos` | |
| `orden` | INT default 0 | Orden de presentación |
| `is_required` | BOOLEAN default true | Si es obligatorio |

**Unique:** `(paquete_id, instrumento_id)`

---

### 2.8 `muestreo_instrumentos` — Snapshot en muestreo (campo)

> **INMUTABLE.** Una vez insertado nunca se modifica. Representa el estado exacto del instrumento en el momento del muestreo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `muestreo_id` | UUID NOT NULL → `muestreos` ON DELETE RESTRICT | No se puede eliminar muestreo si hay snapshots |
| `instrumento_id` | UUID NOT NULL → `instrumentos` | Sin cascade (registro histórico permanente) |
| `paquete_id` | UUID → `paquetes_equipo` | Si proviene de un paquete |
| `estado_al_momento` | VARCHAR CHECK ('vigente','proximo_vencer','vencido') | **Congelado al momento de uso** |
| `fecha_vencimiento_al_momento` | DATE NOT NULL | **Congelada al momento de uso** |
| `instrumento_maestro_snap_id` | UUID | Snapshot del Tipo A para instrumentos Tipo C |
| `observaciones` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Índices:**
```sql
idx_muestreo_inst_muestreo    ON muestreo_instrumentos(muestreo_id)
idx_muestreo_inst_instrumento ON muestreo_instrumentos(instrumento_id)
```

---

### 2.9 `ensayo_instrumentos` — Snapshot en ensayo (laboratorio)

> **INMUTABLE.** Misma semántica que `muestreo_instrumentos`, para el momento del ensayo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `ensayo_id` | UUID NOT NULL → `ensayos` ON DELETE RESTRICT | |
| `instrumento_id` | UUID NOT NULL → `instrumentos` | |
| `estado_al_momento` | VARCHAR CHECK ('vigente','proximo_vencer','vencido') | |
| `fecha_vencimiento_al_momento` | DATE NOT NULL | |
| `instrumento_maestro_snap_id` | UUID | |
| `observaciones` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

---

### 2.10 `incidentes_instrumento` — Registro de incidentes

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `instrumento_id` | UUID NOT NULL → `instrumentos` | |
| `tipo` | VARCHAR CHECK enum | `dano_fisico` \| `perdida` \| `mal_funcionamiento` \| `desviacion_lectura` \| `otro` |
| `severidad` | VARCHAR CHECK ('baja','media','alta','critica') | |
| `descripcion` | TEXT NOT NULL | |
| `fecha_incidente` | DATE NOT NULL | |
| `reportado_por` | UUID → `auth.users` | |
| `estado` | VARCHAR CHECK ('abierto','en_revision','resuelto','cerrado') | |
| `resolucion` | TEXT | |
| `resuelto_por` | UUID → `auth.users` | |
| `resuelto_en` | TIMESTAMPTZ | |
| `evidencia_paths` | TEXT[] default `{}` | Storage: `instrument-incidents/` |
| `programa_id` | UUID → `programa_calibraciones` | Auto-creado para severidad alta/crítica |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

**Trigger `BEFORE INSERT`** (para poder asignar `programa_id`):
- Si `severidad IN ('alta','critica')`:
  1. Crea entrada urgente en `programa_calibraciones` con `tipo_evento = 'verificacion_post_incidente'` y `fecha_programada = CURRENT_DATE`
  2. Actualiza `instrumentos.estado = 'en_revision'`
  3. Asigna `NEW.programa_id` al ID creado

---

### 2.11 `checklist_instrumento` — Protocolo de inspección

Items definidos completamente en la app (sin seed data). Cada checklist es una instantánea con sus ítems en JSONB.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `instrumento_id` | UUID NOT NULL → `instrumentos` | |
| `tipo_checklist` | VARCHAR CHECK ('recepcion','periodico','post_calibracion','post_incidente') | |
| `fecha_inspeccion` | DATE NOT NULL | |
| `realizado_por` | UUID → `auth.users` | |
| `estado_general` | VARCHAR CHECK ('bueno','regular','malo','fuera_de_servicio') | |
| `items` | JSONB default `[]` | Array: `[{item_nombre, passed: bool, observacion}]` |
| `observaciones_generales` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Índice:** `idx_checklist_instrumento ON (instrumento_id, fecha_inspeccion DESC)`

---

### 2.12 `ema_configuracion` — Configuración singleton

Una sola fila. Controla el comportamiento global del módulo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | UUID PK | |
| `bloquear_vencidos` | BOOLEAN default **false** | Si `true`, bloquea guardado de muestreos/ensayos con instrumentos vencidos |
| `dias_alerta_proximo_vencer` | INT default 7 | Días antes del vencimiento para transición a `proximo_vencer` |
| `roles_notificar_vencimiento` | TEXT[] | Roles que reciben alertas de calibración |
| `updated_by` | UUID → `auth.users` | |
| `updated_at` | TIMESTAMPTZ | |

> **Nota:** El campo `bloquear_vencidos` inicia en `false` durante el período de configuración inicial. Un administrador lo activa manualmente cuando el catálogo de instrumentos está completo.

---

## 3. Lógica de negocio y triggers

### Función auxiliar: `compute_instrumento_estado()`

```sql
CREATE OR REPLACE FUNCTION compute_instrumento_estado(
  fecha_proximo DATE,
  estado_actual VARCHAR,
  dias_alerta INT DEFAULT 7
) RETURNS VARCHAR
```

Regresa:
- `inactivo` / `en_revision` → sin cambio (protegidos)
- `NULL fecha_proximo` → `vigente`
- `fecha_proximo < CURRENT_DATE` → `vencido`
- `fecha_proximo <= CURRENT_DATE + dias_alerta` → `proximo_vencer`
- resto → `vigente`

### Función auxiliar: `get_instrumento_periodo()`

```sql
CREATE OR REPLACE FUNCTION get_instrumento_periodo(p_instrumento_id UUID) RETURNS INT
```

Retorna `instrumentos.periodo_calibracion_dias` si no es NULL, o en su defecto `modelos_instrumento.periodo_calibracion_dias`.

### Trigger 1: `trg_after_certificado` (AFTER INSERT on `certificados_calibracion`)

1. Marca todos los certificados anteriores del instrumento como `is_vigente = false`
2. Actualiza `instrumentos.fecha_proximo_evento = NEW.fecha_vencimiento`
3. Recalcula `instrumentos.estado`
4. Crea entrada en `programa_calibraciones`:
   - `tipo_evento = 'calibracion_externa'`
   - `fecha_programada = NEW.fecha_vencimiento`
5. Marca la entrada anterior del programa como `completado`

### Trigger 2: `trg_after_verificacion` (AFTER INSERT on `verificaciones_internas`)

1. Actualiza `instrumentos.fecha_proximo_evento = NEW.fecha_proxima_verificacion`
2. Recalcula `instrumentos.estado`
3. Crea entrada en `programa_calibraciones`:
   - `tipo_evento = 'verificacion_interna'`
   - `fecha_programada = NEW.fecha_proxima_verificacion`
4. Marca entradas anteriores pendientes del programa como `completado`

### Trigger 3: `trg_incidente_severidad` (BEFORE INSERT on `incidentes_instrumento`)

Para `severidad IN ('alta','critica')`:
1. Cambia `instrumentos.estado = 'en_revision'`
2. Inserta en `programa_calibraciones`:
   - `tipo_evento = 'verificacion_post_incidente'`
   - `fecha_programada = CURRENT_DATE`
3. Asigna `NEW.programa_id` con el ID del programa creado

### pg_cron: Actualización diaria de estados

```sql
SELECT cron.schedule('ema_calibracion_notif', '0 15 * * *',
  $$SELECT net.http_post(
      url := 'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/ema-calibration-reminder',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
  )$$
);
```

Ejecuta diariamente a las **9:00 AM (hora CDMX / UTC-6)**.

---

## 4. Clasificación de instrumentos

| Tipo | Nombre | Calibración | Ejemplo |
|------|--------|-------------|---------|
| **A** | Maestro verificador | Laboratorio externo acreditado EMA | Balanza de precisión, patrón de masa |
| **B** | Externo independiente | Laboratorio externo acreditado EMA | Termómetro de referencia |
| **C** | Trabajo interno | Verificación interna con Tipo A | Cono de Abrams, termómetro de campo, prensa |

**Cadena de trazabilidad EMA:**
```
Laboratorio EMA externo
        │ certifica
        ▼
Instrumento Tipo A (maestro)
        │ verifica
        ▼
Instrumento Tipo C (trabajo)
        │ usa en
        ▼
Muestreo / Ensayo
```

---

## 5. Máquina de estados del instrumento

```
                    ┌─────────────────┐
    nuevo ──────▶   │    vigente      │
                    └────────┬────────┘
                             │  fecha_proximo ≤ hoy + dias_alerta
                             ▼
                    ┌─────────────────┐
                    │ proximo_vencer  │
                    └────────┬────────┘
                             │  fecha_proximo < hoy
                             ▼
                    ┌─────────────────┐
                    │    vencido      │◀──────────────────┐
                    └────────┬────────┘                   │
                             │  nuevo cert/verif          │
                             ▼                            │
                    ┌─────────────────┐                   │
                    │    vigente      │                   │
                    └─────────────────┘                   │
                                                          │
         incidente alta/crítica ──▶  ┌──────────────┐   │
                                     │  en_revision │   │
                                     └──────┬───────┘   │
                                            │  resuelto + cert │
                                            └─────────────────┘
         (cualquier estado) ──▶ inactivo  [admin, permanente]
```

**Transiciones que actualizan el estado:**
- Triggers DB (certificado / verificación INSERT)
- pg_cron diario (para vencimiento por fecha)
- Trigger de incidente (para `en_revision`)

---

## 6. Trazabilidad en dos niveles

### Nivel Muestreo (campo)

Instrumentos registrados **al momento de recolectar muestras en obra**:
- Cono de Abrams (revenimiento)
- Termómetro de campo
- Balanza (masa unitaria)
- Cualquier equipo de medición in situ

Tabla: `muestreo_instrumentos`

### Nivel Ensayo (laboratorio)

Instrumentos registrados **al momento de ensayar cada espécimen en el laboratorio**:
- Prensa de compresión hidráulica
- Prensa de módulo de ruptura
- Vernier / calibrador
- Cualquier equipo de laboratorio

Tabla: `ensayo_instrumentos`

### Inmutabilidad de snapshots

Una vez insertados, **los snapshots NUNCA se modifican**. Si el instrumento es recalibrado después, los registros históricos conservan el estado que tenían al momento del uso.

```
Muestreo 2026-03-01
  └─ INS-P001-001 · estado_al_momento: "vencido" · vence: 2026-02-15
  └─ INS-P001-002 · estado_al_momento: "vigente"  · vence: 2026-09-01

[Luego INS-P001-001 recibe nuevo certificado → estado = "vigente"]

Muestreo 2026-03-01 SIGUE mostrando "vencido" para ese instrumento → correcto para auditoría EMA
```

---

## 7. Servicios backend

### `src/services/emaInstrumentoService.ts`

#### Modelos
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getModelos(params?)` | `ModeloInstrumento[]` | Lista con filtros opcionales |
| `getModeloById(id)` | `ModeloInstrumento \| null` | Detalle completo |
| `createModelo(input, userId)` | `ModeloInstrumento` | Crea nuevo modelo |
| `updateModelo(id, input)` | `ModeloInstrumento` | Actualiza modelo |

#### Instrumentos
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getInstrumentos(params)` | `InstrumentoCard[]` | Lista para grid (con filtros: planta, tipo, estado, categoría) |
| `getInstrumentoById(id)` | `InstrumentoDetalle \| null` | Detalle con historial |
| `createInstrumento(input, userId)` | `Instrumento` | Crea nuevo instrumento |
| `updateInstrumento(id, input)` | `Instrumento` | Actualiza datos |
| `inactivarInstrumento(id, motivo)` | `void` | Soft delete con motivo |

#### Certificados
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getCertificadosByInstrumento(id)` | `CertificadoCalibracion[]` | Historial completo |
| `createCertificado(input, userId)` | `CertificadoCalibracion` | Registra; dispara trigger |

#### Verificaciones
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getVerificacionesByInstrumento(id)` | `VerificacionInterna[]` | Historial |
| `createVerificacion(input, userId)` | `VerificacionInterna` | Registra; dispara trigger |

#### Incidentes
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getIncidentesByInstrumento(id)` | `IncidenteInstrumento[]` | Lista |
| `createIncidente(input, userId)` | `IncidenteInstrumento` | Registra; escalada automática si alta/crítica |
| `resolverIncidente(id, resolucion, userId)` | `IncidenteInstrumento` | Marca como resuelto |

#### Checklists
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getChecklistsByInstrumento(id)` | `ChecklistInstrumento[]` | Historial |
| `createChecklist(input, userId)` | `ChecklistInstrumento` | Registra inspección con ítems JSONB |

#### Paquetes
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getPaquetes(params?)` | `PaqueteConInstrumentos[]` | Lista con instrumentos incluidos |
| `getPaqueteById(id)` | `PaqueteConInstrumentos \| null` | Detalle completo |
| `createPaquete(input, instrumentos, userId)` | `PaqueteConInstrumentos` | Crea paquete con sus instrumentos |

#### Snapshots (integración con calidad)
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `validateInstrumentos(ids[])` | `InstrumentosValidationResult` | Verifica si hay vencidos + respeta `bloquear_vencidos` |
| `saveMuestreoInstrumentos(muestreo_id, list)` | `MuestreoInstrumento[]` | Guarda snapshots de campo |
| `saveEnsayoInstrumentos(ensayo_id, list)` | `EnsayoInstrumento[]` | Guarda snapshots de laboratorio |

#### Trazabilidad
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getInstrumentosByMuestreo(muestreo_id)` | `(MuestreoInstrumento & instrumento)[]` | Equipo usado en un muestreo |
| `getInstrumentosByEnsayo(ensayo_id)` | `(EnsayoInstrumento & instrumento)[]` | Equipo usado en un ensayo |
| `getInstrumentoTrazabilidad(instrumento_id)` | `InstrumentoTrazabilidad` | Vista inversa: muestreos y ensayos del instrumento |

#### Configuración
| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getEmaConfig()` | `EmaConfiguracion` | Lee la fila singleton |
| `updateEmaConfig(input, userId)` | `EmaConfiguracion` | Actualiza configuración global |

---

### `src/services/emaProgramaService.ts`

| Función | Retorna | Descripción |
|---------|---------|-------------|
| `getProgramaCalendar(params)` | `ProgramaCalibracionConInstrumento[]` | Calendario con filtros (planta, BU, fechas, tipo, estado) |
| `getProgramaByInstrumento(id)` | `ProgramaCalibracion[]` | Historial de un instrumento |
| `getPendingUpcoming(plant_id, days=30)` | `ProgramaCalibracionConInstrumento[]` | Widget de próximos eventos |
| `cancelarEventoPrograma(id, notas, userId)` | `ProgramaCalibracion` | Cancela un evento pendiente |
| `runDailyRefresh()` | `{ updated_instrumentos, vencidos_marcados, programa_filas_actualizadas, programa_filas_insertadas }` | Fuerza RPC `ema_refresh_compliance_and_programa` (admin) |
| `getPendingNotif7Dias()` | `ProgramaCalibracionConInstrumento[]` | Para Edge Function |
| `getPendingNotif1Dia()` | `ProgramaCalibracionConInstrumento[]` | Para Edge Function |
| `markNotif7DiasEnviada(ids[])` | `void` | Marca enviado |
| `markNotif1DiaEnviada(ids[])` | `void` | Marca enviado |

---

## 8. API Routes

Todas las rutas están bajo `/api/ema/`. Autenticación requerida en todas.

### Instrumentos

| Ruta | Método | Roles lectura | Roles escritura | Descripción |
|------|--------|---------------|-----------------|-------------|
| `/api/ema/instrumentos` | GET | Todos los quality roles | — | Lista con filtros: `plant_id`, `tipo`, `estado`, `categoria` |
| `/api/ema/instrumentos` | POST | — | PLANT_MANAGER, EXECUTIVE, ADMIN | Crear instrumento |
| `/api/ema/instrumentos/[id]` | GET | Todos | — | Detalle completo |
| `/api/ema/instrumentos/[id]` | PUT | — | Managers | Actualizar / inactivar |
| `/api/ema/instrumentos/[id]/certificados` | GET | Todos | — | Historial de certificados |
| `/api/ema/instrumentos/[id]/certificados` | POST | — | QUALITY_TEAM, LABORATORY, PLANT_MANAGER, EXECUTIVE, ADMIN | Registrar certificado |
| `/api/ema/instrumentos/[id]/verificaciones` | GET | Todos | — | Historial de verificaciones |
| `/api/ema/instrumentos/[id]/verificaciones` | POST | — | QUALITY_TEAM, LABORATORY, PLANT_MANAGER, EXECUTIVE, ADMIN | Registrar verificación |
| `/api/ema/instrumentos/[id]/incidentes` | GET | Todos | — | Lista de incidentes |
| `/api/ema/instrumentos/[id]/incidentes` | POST | — | QUALITY_TEAM, LABORATORY, PLANT_MANAGER, EXECUTIVE, ADMIN | Reportar incidente |
| `/api/ema/instrumentos/[id]/incidentes` | PATCH | — | PLANT_MANAGER, EXECUTIVE, ADMIN | Resolver incidente |
| `/api/ema/instrumentos/[id]/checklists` | GET | Todos | — | Historial checklists |
| `/api/ema/instrumentos/[id]/checklists` | POST | — | QUALITY_TEAM, LABORATORY, PLANT_MANAGER, EXECUTIVE, ADMIN | Registrar checklist |
| `/api/ema/instrumentos/[id]/muestreos` | GET | Todos | — | Trazabilidad completa |

### Modelos

| Ruta | Método | Roles escritura | Descripción |
|------|--------|-----------------|-------------|
| `/api/ema/modelos` | GET | — | Lista de modelos |
| `/api/ema/modelos` | POST | PLANT_MANAGER, EXECUTIVE, ADMIN | Crear modelo |
| `/api/ema/modelos/[id]` | GET | — | Detalle |
| `/api/ema/modelos/[id]` | PUT | PLANT_MANAGER, EXECUTIVE, ADMIN | Actualizar |

### Paquetes

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/ema/paquetes` | GET | Lista con filtros de planta/BU |
| `/api/ema/paquetes` | POST | Crear paquete con instrumentos |
| `/api/ema/paquetes/[id]` | GET | Detalle con instrumentos |
| `/api/ema/paquetes/[id]` | PUT | Actualizar |
| `/api/ema/paquetes/[id]` | DELETE | Soft delete (`is_active = false`) |

### Programa y Configuración

| Ruta | Método | Roles | Descripción |
|------|--------|-------|-------------|
| `/api/ema/programa` | GET | Todos quality roles | Calendario con filtros; `include_gaps=1` devuelve `{ entries, gaps }` (brechas de cumplimiento) |
| `/api/ema/programa` | POST | EXECUTIVE, ADMIN, ADMIN_OPERATIONS | Forzar actualización diaria |
| `/api/ema/admin/schedule-backfill` | POST | EXECUTIVE, ADMIN, ADMIN_OPERATIONS | Carga masiva revisada de `fecha_proximo_evento` + refresh de programa (`{ updates: [{ instrumento_id, fecha_proximo_evento }] }`, máx. 500) |
| `/api/ema/configuracion` | GET | Todos quality roles | Leer configuración singleton |
| `/api/ema/configuracion` | PUT | **EXECUTIVE, ADMIN únicamente** | Actualizar (incluye `bloquear_vencidos`) |

### Snapshots (integración calidad)

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/ema/muestreos/[id]/instrumentos` | GET | Instrumentos usados en muestreo |
| `/api/ema/muestreos/[id]/instrumentos` | POST | Guardar snapshots de campo |
| `/api/ema/ensayos/[id]/instrumentos` | GET | Instrumentos usados en ensayo |
| `/api/ema/ensayos/[id]/instrumentos` | POST | Guardar snapshots de laboratorio |

> **Comportamiento de bloqueo (422):** Si `bloquear_vencidos = true` y algún instrumento seleccionado tiene estado `vencido`, la respuesta es `422 Unprocessable Entity` con lista de instrumentos bloqueantes.

### Validación con Zod

Los endpoints POST/PUT validan el body con esquemas Zod. Ejemplo para crear instrumento:
```typescript
z.object({
  modelo_id:    z.string().uuid(),
  codigo:       z.string().min(1).max(50),
  nombre:       z.string().min(1).max(200),
  tipo:         z.enum(['A','B','C']),
  plant_id:     z.string().uuid(),
  // campos opcionales...
  periodo_calibracion_dias: z.number().int().positive().optional(),
})
```

---

## 9. Páginas UI

### `/quality/instrumentos` — Catálogo principal

**Funcionalidad:**
- Grid de instrumentos agrupados por categoría
- Tarjetas con código, nombre, estado (chip coloreado) y próxima fecha
- Estadísticas rápidas: conteo por estado (vigente / próximo / vencido / en revisión)
- Filtros: estado, tipo, búsqueda por texto
- Acceso rápido a Programa y Paquetes
- Click en tarjeta → detalle del instrumento

**Chips de estado:**
| Estado | Color |
|--------|-------|
| `vigente` | Verde |
| `proximo_vencer` | Amarillo |
| `vencido` | Rojo |
| `en_revision` | Naranja |
| `inactivo` | Gris |

---

### `/quality/instrumentos/nuevo` — Crear instrumento (2 pasos)

**Paso 1: Seleccionar modelo**
- Lista de modelos disponibles con tipo y período
- Acceso rápido a crear un modelo nuevo si no existe
- Selección visual con checkbox

**Paso 2: Datos del instrumento**
- Pre-rellena tipo desde el modelo seleccionado
- Campos: código, nombre, tipo, planta, serie, marca, modelo comercial
- Si Tipo C: selector de instrumento maestro (Tipo A)
- Override opcional del período de calibración
- Notas

---

### `/quality/instrumentos/[id]` — Detalle (5 pestañas)

#### Pestaña: Certificados (default para Tipo A/B)
- Historial de certificados con indicador de vigencia
- Formulario inline: laboratorio, fechas emisión/vencimiento, path de archivo, observaciones

#### Pestaña: Verificaciones (default para Tipo C)
- Historial con resultado (conforme / no conforme / condicional)
- Formulario: selector de instrumento maestro, fecha, resultado, observaciones

#### Pestaña: Incidentes
- Historial con severidad coloreada y estado
- Formulario: tipo, severidad, descripción, fecha
- Advertencia visual al seleccionar alta/crítica (notifica escalada automática)

#### Pestaña: Trazabilidad (Muestreos)
- Contadores: total de muestreos y ensayos con este instrumento
- Lista de últimos 10 muestreos con fecha y estado al momento
- Vista inversa de la cadena de trazabilidad EMA

#### Pestaña: Checklists
- Historial de inspecciones con tipo, estado general, % ítems conformes
- Formulario: tipo, fecha, estado general, lista dinámica de ítems con checkbox pass/fail

---

### `/quality/instrumentos/programa` — Calendario de calibraciones

**Funcionalidad:**
- Lista de eventos pendientes/completados/vencidos agrupados por mes
- Indicadores temporales: "en 7d", "¡Hoy!", "3d vencido"
- Filtros: planta, estado, tipo de evento, rango de fechas
- Click en evento → navega al instrumento
- Estadísticas: conteo por estado

---

### `/quality/modelos` — Catálogo de modelos

- Grid agrupado por categoría
- Chip de tipo (A/B/C) en cada tarjeta
- Período de calibración visible
- Indicador de inactivo

---

### `/quality/modelos/nuevo` — Crear modelo

- Formulario: nombre, categoría, tipo defecto, período (días)
- Descripción opcional
- Paths de manual e instrucciones (Storage)

---

### `/quality/paquetes` — Gestión de paquetes

**Funcionalidad:**
- Grid de paquetes con instrumentos incluidos
- Formulario de creación inline:
  - Nombre, tipo de prueba, descripción
  - Alcance: global / planta específica
  - Buscador de instrumentos (debounced 300ms)
  - Toggle "requerido" por instrumento
  - Soft delete (desactivar)

---

## 10. Componentes reutilizables

### `EquipoUtilizadoPicker`

**Ubicación:** `src/components/quality/muestreos/EquipoUtilizadoPicker.tsx`

**Interfaz:**
```typescript
// Props
interface Props {
  plantId?: string;                                    // Filtra paquetes e instrumentos por planta
  onChange?: (instruments: SelectedInstrumento[]) => void; // Callback opcional
}

// Handle (ref)
interface EquipoUtilizadoPickerHandle {
  getSelected: () => SelectedInstrumento[];
}

// Tipo de instrumento seleccionado
interface SelectedInstrumento {
  instrumento_id: string;
  paquete_id?: string;               // Si se cargó desde un paquete
  nombre: string;
  codigo: string;
  estado_al_momento: 'vigente' | 'proximo_vencer' | 'vencido';
  fecha_vencimiento_al_momento: string;
}
```

**Uso con ref:**
```tsx
const equipoPickerRef = useRef<EquipoUtilizadoPickerHandle>(null);

// En el submit:
const selected = equipoPickerRef.current?.getSelected() ?? [];

// En el JSX:
<EquipoUtilizadoPicker ref={equipoPickerRef} plantId={currentPlant?.id} />
```

**Características:**
- Carga rápida desde paquete predefinido
- Búsqueda debounced por código/nombre (350ms)
- Estado coloreado en resultados de búsqueda
- Advertencia inline si hay instrumentos vencidos
- Limpieza automática del campo de búsqueda al seleccionar

---

## 11. Integración con calidad

### Flujo en nuevo muestreo (`/quality/muestreos/new`)

```
1. Usuario llena el formulario de muestreo (linked o manual)
2. Sección "Equipo utilizado" aparece antes del botón de guardar
3. Usuario busca/carga instrumentos desde paquete
4. Al dar Submit:
   a. createMuestreoWithSamples() → retorna muestreoId
   b. Si hay instrumentos seleccionados:
      POST /api/ema/muestreos/{muestreoId}/instrumentos
        → Si bloquear_vencidos=true y hay vencidos: 422, muestra error
        → Si OK: snapshots guardados inmutablemente
5. Redirect a /quality/muestreos/{muestreoId}
```

### Flujo en registro de ensayo (`EnsayoForm`)

```
1. Usuario llena carga (kg), observaciones, evidencias
2. Sección "Equipo utilizado en el ensayo" (prensa, vernier, etc.)
3. Al dar Submit:
   a. createEnsayo() → retorna ensayo
   b. Si hay instrumentos seleccionados:
      POST /api/ema/ensayos/{ensayo.id}/instrumentos
        → Si bloquear_vencidos=true y hay vencidos: toast de error, no continúa
        → Si OK: snapshots guardados
   c. updateMuestraEstado(muestraId, 'ENSAYADO')
4. Toast de confirmación + callback onSuccess
```

### Prop `plantId` en EnsayoForm

Para cargar instrumentos y paquetes filtrados por planta, se agregó la prop opcional `plantId` a `EnsayoFormProps`. El componente padre debe pasarla.

---

## 12. Sistema de notificaciones

### Edge Function: `ema-calibration-reminder`

**Archivo:** `migrations/supabase/functions/ema-calibration-reminder/index.ts`

**Desplegada en:** `https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/ema-calibration-reminder`

**Sin verificación JWT** (se llama desde pg_cron con `net.http_post`)

**Flujo:**
```
1. Calcular TODAY+7 y TODAY+1

2. Consultar programa_calibraciones donde:
   - estado = 'pendiente'
   - fecha_programada = TODAY+7 AND notif_7dias_enviada = false
   (+ consulta paralela para TODAY+1)

3. Para cada entrada:
   a. Obtener instrumento + planta (join)
   b. Consultar user_profiles con:
      - role IN entry.roles_notificar
      - plant_id IS NULL OR plant_id = instrumento.plant_id
   c. Construir email HTML con:
      - Badge "7 DÍAS" o "¡MAÑANA!"
      - Grid de info: código, nombre, tipo, planta, evento, fecha, estado
      - Botón CTA → /quality/instrumentos/{id}
   d. POST a SendGrid API
   e. Si enviado: marcar notif_Xdias_enviada = true

4. Return: { success: true, emailsSent: N }
```

**Email generado (visual):**
- Header: badge coloreado + título + subtítulo
- Info grid: 7 filas con label/value
- Texto explicativo dinámico (7 días vs mañana)
- Botón "Ver instrumento →"
- Footer: "Generado automáticamente por el sistema EMA"

**Variables de entorno requeridas:**
```
SUPABASE_URL            (default: pkjqznogflgbnwzkzmpg)
SUPABASE_SERVICE_ROLE_KEY
SENDGRID_API_KEY
FRONTEND_URL            (default: https://dcconcretos-hub.com)
```

---

## 13. Configuración EMA

La tabla `ema_configuracion` tiene exactamente **una fila**. Se accede vía:

```
GET  /api/ema/configuracion   → lee la fila
PUT  /api/ema/configuracion   → actualiza (solo EXECUTIVE/ADMIN)
```

### Activar bloqueo de instrumentos vencidos

Cuando el catálogo de instrumentos esté completo:

```bash
# Vía Supabase SQL Editor:
UPDATE ema_configuracion SET bloquear_vencidos = true, updated_at = now();

# O vía UI: EXECUTIVE/ADMIN → Configuración EMA → toggle ON
```

> **Efecto:** Los endpoints `POST /api/ema/muestreos/*/instrumentos` y `POST /api/ema/ensayos/*/instrumentos` rechazarán con 422 si se intenta guardar con instrumentos en estado `vencido`.

### Ajustar días de alerta

```json
PUT /api/ema/configuracion
{ "dias_alerta_proximo_vencer": 14 }
```

Con 14 días, los instrumentos que vencen en menos de 14 días aparecerán en estado `proximo_vencer`.

---

## 14. Permisos por rol

| Acción | LABORATORY | QUALITY_TEAM | PLANT_MANAGER | EXECUTIVE | ADMIN |
|--------|:----------:|:------------:|:-------------:|:---------:|:-----:|
| Ver catálogo de instrumentos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver detalle + historial | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crear / editar instrumentos | ❌ | ❌ | ✅ | ✅ | ✅ |
| Registrar certificados | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registrar verificaciones | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reportar incidentes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Resolver incidentes | ❌ | ❌ | ✅ | ✅ | ✅ |
| Completar checklists | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gestionar paquetes | ❌ | ✅ | ✅ | ✅ | ✅ |
| Crear / editar modelos | ❌ | ❌ | ✅ | ✅ | ✅ |
| Ver programa de calibraciones | ✅ | ✅ | ✅ | ✅ | ✅ |
| Forzar actualización diaria | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Configurar `bloquear_vencidos`** | ❌ | ❌ | ❌ | ✅ | ✅ |
| Registrar equipo en muestreos | ✅ | ✅ | ✅ | ✅ | ✅ |
| Registrar equipo en ensayos | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 15. Flujo completo end-to-end

### Escenario: Calibración de prensa de compresión (Tipo A)

```
1. PLANT_MANAGER crea modelo:
   POST /api/ema/modelos
   { nombre: "Prensa hidráulica FORNEY", categoria: "Compresión", tipo_defecto: "A", periodo_calibracion_dias: 365 }

2. PLANT_MANAGER crea instrumento:
   POST /api/ema/instrumentos
   { modelo_id, codigo: "INS-P001-001", nombre: "Prensa FORNEY P001", tipo: "A", plant_id }
   → Estado inicial: vigente (sin fecha_proximo_evento)

3. QUALITY_TEAM registra certificado externo:
   POST /api/ema/instrumentos/{id}/certificados
   { laboratorio_externo: "CENAM", fecha_emision: "2026-03-01", fecha_vencimiento: "2027-03-01" }
   → Trigger: fecha_proximo_evento = 2027-03-01, estado = vigente
   → Trigger: crea programa_calibraciones entrada para 2027-03-01

4. (8 meses después) pg_cron evalúa:
   fecha_proximo_evento = 2027-03-01
   hoy = 2027-02-22 (< 7 días)
   → estado → proximo_vencer

5. Edge Function envía email "7 DÍAS" a QUALITY_TEAM + PLANT_MANAGER

6. Edge Function envía email "¡MAÑANA!" el 2027-02-28

7. QUALITY_TEAM crea checklist post-calibración:
   POST /api/ema/instrumentos/{id}/checklists
   { tipo_checklist: "post_calibracion", estado_general: "bueno", items: [...] }

8. QUALITY_TEAM registra nuevo certificado:
   → Trigger: estado → vigente, nuevo programa creado para 2028-03-01
```

### Escenario: Trazabilidad de muestreo con equipo

```
1. QUALITY_TEAM abre formulario nuevo muestreo en obra

2. Carga paquete "Site Check" → 3 instrumentos pre-cargados:
   - INS-P001-002 (cono de revenimiento, Tipo C, vigente)
   - INS-P001-003 (termómetro campo, Tipo C, proximo_vencer)
   - INS-P001-004 (balanza, Tipo A, vigente)

3. Guarda el muestreo → ID: muestreo-abc123

4. POST /api/ema/muestreos/muestreo-abc123/instrumentos
   bloquear_vencidos = false → pasa (proximo_vencer permitido)
   → 3 filas en muestreo_instrumentos con estados congelados

5. En laboratorio, LABORATORY registra ensayo de cilindro → ID: ensayo-xyz456

6. Selecciona prensa INS-P001-001 en EnsayoForm
   POST /api/ema/ensayos/ensayo-xyz456/instrumentos
   → 1 fila en ensayo_instrumentos

7. Para auditoría EMA, inspector puede ver:
   GET /api/ema/instrumentos/INS-P001-001/muestreos
   → { instrumento: {...}, muestreos: [muestreo-abc123, ...], ensayos: [ensayo-xyz456, ...] }
```

---

## 16. Verificación del sistema

### Pruebas funcionales clave

| # | Prueba | Resultado esperado |
|---|--------|-------------------|
| 1 | Crear modelo BU-scope + instrumento Tipo A | `estado=vigente`, `fecha_proximo_evento=NULL` |
| 2 | Crear instrumento Tipo C sin `instrumento_maestro_id` | Error de constraint |
| 3 | Crear certificado para Tipo A | `estado` recalculado, nuevo programa creado |
| 4 | Crear verificación para Tipo C | `fecha_proximo_evento` actualizada |
| 5 | Reportar incidente `critica` | `estado='en_revision'`, programa de verificación inmediato |
| 6 | Muestreo con vencido + `bloquear_vencidos=true` | HTTP 422 con lista de instrumentos bloqueantes |
| 7 | Muestreo con vencido + `bloquear_vencidos=false` | Guardado exitoso, snapshot `estado_al_momento='vencido'` |
| 8 | Nuevo certificado post-vencimiento | `estado → vigente` |
| 9 | Ver trazabilidad de instrumento | Lista de muestreos y ensayos históricos |
| 10 | Trigger Edge Function manualmente | `emailsSent > 0`, `notif_*_enviada = true` |

### Storage buckets requeridos (crear en Supabase Dashboard)

| Bucket | Acceso | Uso |
|--------|--------|-----|
| `calibration-certificates` | Privado | PDFs de certificados EMA |
| `instrument-incidents` | Privado | Fotos y evidencias de incidentes |
| `instrument-models-docs` | Privado | Manuales e instrucciones de modelos |

### Activación de pg_cron (verificar)

```sql
-- Verificar que el job esté activo:
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'ema_calibracion_notif';

-- Si no aparece, re-ejecutar:
SELECT cron.schedule('ema_calibracion_notif', '0 15 * * *',
  $$SELECT net.http_post(
      url := 'https://pkjqznogflgbnwzkzmpg.supabase.co/functions/v1/ema-calibration-reminder',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
  )$$
);
```

---

*Documentación generada: 2026-03-25 — Módulo EMA v1.0*
