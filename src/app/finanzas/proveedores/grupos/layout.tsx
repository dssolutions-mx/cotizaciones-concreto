import type { ReactNode } from 'react'
import FinanzasHubShell from '@/components/finanzas/FinanzasHubShell'
import FinanzasWorkspaceHeader from '@/components/finanzas/FinanzasWorkspaceHeader'
import { finanzasHubPageStackClass } from '@/components/finanzas/finanzasHubUi'

export default function ProveedoresGruposLayout({ children }: { children: ReactNode }) {
  return (
    <FinanzasHubShell width="wide">
      <div className={finanzasHubPageStackClass}>
        <FinanzasWorkspaceHeader
          title="Grupos de proveedores"
          subtitle="Agrupa proveedores para análisis y gestión"
        />
        <div className="min-w-0">{children}</div>
      </div>
    </FinanzasHubShell>
  )
}
