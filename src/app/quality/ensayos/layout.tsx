import type { ReactNode } from 'react'
import QualityHubShell from '@/components/quality/QualityHubShell'

/** Same typography + canvas as muestreos: DM Sans, warm stone background. */
export default function EnsayosSectionLayout({ children }: { children: ReactNode }) {
  return <QualityHubShell>{children}</QualityHubShell>
}
