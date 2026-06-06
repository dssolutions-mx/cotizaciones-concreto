'use client'

import React, { useCallback, useEffect, useMemo, useState, startTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DollarSign, FileText, Receipt, ShieldCheck, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import OrphanEntriesTab from '@/components/finanzas/OrphanEntriesTab'
import InvoicesPayablesTab from '@/components/finanzas/InvoicesPayablesTab'
import CreditNotesPayablesTab from '@/components/finanzas/CreditNotesPayablesTab'
import { usePlantContext } from '@/contexts/PlantContext'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const CXP_TABS = ['sin_factura', 'facturas', 'notas_credito'] as const
type CxpTab = (typeof CXP_TABS)[number]

function parseCxpTab(raw: string | null): CxpTab {
  if (raw && CXP_TABS.includes(raw as CxpTab)) return raw as CxpTab
  return 'sin_factura'
}

type Props = {
  /** Plant scope from procurement workspace header (empty = all plants). */
  workspacePlantId?: string
  /** When true, hide page title and plant picker — parent supplies plant scope. */
  embedded?: boolean
}

export default function CxpWorkspace({ workspacePlantId = '', embedded = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { availablePlants } = usePlantContext()
  const [localPlant, setLocalPlant] = useState('')

  const tabFromUrl = useMemo(() => parseCxpTab(searchParams.get('cxp_tab')), [searchParams])
  const [optimisticTab, setOptimisticTab] = useState<CxpTab | null>(null)
  const activeTab = optimisticTab ?? tabFromUrl
  const plantScope = embedded ? workspacePlantId : localPlant
  const [exportingReview, setExportingReview] = useState(false)

  useEffect(() => {
    if (!optimisticTab) return
    if (tabFromUrl === optimisticTab) setOptimisticTab(null)
  }, [tabFromUrl, optimisticTab])

  const exportIntegralReview = async () => {
    setExportingReview(true)
    try {
      const qs = new URLSearchParams()
      if (plantScope) qs.set('plant_id', plantScope)
      const res = await fetch(`/api/ap/cxp-review-export?${qs}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Error ${res.status}`)
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition')
      const match = disposition?.match(/filename="([^"]+)"/)
      const filename =
        match?.[1] ??
        `CuentasPorPagar_Revision_Integral_${new Date().toISOString().slice(0, 10)}.xlsx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Informe integral exportado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo exportar el informe')
    } finally {
      setExportingReview(false)
    }
  }

  const setTab = useCallback(
    (tab: string) => {
      const next = parseCxpTab(tab)
      if (next === activeTab) return
      setOptimisticTab(next)
      const params = new URLSearchParams(searchParams.toString())
      params.set('cxp_tab', next)
      if (embedded) params.set('tab', 'cxp')
      const q = params.toString()
      startTransition(() => {
        router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
      })
    },
    [activeTab, embedded, pathname, router, searchParams]
  )

  return (
    <div className={embedded ? 'space-y-4' : 'p-6 space-y-6'}>
      {!embedded && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Cuentas por Pagar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gestión de facturas y cuentas por pagar de materiales y flota
            </p>
          </div>
          <Select value={localPlant || '__all__'} onValueChange={(v) => setLocalPlant(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-[200px] bg-white border-stone-300">
              <SelectValue placeholder="Todas las plantas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas las plantas</SelectItem>
              {availablePlants.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gray-100/50 p-1 text-gray-500 backdrop-blur-sm"
            role="tablist"
            aria-label="Secciones de cuentas por pagar"
          >
            {(
              [
                { id: 'sin_factura' as const, label: 'Sin factura', icon: FileText },
                { id: 'facturas' as const, label: 'Facturas / CxP', icon: DollarSign },
                { id: 'notas_credito' as const, label: 'Notas de crédito', icon: Receipt },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                className={cn(
                  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium gap-1.5 transition-all',
                  activeTab === id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
                onClick={() => setTab(id)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <Link
            href="/finanzas/cxp/sat?tab=complementos"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 hover:text-stone-800 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Conciliación SAT
          </Link>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 text-xs gap-1.5 border-stone-300"
            disabled={exportingReview}
            onClick={() => void exportIntegralReview()}
          >
            {exportingReview ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Exportar informe integral
          </Button>
        </div>

        <div role="tabpanel">
          {activeTab === 'sin_factura' ? (
            <OrphanEntriesTab workspacePlantId={plantScope} hidePlantFilter={embedded} />
          ) : activeTab === 'notas_credito' ? (
            <CreditNotesPayablesTab workspacePlantId={plantScope} hidePlantFilter={embedded} />
          ) : (
            <InvoicesPayablesTab workspacePlantId={plantScope} hidePlantFilter={embedded} />
          )}
        </div>
      </div>
    </div>
  )
}