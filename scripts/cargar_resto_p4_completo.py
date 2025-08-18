#!/usr/bin/env python3
"""
Script para cargar el resto de muestras y ensayos de P4 de forma eficiente
"""

def cargar_resto_p4():
    """Carga el resto de datos de P4"""
    
    # Primero cargar todas las muestras restantes
    print("🔄 Cargando muestras restantes...")
    
    # Como son muchas muestras, voy a usar el SQL completo dividido en secciones
    archivo_sql = "carga_p4_definitiva_20250817_212810.sql"
    
    with open(archivo_sql, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extraer la sección completa de muestras
    inicio_muestras = content.find("INSERT INTO public.muestras")
    fin_muestras = content.find("-- ==========================================\n-- PASO 3: CREAR ENSAYOS")
    
    if inicio_muestras != -1 and fin_muestras != -1:
        seccion_muestras = content[inicio_muestras:fin_muestras].strip()
        
        # Guardar en archivo separado
        with open("muestras_p4_completas.sql", 'w', encoding='utf-8') as f:
            f.write(seccion_muestras)
        
        print("✅ Sección de muestras extraída: muestras_p4_completas.sql")
    
    # Extraer la sección completa de ensayos
    inicio_ensayos = content.find("INSERT INTO public.ensayos")
    fin_ensayos = content.find("-- ==========================================\n-- PASO 4: VERIFICACIONES")
    
    if inicio_ensayos != -1 and fin_ensayos != -1:
        seccion_ensayos = content[inicio_ensayos:fin_ensayos].strip()
        
        # Guardar en archivo separado
        with open("ensayos_p4_completos.sql", 'w', encoding='utf-8') as f:
            f.write(seccion_ensayos)
        
        print("✅ Sección de ensayos extraída: ensayos_p4_completos.sql")

if __name__ == "__main__":
    cargar_resto_p4()
