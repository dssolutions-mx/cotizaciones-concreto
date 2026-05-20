import type { ReactNode } from 'react'
import FinanzasHubShell from '@/components/finanzas/FinanzasHubShell'
import FinanzasWorkspaceHeader from '@/components/finanzas/FinanzasWorkspaceHeader'
import { finanzasHubPageStackClass } from '@/components/finanzas/finanzasHubUi'

export default function RemisionesFinanzasLayout({ children }: { children: ReactNode }) {
  return (
    <FinanzasHubShell width="wide">
      <div className={finanzasHubPageStackClass}>
        <FinanzasWorkspaceHeader
          title="Remisiones por cliente"
          subtitle="Consulta y exporta para contabilidad"
        />
        <div className="min-w-0">{children}</div>
      </div>
    </FinanzasHubShell>
  )
}
