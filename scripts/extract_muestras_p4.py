#!/usr/bin/env python3
"""
Script para extraer y dividir la sección de muestras del SQL generado
para cargar en lotes más pequeños
"""

import re

def extraer_muestras_sql():
    """
    Extrae la sección de muestras del SQL generado y la divide en lotes
    """
    archivo_sql = "carga_planta4_20250817_201139.sql"
    
    with open(archivo_sql, 'r', encoding='utf-8') as f:
        contenido = f.read()
    
    # Encontrar la sección de muestras
    inicio_muestras = contenido.find("INSERT INTO public.muestras")
    fin_muestras = contenido.find("-- ==============================================\n-- PASO 3: CREAR ENSAYOS")
    
    if inicio_muestras == -1 or fin_muestras == -1:
        print("Error: No se pudo encontrar la sección de muestras")
        return
    
    seccion_muestras = contenido[inicio_muestras:fin_muestras].strip()
    
    # Extraer solo las líneas de VALUES
    lineas = seccion_muestras.split('\n')
    valores_lineas = []
    capturando_valores = False
    
    for linea in lineas:
        linea = linea.strip()
        if linea.startswith("('") and linea.endswith("'),") or linea.endswith("')"):
            valores_lineas.append(linea)
        elif "VALUES" in linea:
            capturando_valores = True
    
    print(f"Total líneas de valores encontradas: {len(valores_lineas)}")
    
    # Dividir en lotes de 50
    lote_size = 50
    total_lotes = (len(valores_lineas) + lote_size - 1) // lote_size
    
    print(f"Dividiendo en {total_lotes} lotes de máximo {lote_size} muestras cada uno")
    
    for i in range(total_lotes):
        inicio_lote = i * lote_size
        fin_lote = min((i + 1) * lote_size, len(valores_lineas))
        lote_valores = valores_lineas[inicio_lote:fin_lote]
        
        # Ajustar la última línea del lote (quitar coma)
        if lote_valores:
            ultima_linea = lote_valores[-1]
            if ultima_linea.endswith(','):
                lote_valores[-1] = ultima_linea[:-1]  # Quitar la coma final
        
        # Crear SQL para este lote
        sql_lote = f"""-- Carga masiva de muestras Planta 4 - Lote {i+1} de {total_lotes}
INSERT INTO public.muestras (
  muestreo_id, identificacion, tipo_muestra, fecha_programada_ensayo,
  fecha_programada_ensayo_ts, estado, plant_id, event_timezone,
  created_at, updated_at
)
SELECT 
  m.id as muestreo_id,
  datos.identificacion,
  datos.tipo_muestra,
  datos.fecha_programada_ensayo::date,
  datos.fecha_programada_ensayo_ts::timestamptz,
  datos.estado,
  datos.plant_id::uuid,
  datos.event_timezone,
  now() as created_at,
  now() as updated_at
FROM (
  VALUES
"""
        
        for j, valor in enumerate(lote_valores):
            separador = "," if j < len(lote_valores) - 1 else ""
            sql_lote += f"    {valor}{separador}\n"
        
        sql_lote += ") AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)\n"
        sql_lote += "JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4';"
        
        # Guardar lote en archivo
        archivo_lote = f"muestras_p4_lote_{i+1}.sql"
        with open(archivo_lote, 'w', encoding='utf-8') as f:
            f.write(sql_lote)
        
        print(f"✅ Lote {i+1} guardado: {archivo_lote} ({len(lote_valores)} muestras)")

if __name__ == "__main__":
    extraer_muestras_sql()
