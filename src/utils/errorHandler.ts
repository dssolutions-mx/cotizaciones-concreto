import { PostgrestError } from '@supabase/supabase-js';

/**
 * Maneja errores de Supabase y otros errores de la aplicación de manera consistente
 * @param error - El error que se produjo
 * @param context - El contexto donde ocurrió el error para facilitar el debugging
 * @param contextData - Datos adicionales del contexto para mensajes más específicos (ej: { provider_number: 2, plant_id: '...' })
 * @returns Un mensaje de error amigable
 */
export const handleError = (
  error: PostgrestError | Error | unknown, 
  context: string,
  contextData?: Record<string, any>
): string => {
  // Registrar el error para debugging
  console.error(`Error en ${context}:`, error);
  
  // Para errores específicos de Supabase
  if (error && typeof error === 'object' && 'code' in error) {
    const pgError = error as PostgrestError;
    
    switch (pgError.code) {
      case '23505': // Violación de unicidad
        // Mensajes específicos según el contexto
        if (context === 'createSupplier' && contextData?.provider_number) {
          const plantInfo = contextData.plant_id ? ' en esta planta' : '';
          return `Ya existe un proveedor con el número ${contextData.provider_number}${plantInfo}.`;
        }
        // Intentar extraer información del mensaje de error de PostgreSQL
        if (pgError.message) {
          // Buscar patrones comunes en mensajes de PostgreSQL
          const providerNumberMatch = pgError.message.match(/provider_number[^=]*=\((\d+)\)/i);
          if (providerNumberMatch) {
            const number = providerNumberMatch[1];
            return `Ya existe un proveedor con el número ${number}.`;
          }
          // Buscar información sobre la constraint
          if (pgError.message.includes('suppliers') && pgError.message.includes('provider_number')) {
            return 'Ya existe un proveedor con ese número.';
          }
        }
        return 'Ya existe un registro con esa información.';
      case '23503': // Violación de clave foránea
        return 'La información está siendo usada por otros registros.';
      case '42P01': // Tabla no existe
        return 'Ha ocurrido un error en la base de datos.';
      case '23502': // Violación de no nulidad
        return 'Falta información requerida.';
      case '23514': // Violación de check constraint
        // Mensajes específicos para check constraints de suppliers
        if (pgError.message?.includes('suppliers_provider_number_check')) {
          // Mostrar el mensaje real de PostgreSQL para que el usuario vea qué restricción está violando
          // Esto ayuda a identificar si la restricción en la BD es incorrecta
          const constraintMessage = pgError.message || 'El número de proveedor no cumple con las restricciones de la base de datos.';
          if (context === 'createSupplier' && contextData?.provider_number) {
            return `El número de proveedor ${contextData.provider_number} no es válido según las restricciones de la base de datos. ${constraintMessage}`;
          }
          return `El número de proveedor no es válido. ${constraintMessage}`;
        }
        // Mensaje genérico para otros check constraints
        return pgError.message || 'Los datos proporcionados no cumplen con las restricciones requeridas.';
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