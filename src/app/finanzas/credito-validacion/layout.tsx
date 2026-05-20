import type { ReactNode } from 'react'
import FinanzasHubShell from '@/components/finanzas/FinanzasHubShell'

export default function CreditoValidacionLayout({ children }: { children: ReactNode }) {
  return <FinanzasHubShell width="wide">{children}</FinanzasHubShell>
}
