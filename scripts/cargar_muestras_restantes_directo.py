#!/usr/bin/env python3
"""
Script para cargar directamente las muestras restantes
"""

def extraer_muestras_desde_linea(inicio_linea):
    """
    Extrae muestras desde una línea específica del SQL
    """
    archivo_sql = "carga_planta4_corregido_20250817_203726.sql"
    
    with open(archivo_sql, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Buscar líneas que contienen VALUES de muestras
    muestras_lines = []
    in_muestras_section = False
    
    for line in lines:
        line = line.strip()
        if "INSERT INTO public.muestras" in line:
            in_muestras_section = True
            continue
        elif "-- PASO 3: CREAR ENSAYOS" in line:
            break
        elif in_muestras_section and line.startswith("('") and "', 'M" in line:
            muestras_lines.append(line)
    
    print(f"Total líneas de muestras encontradas: {len(muestras_lines)}")
    
    # Tomar desde la línea especificada
    muestras_restantes = muestras_lines[inicio_linea:]
    print(f"Muestras desde línea {inicio_linea}: {len(muestras_restantes)}")
    
    return muestras_restantes

def crear_lote_sql(muestras, lote_num):
    """
    Crea SQL para un lote de muestras
    """
    # Limpiar última línea
    if muestras:
        ultima = muestras[-1]
        if ultima.endswith(','):
            muestras[-1] = ultima[:-1]
    
    sql = f"""-- Muestras P4 Corregidas - Lote directo {lote_num}
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
    
    for i, muestra in enumerate(muestras):
        separador = "," if i < len(muestras) - 1 else ""
        sql += f"    {muestra}{separador}\n"
    
    sql += ") AS datos(remision, identificacion, tipo_muestra, fecha_programada_ensayo, fecha_programada_ensayo_ts, estado, plant_id, event_timezone)\n"
    sql += "JOIN public.muestreos m ON m.manual_reference = datos.remision AND m.planta = 'P4';"
    
    return sql

if __name__ == "__main__":
    # Ya cargamos aproximadamente 104 muestras, necesitamos las restantes
    muestras_restantes = extraer_muestras_desde_linea(104)
    
    # Dividir en lotes de 60
    lote_size = 60
    for i in range(0, len(muestras_restantes), lote_size):
        lote = muestras_restantes[i:i+lote_size]
        sql = crear_lote_sql(lote, i//lote_size + 1)
        
        archivo = f"muestras_restantes_lote_{i//lote_size + 1}.sql"
        with open(archivo, 'w', encoding='utf-8') as f:
            f.write(sql)
        
        print(f"✅ Creado {archivo} con {len(lote)} muestras")
