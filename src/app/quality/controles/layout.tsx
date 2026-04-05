import type { ReactNode } from 'react'
import QualityHubShell from '@/components/quality/QualityHubShell'

export default function ControlesLayout({ children }: { children: ReactNode }) {
  return <QualityHubShell>{children}</QualityHubShell>
}
