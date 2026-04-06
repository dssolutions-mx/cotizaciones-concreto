/**
 * Maps Supabase/PostgREST errors to short Spanish messages for procurement APIs.
 * Helps distinguish permission issues from empty data.
 */
export function userMessageForDbError(
  error: { message?: string; code?: string; details?: string } | null | undefined
): string | null {
  if (!error?.message) return null
  const msg = error.message.toLowerCase()
  const code = error.code

  if (code === '42501' || msg.includes('row-level security') || msg.includes('rls policy')) {
    return 'Sin permiso para ver o modificar estos datos en esta planta. Verifique su rol o la planta asignada.'
  }
  if (
    msg.includes('foreign key') ||
    msg.includes('violates foreign key') ||
    code === '23503'
  ) {
    return 'Referencia inválida: el proveedor, material u otro registro vinculado no existe o fue eliminado.'
  }
  if (msg.includes('duplicate key') || code === '23505') {
    return 'Ya existe un registro con esos datos (duplicado).'
  }
  if (msg.includes('permission denied')) {
    return 'La operación fue rechazada por permisos de base de datos.'
  }
  return null
}

export function procurementHttpErrorMessage(status: number, body?: { error?: string }): string {
  if (status === 401) return 'Sesión expirada o no iniciada. Vuelva a entrar.'
  if (status === 403) return 'No tiene permiso para esta acción.'
  if (status === 404) return 'No se encontró el recurso solicitado.'
  if (body?.error && typeof body.error === 'string') return body.error
  if (status >= 500) return 'Error del servidor. Intente de nuevo o contacte a soporte.'
  return 'No se pudo completar la solicitud.'
}
