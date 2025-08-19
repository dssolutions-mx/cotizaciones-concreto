#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para carga masiva de datos de Planta 5 (P005)
Basado en la metodología exitosa de Planta 1

Archivo fuente: archivoexcel/P5 DATA.csv
"""

import csv
from datetime import datetime, timedelta

# Configuración
PLANT_ID = "8eb389ed-3e6a-4064-b36a-ccfe892c977f"  # P005
PLANT_CODE = "P005"
CSV_FILE = "../archivoexcel/P5 DATA.csv"

def convertir_fecha_texto(fecha_str):
    """Convierte fecha en formato dd/mm/yyyy a formato YYYY-MM-DD"""
    try:
        if not fecha_str or fecha_str.strip() == '':
            return None
        # Parsear dd/mm/yyyy
        fecha_obj = datetime.strptime(fecha_str.strip(), '%d/%m/%Y')
        return fecha_obj.strftime('%Y-%m-%d')
    except:
        return None

def convertir_resistencia_a_carga(resistencia_str, tipo_muestra):
    """
    Convierte resistencia a carga según tipo de muestra
    CUBO: resistencia * 100 (área 100 cm²)
    VIGA: resistencia * 75 (factor del sistema)
    """
    try:
        if not resistencia_str or resistencia_str.strip() == '':
            return None
        
        resistencia_float = float(resistencia_str.strip())
        
        if tipo_muestra == 'CUBO':
            return resistencia_float * 100
        elif tipo_muestra == 'VIGA':
            return resistencia_float * 75
        else:
            return resistencia_float * 100  # Default CUBO
    except:
        return None

def determinar_tipo_muestra_p5(resistencia_valor):
    """
    Determina el tipo de muestra para P5 basado en el rango de resistencia
    Siguiendo patrones observados en otros archivos CSV
    """
    try:
        if not resistencia_valor:
            return 'CUBO'  # Default
        
        resistencia = float(resistencia_valor)
        
        # Rangos típicos observados:
        # CUBO: Resistencias altas (>150 kg/cm²)
        # VIGA: Resistencias bajas (<100 kg/cm²)
        if resistencia < 100:
            return 'VIGA'
        else:
            return 'CUBO'
    except:
        return 'CUBO'  # Default

def procesar_csv_p5():
    """Procesa el archivo CSV de P5 y genera SQL"""
    
    # Leer archivo CSV
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    # Detectar header con BOM
    remision_key = '\ufeffRemisión' if '\ufeffRemisión' in rows[0] else 'Remisión'
    
    # Filtrar filas válidas
    filas_validas = [row for row in rows if row[remision_key].strip()]
    
    print(f"Procesando {len(filas_validas)} muestreos de P5...")
    
    # Generar timestamp para archivo de salida
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f"carga_planta5_{timestamp}.sql"
    
    muestreos_sql = []
    muestras_data = []
    ensayos_data = []
    
    for row in filas_validas:
        remision = row[remision_key].strip()
        fecha_str = row['Fecha'].strip()
        
        # Convertir fecha
        fecha_muestreo = convertir_fecha_texto(fecha_str)
        if not fecha_muestreo:
            print(f"Error: Fecha inválida en remisión {remision}: {fecha_str}")
            continue
        
        # Campos opcionales - manejar como NULL si están vacíos
        revenimiento = row.get('Revenimiento', '').strip()
        masa_unitaria = row.get('Masa Unitaria', '').strip()
        temp_ambiente = row.get('Temperatura Ambiente', '').strip()
        temp_concreto = row.get('Temperatura Concreto', '').strip()
        
        # Convertir a NULL si están vacíos
        revenimiento_sql = f"{float(revenimiento)}" if revenimiento else "NULL"
        masa_unitaria_sql = f"{float(masa_unitaria)}" if masa_unitaria else "NULL"
        temp_ambiente_sql = f"{float(temp_ambiente)}" if temp_ambiente else "NULL"
        temp_concreto_sql = f"{float(temp_concreto)}" if temp_concreto else "NULL"
        
        # Crear SQL para muestreo
        muestreo_sql = f"""('{remision}', '{PLANT_CODE}', '{fecha_muestreo}', '{fecha_muestreo} 08:00:00', '08:00:00', {revenimiento_sql}, {masa_unitaria_sql}, {temp_ambiente_sql}, {temp_concreto_sql}, 'REMISION_LINKED', 'SYNCED', '{PLANT_ID}', 'America/Mexico_City', now(), now())"""
        muestreos_sql.append(muestreo_sql)
        
        # Procesar muestras y ensayos
        for i in range(1, 5):
            edad_str = row.get(f'Edad {i}', '').strip()
            resistencia_str = row.get(f'Resistencia {i}', '').strip()
            
            if edad_str:  # Solo crear muestra si hay edad
                try:
                    edad_dias = int(float(edad_str))
                    fecha_ensayo_obj = datetime.strptime(fecha_muestreo, '%Y-%m-%d') + timedelta(days=edad_dias)
                    fecha_ensayo = fecha_ensayo_obj.strftime('%Y-%m-%d')
                    fecha_ensayo_ts = f"{fecha_ensayo} 08:00:00"
                    
                    # Determinar tipo de muestra basado en resistencia
                    tipo_muestra = determinar_tipo_muestra_p5(resistencia_str)
                    
                    # Estado de la muestra
                    estado = 'ENSAYADO' if resistencia_str else 'PENDIENTE'
                    
                    # Datos de muestra
                    muestra_data = {
                        'remision': remision,
                        'identificacion': f'M{i}',
                        'tipo_muestra': tipo_muestra,
                        'fecha_ensayo': fecha_ensayo,
                        'fecha_ensayo_ts': fecha_ensayo_ts,
                        'estado': estado
                    }
                    muestras_data.append(muestra_data)
                    
                    # Si hay resistencia, crear ensayo
                    if resistencia_str:
                        carga_kg = convertir_resistencia_a_carga(resistencia_str, tipo_muestra)
                        if carga_kg is not None:
                            ensayo_data = {
                                'remision': remision,
                                'identificacion': f'M{i}',
                                'fecha_ensayo': fecha_ensayo,
                                'fecha_ensayo_ts': fecha_ensayo_ts,
                                'carga_kg': carga_kg
                            }
                            ensayos_data.append(ensayo_data)
                
                except Exception as e:
                    print(f"Error procesando muestra {i} de remisión {remision}: {e}")
    
    # Generar archivo SQL
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(f"-- Carga masiva Planta 5 (P005) - Archivo: P5 DATA.csv\n")
        f.write(f"-- Generado: {datetime.now()}\n")
        f.write(f"-- Muestreos: {len(muestreos_sql)}, Muestras: {len(muestras_data)}, Ensayos: {len(ensayos_data)}\n\n")
        
        # 1. MUESTREOS
        f.write("-- 1. INSERTAR MUESTREOS\n")
        f.write("INSERT INTO public.muestreos (\n")
        f.write("  manual_reference, planta, fecha_muestreo, fecha_muestreo_ts, hora_muestreo,\n")
        f.write("  revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,\n")
        f.write("  sampling_type, sync_status, plant_id, event_timezone,\n")
        f.write("  created_at, updated_at\n")
        f.write(") VALUES\n")
        f.write(",\n".join(muestreos_sql) + ";\n\n")
        
        # 2. MUESTRAS
        f.write("-- 2. INSERTAR MUESTRAS\n")
        f.write("INSERT INTO public.muestras (\n")
        f.write("  muestreo_id, identificacion, tipo_muestra, fecha_programada_ensayo,\n")
        f.write("  fecha_programada_ensayo_ts, estado, plant_id, event_timezone,\n")
        f.write("  cube_side_cm, beam_width_cm, beam_height_cm, beam_span_cm,\n")
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
        f.write("  CASE WHEN datos.tipo_muestra = 'CUBO' THEN 10 ELSE NULL END as cube_side_cm,\n")
        f.write("  CASE WHEN datos.tipo_muestra = 'VIGA' THEN 15.0 ELSE NULL END as beam_width_cm,\n")
        f.write("  CASE WHEN datos.tipo_muestra = 'VIGA' THEN 15.0 ELSE NULL END as beam_height_cm,\n")
        f.write("  CASE WHEN datos.tipo_muestra = 'VIGA' THEN 50.0 ELSE NULL END as beam_span_cm,\n")
        f.write("  now() as created_at,\n")
        f.write("  now() as updated_at\n")
        f.write("FROM (\n")
        f.write("  VALUES\n")
        
        muestras_values = []
        for muestra in muestras_data:
            value = f"('{muestra['remision']}', '{muestra['identificacion']}', '{muestra['tipo_muestra']}', '{muestra['fecha_ensayo']}', '{muestra['fecha_ensayo_ts']}', '{muestra['estado']}', '{PLANT_ID}', 'America/Mexico_City')"
            muestras_values.append(value)
        
        f.write(",\n".join(muestras_values))
        f.write("\n) AS datos(manual_reference, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)\n")
        f.write(f"JOIN public.muestreos m ON m.manual_reference = datos.manual_reference AND m.planta = '{PLANT_CODE}';\n\n")
        
        # 3. ENSAYOS
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
        
        ensayos_values = []
        for ensayo in ensayos_data:
            value = f"('{ensayo['remision']}', '{ensayo['identificacion']}', '{ensayo['fecha_ensayo']}', '{ensayo['fecha_ensayo_ts']}', {ensayo['carga_kg']}, '{PLANT_ID}', 'America/Mexico_City')"
            ensayos_values.append(value)
        
        f.write(",\n".join(ensayos_values))
        f.write("\n) AS datos(manual_reference, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)\n")
        f.write(f"JOIN public.muestreos m ON m.manual_reference = datos.manual_reference AND m.planta = '{PLANT_CODE}'\n")
        f.write("JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;\n")
    
    print(f"\n✅ Archivo SQL generado: {output_file}")
    print(f"📊 Resumen:")
    print(f"   - Muestreos: {len(muestreos_sql)}")
    print(f"   - Muestras: {len(muestras_data)}")
    print(f"   - Ensayos: {len(ensayos_data)}")
    
    return output_file

if __name__ == "__main__":
    archivo_sql = procesar_csv_p5()
    print(f"\n🚀 Listo para aplicar: {archivo_sql}")
