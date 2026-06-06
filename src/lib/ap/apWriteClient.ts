import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/server'

export function getApServiceClient():
  | { ok: true; client: SupabaseClient }
  | { ok: false; error: string } {
  try {
    return { ok: true, client: createServiceClient() }
  } catch {
    return {
      ok: false,
      error: 'Configuración del servidor incompleta (falta SUPABASE_SERVICE_ROLE_KEY)',
    }
  }
}
