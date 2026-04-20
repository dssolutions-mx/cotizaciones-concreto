import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  canAccessOrderForFinanzasAudit,
  canWriteFinanzasAudit,
  type AuditProfile,
} from '@/lib/finanzas/auditCapabilities'

const FINANZAS_LAYOUT_ROLES = new Set([
  'EXECUTIVE',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
  'SALES_AGENT',
  'ADMIN_OPERATIONS',
  'ADMINISTRATIVE',
  'ADMIN',
])

export type FinanzasAuditRequestContext = {
  userId: string
  profile: AuditProfile
  canWrite: boolean
}

export async function requireFinanzasAuditContext(
  request: NextRequest,
  opts?: { requireWriter?: boolean }
): Promise<FinanzasAuditRequestContext> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    throw new Error('UNAUTHORIZED')
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, role, plant_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    throw new Error('FORBIDDEN_PROFILE')
  }

  if (!FINANZAS_LAYOUT_ROLES.has(profile.role)) {
    throw new Error('FORBIDDEN_FINANZAS')
  }

  const canWrite = canWriteFinanzasAudit(profile)
  if (opts?.requireWriter && !canWrite) {
    throw new Error('FORBIDDEN_WRITER')
  }

  return {
    userId: user.id,
    profile: {
      id: profile.id,
      role: profile.role,
      plant_id: profile.plant_id,
    },
    canWrite,
  }
}

export async function assertOrderAccess(
  profile: AuditProfile,
  orderPlantId: string | null
): Promise<void> {
  if (!orderPlantId) {
    throw new Error('ORDER_NO_PLANT')
  }
  if (!canAccessOrderForFinanzasAudit(profile, orderPlantId)) {
    throw new Error('FORBIDDEN_ORDER')
  }
}

export function getRequestAuditMeta(request: NextRequest): {
  request_ip: string | null
  user_agent: string | null
} {
  const fwd = request.headers.get('x-forwarded-for')
  const request_ip = fwd?.split(',')[0]?.trim() || null
  const user_agent = request.headers.get('user-agent')
  return { request_ip, user_agent }
}
