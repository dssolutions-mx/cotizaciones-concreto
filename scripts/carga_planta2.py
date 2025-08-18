#!/usr/bin/env python3
"""
Script para carga masiva de muestreos y muestras de Planta 2
Basado en el archivo: archivoexcel/Registro P2 Final.csv

Lógica implementada:
- EDAD1 → M1 → CARGA1
- EDAD2 → M2 → CARGA2  
- EDAD3 → M3 → CARGA3
- EDAD4 → M4 → CARGA4

Solo se crean muestras donde EDAD tiene valor
Solo se crean ensayos donde CARGA tiene valor
"""

import csv
import os
import sys
from datetime import datetime, timedelta, date
from decimal import Decimal
import json

# Configuración de la base de datos
SUPABASE_PROJECT_ID = "pkjqznogflgbnwzkzmpg"
PLANT_P2_ID = "836cbbcf-67b2-4534-97cc-b83e71722ff7"  # Planta 2
PLANT_CODE = "P2"

def convertir_fecha_excel(numero_serial):
    """
    Convierte número serial de Excel a fecha Python
    Excel cuenta desde 1900-01-01 (con bug del año bisiesto 1900)
    """
    if not numero_serial or numero_serial == '':
        return None
    
    try:
        # Excel serial date epoch: 1900-01-01 (pero con bug, cuenta 1900 como bisiesto)
        excel_epoch = datetime(1899, 12, 30)  # Ajuste por el bug de Excel
        fecha = excel_epoch + timedelta(days=float(numero_serial))
        return fecha.date()
    except (ValueError, TypeError):
        print(f"Error convirtiendo fecha Excel: {numero_serial}")
        return None

def convertir_hora_decimal(decimal_hora):
    """
    Convierte hora decimal de Excel a tiempo Python
    0.5 = 12:00:00, 0.527777778 ≈ 12:40:00
    """
    if not decimal_hora or decimal_hora == '':
        return None
        
    try:
        # Convertir decimal a segundos del día
        total_segundos = float(decimal_hora) * 24 * 60 * 60
        horas = int(total_segundos // 3600)
        minutos = int((total_segundos % 3600) // 60)
        segundos = int(total_segundos % 60)
        
        return f"{horas:02d}:{minutos:02d}:{segundos:02d}"
    except (ValueError, TypeError):
        print(f"Error convirtiendo hora decimal: {decimal_hora}")
        return None

def limpiar_valor_numerico(valor):
    """Limpia y convierte valores numéricos, retorna None si está vacío"""
    if not valor or str(valor).strip() == '':
        return None
    try:
        return float(str(valor).strip())
    except (ValueError, TypeError):
        return None

def normalizar_tipo_y_medidas(tipo_original: str):
    """
    Normaliza el tipo de muestra a valores esperados (CUBO, CILINDRO, VIGA)
    y determina medidas asociadas según el texto del CSV.

    Retorna (tipo_normalizado, medidas_dict)
    medidas_dict puede contener:
      - cube_side_cm
      - diameter_cm
      - beam_width_cm, beam_height_cm, beam_span_cm (si se conocen)
    """
    if not tipo_original:
        return "CUBO", {"cube_side_cm": None, "diameter_cm": None,
                         "beam_width_cm": None, "beam_height_cm": None, "beam_span_cm": None}

    texto = tipo_original.strip().upper()

    # CILINDRO
    if "CILINDRO" in texto:
        diametro = 10.0 if "10" in texto else None
        return "CILINDRO", {
            "diameter_cm": diametro,
            "cube_side_cm": None,
            "beam_width_cm": None,
            "beam_height_cm": None,
            "beam_span_cm": None
        }

    # CUBO
    if "CUBO" in texto:
        lado = 15.0 if "15" in texto else (10.0 if "10" in texto else None)
        return "CUBO", {
            "cube_side_cm": lado,
            "diameter_cm": None,
            "beam_width_cm": None,
            "beam_height_cm": None,
            "beam_span_cm": None
        }

    # VIGA
    if "VIGA" in texto:
        # Si no hay medidas provistas en CSV, se dejan nulas (no adivinar)
        return "VIGA", {
            "beam_width_cm": None,
            "beam_height_cm": None,
            "beam_span_cm": None,
            "cube_side_cm": None,
            "diameter_cm": None
        }

    # Predeterminar a CUBO sin medidas si no coincide
    return "CUBO", {"cube_side_cm": None, "diameter_cm": None,
                     "beam_width_cm": None, "beam_height_cm": None, "beam_span_cm": None}

def procesar_csv_planta2():
    """
    Procesa el archivo CSV de Planta 2 y genera SQL para carga masiva
    """
    archivo_csv = "../archivoexcel/Registro P2 Final.csv"
    
    if not os.path.exists(archivo_csv):
        print(f"Error: No se encontró el archivo {archivo_csv}")
        return
    
    # Contadores para estadísticas
    total_registros = 0
    muestreos_creados = 0
    muestras_creadas = 0
    ensayos_creados = 0
    errores = []
    
    # Listas para almacenar los datos procesados
    muestreos_data = []
    muestras_data = []
    ensayos_data = []
    
    print("🔄 Procesando archivo CSV de Planta 2...")
    
    try:
        with open(archivo_csv, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row_num, row in enumerate(reader, start=2):
                total_registros += 1
                
                try:
                    # Extraer datos básicos
                    remision = row.get('Número de remisión', '').strip()
                    if not remision:
                        errores.append(f"Fila {row_num}: Remisión vacía")
                        continue
                    
                    # Convertir fecha y hora
                    fecha_excel = row.get('Fecha muestreo', '').strip()
                    hora_decimal = row.get('Hora de Muestreo', '').strip()
                    
                    fecha_muestreo = convertir_fecha_excel(fecha_excel)
                    hora_muestreo = convertir_hora_decimal(hora_decimal)
                    
                    if not fecha_muestreo:
                        errores.append(f"Fila {row_num}: Fecha de muestreo inválida: {fecha_excel}")
                        continue
                    
                    # Combinar fecha y hora para timestamp
                    if hora_muestreo:
                        fecha_muestreo_ts = f"{fecha_muestreo} {hora_muestreo}"
                    else:
                        fecha_muestreo_ts = f"{fecha_muestreo} 00:00:00"
                    
                    # Datos del muestreo
                    clasificacion = row.get('Clasificación', '').strip()
                    revenimiento = limpiar_valor_numerico(row.get('Revenimiento/Extensibilidad de Muestreo', ''))
                    masa_unitaria = limpiar_valor_numerico(row.get('Masa Unitaria', ''))
                    temp_ambiente = limpiar_valor_numerico(row.get('Temperatura ambiente', ''))
                    temp_concreto = limpiar_valor_numerico(row.get('Temperatura del concreto', ''))
                    
                    # Crear registro de muestreo
                    muestreo_data = {
                        'manual_reference': remision,
                        'planta': PLANT_CODE,
                        'fecha_muestreo': str(fecha_muestreo),
                        'fecha_muestreo_ts': fecha_muestreo_ts,
                        'hora_muestreo': hora_muestreo,
                        'revenimiento_sitio': revenimiento or 0,
                        'masa_unitaria': masa_unitaria or 0,
                        'temperatura_ambiente': temp_ambiente or 0,
                        'temperatura_concreto': temp_concreto or 0,
                        'sampling_type': 'REMISION_LINKED',
                        'sync_status': 'SYNCED',
                        'plant_id': PLANT_P2_ID,
                        'event_timezone': 'America/Mexico_City'
                    }
                    
                    muestreos_data.append(muestreo_data)
                    muestreos_creados += 1
                    
                    # Procesar edades y crear muestras
                    edades = [
                        limpiar_valor_numerico(row.get('EDAD 1', '')),
                        limpiar_valor_numerico(row.get('EDAD 2', '')),
                        limpiar_valor_numerico(row.get('EDAD 3', '')),
                        limpiar_valor_numerico(row.get('EDAD 4', ''))
                    ]
                    
                    tipos_muestra = [
                        row.get('TIPO DE MUESTRA 1', '').strip(),
                        row.get('TIPO DE MUESTRA 2', '').strip(),
                        row.get('TIPO DE MUESTRA 3', '').strip(),
                        row.get('TIPO DE MUESTRA 4', '').strip()
                    ]
                    
                    cargas = [
                        limpiar_valor_numerico(row.get('CARGA 1 (KG)', '')),
                        limpiar_valor_numerico(row.get('CARGA 2 (KG)', '')),
                        limpiar_valor_numerico(row.get('CARGA 3 (KG)', '')),
                        limpiar_valor_numerico(row.get('CARGA 4 (KG)', ''))
                    ]
                    
                    # Crear muestras solo donde hay edad
                    for i, edad in enumerate(edades):
                        if edad is not None and edad > 0:
                            identificacion = f"M{i+1}"
                            tipo_muestra_original = tipos_muestra[i] or "CUBO 10 X 10"
                            tipo_normalizado, medidas = normalizar_tipo_y_medidas(tipo_muestra_original)
                            carga = cargas[i]
                            
                            # Calcular fecha programada de ensayo
                            fecha_ensayo = fecha_muestreo + timedelta(days=int(edad))
                            fecha_ensayo_ts = f"{fecha_ensayo} 08:00:00"  # Hora estándar de laboratorio
                            
                            # Determinar estado inicial
                            estado = 'ENSAYADO' if carga is not None else 'PENDIENTE'
                            
                            muestra_data = {
                                'remision': remision,
                                'identificacion': identificacion,
                                'tipo_muestra': tipo_normalizado,
                                'fecha_programada_ensayo': str(fecha_ensayo),
                                'fecha_programada_ensayo_ts': fecha_ensayo_ts,
                                'estado': estado,
                                'plant_id': PLANT_P2_ID,
                                'event_timezone': 'America/Mexico_City',
                                # Medidas
                                'cube_side_cm': medidas.get('cube_side_cm'),
                                'diameter_cm': medidas.get('diameter_cm'),
                                'beam_width_cm': medidas.get('beam_width_cm'),
                                'beam_height_cm': medidas.get('beam_height_cm'),
                                'beam_span_cm': medidas.get('beam_span_cm')
                            }
                            
                            muestras_data.append(muestra_data)
                            muestras_creadas += 1
                            
                            # Crear ensayo si hay carga
                            if carga is not None and carga > 0:
                                ensayo_data = {
                                    'remision': remision,
                                    'identificacion': identificacion,
                                    'fecha_ensayo': str(fecha_ensayo),
                                    'fecha_ensayo_ts': fecha_ensayo_ts,
                                    'carga_kg': carga,
                                    'plant_id': PLANT_P2_ID,
                                    'event_timezone': 'America/Mexico_City'
                                }
                                
                                ensayos_data.append(ensayo_data)
                                ensayos_creados += 1
                
                except Exception as e:
                    errores.append(f"Fila {row_num}: Error procesando registro - {str(e)}")
                    continue
    
    except Exception as e:
        print(f"❌ Error leyendo archivo CSV: {str(e)}")
        return
    
    # Generar SQL de carga
    print("📝 Generando script SQL...")
    generar_sql_carga(muestreos_data, muestras_data, ensayos_data)
    
    # Mostrar estadísticas
    print("\n📊 ESTADÍSTICAS DE PROCESAMIENTO")
    print(f"Total registros procesados: {total_registros}")
    print(f"Muestreos a crear: {muestreos_creados}")
    print(f"Muestras a crear: {muestras_creadas}")
    print(f"Ensayos a crear: {ensayos_creados}")
    
    if errores:
        print(f"\n⚠️  ERRORES ENCONTRADOS ({len(errores)}):")
        for error in errores[:10]:  # Mostrar solo los primeros 10
            print(f"  - {error}")
        if len(errores) > 10:
            print(f"  ... y {len(errores) - 10} errores más")

def generar_sql_carga(muestreos_data, muestras_data, ensayos_data):
    """
    Genera el script SQL completo para la carga masiva
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archivo_sql = f"carga_planta2_{timestamp}.sql"
    
    with open(archivo_sql, 'w', encoding='utf-8') as f:
        f.write("-- Script de carga masiva para Planta 2\n")
        f.write(f"-- Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"-- Archivo fuente: archivoexcel/Registro P2 Final.csv\n\n")
        
        f.write("-- ==============================================\n")
        f.write("-- PASO 1: CREAR MUESTREOS\n")
        f.write("-- ==============================================\n\n")
        
        # Generar INSERT para muestreos
        if muestreos_data:
            f.write("INSERT INTO public.muestreos (\n")
            f.write("  manual_reference, planta, fecha_muestreo, fecha_muestreo_ts, hora_muestreo,\n")
            f.write("  revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,\n")
            f.write("  sampling_type, sync_status, plant_id, event_timezone,\n")
            f.write("  created_at, updated_at\n")
            f.write(") VALUES\n")
            
            for i, muestreo in enumerate(muestreos_data):
                valores = [
                    f"'{muestreo['manual_reference']}'",
                    f"'{muestreo['planta']}'",
                    f"'{muestreo['fecha_muestreo']}'",
                    f"'{muestreo['fecha_muestreo_ts']}'",
                    f"'{muestreo['hora_muestreo']}'" if muestreo['hora_muestreo'] else "NULL",
                    str(muestreo['revenimiento_sitio']),
                    str(muestreo['masa_unitaria']),
                    str(muestreo['temperatura_ambiente']),
                    str(muestreo['temperatura_concreto']),
                    f"'{muestreo['sampling_type']}'",
                    f"'{muestreo['sync_status']}'",
                    f"'{muestreo['plant_id']}'",
                    f"'{muestreo['event_timezone']}'",
                    "now()",
                    "now()"
                ]
                
                separador = "," if i < len(muestreos_data) - 1 else ";"
                f.write(f"  ({', '.join(valores)}){separador}\n")
            
            f.write(f"\n-- Muestreos creados: {len(muestreos_data)}\n\n")
        
        f.write("-- ==============================================\n")
        f.write("-- PASO 2: CREAR MUESTRAS\n")
        f.write("-- ==============================================\n\n")
        
        # Generar INSERT para muestras con JOIN a muestreos
        if muestras_data:
            f.write("INSERT INTO public.muestras (\n")
            f.write("  muestreo_id, identificacion, tipo_muestra, fecha_programada_ensayo,\n")
            f.write("  fecha_programada_ensayo_ts, estado, plant_id, event_timezone,\n")
            f.write("  cube_side_cm, diameter_cm, beam_width_cm, beam_height_cm, beam_span_cm,\n")
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
            f.write("  datos.cube_side_cm::numeric,\n")
            f.write("  datos.diameter_cm::numeric,\n")
            f.write("  datos.beam_width_cm::numeric,\n")
            f.write("  datos.beam_height_cm::numeric,\n")
            f.write("  datos.beam_span_cm::numeric,\n")
            f.write("  now() as created_at,\n")
            f.write("  now() as updated_at\n")
            f.write("FROM (\n")
            f.write("  VALUES\n")
            
            for i, muestra in enumerate(muestras_data):
                valores = [
                    f"'{muestra['remision']}'",
                    f"'{muestra['identificacion']}'",
                    f"'{muestra['tipo_muestra']}'",
                    f"'{muestra['fecha_programada_ensayo']}'",
                    f"'{muestra['fecha_programada_ensayo_ts']}'",
                    f"'{muestra['estado']}'",
                    f"'{muestra['plant_id']}'",
                    f"'{muestra['event_timezone']}'",
                    (str(muestra['cube_side_cm']) if muestra['cube_side_cm'] is not None else "NULL"),
                    (str(muestra['diameter_cm']) if muestra['diameter_cm'] is not None else "NULL"),
                    (str(muestra['beam_width_cm']) if muestra['beam_width_cm'] is not None else "NULL"),
                    (str(muestra['beam_height_cm']) if muestra['beam_height_cm'] is not None else "NULL"),
                    (str(muestra['beam_span_cm']) if muestra['beam_span_cm'] is not None else "NULL")
                ]
                
                separador = "," if i < len(muestras_data) - 1 else ""
                f.write(f"    ({', '.join(valores)}){separador}\n")
            
            f.write(") AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone, cube_side_cm, diameter_cm, beam_width_cm, beam_height_cm, beam_span_cm)\n")
            f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2';\n\n")
            f.write(f"-- Muestras creadas: {len(muestras_data)}\n\n")
        
        f.write("-- ==============================================\n")
        f.write("-- PASO 3: CREAR ENSAYOS\n")
        f.write("-- ==============================================\n\n")
        
        # Generar INSERT para ensayos
        if ensayos_data:
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
            
            for i, ensayo in enumerate(ensayos_data):
                valores = [
                    f"'{ensayo['remision']}'",
                    f"'{ensayo['identificacion']}'",
                    f"'{ensayo['fecha_ensayo']}'",
                    f"'{ensayo['fecha_ensayo_ts']}'",
                    str(ensayo['carga_kg']),
                    f"'{ensayo['plant_id']}'",
                    f"'{ensayo['event_timezone']}'"
                ]
                
                separador = "," if i < len(ensayos_data) - 1 else ""
                f.write(f"    ({', '.join(valores)}){separador}\n")
            
            f.write(") AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)\n")
            f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2'\n")
            f.write("JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;\n\n")
            f.write(f"-- Ensayos creados: {len(ensayos_data)}\n\n")
        
        f.write("-- ==============================================\n")
        f.write("-- PASO 4: VERIFICACIONES\n")
        f.write("-- ==============================================\n\n")
        
        f.write("-- Verificar muestreos creados\n")
        f.write("SELECT 'Muestreos P2' as tabla, COUNT(*) as total\n")
        f.write("FROM public.muestreos \n")
        f.write("WHERE planta = 'P2' AND DATE(created_at) = CURRENT_DATE;\n\n")
        
        f.write("-- Verificar muestras por estado\n")
        f.write("SELECT \n")
        f.write("  'Muestras P2' as tabla,\n")
        f.write("  estado,\n")
        f.write("  COUNT(*) as total\n")
        f.write("FROM public.muestras mu\n")
        f.write("JOIN public.muestreos m ON m.id = mu.muestreo_id\n")
        f.write("WHERE m.planta = 'P2' AND DATE(mu.created_at) = CURRENT_DATE\n")
        f.write("GROUP BY estado;\n\n")
        
        f.write("-- Verificar ensayos creados\n")
        f.write("SELECT 'Ensayos P2' as tabla, COUNT(*) as total\n")
        f.write("FROM public.ensayos e\n")
        f.write("JOIN public.muestras mu ON mu.id = e.muestra_id\n")
        f.write("JOIN public.muestreos m ON m.id = mu.muestreo_id\n")
        f.write("WHERE m.planta = 'P2' AND DATE(e.created_at) = CURRENT_DATE;\n\n")
        
        f.write("-- FIN DEL SCRIPT\n")
    
    print(f"✅ Script SQL generado: {archivo_sql}")

    # Además, generar lotes pequeños para aplicar vía API sin exceder límites
    generar_sql_lotes(muestras_data, ensayos_data)

def _chunk_list(data_list, chunk_size):
    for i in range(0, len(data_list), chunk_size):
        yield data_list[i:i+chunk_size]

def generar_sql_lotes(muestras_data, ensayos_data, chunk_size: int = 40):
    """
    Genera archivos SQL en lotes para insertar muestras (con medidas) y ensayos
    en bloques pequeños que no excedan los límites de payload del API.
    """
    # Lotes de muestras
    if muestras_data:
        for idx, lote in enumerate(_chunk_list(muestras_data, chunk_size), start=1):
            nombre_archivo = f"muestras_p2_lote_{idx}.sql"
            with open(nombre_archivo, 'w', encoding='utf-8') as f:
                f.write("-- Lote de MUESTRAS P2 con medidas\n\n")
                f.write("INSERT INTO public.muestras (\n")
                f.write("  muestreo_id, identificacion, tipo_muestra, fecha_programada_ensayo,\n")
                f.write("  fecha_programada_ensayo_ts, estado, plant_id, event_timezone,\n")
                f.write("  cube_side_cm, diameter_cm, beam_width_cm, beam_height_cm, beam_span_cm,\n")
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
                f.write("  datos.cube_side_cm::numeric,\n")
                f.write("  datos.diameter_cm::numeric,\n")
                f.write("  datos.beam_width_cm::numeric,\n")
                f.write("  datos.beam_height_cm::numeric,\n")
                f.write("  datos.beam_span_cm::numeric,\n")
                f.write("  now() as created_at,\n")
                f.write("  now() as updated_at\n")
                f.write("FROM (\n")
                f.write("  VALUES\n")

                for i, muestra in enumerate(lote):
                    valores = [
                        f"'{muestra['remision']}'",
                        f"'{muestra['identificacion']}'",
                        f"'{muestra['tipo_muestra']}'",
                        f"'{muestra['fecha_programada_ensayo']}'",
                        f"'{muestra['fecha_programada_ensayo_ts']}'",
                        f"'{muestra['estado']}'",
                        f"'{muestra['plant_id']}'",
                        f"'{muestra['event_timezone']}'",
                        (str(muestra['cube_side_cm']) if muestra['cube_side_cm'] is not None else "NULL"),
                        (str(muestra['diameter_cm']) if muestra['diameter_cm'] is not None else "NULL"),
                        (str(muestra['beam_width_cm']) if muestra['beam_width_cm'] is not None else "NULL"),
                        (str(muestra['beam_height_cm']) if muestra['beam_height_cm'] is not None else "NULL"),
                        (str(muestra['beam_span_cm']) if muestra['beam_span_cm'] is not None else "NULL")
                    ]
                    separador = "," if i < len(lote) - 1 else ""
                    f.write(f"    ({', '.join(valores)}){separador}\n")

                f.write(") AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone, cube_side_cm, diameter_cm, beam_width_cm, beam_height_cm, beam_span_cm)\n")
                f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2';\n")

    # Lotes de ensayos
    if ensayos_data:
        for idx, lote in enumerate(_chunk_list(ensayos_data, chunk_size), start=1):
            nombre_archivo = f"ensayos_p2_lote_{idx}.sql"
            with open(nombre_archivo, 'w', encoding='utf-8') as f:
                f.write("-- Lote de ENSAYOS P2\n\n")
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

                for i, ensayo in enumerate(lote):
                    valores = [
                        f"'{ensayo['remision']}'",
                        f"'{ensayo['identificacion']}'",
                        f"'{ensayo['fecha_ensayo']}'",
                        f"'{ensayo['fecha_ensayo_ts']}'",
                        str(ensayo['carga_kg']),
                        f"'{ensayo['plant_id']}'",
                        f"'{ensayo['event_timezone']}'"
                    ]
                    separador = "," if i < len(lote) - 1 else ""
                    f.write(f"    ({', '.join(valores)}){separador}\n")

                f.write(") AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)\n")
                f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P2'\n")
                f.write("JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;\n")

if __name__ == "__main__":
    print("🚀 Iniciando procesamiento de carga masiva - Planta 2")
    print("=" * 60)
    
    procesar_csv_planta2()
    
    print("\n✅ Procesamiento completado!")
    print("\nPróximos pasos:")
    print("1. Revisar el archivo SQL generado")
    print("2. Ejecutar el script en la base de datos")
    print("3. Verificar los resultados con las queries de validación")
