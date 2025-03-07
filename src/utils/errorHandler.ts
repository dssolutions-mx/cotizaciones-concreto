import { PostgrestError } from '@supabase/supabase-js';

/**
 * Maneja errores de Supabase y otros errores de la aplicación de manera consistente
 * @param error - El error que se produjo
 * @param context - El contexto donde ocurrió el error para facilitar el debugging
 * @returns Un mensaje de error amigable
 */
export const handleError = (error: PostgrestError | Error | unknown, context: string): string => {
  // Registrar el error para debugging
  console.error(`Error en ${context}:`, error);
  
  // Para errores específicos de Supabase
  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as PostgrestError;
    
    switch (pgError.code) {
      case '23505': // Violación de unicidad
        return 'Ya existe un registro con esa información.';
      case '23503': // Violación de clave foránea
        return 'La información está siendo usada por otros registros.';
      case '42P01': // Tabla no existe
        return 'Ha ocurrido un error en la base de datos.';
      case '23502': // Violación de no nulidad
        return 'Falta información requerida.';
      default:
        return `Error: ${pgError.message || 'Desconocido'}`;
    }
  }
  
  // Para errores estándar de JavaScript
  if (error instanceof Error) {
    return error.message;
  }
  
  // Para otros tipos de errores
  return 'Ha ocurrido un error inesperado.';
}; 