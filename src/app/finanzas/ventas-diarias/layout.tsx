import type { ReactNode } from 'react'
import FinanzasHubShell from '@/components/finanzas/FinanzasHubShell'
import { finanzasHubPageStackClass } from '@/components/finanzas/finanzasHubUi'

export default function VentasDiariasLayout({ children }: { children: ReactNode }) {
  return (
    <FinanzasHubShell width="wide">
      <div className={finanzasHubPageStackClass}>{children}</div>
    </FinanzasHubShell>
  )
}
