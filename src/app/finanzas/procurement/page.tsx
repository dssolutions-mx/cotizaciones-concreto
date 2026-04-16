import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import ProcurementWorkspaceClient from './ProcurementWorkspaceClient'

function ProcurementWorkspaceFallback() {
  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <Skeleton className="h-12 w-full min-w-[720px] max-w-full rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

export default function ProcurementPage() {
  return (
    <Suspense fallback={<ProcurementWorkspaceFallback />}>
      <ProcurementWorkspaceClient />
    </Suspense>
  )
}
