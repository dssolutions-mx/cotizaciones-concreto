'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ClipboardList, Plus, ChevronRight, Lock, Clock, CheckCircle2, AlertCircle, FilePen } from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb'
import InitiateClosureModal from '@/components/inventory/closure/InitiateClosureModal'
import type { InventoryClosureSummary, ClosureStatus } from '@/types/inventoryClosure'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

const STATUS_META: Record<ClosureStatus, { label: string; color: string; Icon: React.ElementType }> = {
  draft: { label: 'Borrador', color: 'bg-stone-100 text-stone-700 border-stone-200', Icon: Clock },
  physical_count: { label: 'Conteo físico', color: 'bg-amber-50 text-amber-800 border-amber-200', Icon: Clock },
  reconciled: { label: 'Reconciliado', color: 'bg-sky-50 text-sky-800 border-sky-200', Icon: Clock },
  justified: { label: 'Justificado', color: 'bg-violet-50 text-violet-800 border-violet-200', Icon: CheckCircle2 },
  sealed: { label: 'Sellado', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: Lock },
  cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-200', Icon: AlertCircle },
}

const CLOSURE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR']

function fmtDate(d: string) {
  try { return format(parseISO(d), "d 'de' MMMM yyyy", { locale: es }) } catch { return d }
}

function StatusBadge({ status }: { status: ClosureStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft
  const Icon = m.Icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', m.color)}>
      <Icon className="h-3 w-3" />
      {m.label}
    </span>
  )
}

export default function InventoryClosureListPage() {
  const { currentPlant } = usePlantContext()
  const { profile } = useAuthSelectors()
  const router = useRouter()
  const [closures, setClosures] = useState<InventoryClosureSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const canInitiate = CLOSURE_ROLES.includes(profile?.role ?? '')

  const fetchClosures = useCallback(async () => {
    if (!currentPlant?.id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/closures?plant_id=${currentPlant.id}&limit=50`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido')
      setClosures(data.closures ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id])

  useEffect(() => { fetchClosures() }, [fetchClosures])

  return (
    <div className="space-y-6">
      <InventoryBreadcrumb />

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-600 bg-[#1B2A4A]">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-900">Cierre de inventario</h1>
            <p className="text-sm text-stone-500">{currentPlant?.name ?? '—'}</p>
          </div>
        </div>
        {canInitiate && (
          <Button
            onClick={() => setShowModal(true)}
            className="bg-[#1B2A4A] text-white hover:bg-[#243560] gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Iniciar cierre
          </Button>
        )}
      </div>

      <Separator className="bg-stone-200" />

      {loading && (
        <div className="flex items-center justify-center py-16 text-stone-400 text-sm">
          Cargando cierres...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && closures.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center">
          <ClipboardList className="h-10 w-10 text-stone-300 mb-3" />
          <p className="text-stone-600 font-medium">Sin cierres registrados</p>
          <p className="text-stone-400 text-sm mt-1">
            {canInitiate ? 'Inicia el primer cierre de inventario para este período.' : 'No hay cierres disponibles.'}
          </p>
        </div>
      )}

      {!loading && !error && closures.length > 0 && (
        <div className="space-y-2">
          {closures.map((c) => (
            <Link
              key={c.id}
              href={`/production-control/inventory-closure/${c.id}`}
              className="group flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4 hover:bg-stone-50 hover:border-stone-300 transition-all"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f5f3f0] border border-stone-200">
                  <ClipboardList className="h-4 w-4 text-stone-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">
                    {fmtDate(c.period_start)} — {fmtDate(c.period_end)}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Iniciado por {c.initiated_by_name || '—'} · {fmtDate(c.initiated_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.parent_closure_id && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                    <FilePen className="h-3 w-3" />
                    Enmienda
                  </span>
                )}
                <StatusBadge status={c.status} />
                <ChevronRight className="h-4 w-4 text-stone-400 group-hover:text-stone-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showModal && currentPlant && (
        <InitiateClosureModal
          plantId={currentPlant.id}
          onClose={() => setShowModal(false)}
          onCreated={(closureId) => { setShowModal(false); router.push(`/production-control/inventory-closure/${closureId}`) }}
        />
      )}
    </div>
  )
}
