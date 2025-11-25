# 🔒 Filtrado por Business Unit - Caracterización y Estudios de Materiales

## 📋 Resumen de Cambios

Se ha implementado el filtrado por `business_unit_id` para que los usuarios solo vean datos correspondientes a su unidad de negocio en:

✅ **Página de Caracterización de Materiales** (`/quality/caracterizacion-materiales`)
✅ **Página de Estudios de Materiales** (`/quality/estudios`)

---

## 🎯 Objetivo

Usuarios asignados a una unidad de negocio específica (ej: **BAJIO**) solo podrán ver:
- Estudios de caracterización de materiales de plantas de su unidad (P001, P005)
- Materiales asociados a plantas de su unidad
- Certificados de materiales de su unidad

---

## 🚀 Cómo Aplicar los Cambios

### Paso 1: Ejecutar la Migración en Supabase

1. Abre **Supabase Dashboard** → **SQL Editor**
2. Copia y pega el contenido completo del archivo:
   ```
   supabase/migrations/20250201_fix_business_unit_filtering_ALL_IN_ONE.sql
   ```
3. Haz clic en **"Run"**
4. Revisa los mensajes en la consola:
   ```
   ✓ Business Unit BAJIO existe
   ✓ Planta P001 asignada a BAJIO
   ✓ Planta P005 asignada a BAJIO
   ✓ Políticas RLS creadas correctamente
   ```

### Paso 2: Verificar Asignación de Usuarios

Asegúrate de que los usuarios tengan su `business_unit_id` configurado correctamente:

```sql
-- Consultar usuarios y sus asignaciones
SELECT 
    email,
    first_name,
    last_name,
    role,
    business_unit_id,
    plant_id
FROM public.user_profiles
WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE')
ORDER BY email;
```

### Paso 3: Asignar Business Unit a Usuarios (si es necesario)

Si un usuario del BAJIO no tiene `business_unit_id`:

```sql
-- Obtener ID del business unit BAJIO
SELECT id, code, name 
FROM public.business_units 
WHERE code = 'BAJIO';

-- Actualizar usuario (reemplaza los valores)
UPDATE public.user_profiles
SET business_unit_id = 'UUID_DEL_BAJIO_AQUI'
WHERE email = 'usuario@ejemplo.com';
```

### Paso 4: Probar el Filtrado

1. **Cierra sesión** en la aplicación
2. **Inicia sesión** con un usuario del BAJIO
3. Ve a `/quality/caracterizacion-materiales`
   - Deberías ver solo estudios de P001 y P005
4. Ve a `/quality/estudios`
   - Deberías ver solo materiales de P001 y P005

---

## 📊 Matriz de Acceso

| Usuario | Configuración | Acceso en Caracterización | Acceso en Estudios |
|---------|--------------|--------------------------|-------------------|
| Usuario con `business_unit_id = BAJIO` | business_unit_id definido | ✓ Solo estudios de P001 y P005 | ✓ Solo materiales de P001 y P005 |
| Usuario con `plant_id = P001` | plant_id definido | ✓ Solo estudios de P001 | ✓ Solo materiales de P001 |
| EXECUTIVE sin restricciones | Sin business_unit_id ni plant_id | ✓ Todos los estudios | ✓ Todos los materiales |
| CLIENT u otros roles | Roles sin privilegios especiales | ❌ Sin acceso a gestión | ✓ Todos los materiales activos (solo lectura) |

---

## 🔍 Qué Hace la Migración

### 1. Configuración de Business Unit BAJIO
- ✅ Crea o actualiza el business unit con código "BAJIO"
- ✅ Asigna plantas P001 y P005 a BAJIO

### 2. Políticas RLS para `alta_estudio` (Caracterización)
- ✅ SELECT: Ver solo estudios de plantas de su business_unit
- ✅ INSERT: Crear solo en plantas de su business_unit
- ✅ UPDATE: Modificar solo estudios de su business_unit
- ✅ DELETE: Eliminar solo estudios de su business_unit

### 3. Políticas RLS para `estudios_seleccionados`
- ✅ Heredan el acceso del `alta_estudio` padre
- ✅ Filtrado automático por business_unit

### 4. Políticas RLS para `materials`
- ✅ SELECT: 
  - Roles de gestión (QUALITY_TEAM, EXECUTIVE, etc.): filtrado por business_unit
  - Otros roles: acceso completo a materiales activos (lectura)
- ✅ INSERT/UPDATE/DELETE: Solo roles de gestión en su business_unit

### 5. Políticas RLS para `material_certificates`
- ✅ SELECT: Filtrado basado en acceso al material padre
- ✅ INSERT/DELETE: Solo QUALITY_TEAM y EXECUTIVE en su business_unit

---

## ✅ Checklist de Verificación

- [ ] Ejecuté la migración SQL en Supabase
- [ ] Verifiqué que BAJIO existe y tiene P001 y P005 asignadas
- [ ] Verifiqué que mi usuario tiene `business_unit_id` correcto
- [ ] Cerré sesión y volví a iniciar
- [ ] Probé en `/quality/caracterizacion-materiales`
  - [ ] Solo veo estudios de P001 y P005
  - [ ] Puedo crear estudios solo en P001 y P005
- [ ] Probé en `/quality/estudios`
  - [ ] Solo veo materiales de P001 y P005
  - [ ] Solo veo certificados de materiales de P001 y P005

---

## 🔧 Troubleshooting

### Problema: Todavía veo estudios/materiales de otras business units

**Soluciones:**

1. **Verificar políticas RLS:**
   ```sql
   -- Para alta_estudio
   SELECT policyname, cmd 
   FROM pg_policies 
   WHERE tablename = 'alta_estudio' 
   AND schemaname = 'public';
   
   -- Para materials
   SELECT policyname, cmd 
   FROM pg_policies 
   WHERE tablename = 'materials' 
   AND schemaname = 'public';
   ```

2. **Verificar asignación del usuario:**
   ```sql
   SELECT 
       up.email, 
       up.business_unit_id, 
       bu.code as business_unit_code,
       up.plant_id,
       p.code as plant_code
   FROM user_profiles up
   LEFT JOIN business_units bu ON up.business_unit_id = bu.id
   LEFT JOIN plants p ON up.plant_id = p.id
   WHERE up.email = 'tu_email@ejemplo.com';
   ```

3. **Verificar relación plantas-business unit:**
   ```sql
   SELECT 
       p.code as plant_code, 
       p.name as plant_name,
       bu.code as business_unit_code,
       bu.name as business_unit_name
   FROM plants p 
   LEFT JOIN business_units bu ON p.business_unit_id = bu.id 
   WHERE p.code IN ('P001', 'P005')
   ORDER BY p.code;
   ```
   - Ambas deben mostrar `business_unit_code = 'BAJIO'`

4. **Limpiar caché:**
   - Cierra sesión
   - Limpia cookies y caché del navegador
   - Inicia sesión de nuevo

### Problema: No puedo crear estudios/materiales

**Causa probable:** Tu usuario no tiene `business_unit_id` asignado o está asignado a una business unit diferente.

**Solución:** Actualiza el `business_unit_id` del usuario:
```sql
-- Primero verifica el ID de BAJIO
SELECT id FROM business_units WHERE code = 'BAJIO';

-- Luego actualiza el usuario
UPDATE user_profiles
SET business_unit_id = 'UUID_AQUI'
WHERE email = 'tu_email@ejemplo.com';
```

### Problema: Error al ejecutar la migración

**Posibles causas:**
1. Las tablas `alta_estudio` o `estudios_seleccionados` no existen
   - **Solución:** Ejecutar primero la migración de creación de tablas de caracterización
2. La tabla `business_units` no existe
   - **Solución:** Crear la tabla business_units primero

---

## 📝 Archivos Modificados

### Frontend:
- ✅ `src/app/quality/estudios/page.tsx` - Filtrado de plantas y materiales por business_unit
- ✅ `src/app/quality/caracterizacion-materiales/page.tsx` - Ya tenía el filtrado (verificado)
- ✅ `src/app/quality/caracterizacion-materiales/nuevo/page.tsx` - Ya tenía el filtrado (verificado)

### Backend (Migraciones SQL):
- ✅ `supabase/migrations/20250201_fix_business_unit_filtering_ALL_IN_ONE.sql` - Migración completa

---

## 🎯 Ejemplo de Uso

### Escenario: Usuario del BAJIO

**Usuario:**
- Email: `calidad.bajio@empresa.com`
- Role: `QUALITY_TEAM`
- Business Unit: `BAJIO` (ID asignado)

**Lo que puede hacer:**

1. **En Caracterización (`/quality/caracterizacion-materiales`):**
   - Ver estudios de P001 y P005
   - Crear nuevos estudios para P001 o P005
   - Editar/eliminar estudios de P001 y P005
   - NO ver estudios de P002, P003, P004, etc.

2. **En Estudios (`/quality/estudios`):**
   - Ver materiales de P001 y P005
   - Subir certificados para materiales de P001 y P005
   - Gestionar certificados de planta para P001 y P005
   - NO ver materiales de otras plantas

3. **Filtro de plantas:**
   - El selector de plantas solo muestra P001 y P005
   - No puede seleccionar plantas de otras business units

---

## 🚀 Próximos Pasos

Después de aplicar esta configuración:

1. **Crear usuarios específicos por business unit**
   - Asignar correctamente `business_unit_id` a cada usuario
   - Verificar que los permisos se aplican correctamente

2. **Documentar otras business units**
   - Si existen más unidades (ej: NORTE, SUR), asegurar que:
     - Están creadas en la tabla `business_units`
     - Las plantas están correctamente asignadas
     - Los usuarios tienen el `business_unit_id` correcto

3. **Monitorear el rendimiento**
   - Las políticas RLS agregan JOINs a las consultas
   - Verificar que los índices están optimizados:
     - `idx_materials_plant_id`
     - `idx_alta_estudio_planta`

---

## 📞 Soporte

Si después de seguir todos los pasos el filtrado no funciona:

1. Ejecuta esta consulta de diagnóstico completo:
   ```sql
   -- Diagnóstico completo
   SELECT 'Business Units' as seccion, code, name, is_active 
   FROM business_units
   UNION ALL
   SELECT 'Plantas', p.code, p.name || ' (BU: ' || COALESCE(bu.code, 'SIN ASIGNAR') || ')', p.is_active::text
   FROM plants p
   LEFT JOIN business_units bu ON p.business_unit_id = bu.id
   ORDER BY seccion, code;
   ```

2. Copia los resultados y compártelos con el equipo técnico
3. Incluye:
   - Email del usuario que está probando
   - Business unit al que debe pertenecer
   - Qué datos ve (plantas/materiales que no debería ver)
   - Screenshots si es posible

---

## ✨ Beneficios de esta Implementación

✅ **Seguridad mejorada:** Aislamiento de datos por unidad de negocio  
✅ **Escalabilidad:** Fácil agregar nuevas business units  
✅ **Flexibilidad:** Soporte para múltiples niveles (business_unit, plant, global)  
✅ **Mantenibilidad:** Políticas RLS centralizadas en la base de datos  
✅ **Performance:** Filtrado en la base de datos, no en el frontend  

---

**Fecha de creación:** 2025-02-01  
**Versión:** 1.0  
**Autor:** Sistema de IA





