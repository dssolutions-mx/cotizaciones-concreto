#!/usr/bin/env python3
"""
Análisis completo del archivo Calidad P4.csv para entender:
1. Edades (horas vs días)
2. Tipos de muestra específicos 
3. Fechas Excel
4. Mapeo EDAD→MUESTRA→CARGA
"""

import csv
from datetime import datetime, timedelta

def convertir_fecha_excel(numero_serial):
    """Convierte número serial de Excel a fecha Python"""
    if not numero_serial or numero_serial == '':
        return None
    try:
        excel_epoch = datetime(1899, 12, 30)  # Ajuste por el bug de Excel
        fecha = excel_epoch + timedelta(days=float(numero_serial))
        return fecha.date()
    except (ValueError, TypeError):
        return None

def analizar_csv_completo():
    """Análisis completo del CSV"""
    archivo_csv = "../archivoexcel/Calidad P4.csv"
    
    print("=== ANÁLISIS COMPLETO DEL ARCHIVO CALIDAD P4.CSV ===\n")
    
    # Contadores y sets para análisis
    total_registros = 0
    registros_horas = 0
    registros_dias = 0
    tipos_muestra_detallados = {}
    cantidad_muestras_por_remision = {}
    patrones_edad = []
    
    with open(archivo_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        print("📋 ANÁLISIS DE PRIMERAS 10 REMISIONES:\n")
        
        for i, row in enumerate(reader):
            total_registros += 1
            
            remision = row['Número de remisión']
            cantidad = int(row['Cantidad de Muestras']) if row['Cantidad de Muestras'] else 0
            
            # Analizar edades
            edad1 = float(row['EDAD 1']) if row['EDAD 1'] else None
            edad2 = float(row['EDAD 2']) if row['EDAD 2'] else None
            edad3 = float(row['EDAD 3']) if row['EDAD 3'] else None
            edad4 = float(row['EDAD 4']) if row['EDAD 4'] else None
            
            edades = [edad1, edad2, edad3, edad4]
            es_horas = edad1 is not None and edad1 > 10
            
            if es_horas:
                registros_horas += 1
            else:
                registros_dias += 1
            
            # Analizar tipos de muestra
            tipos_en_remision = []
            for j in range(1, 5):
                tipo = row[f'TIPO DE MUESTRA {j}'].strip()
                if tipo:
                    tipos_en_remision.append(tipo)
                    if tipo not in tipos_muestra_detallados:
                        tipos_muestra_detallados[tipo] = 0
                    tipos_muestra_detallados[tipo] += 1
            
            # Analizar cargas
            cargas = [
                float(row['CARGA 1 (KG)']) if row['CARGA 1 (KG)'] else None,
                float(row['CARGA 2 (KG)']) if row['CARGA 2 (KG)'] else None,
                float(row['CARGA 3 (KG)']) if row['CARGA 3 (KG)'] else None,
                float(row['CARGA 4 (KG)']) if row['CARGA 4 (KG)'] else None
            ]
            
            # Convertir fecha
            fecha_excel = row['Fecha muestreo']
            fecha_convertida = convertir_fecha_excel(fecha_excel)
            
            # Guardar patrón
            patron = {
                'remision': remision,
                'cantidad_muestras': cantidad,
                'es_horas': es_horas,
                'edad1': edad1,
                'edades': edades,
                'tipos': tipos_en_remision,
                'cargas': cargas,
                'fecha_excel': fecha_excel,
                'fecha_convertida': fecha_convertida
            }
            patrones_edad.append(patron)
            
            if i < 10:  # Mostrar primeras 10
                print(f"REMISIÓN {remision}:")
                print(f"  📅 Fecha Excel: {fecha_excel} → {fecha_convertida}")
                print(f"  🔢 Cantidad Muestras: {cantidad}")
                print(f"  ⏰ Tipo Edad: {'HORAS' if es_horas else 'DÍAS'} (EDAD1={edad1})")
                print(f"  📏 Tipos Muestra: {tipos_en_remision}")
                print(f"  📊 Edades: {[e for e in edades if e is not None]}")
                print(f"  ⚖️  Cargas: {[c for c in cargas if c is not None]}")
                print()
    
    print(f"\n📈 ESTADÍSTICAS GENERALES:")
    print(f"  Total registros: {total_registros}")
    print(f"  Registros con edades en HORAS: {registros_horas}")
    print(f"  Registros con edades en DÍAS: {registros_dias}")
    
    print(f"\n📏 TIPOS DE MUESTRA DETALLADOS:")
    for tipo, count in sorted(tipos_muestra_detallados.items()):
        print(f"  '{tipo}': {count} veces")
    
    print(f"\n🔍 ANÁLISIS DE PATRONES ESPECÍFICOS:")
    
    # Analizar casos especiales
    casos_3_muestras = [p for p in patrones_edad if p['cantidad_muestras'] == 3]
    casos_4_muestras = [p for p in patrones_edad if p['cantidad_muestras'] == 4]
    
    print(f"  Remisiones con 3 muestras: {len(casos_3_muestras)}")
    print(f"  Remisiones con 4 muestras: {len(casos_4_muestras)}")
    
    # Mostrar ejemplos de casos especiales
    if casos_3_muestras:
        ejemplo_3 = casos_3_muestras[0]
        print(f"\n  📋 EJEMPLO - 3 MUESTRAS (Remisión {ejemplo_3['remision']}):")
        print(f"    Edades: {[e for e in ejemplo_3['edades'] if e is not None]}")
        print(f"    Tipos: {ejemplo_3['tipos']}")
        print(f"    Cargas: {[c for c in ejemplo_3['cargas'] if c is not None]}")
    
    # Analizar tipos de muestra únicos para mapeo
    print(f"\n🎯 MAPEO DE TIPOS DE MUESTRA PARA BD:")
    for tipo in sorted(tipos_muestra_detallados.keys()):
        if "10 X 10" in tipo:
            print(f"  '{tipo}' → 'CUBO_10X10'")
        elif "15 X 15" in tipo:
            print(f"  '{tipo}' → 'CUBO_15X15'")
        elif "VIGA" in tipo:
            print(f"  '{tipo}' → 'VIGA'")
        else:
            print(f"  '{tipo}' → 'OTRO'")

if __name__ == "__main__":
    analizar_csv_completo()
