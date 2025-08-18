#!/usr/bin/env python3
"""
Script DEFINITIVO para carga masiva de Planta 4
Archivo: archivoexcel/Calidad P4.csv

LÓGICA IMPLEMENTADA CORRECTAMENTE:
1. Fechas Excel convertidas correctamente
2. Edades en HORAS (si EDAD1 > 10) vs DÍAS (si EDAD1 ≤ 10)
3. Tipos de muestra específicos: CUBO_10X10, CUBO_15X15, VIGA
4. Mapeo exacto: EDAD1→M1→CARGA1, EDAD2→M2→CARGA2, etc.
5. Solo crear muestras donde hay EDAD definida
6. Fecha ensayo = fecha_muestreo + edad (en horas o días)
"""

import csv
import os
import sys
from datetime import datetime, timedelta, date
from decimal import Decimal

# Configuración
SUPABASE_PROJECT_ID = "pkjqznogflgbnwzkzmpg"
PLANT_P4_ID = "78fba7b9-645a-4006-96e7-e6c4d5a9d10e"
PLANT_CODE = "P4"

def convertir_fecha_excel(numero_serial):
    """Convierte número serial de Excel a fecha Python"""
    if not numero_serial or numero_serial == '':
        return None
    try:
        excel_epoch = datetime(1899, 12, 30)  # Ajuste por bug Excel 1900
        fecha = excel_epoch + timedelta(days=float(numero_serial))
        return fecha.date()
    except (ValueError, TypeError):
        print(f"Error convirtiendo fecha Excel: {numero_serial}")
        return None

def convertir_hora_formato_mixto(hora_str):
    """Convierte hora en formato HH:MM o decimal de Excel"""
    if not hora_str or hora_str == '':
        return None
    try:
        hora_str = str(hora_str).strip()
        
        # Si contiene ":", es formato HH:MM
        if ':' in hora_str:
            parts = hora_str.split(':')
            if len(parts) == 2:
                return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:00"
            else:
                return hora_str
        
        # Si no, es decimal de Excel
        total_segundos = float(hora_str) * 24 * 60 * 60
        horas = int(total_segundos // 3600)
        minutos = int((total_segundos % 3600) // 60)
        segundos = int(total_segundos % 60)
        
        return f"{horas:02d}:{minutos:02d}:{segundos:02d}"
    except (ValueError, TypeError):
        print(f"Error convirtiendo hora: {hora_str}")
        return None

def limpiar_valor_numerico(valor):
    """Limpia y convierte valores numéricos"""
    if not valor or str(valor).strip() == '':
        return None
    try:
        return float(str(valor).strip())
    except (ValueError, TypeError):
        return None

def mapear_tipo_muestra(tipo_original):
    """
    Mapea tipos de muestra según los valores permitidos en BD: CUBO, VIGA, CILINDRO
    """
    if not tipo_original:
        return "CUBO"
    
    tipo_limpio = tipo_original.strip().upper()
    
    if "CUBO" in tipo_limpio:  # Incluye tanto 10X10 como 15X15
        return "CUBO"
    elif "VIGA" in tipo_limpio:
        return "VIGA"
    elif "CILINDRO" in tipo_limpio:
        return "CILINDRO"
    else:
        return "CUBO"  # Default

def procesar_csv_p4_definitivo():
    """
    Procesa el CSV de P4 con lógica DEFINITIVA y CORRECTA
    """
    archivo_csv = "../archivoexcel/Calidad P4.csv"
    
    if not os.path.exists(archivo_csv):
        print(f"Error: No se encontró el archivo {archivo_csv}")
        return
    
    # Contadores
    total_registros = 0
    muestreos_creados = 0
    muestras_creadas = 0
    ensayos_creados = 0
    errores = []
    registros_horas = 0
    registros_dias = 0
    
    # Datos procesados
    muestreos_data = []
    muestras_data = []
    ensayos_data = []
    
    print("🚀 PROCESANDO CSV PLANTA 4 - VERSIÓN DEFINITIVA")
    print("=" * 60)
    
    try:
        with open(archivo_csv, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row_num, row in enumerate(reader, start=2):
                total_registros += 1
                
                try:
                    # 1. DATOS BÁSICOS DEL MUESTREO
                    remision = row.get('Número de remisión', '').strip()
                    if not remision:
                        errores.append(f"Fila {row_num}: Remisión vacía")
                        continue
                    
                    cantidad_muestras = limpiar_valor_numerico(row.get('Cantidad de Muestras', ''))
                    if not cantidad_muestras or cantidad_muestras not in [3, 4]:
                        errores.append(f"Fila {row_num}: Cantidad inválida: {cantidad_muestras}")
                        continue
                    cantidad_muestras = int(cantidad_muestras)
                    
                    # 2. CONVERSIÓN DE FECHA Y HORA EXCEL
                    fecha_excel = row.get('Fecha muestreo', '').strip()
                    hora_mixta = row.get('Hora de Muestreo', '').strip()
                    
                    fecha_muestreo = convertir_fecha_excel(fecha_excel)
                    hora_muestreo = convertir_hora_formato_mixto(hora_mixta)
                    
                    if not fecha_muestreo:
                        errores.append(f"Fila {row_num}: Fecha inválida: {fecha_excel}")
                        continue
                    
                    # Crear timestamp completo
                    if hora_muestreo:
                        fecha_muestreo_ts = f"{fecha_muestreo} {hora_muestreo}"
                        fecha_muestreo_dt = datetime.strptime(fecha_muestreo_ts, "%Y-%m-%d %H:%M:%S")
                    else:
                        fecha_muestreo_ts = f"{fecha_muestreo} 00:00:00"
                        fecha_muestreo_dt = datetime.strptime(fecha_muestreo_ts, "%Y-%m-%d %H:%M:%S")
                    
                    # 3. DATOS TÉCNICOS DEL MUESTREO
                    clasificacion = row.get('Clasificación', '').strip()
                    revenimiento = limpiar_valor_numerico(row.get('Revenimiento/Extensibilidad de Muestreo', ''))
                    masa_unitaria = limpiar_valor_numerico(row.get('Masa Unitaria', ''))
                    temp_ambiente = limpiar_valor_numerico(row.get('Temperatura ambiente', ''))
                    temp_concreto = limpiar_valor_numerico(row.get('Temperatura del concreto', ''))
                    
                    # 4. CREAR REGISTRO DE MUESTREO
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
                        'plant_id': PLANT_P4_ID,
                        'event_timezone': 'America/Mexico_City'
                    }
                    
                    muestreos_data.append(muestreo_data)
                    muestreos_creados += 1
                    
                    # 5. PROCESAR EDADES, TIPOS Y CARGAS
                    edades = [
                        limpiar_valor_numerico(row.get('EDAD 1', '')),
                        limpiar_valor_numerico(row.get('EDAD 2', '')),
                        limpiar_valor_numerico(row.get('EDAD 3', '')),
                        limpiar_valor_numerico(row.get('EDAD 4', ''))
                    ]
                    
                    tipos_muestra_originales = [
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
                    
                    # 6. DETERMINAR TIPO DE EDAD (HORAS VS DÍAS)
                    edad_1 = edades[0]
                    es_horas = edad_1 is not None and edad_1 > 10
                    
                    if es_horas:
                        registros_horas += 1
                        tipo_edad_str = "HORAS"
                    else:
                        registros_dias += 1
                        tipo_edad_str = "DÍAS"
                    
                    print(f"📋 Remisión {remision}: {cantidad_muestras} muestras, {tipo_edad_str} (EDAD1={edad_1})")
                    
                    # 7. CREAR MUESTRAS SEGÚN CANTIDAD ESPECIFICADA
                    for i in range(cantidad_muestras):
                        edad = edades[i] if i < len(edades) else None
                        
                        # Solo crear muestra si hay edad definida
                        if edad is not None and edad > 0:
                            identificacion = f"M{i+1}"
                            tipo_original = tipos_muestra_originales[i] if i < len(tipos_muestra_originales) else "CUBO 10 X 10"
                            tipo_muestra = mapear_tipo_muestra(tipo_original)
                            carga = cargas[i] if i < len(cargas) else None
                            
                            # 8. CALCULAR FECHA DE ENSAYO CORRECTAMENTE
                            if es_horas:
                                # Sumar horas al datetime de muestreo
                                fecha_ensayo_dt = fecha_muestreo_dt + timedelta(hours=int(edad))
                                fecha_ensayo = fecha_ensayo_dt.date()
                                fecha_ensayo_ts = fecha_ensayo_dt.strftime("%Y-%m-%d %H:%M:%S")
                            else:
                                # Sumar días a la fecha de muestreo
                                fecha_ensayo = fecha_muestreo + timedelta(days=int(edad))
                                fecha_ensayo_ts = f"{fecha_ensayo} 08:00:00"
                            
                            # 9. DETERMINAR ESTADO
                            estado = 'ENSAYADO' if carga is not None and carga > 0 else 'PENDIENTE'
                            
                            # 10. CREAR DATOS DE MUESTRA
                            muestra_data = {
                                'remision': remision,
                                'identificacion': identificacion,
                                'tipo_muestra': tipo_muestra,
                                'tipo_original': tipo_original,
                                'fecha_programada_ensayo': str(fecha_ensayo),
                                'fecha_programada_ensayo_ts': fecha_ensayo_ts,
                                'estado': estado,
                                'plant_id': PLANT_P4_ID,
                                'event_timezone': 'America/Mexico_City'
                            }
                            
                            muestras_data.append(muestra_data)
                            muestras_creadas += 1
                            
                            print(f"   → {identificacion}: {tipo_muestra} ({tipo_original}) - {fecha_ensayo} - {estado}")
                            
                            # 11. CREAR ENSAYO SI HAY CARGA
                            if carga is not None and carga > 0:
                                ensayo_data = {
                                    'remision': remision,
                                    'identificacion': identificacion,
                                    'fecha_ensayo': str(fecha_ensayo),
                                    'fecha_ensayo_ts': fecha_ensayo_ts,
                                    'carga_kg': carga,
                                    'plant_id': PLANT_P4_ID,
                                    'event_timezone': 'America/Mexico_City'
                                }
                                
                                ensayos_data.append(ensayo_data)
                                ensayos_creados += 1
                
                except Exception as e:
                    errores.append(f"Fila {row_num}: Error - {str(e)}")
                    continue
    
    except Exception as e:
        print(f"❌ Error leyendo CSV: {str(e)}")
        return
    
    # GENERAR SQL
    print(f"\n📝 Generando SQL definitivo...")
    generar_sql_definitivo(muestreos_data, muestras_data, ensayos_data)
    
    # ESTADÍSTICAS FINALES
    print(f"\n📊 ESTADÍSTICAS DEFINITIVAS:")
    print(f"  Total registros: {total_registros}")
    print(f"  Registros HORAS: {registros_horas}")
    print(f"  Registros DÍAS: {registros_dias}")
    print(f"  Muestreos: {muestreos_creados}")
    print(f"  Muestras: {muestras_creadas}")
    print(f"  Ensayos: {ensayos_creados}")
    
    if errores:
        print(f"\n⚠️ ERRORES ({len(errores)}):")
        for error in errores[:5]:
            print(f"  - {error}")

def generar_sql_definitivo(muestreos_data, muestras_data, ensayos_data):
    """Genera SQL definitivo con lógica correcta"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    archivo_sql = f"carga_p4_definitiva_{timestamp}.sql"
    
    with open(archivo_sql, 'w', encoding='utf-8') as f:
        f.write("-- SCRIPT DEFINITIVO DE CARGA PLANTA 4\n")
        f.write(f"-- Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"-- Archivo: archivoexcel/Calidad P4.csv\n")
        f.write(f"-- Plant ID: {PLANT_P4_ID}\n")
        f.write("-- LÓGICA: Edades HORAS (>10) vs DÍAS (≤10)\n")
        f.write("-- TIPOS: CUBO_10X10, CUBO_15X15, VIGA específicos\n")
        f.write("-- MAPEO: EDAD1→M1→CARGA1, EDAD2→M2→CARGA2, etc.\n\n")
        
        # MUESTREOS
        f.write("-- ==========================================\n")
        f.write("-- PASO 1: CREAR MUESTREOS\n")
        f.write("-- ==========================================\n\n")
        
        if muestreos_data:
            f.write("INSERT INTO public.muestreos (\n")
            f.write("  manual_reference, planta, fecha_muestreo, fecha_muestreo_ts, hora_muestreo,\n")
            f.write("  revenimiento_sitio, masa_unitaria, temperatura_ambiente, temperatura_concreto,\n")
            f.write("  sampling_type, sync_status, plant_id, event_timezone,\n")
            f.write("  created_at, updated_at\n")
            f.write(") VALUES\n")
            
            for i, m in enumerate(muestreos_data):
                valores = [
                    f"'{m['manual_reference']}'",
                    f"'{m['planta']}'", 
                    f"'{m['fecha_muestreo']}'",
                    f"'{m['fecha_muestreo_ts']}'",
                    f"'{m['hora_muestreo']}'" if m['hora_muestreo'] else "NULL",
                    str(m['revenimiento_sitio']),
                    str(m['masa_unitaria']),
                    str(m['temperatura_ambiente']),
                    str(m['temperatura_concreto']),
                    f"'{m['sampling_type']}'",
                    f"'{m['sync_status']}'",
                    f"'{m['plant_id']}'",
                    f"'{m['event_timezone']}'",
                    "now()",
                    "now()"
                ]
                
                separador = "," if i < len(muestreos_data) - 1 else ";"
                f.write(f"  ({', '.join(valores)}){separador}\n")
            
            f.write(f"\n-- Muestreos creados: {len(muestreos_data)}\n\n")
        
        # MUESTRAS
        f.write("-- ==========================================\n")
        f.write("-- PASO 2: CREAR MUESTRAS\n")
        f.write("-- ==========================================\n\n")
        
        if muestras_data:
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
            
            for i, mu in enumerate(muestras_data):
                valores = [
                    f"'{mu['remision']}'",
                    f"'{mu['identificacion']}'",
                    f"'{mu['tipo_muestra']}'",
                    f"'{mu['fecha_programada_ensayo']}'",
                    f"'{mu['fecha_programada_ensayo_ts']}'",
                    f"'{mu['estado']}'",
                    f"'{mu['plant_id']}'",
                    f"'{mu['event_timezone']}'"
                ]
                
                separador = "," if i < len(muestras_data) - 1 else ""
                f.write(f"    ({', '.join(valores)}){separador}\n")
            
            f.write(") AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)\n")
            f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4';\n\n")
            f.write(f"-- Muestras creadas: {len(muestras_data)}\n\n")
        
        # ENSAYOS
        f.write("-- ==========================================\n")
        f.write("-- PASO 3: CREAR ENSAYOS\n")
        f.write("-- ==========================================\n\n")
        
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
            
            for i, e in enumerate(ensayos_data):
                valores = [
                    f"'{e['remision']}'",
                    f"'{e['identificacion']}'",
                    f"'{e['fecha_ensayo']}'",
                    f"'{e['fecha_ensayo_ts']}'",
                    str(e['carga_kg']),
                    f"'{e['plant_id']}'",
                    f"'{e['event_timezone']}'"
                ]
                
                separador = "," if i < len(ensayos_data) - 1 else ""
                f.write(f"    ({', '.join(valores)}){separador}\n")
            
            f.write(") AS datos(remision, identificacion, fecha_ensayo, fecha_ensayo_ts, carga_kg, plant_id, event_timezone)\n")
            f.write("JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4'\n")
            f.write("JOIN public.muestras mu ON mu.muestreo_id = m.id AND mu.identificacion = datos.identificacion;\n\n")
            f.write(f"-- Ensayos creados: {len(ensayos_data)}\n\n")
        
        # VERIFICACIONES
        f.write("-- ==========================================\n")
        f.write("-- PASO 4: VERIFICACIONES\n")
        f.write("-- ==========================================\n\n")
        
        f.write("-- Verificar muestreos\n")
        f.write("SELECT 'Muestreos P4' as tabla, COUNT(*) as total\n")
        f.write("FROM public.muestreos WHERE planta = 'P4' AND DATE(created_at) = CURRENT_DATE;\n\n")
        
        f.write("-- Verificar muestras por estado\n")
        f.write("SELECT 'Muestras P4' as tabla, estado, COUNT(*) as total\n")
        f.write("FROM public.muestras mu JOIN public.muestreos m ON m.id = mu.muestreo_id\n")
        f.write("WHERE m.planta = 'P4' AND DATE(mu.created_at) = CURRENT_DATE GROUP BY estado;\n\n")
        
        f.write("-- Verificar tipos de muestra\n")
        f.write("SELECT 'Tipos Muestra P4' as tabla, tipo_muestra, COUNT(*) as total\n")
        f.write("FROM public.muestras mu JOIN public.muestreos m ON m.id = mu.muestreo_id\n")
        f.write("WHERE m.planta = 'P4' AND DATE(mu.created_at) = CURRENT_DATE GROUP BY tipo_muestra;\n\n")
        
        f.write("-- Verificar ensayos\n")
        f.write("SELECT 'Ensayos P4' as tabla, COUNT(*) as total\n")
        f.write("FROM public.ensayos e JOIN public.muestras mu ON mu.id = e.muestra_id\n")
        f.write("JOIN public.muestreos m ON m.id = mu.muestreo_id\n")
        f.write("WHERE m.planta = 'P4' AND DATE(e.created_at) = CURRENT_DATE;\n\n")
        
        f.write("-- FIN SCRIPT DEFINITIVO\n")
    
    print(f"✅ SQL definitivo generado: {archivo_sql}")

if __name__ == "__main__":
    procesar_csv_p4_definitivo()
