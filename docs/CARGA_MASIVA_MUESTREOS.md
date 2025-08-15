# 📋 Guía Completa: Carga Masiva de Muestreos y Muestras

## 🎯 Objetivo

Esta guía documenta el proceso completo para realizar cargas masivas de datos de muestreos, muestras y ensayos desde archivos CSV de Excel hacia la base de datos de cotizaciones de concreto.

## 📊 Caso de Estudio: Planta 2

### Archivo Fuente
- **Archivo**: `archivoexcel/Registro P2 Final.csv`
- **Registros**: 52 muestreos
- **Período**: Julio - Agosto 2025

### Estructura del CSV
```csv
Planta,Número de remisión,Clasificación,Fecha muestreo,Hora de Muestreo,Cantidad de Muestras,
TIPO DE MUESTRA 1,TIPO DE MUESTRA 2,TIPO DE MUESTRA 3,TIPO DE MUESTRA 4,
Revenimiento/Extensibilidad de Muestreo,Masa Unitaria,Temperatura ambiente,Temperatura del concreto,
EDAD 1,EDAD 2,EDAD 3,EDAD 4,CARGA 1 (KG),CARGA 2 (KG),CARGA 3 (KG),CARGA 4 (KG)
```

## 🧠 Lógica de Mapeo Implementada

### Mapeo Principal: EDAD → MUESTRA → CARGA
```
EDAD 1 → M1 → CARGA 1
EDAD 2 → M2 → CARGA 2  
EDAD 3 → M3 → CARGA 3
EDAD 4 → M4 → CARGA 4
```

### Reglas de Negocio

#### ✅ Creación de Muestras
- **Solo se crean muestras** donde la columna EDAD tiene un valor
- **No se crean muestras** para edades vacías
- **Fecha de ensayo** = `fecha_muestreo + edad_dias`

#### ✅ Estados de Muestras
- **ENSAYADO**: Muestra tiene carga asignada
- **PENDIENTE**: Muestra sin carga (aún no ensayada)

#### ✅ Creación de Ensayos
- **Solo se crean ensayos** donde existe una CARGA
- **No se crean ensayos** para muestras sin carga

### Ejemplos Prácticos

#### Ejemplo 1: Remisión 7880
```csv
EDAD1=7, EDAD2=14, EDAD3=28, EDAD4=28
CARGA1=43910, CARGA2=46580, CARGA3=vacío, CARGA4=vacío
```

**Resultado:**
- ✅ 4 muestras creadas (M1, M2, M3, M4)
- ✅ 2 ensayos creados (M1, M2)
- ✅ M1, M2: ENSAYADO
- ✅ M3, M4: PENDIENTE

#### Ejemplo 2: Remisión 7969
```csv
EDAD1=3, EDAD2=3, EDAD3=vacío, EDAD4=vacío
CARGA1=43500, CARGA2=43500, CARGA3=vacío, CARGA4=vacío
```

**Resultado:**
- ✅ 2 muestras creadas (M1, M2)
- ✅ 2 ensayos creados (M1, M2)
- ✅ M1, M2: ENSAYADO

#### Ejemplo 3: Remisión 8691
```csv
EDAD1=1, EDAD2=vacío, EDAD3=vacío, EDAD4=vacío
CARGA1=30627, CARGA2=vacío, CARGA3=vacío, CARGA4=vacío
```

**Resultado:**
- ✅ 1 muestra creada (M1)
- ✅ 1 ensayo creado (M1)
- ✅ M1: ENSAYADO

## 🛠️ Implementación Técnica

### 1. Script de Procesamiento Python

**Archivo**: `scripts/carga_planta2.py`

#### Funciones Clave

##### Conversión de Fechas Excel
```python
def convertir_fecha_excel(numero_serial):
    """
    Convierte número serial de Excel a fecha Python
    Excel cuenta desde 1900-01-01 (con bug del año bisiesto 1900)
    """
    if not numero_serial or numero_serial == '':
        return None
    
    try:
        # Excel usa 1900-01-01 como día 1, pero tiene bug del año bisiesto
        fecha_base = datetime(1899, 12, 30)  # Ajuste por el bug
        fecha = fecha_base + timedelta(days=float(numero_serial))
        return fecha.date()
    except:
        return None
```

##### Conversión de Horas Decimales
```python
def convertir_hora_decimal(hora_decimal):
    """
    Convierte hora decimal de Excel a formato TIME
    Ej: 0.527777778 → 12:40:00
    """
    if not hora_decimal or hora_decimal == '':
        return None
    
    try:
        # Convertir decimal a segundos del día
        segundos_totales = float(hora_decimal) * 24 * 60 * 60
        horas = int(segundos_totales // 3600)
        minutos = int((segundos_totales % 3600) // 60)
        segundos = int(segundos_totales % 60)
        
        return f"{horas:02d}:{minutos:02d}:{segundos:02d}"
    except:
        return None
```

##### Procesamiento Principal
```python
def procesar_csv_planta2():
    """
    Procesa el CSV y genera SQL para muestreos, muestras y ensayos
    """
    # 1. Leer y validar CSV
    # 2. Convertir fechas y horas
    # 3. Generar SQL para muestreos
    # 4. Generar SQL para muestras (según lógica EDAD)
    # 5. Generar SQL para ensayos (según CARGA disponible)
    # 6. Crear archivo SQL completo
```

### 2. Estructura SQL Generada

#### Paso 1: Muestreos
```sql
INSERT INTO public.muestreos (
  manual_reference, planta, fecha_muestreo, fecha_muestreo_ts, hora_muestreo,
  revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,
  sampling_type, sync_status, plant_id, event_timezone,
  created_at, updated_at
) VALUES
  ('7880', 'P2', '2025-07-07', '2025-07-07 12:40:00', '12:40:00', 23.0, 2327.21, 24.0, 31.0, 'REMISION_LINKED', 'SYNCED', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City', now(), now());
```

#### Paso 2: Muestras
```sql
INSERT INTO public.muestras (
  muestreo_id, identificacion, tipo_muestra, fecha_programada_ensayo,
  fecha_programada_ensayo_ts, estado, plant_id, event_timezone,
  created_at, updated_at
)
SELECT 
  m.id as muestreo_id,
  datos.identificacion,
  datos.tipo_muestra,
  datos.fecha_programada_ensayo::date,
  datos.fecha_programada_ensayo_ts::timestamptz,
  datos.estado,
  datos.plant_id::uuid,
  datos.event_timezone,
  now() as created_at,
  now() as updated_at
FROM (
  VALUES
    ('7880', 'M1', 'CUBO', '2025-07-14', '2025-07-14 08:00:00', 'ENSAYADO', '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City')
) AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2';
```

#### Paso 3: Ensayos
```sql
INSERT INTO public.ensayos (
  muestra_id, fecha_ensayo, fecha_ensayo_ts, carga_kg,
  plant_id, event_timezone, created_at, updated_at
)
SELECT 
  mu.id as muestra_id,
  datos.fecha_ensayo::date,
  datos.fecha_ensayo_ts::timestamptz,
  datos.carga_kg::numeric,
  datos.plant_id::uuid,
  datos.event_timezone,
  now() as created_at,
  now() as updated_at
FROM (
  VALUES
    ('7880', 'M1', '2025-07-14', '2025-07-14 08:00:00', 43910.0, '836cbbcf-67b2-4534-97cc-b83e71722ff7', 'America/Mexico_City')
) AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)
JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2'
JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;
```

## 🚀 Proceso de Ejecución

### 1. Preparación
```bash
cd scripts
python carga_planta2.py
```

### 2. Ejecución de Migraciones
Se ejecutan las siguientes migraciones en orden:

1. **Muestreos**: `carga_masiva_planta_2_muestreos_muestras`
2. **Muestras Parte 1**: `carga_masiva_planta_2_muestras_parte_1_corregido`
3. **Muestras Restantes**: `carga_masiva_planta_2_muestras_restantes`
4. **Muestras Finales**: `carga_masiva_planta_2_muestras_finales`
5. **Ensayos Parte 1**: `carga_masiva_planta_2_ensayos_parte_1`
6. **Ensayos Finales**: `carga_masiva_planta_2_ensayos_finales`

### 3. Verificación
```sql
-- Verificar muestreos creados
SELECT 'Muestreos P2' as tabla, COUNT(*) as total
FROM public.muestreos 
WHERE planta = 'P2' AND DATE(created_at) = CURRENT_DATE;

-- Verificar muestras por estado
SELECT 
  'Muestras P2' as tabla,
  estado,
  COUNT(*) as total
FROM public.muestras mu
JOIN public.muestreos m ON m.id = mu.muestreo_id
WHERE m.planta = 'P2' AND DATE(mu.created_at) = CURRENT_DATE
GROUP BY estado;

-- Verificar ensayos creados
SELECT 'Ensayos P2' as tabla, COUNT(*) as total
FROM public.ensayos e
JOIN public.muestras mu ON mu.id = e.muestra_id
JOIN public.muestreos m ON m.id = mu.muestreo_id
WHERE m.planta = 'P2' AND DATE(e.created_at) = CURRENT_DATE;
```

## 📊 Resultados Obtenidos - Planta 2

### ✅ Resumen Final
- **52 Muestreos** creados (100% del CSV)
- **102 Muestras** creadas (según lógica EDAD→MUESTRA)
- **73 Ensayos** creados (donde había cargas disponibles)

### 📈 Distribución por Estado
- **73 muestras ENSAYADAS** (con cargas registradas)
- **29 muestras PENDIENTES** (sin cargas disponibles)

## 🔧 Consideraciones Técnicas

### Problemas Encontrados y Soluciones

#### 1. Longitud de Tipo de Muestra
**Problema**: Campo `tipo_muestra` limitado a 10 caracteres
```
ERROR: 22001: value too long for type character varying(10)
```

**Solución**: Simplificar tipos de muestra:
- `CUBO 10 X 10` → `CUBO`
- `CUBO 15 X 15` → `CUBO`
- `CILINDRO 10` → `CILINDRO`

#### 2. Fechas Excel
**Problema**: Excel usa números seriales para fechas (ej: 45845)

**Solución**: Función de conversión considerando el bug de Excel 1900:
```python
fecha_base = datetime(1899, 12, 30)  # Ajuste por el bug
fecha = fecha_base + timedelta(days=float(numero_serial))
```

#### 3. Horas Decimales
**Problema**: Excel usa decimales para horas (ej: 0.527777778)

**Solución**: Conversión a segundos del día:
```python
segundos_totales = float(hora_decimal) * 24 * 60 * 60
```

#### 4. Remisiones Duplicadas
**Problema**: Algunas remisiones aparecen múltiples veces (ej: 8263, 8295, 8308)

**Solución**: El script procesa cada registro individualmente, manteniendo la integridad de los datos.

## 📋 Template para Otras Plantas

### Estructura del Script Base

```python
#!/usr/bin/env python3
"""
Script para carga masiva de muestreos y muestras de Planta X
Basado en el archivo: archivoexcel/Registro PX Final.csv
"""

import csv
import os
import sys
from datetime import datetime, timedelta, date
from decimal import Decimal
import json

# Configuración de la base de datos
SUPABASE_PROJECT_ID = "pkjqznogflgbnwzkzmpg"
PLANT_ID = "UUID_DE_LA_PLANTA"  # Obtener de la base de datos
PLANT_CODE = "PX"

def convertir_fecha_excel(numero_serial):
    # Implementación igual que Planta 2
    pass

def convertir_hora_decimal(hora_decimal):
    # Implementación igual que Planta 2
    pass

def procesar_csv_plantaX():
    """
    Procesa el CSV de Planta X y genera SQL
    """
    archivo_csv = "../archivoexcel/Registro PX Final.csv"
    
    # Adaptar según estructura del CSV de la planta específica
    # Seguir la misma lógica EDAD→MUESTRA→CARGA
    
    pass

if __name__ == "__main__":
    procesar_csv_plantaX()
```

### Pasos para Adaptar a Nueva Planta

1. **Identificar Plant ID**:
   ```sql
   SELECT id, code, name FROM plants WHERE code = 'PX';
   ```

2. **Analizar estructura del CSV**:
   - Verificar columnas de EDAD
   - Verificar columnas de CARGA
   - Verificar tipos de muestra

3. **Adaptar mapeo EDAD→MUESTRA**:
   - Mantener la lógica core
   - Ajustar según particularidades del CSV

4. **Ejecutar y verificar**:
   - Generar SQL
   - Aplicar migraciones
   - Verificar resultados

## 🎯 Mejores Prácticas

### ✅ Validación de Datos
- Siempre validar fechas y horas antes de convertir
- Verificar que las remisiones no existan previamente
- Validar tipos de muestra contra restricciones de BD

### ✅ Manejo de Errores
- Implementar try-catch en conversiones
- Loggear errores para debugging
- Proveer valores por defecto cuando sea apropiado

### ✅ Trazabilidad
- Incluir timestamps de creación
- Marcar origen de datos (archivo fuente)
- Mantener referencias a plant_id

### ✅ Performance
- Usar VALUES con JOIN para inserts masivos
- Dividir cargas grandes en lotes
- Usar transacciones para atomicidad

## 📚 Recursos Adicionales

### Archivos de Referencia
- `scripts/carga_planta2.py` - Script completo
- `scripts/carga_planta2_20250814_193350.sql` - SQL generado
- `archivoexcel/Registro P2 Final.csv` - Datos fuente

### Comandos Útiles
```sql
-- Limpiar datos de prueba
DELETE FROM ensayos WHERE plant_id = 'PLANT_UUID';
DELETE FROM muestras WHERE plant_id = 'PLANT_UUID';
DELETE FROM muestreos WHERE plant_id = 'PLANT_UUID';

-- Verificar integridad
SELECT COUNT(*) FROM muestreos WHERE planta = 'P2';
SELECT COUNT(*) FROM muestras mu JOIN muestreos m ON m.id = mu.muestreo_id WHERE m.planta = 'P2';
SELECT COUNT(*) FROM ensayos e JOIN muestras mu ON mu.id = e.muestra_id JOIN muestreos m ON m.id = mu.muestreo_id WHERE m.planta = 'P2';
```

---

**✨ Esta guía proporciona todo lo necesario para replicar el proceso de carga masiva en cualquier planta del sistema.**
