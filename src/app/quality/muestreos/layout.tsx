import type { ReactNode } from 'react'
import QualityHubShell from '@/components/quality/QualityHubShell'

/** Same typography + canvas as Centro de compras (`finanzas/procurement`): DM Sans, warm stone background. */
export default function MuestreosSectionLayout({ children }: { children: ReactNode }) {
  return <QualityHubShell>{children}</QualityHubShell>
}
