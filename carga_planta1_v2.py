#!/usr/bin/env python3
"""
Script para carga masiva de muestreos y muestras de Planta 1 (León)
Basado en el archivo: archivoexcel/Carga Silao.csv

FÓRMULAS DE CONVERSIÓN CORRECTAS:
- CUBO 10 X 10: carga_kg = resistencia * 100 (área = 100 cm²)
- VIGA 15x15x50cm: carga_kg = resistencia * 75 (según fórmula del sistema)
"""

import csv
import os
import sys
from datetime import datetime, timedelta, date
from decimal import Decimal
import json

# Configuración de la base de datos
SUPABASE_PROJECT_ID = "pkjqznogflgbnwzkzmpg"
PLANT_ID = "4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad"  # UUID de Planta 1
PLANT_CODE = "P1"

def convertir_fecha_texto(fecha_str):
    """
    Convierte fecha dd/mm/yyyy a objeto date de Python
    """
    if not fecha_str or fecha_str.strip() == '':
        return None
    
    try:
        return datetime.strptime(fecha_str.strip(), '%d/%m/%Y').date()
    except:
        print(f"Error convirtiendo fecha: {fecha_str}")
        return None

def obtener_remision(row):
    """
    Maneja BOM en header de remisión
    """
    remision_key = '\ufeffRemisión' if '\ufeffRemisión' in row else 'Remisión'
    return row[remision_key].strip() if row[remision_key] else ''

def obtener_valor_numerico_o_null(valor):
    """
    Convierte a float o retorna None para SQL NULL
    """
    if not valor or valor.strip() == '':
        return None
    try:
        return float(valor.strip())
    except:
        return None

def calcular_carga_kg(tipo_muestra, resistencia_str):
    """
    Calcula carga en kg desde resistencia kg/cm²
    FÓRMULAS CORRECTAS:
    - CUBO 10 X 10: carga = resistencia * 100 cm²
    - VIGA 15x15x50: carga = resistencia * 75 (según fórmula del sistema)
    """
    if not resistencia_str or resistencia_str.strip() == '':
        return None
    
    try:
        resistencia = float(resistencia_str.strip())
        
        if "CUBO 10 X 10" in tipo_muestra.upper():
            return resistencia * 100  # Área cubo 10x10 = 100 cm²
        elif "VIGA" in tipo_muestra.upper():
            return resistencia * 75   # Factor correcto según fórmula del sistema
        
        return None
    except:
        print(f"Error calculando carga: {tipo_muestra}, {resistencia_str}")
        return None

def generar_sql_muestreos(rows):
    """
    Genera SQL para insertar muestreos con manejo correcto de NULL
    """
    muestreos_sql = []
    
    for row in rows:
        remision = obtener_remision(row)
        fecha_muestreo = convertir_fecha_texto(row['Fecha de muestreo'])
        
        if not remision or not fecha_muestreo:
            print(f"Saltando fila con datos incompletos: {remision}, {row['Fecha de muestreo']}")
            continue
        
        # Manejar datos que pueden ser NULL
        revenimiento = obtener_valor_numerico_o_null(row['Revenimiento'])
        masa_unitaria = obtener_valor_numerico_o_null(row['Masa Unitaria'])
        temp_ambiente = obtener_valor_numerico_o_null(row['Temperatura Ambiente'])
        temp_concreto = obtener_valor_numerico_o_null(row['Temperatura Concreto'])
        
        # Generar timestamp
        fecha_ts = f"{fecha_muestreo} 08:00:00"
        
        # Generar SQL con NULLs apropiados
        sql_values = f"('{remision}', 'P1', '{fecha_muestreo}', '{fecha_ts}', '08:00:00', "
        sql_values += f"{revenimiento if revenimiento is not None else 'NULL'}, "
        sql_values += f"{masa_unitaria if masa_unitaria is not None else 'NULL'}, "
        sql_values += f"{temp_ambiente if temp_ambiente is not None else 'NULL'}, "
        sql_values += f"{temp_concreto if temp_concreto is not None else 'NULL'}, "
        sql_values += f"'REMISION_LINKED', 'SYNCED', '{PLANT_ID}', 'America/Mexico_City', now(), now())"
        
        muestreos_sql.append(sql_values)
    
    return muestreos_sql

def generar_sql_muestras(rows):
    """
    Genera SQL para muestras siguiendo lógica EDAD → MUESTRA
    """
    muestras_sql = []
    
    for row in rows:
        remision = obtener_remision(row)
        fecha_muestreo = convertir_fecha_texto(row['Fecha de muestreo'])
        
        if not remision or not fecha_muestreo:
            continue
        
        # Procesar cada edad posible
        for i in range(1, 5):
            edad_key = f'EDAD {i}' if i < 4 else 'EDAD 4 '  # EDAD 4 tiene espacio
            tipo_key = f'Tipo de muestra {i}'
            res_key = f'RESISTENCIA {i}'
            
            edad_str = row.get(edad_key, '').strip()
            tipo_muestra = row.get(tipo_key, '').strip()
            resistencia_str = row.get(res_key, '').strip()
            
            # Solo crear muestra si hay EDAD
            if edad_str and tipo_muestra:
                try:
                    edad_dias = int(edad_str)
                    fecha_ensayo = fecha_muestreo + timedelta(days=edad_dias)
                    
                    # Estado según disponibilidad de resistencia
                    estado = 'ENSAYADO' if resistencia_str else 'PENDIENTE'
                    
                    # Simplificar tipo de muestra para BD (máximo 10 caracteres)
                    tipo_bd = 'CUBO' if 'CUBO' in tipo_muestra else 'VIGA'
                    
                    # Generar timestamp
                    fecha_ensayo_ts = f"{fecha_ensayo} 08:00:00"
                    
                    sql_values = f"('{remision}', 'M{i}', '{tipo_bd}', '{fecha_ensayo}', "
                    sql_values += f"'{fecha_ensayo_ts}', '{estado}', '{PLANT_ID}', "
                    sql_values += f"'America/Mexico_City')"
                    
                    muestras_sql.append(sql_values)
                    
                except ValueError:
                    print(f"Error procesando edad: {edad_str} para remisión {remision}")
                    continue
    
    return muestras_sql

def generar_sql_ensayos(rows):
    """
    Genera SQL para ensayos con cálculo RESISTENCIA → CARGA
    """
    ensayos_sql = []
    
    for row in rows:
        remision = obtener_remision(row)
        fecha_muestreo = convertir_fecha_texto(row['Fecha de muestreo'])
        
        if not remision or not fecha_muestreo:
            continue
        
        # Procesar cada resistencia disponible
        for i in range(1, 5):
            edad_key = f'EDAD {i}' if i < 4 else 'EDAD 4 '
            tipo_key = f'Tipo de muestra {i}'
            res_key = f'RESISTENCIA {i}'
            
            edad_str = row.get(edad_key, '').strip()
            tipo_muestra = row.get(tipo_key, '').strip()
            resistencia_str = row.get(res_key, '').strip()
            
            # Solo crear ensayo si hay EDAD, TIPO y RESISTENCIA
            if edad_str and tipo_muestra and resistencia_str:
                try:
                    edad_dias = int(edad_str)
                    fecha_ensayo = fecha_muestreo + timedelta(days=edad_dias)
                    
                    # Calcular carga desde resistencia
                    carga_kg = calcular_carga_kg(tipo_muestra, resistencia_str)
                    
                    if carga_kg:
                        # Generar timestamp
                        fecha_ensayo_ts = f"{fecha_ensayo} 08:00:00"
                        
                        sql_values = f"('{remision}', 'M{i}', '{fecha_ensayo}', "
                        sql_values += f"'{fecha_ensayo_ts}', {carga_kg}, '{PLANT_ID}', "
                        sql_values += f"'America/Mexico_City')"
                        
                        ensayos_sql.append(sql_values)
                        
                except ValueError:
                    print(f"Error procesando datos para remisión {remision}, muestra {i}")
                    continue
    
    return ensayos_sql

def procesar_csv_planta1():
    """
    Procesa el CSV de Planta 1 y genera SQL
    """
    archivo_csv = "../archivoexcel/Carga Silao.csv"
    
    if not os.path.exists(archivo_csv):
        print(f"❌ Error: No se encontró el archivo {archivo_csv}")
        return
    
    print("🚀 Iniciando procesamiento de Carga Silao.csv...")
    
    try:
        with open(archivo_csv, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            rows = list(reader)
            
        print(f"📊 Total de filas leídas: {len(rows)}")
        
        # Generar SQL para cada tipo
        print("🔄 Generando SQL para muestreos...")
        muestreos_sql = generar_sql_muestreos(rows)
        
        print("🔄 Generando SQL para muestras...")
        muestras_sql = generar_sql_muestras(rows)
        
        print("🔄 Generando SQL para ensayos...")
        ensayos_sql = generar_sql_ensayos(rows)
        
        print(f"📈 Estadísticas generadas:")
        print(f"  - Muestreos: {len(muestreos_sql)}")
        print(f"  - Muestras: {len(muestras_sql)}")
        print(f"  - Ensayos: {len(ensayos_sql)}")
        
        # Crear archivo SQL
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        archivo_sql = f"carga_planta1_{timestamp}.sql"
        
        with open(archivo_sql, 'w', encoding='utf-8') as f:
            f.write("-- Carga masiva Planta 1 (León) - Generado automáticamente\n")
            f.write(f"-- Archivo fuente: Carga Silao.csv\n")
            f.write(f"-- Fecha: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write("-- FÓRMULAS USADAS:\n")
            f.write("-- CUBO 10x10: carga_kg = resistencia * 100\n")
            f.write("-- VIGA 15x15x50: carga_kg = resistencia * 75\n\n")
            
            # Muestreos
            if muestreos_sql:
                f.write("-- ========================================\n")
                f.write("-- PASO 1: MUESTREOS\n")
                f.write("-- ========================================\n")
                f.write("INSERT INTO public.muestreos (\n")
                f.write("  manual_reference, planta, fecha_muestreo, fecha_muestreo_ts, hora_muestreo,\n")
                f.write("  revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,\n")
                f.write("  sampling_type, sync_status, plant_id, event_timezone,\n")
                f.write("  created_at, updated_at\n")
                f.write(") VALUES\n")
                f.write(",\n".join(muestreos_sql))
                f.write(";\n\n")
            
            # Muestras
            if muestras_sql:
                f.write("-- ========================================\n")
                f.write("-- PASO 2: MUESTRAS\n")
                f.write("-- ========================================\n")
                f.write("INSERT INTO public.muestras (\n")
                f.write("  muestreo_id, identificacion, tipo_muestra, fecha_programada_ensayo,\n")
                f.write("  fecha_programada_ensayo_ts, estado, plant_id, event_timezone,\n")
                f.write("  created_at, updated_at\n")
                f.write(")\n")
                f.write("SELECT \n")
                f.write("  m.id as muestreo_id,\n")
                f.write("  datos.identificacion,\n")
                f.write("  datos.tipo_muestra,\n")
                f.write("  datos.fecha_programada_ensayo::date,\n")
                f.write("  datos.fecha_programada_ensayo_ts::timestamptz,\n")
                f.write("  datos.estado,\n")
                f.write("  datos.plant_id::uuid,\n")
                f.write("  datos.event_timezone,\n")
                f.write("  now() as created_at,\n")
                f.write("  now() as updated_at\n")
                f.write("FROM (\n")
                f.write("  VALUES\n")
                f.write(",\n".join([f"    {sql}" for sql in muestras_sql]))
                f.write("\n) AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)\n")
                f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P1';\n\n")
            
            # Ensayos
            if ensayos_sql:
                f.write("-- ========================================\n")
                f.write("-- PASO 3: ENSAYOS\n")
                f.write("-- ========================================\n")
                f.write("INSERT INTO public.ensayos (\n")
                f.write("  muestra_id, fecha_ensayo, fecha_ensayo_ts, carga_kg,\n")
                f.write("  plant_id, event_timezone, created_at, updated_at\n")
                f.write(")\n")
                f.write("SELECT \n")
                f.write("  mu.id as muestra_id,\n")
                f.write("  datos.fecha_ensayo::date,\n")
                f.write("  datos.fecha_ensayo_ts::timestamptz,\n")
                f.write("  datos.carga_kg::numeric,\n")
                f.write("  datos.plant_id::uuid,\n")
                f.write("  datos.event_timezone,\n")
                f.write("  now() as created_at,\n")
                f.write("  now() as updated_at\n")
                f.write("FROM (\n")
                f.write("  VALUES\n")
                f.write(",\n".join([f"    {sql}" for sql in ensayos_sql]))
                f.write("\n) AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)\n")
                f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P1'\n")
                f.write("JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;\n\n")
        
        print(f"✅ Archivo SQL generado: {archivo_sql}")
        print(f"📄 Tamaño del archivo: {os.path.getsize(archivo_sql)} bytes")
        
        # Mostrar algunas estadísticas
        print("\n📊 VERIFICACIÓN DE CONVERSIONES:")
        print("Ejemplos de conversión RESISTENCIA → CARGA:")
        
        # Mostrar algunos ejemplos
        ejemplos_mostrados = 0
        for row in rows[:5]:  # Primeros 5 ejemplos
            remision = obtener_remision(row)
            for i in range(1, 3):  # Solo M1 y M2
                tipo_key = f'Tipo de muestra {i}'
                res_key = f'RESISTENCIA {i}'
                
                tipo_muestra = row.get(tipo_key, '').strip()
                resistencia_str = row.get(res_key, '').strip()
                
                if tipo_muestra and resistencia_str:
                    carga_kg = calcular_carga_kg(tipo_muestra, resistencia_str)
                    if carga_kg:
                        print(f"  {remision} M{i}: {resistencia_str} kg/cm² → {carga_kg} kg ({tipo_muestra})")
                        ejemplos_mostrados += 1
                        if ejemplos_mostrados >= 5:
                            break
            if ejemplos_mostrados >= 5:
                break
                
    except Exception as e:
        print(f"❌ Error procesando archivo: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    procesar_csv_planta1()