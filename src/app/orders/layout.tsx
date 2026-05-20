import type { ReactNode } from 'react'
import CommercialHubShell from '@/components/commercial/CommercialHubShell'

export default function OrdersLayout({ children }: { children: ReactNode }) {
  return <CommercialHubShell maxWidth="1600">{children}</CommercialHubShell>
}
