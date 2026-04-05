import type { ReactNode } from 'react'
import QualityHubShell from '@/components/quality/QualityHubShell'

export default function RecetasHubLayout({ children }: { children: ReactNode }) {
  return <QualityHubShell>{children}</QualityHubShell>
}
