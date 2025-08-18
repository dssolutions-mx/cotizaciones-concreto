#!/usr/bin/env python3
"""
Script para analizar detalladamente el archivo Calidad P4.csv
"""

import csv

def analizar_csv_p4():
    """
    Analiza la estructura del CSV para identificar problemas
    """
    archivo_csv = "archivoexcel/Calidad P4.csv"
    
    print("=== ANÁLISIS DETALLADO DEL CSV PLANTA 4 ===\n")
    
    with open(archivo_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        # Analizar primeras 10 filas para entender estructura
        for i, row in enumerate(reader):
            if i >= 10:
                break
                
            print(f"FILA {i+2}:")
            print(f"  Remisión: {row['Número de remisión']}")
            print(f"  Cantidad Muestras: {row['Cantidad de Muestras']}")
            print(f"  Tipo Muestra 1: \"{row['TIPO DE MUESTRA 1']}\"")
            print(f"  Tipo Muestra 2: \"{row['TIPO DE MUESTRA 2']}\"")
            print(f"  Tipo Muestra 3: \"{row['TIPO DE MUESTRA 3']}\"")
            print(f"  Tipo Muestra 4: \"{row['TIPO DE MUESTRA 4']}\"")
            print(f"  EDAD 1: {row['EDAD 1']}")
            print(f"  EDAD 2: {row['EDAD 2']}")
            print(f"  EDAD 3: {row['EDAD 3']}")
            print(f"  EDAD 4: {row['EDAD 4']}")
            print(f"  CARGA 1: {row['CARGA 1 (KG)']}")
            print(f"  CARGA 2: {row['CARGA 2 (KG)']}")
            print(f"  CARGA 3: {row['CARGA 3 (KG)']}")
            print(f"  CARGA 4: {row['CARGA 4 (KG)']}")
            print()
    
    print("\n=== ANÁLISIS DE PATRONES ===\n")
    
    # Reiniciar el archivo para análisis completo
    with open(archivo_csv, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        tipos_muestra_unicos = set()
        cantidad_muestras_valores = set()
        edades_maximas = []
        
        for row in reader:
            # Recopilar tipos de muestra únicos
            for i in range(1, 5):
                tipo = row[f'TIPO DE MUESTRA {i}'].strip()
                if tipo:
                    tipos_muestra_unicos.add(tipo)
            
            # Recopilar valores de cantidad de muestras
            cantidad = row['Cantidad de Muestras'].strip()
            if cantidad:
                cantidad_muestras_valores.add(cantidad)
            
            # Analizar EDAD 1 para determinar patrón
            edad1 = row['EDAD 1'].strip()
            if edad1:
                try:
                    edades_maximas.append(float(edad1))
                except:
                    pass
    
    print("TIPOS DE MUESTRA ÚNICOS:")
    for tipo in sorted(tipos_muestra_unicos):
        print(f"  - \"{tipo}\"")
    
    print(f"\nCANTIDAD DE MUESTRAS VALORES:")
    for cantidad in sorted(cantidad_muestras_valores):
        print(f"  - {cantidad}")
    
    print(f"\nEDADES 1 ANALIZADAS:")
    print(f"  - Mínima: {min(edades_maximas) if edades_maximas else 'N/A'}")
    print(f"  - Máxima: {max(edades_maximas) if edades_maximas else 'N/A'}")
    print(f"  - Edades > 10: {len([e for e in edades_maximas if e > 10])}")
    print(f"  - Edades <= 10: {len([e for e in edades_maximas if e <= 10])}")

if __name__ == "__main__":
    analizar_csv_p4()
