'use client'

import { useMemo } from 'react'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import {
  canPostCloseFinanzasAudit,
  canWriteFinanzasAudit,
} from '@/lib/finanzas/auditCapabilities'

export type FinanzasAuditCapabilities = {
  canWrite: boolean
  canPostClose: boolean
  canSeeInactive: boolean
}

export function useFinanzasAuditCapabilities(): FinanzasAuditCapabilities {
  const { profile } = useAuthSelectors()

  return useMemo(() => {
    const canWrite = canWriteFinanzasAudit(profile ?? undefined)
    return {
      canWrite,
      canPostClose: canPostCloseFinanzasAudit(profile ?? undefined),
      canSeeInactive: canWrite,
    }
  }, [profile])
}
