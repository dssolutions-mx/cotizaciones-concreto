#!/usr/bin/env python3
"""
Script para cargar todas las muestras restantes de P4 directamente
"""

def cargar_muestras_restantes():
    """
    Extrae y carga las muestras restantes del SQL corregido
    """
    archivo_sql = "carga_planta4_corregido_20250817_203726.sql"
    
    with open(archivo_sql, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Encontrar la sección de muestras
    inicio = content.find("INSERT INTO public.muestras")
    fin = content.find("-- ==============================================\n-- PASO 3: CREAR ENSAYOS")
    
    if inicio == -1 or fin == -1:
        print("Error: No se pudo encontrar la sección de muestras")
        return
    
    seccion_muestras = content[inicio:fin].strip()
    
    # Extraer líneas de VALUES (saltar las primeras 50 ya cargadas)
    lineas = seccion_muestras.split('\n')
    valores_lineas = []
    
    for linea in lineas:
        linea = linea.strip()
        if linea.startswith("('") and ("', 'M" in linea):
            valores_lineas.append(linea)
    
    print(f"Total líneas de muestras encontradas: {len(valores_lineas)}")
    
    # Saltar las primeras 50 ya cargadas
    muestras_restantes = valores_lineas[50:]
    print(f"Muestras restantes por cargar: {len(muestras_restantes)}")
    
    # Dividir en lotes de 60
    lote_size = 60
    total_lotes = (len(muestras_restantes) + lote_size - 1) // lote_size
    
    for i in range(total_lotes):
        inicio_lote = i * lote_size
        fin_lote = min((i + 1) * lote_size, len(muestras_restantes))
        lote = muestras_restantes[inicio_lote:fin_lote]
        
        # Limpiar la última línea del lote
        if lote:
            ultima_linea = lote[-1]
            if ultima_linea.endswith(','):
                lote[-1] = ultima_linea[:-1]
        
        # Crear archivo SQL para este lote
        sql_lote = f"""-- Muestras P4 Corregidas - Lote {i+1} de {total_lotes}
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
        
        for j, valor in enumerate(lote):
            separador = "," if j < len(lote) - 1 else ""
            sql_lote += f"    {valor}{separador}\n"
        
        sql_lote += ") AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)\n"
        sql_lote += "JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4';"
        
        # Guardar en archivo
        archivo_lote = f"muestras_p4_corregidas_lote_{i+1}.sql"
        with open(archivo_lote, 'w', encoding='utf-8') as f:
            f.write(sql_lote)
        
        print(f"✅ Lote {i+1} creado: {archivo_lote} ({len(lote)} muestras)")

if __name__ == "__main__":
    cargar_muestras_restantes()
