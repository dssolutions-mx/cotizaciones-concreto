import type { ReactNode } from 'react'
import FinanzasHubShell from '@/components/finanzas/FinanzasHubShell'
import FinanzasWorkspaceHeader from '@/components/finanzas/FinanzasWorkspaceHeader'
import ProduccionWorkspaceNav from '@/components/finanzas/ProduccionWorkspaceNav'
import { finanzasHubPageStackClass } from '@/components/finanzas/finanzasHubUi'

export default function ProduccionFinanzasLayout({ children }: { children: ReactNode }) {
  return (
    <FinanzasHubShell width="wide">
      <div className={finanzasHubPageStackClass}>
        <FinanzasWorkspaceHeader
          title="Producción y costos"
          subtitle="Comparativa entre plantas, detalle de materiales y análisis"
          tabs={<ProduccionWorkspaceNav />}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </FinanzasHubShell>
  )
}
