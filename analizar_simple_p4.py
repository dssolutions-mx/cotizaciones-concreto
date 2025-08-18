#!/usr/bin/env python3
import csv

with open('archivoexcel/Calidad P4.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    
    print("=== ANÁLISIS ESTRUCTURA CSV P4 ===")
    print()
    
    tipos_muestra = set()
    cantidad_muestras = set()
    
    for i, row in enumerate(reader):
        if i < 5:  # Solo primeras 5 filas
            print(f"FILA {i+2}: Remisión {row['Número de remisión']}")
            print(f"  Cantidad: {row['Cantidad de Muestras']}")
            print(f"  Tipos: {row['TIPO DE MUESTRA 1']} | {row['TIPO DE MUESTRA 2']} | {row['TIPO DE MUESTRA 3']} | {row['TIPO DE MUESTRA 4']}")
            print(f"  Edades: {row['EDAD 1']} | {row['EDAD 2']} | {row['EDAD 3']} | {row['EDAD 4']}")
            print(f"  Cargas: {row['CARGA 1 (KG)']} | {row['CARGA 2 (KG)']} | {row['CARGA 3 (KG)']} | {row['CARGA 4 (KG)']}")
            print()
        
        # Recopilar todos los tipos
        for j in range(1, 5):
            tipo = row[f'TIPO DE MUESTRA {j}'].strip()
            if tipo:
                tipos_muestra.add(tipo)
        
        cantidad = row['Cantidad de Muestras'].strip()
        if cantidad:
            cantidad_muestras.add(cantidad)
    
    print("TIPOS DE MUESTRA ÚNICOS:")
    for tipo in sorted(tipos_muestra):
        print(f"  - '{tipo}'")
    
    print(f"\nCANTIDAD DE MUESTRAS:")
    for cant in sorted(cantidad_muestras):
        print(f"  - {cant}")
