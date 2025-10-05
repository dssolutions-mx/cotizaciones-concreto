#!/usr/bin/env python3
"""
Script para analizar la estructura del CSV de Carga Silao
"""

import csv

def analizar_csv():
    print("=== ANÁLISIS COMPLETO DEL CSV CARGA SILAO ===\n")
    
    with open('../archivoexcel/Carga Silao.csv', 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        headers = reader.fieldnames
        
        print("📋 HEADERS ENCONTRADOS:")
        for i, header in enumerate(headers, 1):
            print(f"  {i:2d}. '{header}'")
        
        print(f"\n📊 ANÁLISIS DE DATOS:")
        
        rows = list(reader)
        total_rows = len(rows)
        print(f"Total de registros: {total_rows}")
        
        print(f"\n--- PRIMERAS 3 FILAS ---")
        for idx, row in enumerate(rows[:3]):
            print(f"\nFILA {idx + 1}:")
            
            # Buscar clave de remisión (puede tener BOM)
            remision_key = None
            for key in row.keys():
                if 'Remisi' in key:
                    remision_key = key
                    break
            
            if remision_key:
                print(f"  Remisión: {row[remision_key]}")
            
            print(f"  Fecha: {row.get('Fecha de muestreo', 'N/A')}")
            
            # Edades
            edad1 = row.get('EDAD 1', '')
            edad2 = row.get('EDAD 2', '')
            edad3 = row.get('EDAD 3', '')
            edad4 = row.get('EDAD 4 ', '')  # Nota el espacio
            print(f"  EDADES: {edad1} | {edad2} | {edad3} | {edad4}")
            
            # Resistencias
            res1 = row.get('RESISTENCIA 1', '')
            res2 = row.get('RESISTENCIA 2', '')
            res3 = row.get('RESISTENCIA 3', '')
            res4 = row.get('RESISTENCIA 4', '')
            print(f"  RESISTENCIAS: {res1} | {res2} | {res3} | {res4}")
            
            # Tipos
            tipo1 = row.get('Tipo de muestra 1', '')
            tipo2 = row.get('Tipo de muestra 2', '')
            print(f"  TIPOS: {tipo1} | {tipo2}")
            
            # Otros datos
            rev = row.get('Revenimiento', '')
            masa = row.get('Masa Unitaria', '')
            temp_amb = row.get('Temperatura Ambiente', '')
            temp_conc = row.get('Temperatura Concreto', '')
            print(f"  DATOS: Rev={rev} | Masa={masa} | TempAmb={temp_amb} | TempConc={temp_conc}")
        
        print(f"\n🔍 ANÁLISIS DE PATRONES:")
        
        # Analizar tipos únicos
        tipos_unicos = set()
        edades_encontradas = set()
        resistencias_con_datos = 0
        total_muestras_posibles = 0
        
        for row in rows:
            for i in range(1, 5):
                tipo_key = f'Tipo de muestra {i}'
                edad_key = f'EDAD {i}' if i < 4 else 'EDAD 4 '  # EDAD 4 tiene espacio
                res_key = f'RESISTENCIA {i}'
                
                if row.get(tipo_key, '').strip():
                    tipos_unicos.add(row[tipo_key].strip())
                
                if row.get(edad_key, '').strip():
                    edades_encontradas.add(row[edad_key].strip())
                    total_muestras_posibles += 1
                    
                    if row.get(res_key, '').strip():
                        resistencias_con_datos += 1
        
        print(f"  Tipos de muestra únicos: {sorted(tipos_unicos)}")
        print(f"  Edades encontradas: {sorted(edades_encontradas, key=lambda x: int(x) if x.isdigit() else 0)}")
        print(f"  Total muestras posibles: {total_muestras_posibles}")
        print(f"  Resistencias con datos: {resistencias_con_datos}")
        print(f"  Muestras PENDIENTES: {total_muestras_posibles - resistencias_con_datos}")

if __name__ == "__main__":
    analizar_csv()
