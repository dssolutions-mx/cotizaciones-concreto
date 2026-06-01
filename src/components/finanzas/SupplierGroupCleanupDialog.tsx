'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { MaintenanceExecutionPlan, MaintenancePreview } from '@/lib/ap/supplierGroupMaintenance'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  plantMap: Map<string, string>
  onCompleted: () => void
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  if (value === 0) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-800">
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-stone-600">{label}</span>
    </span>
  )
}

function MergeClusterSection({
  cluster,
  plantMap,
  defaultOpen,
}: {
  cluster: MaintenanceExecutionPlan['merge_clusters'][number]
  plantMap: Map<string, string>
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const dupCount = cluster.duplicates.length

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <button
        type="button"
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-stone-50"
        onClick={() => setOpen(v => !v)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 mt-0.5 text-stone-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 mt-0.5 text-stone-500" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900">
            {cluster.normalized_name}
            <span className="text-stone-500 font-normal ml-1.5">
              — fusionar {dupCount} duplicado{dupCount !== 1 ? 's' : ''} en uno
            </span>
          </p>
          <p className="text-xs text-stone-600 mt-0.5">
            Se conserva: <span className="font-medium">{cluster.canonical.name}</span>
            {cluster.canonical.rfc ? (
              <span className="font-mono ml-1">{cluster.canonical.rfc}</span>
            ) : cluster.rfc_after_merge ? (
              <span className="ml-1">
                → RFC <span className="font-mono">{cluster.rfc_after_merge}</span>
              </span>
            ) : (
              <span className="ml-1 text-amber-700">(sin RFC)</span>
            )}
          </p>
        </div>
      </button>

      {open ? (
        <div className="border-t border-stone-100 px-3 py-3 space-y-3 text-xs">
          {cluster.warnings.map((w, i) => (
            <p key={i} className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              {w}
            </p>
          ))}

          <div>
            <p className="font-medium text-stone-700 mb-1">Grupo que permanece</p>
            <GroupRow g={cluster.canonical} highlight />
            {cluster.rfc_after_merge && !cluster.canonical.rfc ? (
              <p className="text-stone-600 mt-1 pl-1">
                Se asignará RFC <span className="font-mono font-medium">{cluster.rfc_after_merge}</span> al
                consolidar.
              </p>
            ) : null}
          </div>

          <div>
            <p className="font-medium text-stone-700 mb-1">Duplicados que se desactivan</p>
            <ul className="space-y-1">
              {cluster.duplicates.map(d => (
                <li key={d.id}>
                  <GroupRow g={d} />
                </li>
              ))}
            </ul>
          </div>

          {(cluster.invoices_to_relink > 0 || cluster.credit_notes_to_relink > 0) && (
            <p className="text-stone-600">
              Se reasignan{' '}
              {cluster.invoices_to_relink > 0 && (
                <strong>{cluster.invoices_to_relink}</strong>
              )}{' '}
              {cluster.invoices_to_relink > 0 ? 'factura(s)' : ''}
              {cluster.invoices_to_relink > 0 && cluster.credit_notes_to_relink > 0 ? ' y ' : ''}
              {cluster.credit_notes_to_relink > 0 && (
                <strong>{cluster.credit_notes_to_relink}</strong>
              )}{' '}
              {cluster.credit_notes_to_relink > 0 ? 'nota(s) de crédito' : ''}{' '}
              al grupo «{cluster.canonical.name}».
            </p>
          )}

          {cluster.suppliers_to_relink.length > 0 ? (
            <div>
              <p className="font-medium text-stone-700 mb-1.5">
                Proveedores de planta que pasan a este grupo ({cluster.suppliers_to_relink.length})
              </p>
              <ul className="divide-y divide-stone-100 rounded-md border border-stone-200 max-h-40 overflow-y-auto">
                {cluster.suppliers_to_relink.map(s => (
                  <li key={s.supplier_id} className="px-2.5 py-1.5 flex items-center gap-2 min-w-0">
                    <span className="truncate font-medium text-stone-900">{s.supplier_name}</span>
                    {s.provider_number != null && (
                      <span className="text-stone-400 font-mono shrink-0">#{s.provider_number}</span>
                    )}
                    <span className="text-stone-500 shrink-0 ml-auto">
                      {s.plant_id ? (plantMap.get(s.plant_id) ?? 'Planta') : '—'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-stone-400 shrink-0" />
                    <span className="text-stone-600 shrink-0 truncate max-w-[120px]">
                      {cluster.canonical.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-stone-500 italic">Ningún proveedor de planta vinculado a los duplicados.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

function GroupRow({
  g,
  highlight,
}: {
  g: { name: string; rfc: string | null; supplier_count: number; invoice_count: number; credit_note_count: number }
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-stone-600',
        highlight && 'text-stone-800',
      )}
    >
      <Building2 className="h-3 w-3 text-primary shrink-0" />
      <span className={cn('font-sans text-sm', highlight ? 'font-semibold' : 'font-medium')}>{g.name}</span>
      {g.rfc ? <span>{g.rfc}</span> : null}
      <span className="font-sans text-stone-500">
        {g.supplier_count} prov. · {g.invoice_count} fact. · {g.credit_note_count} NC
      </span>
    </div>
  )
}

export default function SupplierGroupCleanupDialog({
  open,
  onOpenChange,
  plantMap,
  onCompleted,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [preview, setPreview] = useState<MaintenancePreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ap/supplier-groups/maintenance')
      if (!res.ok) throw new Error('No se pudo cargar el plan')
      setPreview((await res.json()) as MaintenancePreview)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void loadPreview()
  }, [open, loadPreview])

  const plan = preview?.plan
  const totals = plan?.totals

  const runCleanup = async () => {
    setRunning(true)
    try {
      const res = await fetch('/api/ap/supplier-groups/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error en limpieza')
      onCompleted()
      onOpenChange(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo ejecutar')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[min(90vh,800px)] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Vista previa de limpieza</DialogTitle>
          <DialogDescription>
            Revise cada cambio antes de confirmar. Nada se modifica hasta pulsar «Ejecutar limpieza».
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Calculando plan…
            </div>
          ) : error ? (
            <div className="py-8 space-y-3 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void loadPreview()}>
                Reintentar
              </Button>
            </div>
          ) : plan && !plan.has_actions ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No hay acciones pendientes. El catálogo está en orden.
            </p>
          ) : plan ? (
            <div className="space-y-5 pb-4">
              {plan.warnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1">
                  <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Requiere revisión manual
                  </p>
                  <ul className="text-xs text-amber-900/90 list-disc pl-5 space-y-0.5">
                    {plan.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {totals ? (
                <div className="flex flex-wrap gap-2">
                  <SummaryPill label="grupos fusionados" value={totals.groups_merged_away} />
                  <SummaryPill label="proveedores reasignados" value={totals.suppliers_relinked} />
                  <SummaryPill label="facturas movidas" value={totals.invoices_relinked} />
                  <SummaryPill label="RFC actualizados" value={totals.rfc_updates} />
                  <SummaryPill label="grupos desactivados" value={totals.groups_deactivated} />
                </div>
              ) : null}

              {plan.merge_clusters.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    1. Fusiones por nombre duplicado ({plan.merge_clusters.length})
                  </h3>
                  <p className="text-xs text-stone-600 -mt-1">
                    Los proveedores de planta listados cambiarán su <code className="text-[11px]">group_id</code> al
                    grupo conservado. Las facturas y notas de crédito del duplicado se mueven al mismo grupo.
                  </p>
                  <div className="space-y-2">
                    {plan.merge_clusters.map((c, i) => (
                      <MergeClusterSection
                        key={c.normalized_name}
                        cluster={c}
                        plantMap={plantMap}
                        defaultOpen={i < 2}
                      />
                    ))}
                  </div>
                </section>
              )}

              {plan.rfc_backfills.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    2. RFC fiscal a completar ({plan.rfc_backfills.length})
                  </h3>
                  <p className="text-xs text-stone-600 -mt-1">
                    Tomado del RFC emisor en todas las facturas del grupo (mismo valor en cada XML).
                  </p>
                  <ul className="rounded-lg border border-stone-200 divide-y text-sm">
                    {plan.rfc_backfills.map(r => (
                      <li key={r.group_id} className="px-3 py-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.group_name}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-stone-400" />
                        <span className="font-mono text-xs">{r.rfc}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">
                          {r.invoice_count} factura{r.invoice_count !== 1 ? 's' : ''}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {plan.deactivations.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    3. Grupos que se desactivan ({plan.deactivations.length})
                  </h3>
                  <p className="text-xs text-stone-600 -mt-1">
                    No se borran; quedan <code className="text-[11px]">is_active = false</code> y dejan de aparecer en
                    selectores. El historial de facturas ya quedó en el grupo conservado.
                  </p>
                  <ul className="rounded-lg border border-stone-200 divide-y text-sm max-h-48 overflow-y-auto">
                    {plan.deactivations.map(d => (
                      <li key={d.group_id} className="px-3 py-2 flex flex-wrap items-center gap-2">
                        <span className="font-medium">{d.group_name}</span>
                        {d.rfc ? <span className="font-mono text-xs text-stone-500">{d.rfc}</span> : null}
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] ml-auto',
                            d.reason === 'merged_duplicate'
                              ? 'border-amber-300 text-amber-800'
                              : 'text-stone-600',
                          )}
                        >
                          {d.reason === 'merged_duplicate' ? 'Duplicado fusionado' : 'Vacío sin uso'}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={running || loading || !plan?.has_actions}
            className="bg-amber-900 hover:bg-amber-800 text-white"
            onClick={() => void runCleanup()}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Ejecutando…
              </>
            ) : (
              'Ejecutar limpieza'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
