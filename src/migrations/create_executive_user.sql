-- Este script es para ejecutarlo manualmente desde Supabase para crear
-- un usuario con rol de EXECUTIVE cuando no hay ninguno.
-- IMPORTANTE: Debes reemplazar los valores de ejemplo con datos reales.

-- 1. Insertar usuario en la tabla auth.users (requiere permisos especiales)
-- Esto NO funcionará directamente desde el SQL Editor normal de Supabase,
-- porque necesita permisos especiales para insertar en auth.users.
-- Es mejor usar la página Authentication > Users en Supabase para crear el usuario.

-- Sin embargo, si ya has creado un usuario y solo necesitas asignarle el rol EXECUTIVE:

-- 2. Actualizar directamente el perfil existente a EXECUTIVE
-- (Reemplaza 'correo@ejemplo.com' con el email del usuario real)
UPDATE public.user_profiles
SET role = 'EXECUTIVE'
WHERE email = 'correo@ejemplo.com';

-- Alternativa: Actualizar por ID de usuario
-- (Reemplaza 'id-del-usuario-aqui' con el UUID real del usuario)
-- UPDATE public.user_profiles
-- SET role = 'EXECUTIVE'
-- WHERE id = 'id-del-usuario-aqui';

-- Verificar si el usuario ahora es EXECUTIVE
SELECT * FROM public.user_profiles
WHERE role = 'EXECUTIVE'; 