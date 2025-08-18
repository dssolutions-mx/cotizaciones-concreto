#!/usr/bin/env python3
"""
Script para aplicar el SQL completo de P4 con dimensiones en lotes eficientes
"""

def aplicar_sql_p4_completo():
    """Aplica el SQL completo de P4 en lotes manejables"""
    
    archivo_sql = "carga_p4_con_dimensiones_20250817_215409.sql"
    
    with open(archivo_sql, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Dividir en secciones
    secciones = content.split("-- ==========================================")
    
    print(f"📋 Archivo SQL tiene {len(secciones)} secciones")
    
    # Extraer sección de muestras completa
    seccion_muestras = None
    for seccion in secciones:
        if "PASO 2: CREAR MUESTRAS CON DIMENSIONES ESPECÍFICAS" in seccion:
            seccion_muestras = seccion
            break
    
    if seccion_muestras:
        # Extraer solo el INSERT de muestras
        inicio = seccion_muestras.find("INSERT INTO public.muestras")
        fin = seccion_muestras.find("-- Muestras creadas:")
        
        if inicio != -1 and fin != -1:
            insert_muestras = seccion_muestras[inicio:fin].strip()
            
            # Guardar en archivo
            with open("muestras_p4_con_dimensiones_completas.sql", 'w', encoding='utf-8') as f:
                f.write("-- MUESTRAS P4 CON DIMENSIONES ESPECÍFICAS COMPLETAS\n")
                f.write("-- CUBO 10x10: cube_side_cm = 10\n")
                f.write("-- CUBO 15x15: cube_side_cm = 15\n")
                f.write("-- VIGA: beam_width_cm = 15, beam_height_cm = 15, beam_span_cm = 60\n\n")
                f.write(insert_muestras)
            
            print("✅ SQL de muestras con dimensiones extraído: muestras_p4_con_dimensiones_completas.sql")
            
            # Contar líneas para dividir en lotes
            lineas_values = insert_muestras.count("('")
            print(f"📊 Total de muestras en SQL: {lineas_values}")
    
    # Extraer sección de ensayos
    seccion_ensayos = None
    for seccion in secciones:
        if "PASO 3: CREAR ENSAYOS" in seccion:
            seccion_ensayos = seccion
            break
    
    if seccion_ensayos:
        inicio = seccion_ensayos.find("INSERT INTO public.ensayos")
        fin = seccion_ensayos.find("-- Ensayos creados:")
        
        if inicio != -1 and fin != -1:
            insert_ensayos = seccion_ensayos[inicio:fin].strip()
            
            with open("ensayos_p4_completos.sql", 'w', encoding='utf-8') as f:
                f.write("-- ENSAYOS P4 COMPLETOS\n\n")
                f.write(insert_ensayos)
            
            print("✅ SQL de ensayos extraído: ensayos_p4_completos.sql")
            
            lineas_ensayos = insert_ensayos.count("('")
            print(f"📊 Total de ensayos en SQL: {lineas_ensayos}")

if __name__ == "__main__":
    aplicar_sql_p4_completo()
