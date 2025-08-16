#!/usr/bin/env python3
"""
Script para carga masiva de muestreos y muestras de Planta 1 (León)
Basado en el archivo: archivoexcel/Carga Silao.csv

Diferencias clave con Planta 2:
- Usa RESISTENCIAS en lugar de CARGAS directas
- Fechas en formato dd/mm/yyyy en lugar de números seriales Excel
- Tipos de muestra: CUBO 10 X 10, VIGA
- Conversión: Resistencia → Carga usando área de la muestra
"""

import csv
import os
import sys
from datetime import datetime, timedelta, date
from decimal import Decimal
import json

# Configuración de la base de datos
SUPABASE_PROJECT_ID = "pkjqznogflgbnwzkzmpg"
PLANT_ID = "4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad"  # León Planta 1
PLANT_CODE = "P1"

def convertir_fecha_texto(fecha_str):
    """
    Convierte fecha en formato dd/mm/yyyy a fecha Python
    Ej: "02/06/2025" → date(2025, 6, 2)
    """
    if not fecha_str or fecha_str.strip() == '':
        return None
    
    try:
        # Formato dd/mm/yyyy
        fecha = datetime.strptime(fecha_str.strip(), '%d/%m/%Y')
        return fecha.date()
    except:
        return None

def convertir_resistencia_a_carga(resistencia, tipo_muestra):
    """
    Convierte resistencia (kg/cm²) a carga (kg) según el tipo de muestra
    
    Fórmulas:
    - CUBO 10 X 10: Área = 100 cm² → Carga = Resistencia × 100
    - VIGA: Área estimada según dimensiones estándar
    """
    if not resistencia or resistencia == '' or resistencia is None:
        return None
    
    try:
        resistencia_float = float(resistencia)
        
        if 'CUBO' in tipo_muestra.upper():
            # CUBO 10 X 10 = 100 cm²
            return resistencia_float * 100
        elif 'VIGA' in tipo_muestra.upper():
            # VIGA: factor 75 según fórmula del sistema (resistencia = 45 * carga / 3375)
            return resistencia_float * 75
        else:
            # Default: usar área de cubo
            return resistencia_float * 100
            
    except (ValueError, TypeError):
        return None

def limpiar_tipo_muestra(tipo_original):
    """
    Limpia y estandariza el tipo de muestra para cumplir restricciones de BD
    """
    if not tipo_original or tipo_original.strip() == '':
        return 'CUBO'
    
    tipo = tipo_original.strip().upper()
    
    if 'CUBO' in tipo:
        return 'CUBO'
    elif 'VIGA' in tipo:
        return 'VIGA'
    elif 'CILINDRO' in tipo:
        return 'CILINDRO'
    else:
        return 'CUBO'  # Default

def procesar_csv_planta1():
    """
    Procesa el CSV de Planta 1 y genera SQL para muestreos, muestras y ensayos
    Aplica la lógica EDAD→MUESTRA→RESISTENCIA→CARGA
    """
    archivo_csv = "../archivoexcel/Carga Silao.csv"
    
    if not os.path.exists(archivo_csv):
        print(f"Error: No se encontró el archivo {archivo_csv}")
        return
    
    # Generar nombre de archivo SQL con timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archivo_sql = f"carga_planta1_{timestamp}.sql"
    
    muestreos = []
    muestras = []
    ensayos = []
    
    print(f"Procesando archivo: {archivo_csv}")
    
    with open(archivo_csv, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                # Datos básicos del muestreo (manejar BOM en el primer header)
                remision_key = '\ufeffRemisión' if '\ufeffRemisión' in row else 'Remisión'
                remision = row[remision_key].strip() if row[remision_key] else ''
                if not remision:
                    print(f"Fila {row_num}: Remisión vacía, saltando...")
                    continue
                
                # Convertir fecha
                fecha_muestreo = convertir_fecha_texto(row['Fecha de muestreo'])
                if not fecha_muestreo:
                    print(f"Fila {row_num}: Fecha inválida, saltando...")
                    continue
                
                # Datos del muestreo (usar NULL para datos faltantes, NO inventar datos)
                revenimiento = float(row['Revenimiento']) if row['Revenimiento'] and row['Revenimiento'].strip() else None
                masa_unitaria = float(row['Masa Unitaria']) if row['Masa Unitaria'] and row['Masa Unitaria'].strip() else None
                temp_ambiente = float(row['Temperatura Ambiente']) if row['Temperatura Ambiente'] and row['Temperatura Ambiente'].strip() else None
                temp_concreto = float(row['Temperatura Concreto']) if row['Temperatura Concreto'] and row['Temperatura Concreto'].strip() else None
                
                # Crear registro de muestreo
                fecha_ts = f"{fecha_muestreo} 08:00:00"  # Hora por defecto
                
                # Generar SQL con NULL apropiados
                rev_sql = revenimiento if revenimiento is not None else 'NULL'
                masa_sql = masa_unitaria if masa_unitaria is not None else 'NULL'
                temp_amb_sql = temp_ambiente if temp_ambiente is not None else 'NULL'
                temp_conc_sql = temp_concreto if temp_concreto is not None else 'NULL'
                
                muestreo_sql = f"('{remision}', '{PLANT_CODE}', '{fecha_muestreo}', '{fecha_ts}', '08:00:00', {rev_sql}, {masa_sql}, {temp_amb_sql}, {temp_conc_sql}, 'REMISION_LINKED', 'SYNCED', '{PLANT_ID}', 'America/Mexico_City', now(), now())"
                muestreos.append(muestreo_sql)
                
                # Procesar muestras según lógica EDAD→MUESTRA
                edades = [
                    row['EDAD 1'].strip() if row['EDAD 1'] else '',
                    row['EDAD 2'].strip() if row['EDAD 2'] else '',
                    row['EDAD 3'].strip() if row['EDAD 3'] else '',
                    row['EDAD 4 '].strip() if row['EDAD 4 '] else ''  # Nota el espacio en 'EDAD 4 '
                ]
                
                tipos_muestra = [
                    row['Tipo de muestra 1'].strip() if row['Tipo de muestra 1'] else '',
                    row['Tipo de muestra 2'].strip() if row['Tipo de muestra 2'] else '',
                    row['Tipo de muestra 3'].strip() if row['Tipo de muestra 3'] else '',
                    row['Tipo de muestra 4'].strip() if row['Tipo de muestra 4'] else ''
                ]
                
                resistencias = [
                    row['RESISTENCIA 1'].strip() if row['RESISTENCIA 1'] else '',
                    row['RESISTENCIA 2'].strip() if row['RESISTENCIA 2'] else '',
                    row['RESISTENCIA 3'].strip() if row['RESISTENCIA 3'] else '',
                    row['RESISTENCIA 4'].strip() if row['RESISTENCIA 4'] else ''
                ]
                
                # Crear muestras solo donde hay EDAD
                for i in range(4):
                    edad = edades[i]
                    tipo_muestra = tipos_muestra[i]
                    resistencia = resistencias[i]
                    
                    if edad and edad != '':
                        try:
                            edad_dias = int(float(edad))
                            fecha_ensayo = fecha_muestreo + timedelta(days=edad_dias)
                            fecha_ensayo_ts = f"{fecha_ensayo} 08:00:00"
                            
                            identificacion = f"M{i+1}"
                            tipo_limpio = limpiar_tipo_muestra(tipo_muestra)
                            
                            # Determinar estado según si tiene resistencia
                            estado = 'ENSAYADO' if resistencia and resistencia != '' else 'PENDIENTE'
                            
                            muestra_sql = f"('{remision}', '{identificacion}', '{tipo_limpio}', '{fecha_ensayo}', '{fecha_ensayo_ts}', '{estado}', '{PLANT_ID}', 'America/Mexico_City')"
                            muestras.append(muestra_sql)
                            
                            # Crear ensayo si hay resistencia
                            if resistencia and resistencia != '':
                                carga_kg = convertir_resistencia_a_carga(resistencia, tipo_muestra)
                                if carga_kg is not None:
                                    ensayo_sql = f"('{remision}', '{identificacion}', '{fecha_ensayo}', '{fecha_ensayo_ts}', {carga_kg}, '{PLANT_ID}', 'America/Mexico_City')"
                                    ensayos.append(ensayo_sql)
                        
                        except (ValueError, TypeError) as e:
                            print(f"Fila {row_num}, Muestra {i+1}: Error procesando edad '{edad}': {e}")
                            continue
                
            except Exception as e:
                print(f"Error procesando fila {row_num}: {e}")
                continue
    
    # Generar archivo SQL
    print(f"\nGenerando archivo SQL: {archivo_sql}")
    print(f"- Muestreos: {len(muestreos)}")
    print(f"- Muestras: {len(muestras)}")
    print(f"- Ensayos: {len(ensayos)}")
    
    with open(archivo_sql, 'w', encoding='utf-8') as f:
        f.write("-- Carga masiva Planta 1 (León) - Archivo: Carga Silao.csv\n")
        f.write(f"-- Generado: {datetime.now()}\n")
        f.write(f"-- Muestreos: {len(muestreos)}, Muestras: {len(muestras)}, Ensayos: {len(ensayos)}\n\n")
        
        # 1. Muestreos
        if muestreos:
            f.write("-- 1. INSERTAR MUESTREOS\n")
            f.write("INSERT INTO public.muestreos (\n")
            f.write("  manual_reference, planta, fecha_muestreo, fecha_muestreo_ts, hora_muestreo,\n")
            f.write("  revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,\n")
            f.write("  sampling_type, sync_status, plant_id, event_timezone,\n")
            f.write("  created_at, updated_at\n")
            f.write(") VALUES\n")
            f.write(",\n".join(muestreos))
            f.write(";\n\n")
        
        # 2. Muestras
        if muestras:
            f.write("-- 2. INSERTAR MUESTRAS\n")
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
            f.write(",\n".join(muestras))
            f.write("\n) AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)\n")
            f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P1';\n\n")
        
        # 3. Ensayos
        if ensayos:
            f.write("-- 3. INSERTAR ENSAYOS\n")
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
            f.write(",\n".join(ensayos))
            f.write("\n) AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)\n")
            f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P1'\n")
            f.write("JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;\n\n")
    
    print(f"\n✅ Archivo SQL generado exitosamente: {archivo_sql}")
    
    # Mostrar algunos ejemplos de conversión
    print("\n📊 Ejemplos de conversión Resistencia → Carga:")
    ejemplos_mostrados = 0
    for i, ensayo in enumerate(ensayos[:5]):  # Mostrar primeros 5
        try:
            partes = ensayo.strip('()').split(', ')
            remision = partes[0].strip("'")
            muestra = partes[1].strip("'")
            carga = float(partes[4])
            print(f"  - Remisión {remision} {muestra}: {carga:.1f} kg")
            ejemplos_mostrados += 1
        except:
            continue
    
    if ejemplos_mostrados == 0:
        print("  (No se pudieron mostrar ejemplos)")

if __name__ == "__main__":
    procesar_csv_planta1()
