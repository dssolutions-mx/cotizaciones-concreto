# Actualización de Normativas ASTM a NMX

Este documento describe cómo actualizar las normativas en los estudios existentes de ASTM a NMX.

## 📋 Resumen del Cambio

Se actualizarán todas las referencias de normativas en la base de datos:

| Estudio | Normativa Anterior | Normativa Nueva |
|---------|-------------------|-----------------|
| Análisis Granulométrico | ASTM C136 / NMX-C-077 | NMX-C-077 |
| Densidad | ASTM C127/C128 | NMX-C-164 / NMX-C-165 |
| Masa Volumétrico | ASTM C29 / NMX-C-073 | NMX-C-073 |
| Pérdida por Lavado | ASTM C117 / NMX-C-084 | NMX-C-084 |
| Absorción | ASTM C127/C128 | NMX-C-164 / NMX-C-165 |

## 🚀 Opción 1: Script desde el Proyecto (Recomendado)

Este método ejecuta un script desde tu proyecto que actualiza la base de datos.

### Requisitos
- Node.js instalado
- Variables de entorno configuradas en `.env.local`

### Pasos

1. **Asegúrate de tener las variables de entorno configuradas:**
   ```bash
   # En tu archivo .env.local
   NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
   # O mejor aún
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   ```

2. **Ejecuta el script:**
   ```bash
   node scripts/update-normas-to-nmx.js
   ```

3. **Verifica los resultados:**
   El script mostrará:
   - Número de registros actualizados por cada tipo de estudio
   - Ejemplos de normativas antiguas encontradas
   - Resumen final con el estado de todas las normativas

4. **Recarga tu aplicación:**
   - Refresca tu navegador
   - Las tarjetas ahora mostrarán solo las normativas NMX

### Ejemplo de salida esperada:
```
🔄 Iniciando actualización de normativas ASTM a NMX...

📋 Actualizando: Análisis Granulométrico
   📊 Registros encontrados: 5
   📝 Ejemplos de normativas antiguas: ASTM C136 / NMX-C-077
   ✅ Actualizados: 5 registros a "NMX-C-077"

📋 Actualizando: Densidad
   📊 Registros encontrados: 3
   📝 Ejemplos de normativas antiguas: ASTM C127/C128
   ✅ Actualizados: 3 registros a "NMX-C-164 / NMX-C-165"

...

✨ Proceso completado. Total de registros actualizados: 15

💡 Recuerda recargar la página en tu aplicación para ver los cambios.
```

## 🗄️ Opción 2: Migración SQL en Supabase

Este método ejecuta una migración SQL directamente en Supabase.

### Pasos

1. **Accede al Dashboard de Supabase:**
   - Ve a https://app.supabase.com
   - Selecciona tu proyecto

2. **Ve al SQL Editor:**
   - En el menú lateral, selecciona "SQL Editor"
   - Click en "New query"

3. **Copia y pega el SQL:**
   Copia el contenido del archivo `supabase/migrations/20250107_update_normas_to_nmx.sql`

4. **Ejecuta la consulta:**
   - Click en el botón "Run" o presiona `Ctrl + Enter`
   - Espera a que se complete

5. **Verifica los resultados:**
   La última parte del script mostrará un resumen agrupado de las normativas

## ✅ Verificación Post-Actualización

Después de ejecutar cualquiera de las dos opciones:

1. **Verifica en la aplicación:**
   - Ve a `/quality/caracterizacion-materiales`
   - Abre cualquier estudio existente
   - Las tarjetas deben mostrar solo normativas NMX

2. **Verifica en la base de datos:**
   ```sql
   SELECT 
       nombre_estudio,
       norma_referencia,
       COUNT(*) as total
   FROM estudios_seleccionados
   GROUP BY nombre_estudio, norma_referencia
   ORDER BY nombre_estudio;
   ```

   No deberías ver ninguna referencia ASTM

## 🔄 Reversión (si es necesario)

Si necesitas revertir los cambios, ejecuta en SQL:

```sql
-- SOLO SI NECESITAS REVERTIR
-- Esto restaura las normativas antiguas

UPDATE estudios_seleccionados
SET norma_referencia = 'ASTM C136 / NMX-C-077'
WHERE nombre_estudio = 'Análisis Granulométrico';

UPDATE estudios_seleccionados
SET norma_referencia = 'ASTM C127/C128'
WHERE nombre_estudio IN ('Densidad', 'Absorción');

UPDATE estudios_seleccionados
SET norma_referencia = 'ASTM C29 / NMX-C-073'
WHERE nombre_estudio = 'Masa Volumétrico';

UPDATE estudios_seleccionados
SET norma_referencia = 'ASTM C117 / NMX-C-084'
WHERE nombre_estudio = 'Pérdida por Lavado';
```

## 📝 Notas Importantes

1. **Nuevos estudios:** Todos los estudios creados a partir de ahora ya tendrán las normativas NMX automáticamente.

2. **Backup:** Este script actualiza solo el campo `norma_referencia` y no afecta los resultados de los estudios.

3. **Sin tiempo de inactividad:** La actualización no requiere detener la aplicación.

4. **Idempotente:** Puedes ejecutar el script múltiples veces sin problema, solo actualizará los registros que todavía tengan ASTM.

## 🆘 Solución de Problemas

### Error: "Faltan las variables de entorno"
- Verifica que `.env.local` existe y tiene las variables correctas
- Reinicia tu terminal después de crear/modificar `.env.local`

### Error: "Permission denied"
- Asegúrate de usar `SUPABASE_SERVICE_ROLE_KEY` en lugar de `ANON_KEY`
- El servicio role key tiene permisos de administrador

### No se ven los cambios en la UI
- Recarga la página completamente (Ctrl + Shift + R)
- Limpia el caché del navegador
- Verifica que el script reportó actualizaciones exitosas

## 📞 Soporte

Si encuentras problemas al ejecutar la actualización, verifica:
1. Que el script reportó cambios exitosos
2. Que no hay errores en la consola
3. Que las variables de entorno están correctas

---

**Última actualización:** 7 de enero de 2025

