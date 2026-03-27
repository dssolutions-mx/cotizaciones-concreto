'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  Truck,
  XCircle,
  RefreshCw,
  Eye,
  ClipboardCheck,
  Calendar,
  UserCheck,
  ShoppingCart,
  ClipboardPlus,
  ChevronDown,
  ChevronUp,
  Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import StatCard from './ui/StatCard'
import type { MaterialAlert, AlertStatus } from '@/types/alerts'
import { cn } from '@/lib/utils'
import CreatePOModal from '@/components/po/CreatePOModal'

const STATUS_CONFIG: Record<AlertStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending_confirmation: { label: 'Pendiente confirmación', color: 'bg-amber-100 text-amber-800', icon: Clock },
  confirmed: { label: 'Confirmada', color: 'bg-sky-100 text-sky-900', icon: CheckCircle },
  expired: { label: 'Vencida', color: 'bg-red-100 text-red-800', icon: XCircle },
  pending_validation: { label: 'Pendiente validación', color: 'bg-orange-100 text-orange-800', icon: Eye },
  validated: { label: 'Validada', color: 'bg-indigo-100 text-indigo-800', icon: ClipboardCheck },
  pending_po: { label: 'Requiere OC', color: 'bg-purple-100 text-purple-800', icon: Package },
  po_linked: { label: 'OC Vinculada', color: 'bg-cyan-100 text-cyan-800', icon: Package },
  delivery_scheduled: { label: 'Entrega Programada', color: 'bg-teal-100 text-teal-800', icon: Calendar },
  delivered: { label: 'Entregada', color: 'bg-green-100 text-green-800', icon: Truck },
  closed: { label: 'Cerrada', color: 'bg-stone-100 text-stone-700', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-stone-100 text-stone-500', icon: XCircle },
}

type PanelMode = 'confirm' | 'validate' | 'schedule' | 'link_po' | null

export default function MaterialAlertsPage() {
  const { currentPlant } = usePlantContext()
  const { profile, isInitialized } = useAuthSelectors()
  const [alerts, setAlerts] = useState<MaterialAlert[]>([])
  const [loading, setLoading] = useState(true)
  /** Default "Activas": vista de planta al abrir; las tarjetas resumen ya no dependen del filtro. */
  const [filter, setFilter] = useState<'mine' | 'active' | 'all' | 'expired'>('active')
  /** Conteos de planta (independientes del tab de lista). */
  const [statsActive, setStatsActive] = useState<MaterialAlert[]>([])
  const [statsExpired, setStatsExpired] = useState<MaterialAlert[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [availablePOs, setAvailablePOs] = useState<
    Array<{ id: string; po_number: string; supplier_name: string; pending_summary: string }>
  >([])
  const [loadingPOs, setLoadingPOs] = useState(false)

  const [openPanel, setOpenPanel] = useState<{ alertId: string; mode: PanelMode } | null>(null)
  const [confirmStep, setConfirmStep] = useState<1 | 2 | 3>(1)

  const [formData, setFormData] = useState({
    physical_count_kg: '',
    discrepancy_notes: '',
    validation_notes: '',
    existing_po_id: '',
    needs_new_po: false,
    scheduled_delivery_date: '',
  })
  const [submitting, setSubmitting] = useState(false)
  /** Crear OC desde alerta pending_po; al guardar se vincula automáticamente. */
  const [createPOOpen, setCreatePOOpen] = useState(false)
  const [alertForCreatePO, setAlertForCreatePO] = useState<MaterialAlert | null>(null)
  /** Evita mismatch de hidratación en pestañas (SSR vs cliente / caché). */
  const [filterTabsReady, setFilterTabsReady] = useState(false)

  const myActionableStatuses: AlertStatus[] = useMemo(() => {
    const role = profile?.role || ''
    if (role === 'DOSIFICADOR') return ['pending_confirmation']
    if (role === 'PLANT_MANAGER') return ['pending_validation', 'confirmed', 'pending_po']
    if (['ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'EXECUTIVE'].includes(role))
      return ['po_linked', 'validated', 'pending_po']
    return []
  }, [profile?.role])

  const getWaitingOnLabel = (status: AlertStatus): string | null => {
    const role = profile?.role || ''
    if (role === 'DOSIFICADOR') {
      if (status === 'pending_validation' || status === 'confirmed')
        return 'Esperando validacion del Jefe de Planta'
      if (['po_linked', 'validated', 'pending_po'].includes(status))
        return 'Esperando programacion de entrega (Admin)'
      if (status === 'delivery_scheduled') return 'Entrega programada — en espera del material'
    }
    if (role === 'PLANT_MANAGER') {
      if (status === 'pending_confirmation') return 'Esperando conteo fisico del Dosificador'
      if (['po_linked', 'validated', 'pending_po'].includes(status))
        return 'Esperando programacion de entrega (Admin)'
    }
    return null
  }

  const fetchPlantStats = useCallback(async () => {
    if (!currentPlant?.id) {
      setStatsActive([])
      setStatsExpired([])
      setStatsLoading(false)
      return
    }
    setStatsLoading(true)
    try {
      const base = `/api/alerts/material?plant_id=${currentPlant.id}`
      const [resActive, resExpired] = await Promise.all([
        fetch(`${base}&active=true`),
        fetch(`${base}&status=expired`),
      ])
      const [jsonActive, jsonExpired] = await Promise.all([resActive.json(), resExpired.json()])
      if (jsonActive.success) setStatsActive(jsonActive.data || [])
      if (jsonExpired.success) setStatsExpired(jsonExpired.data || [])
    } catch (e) {
      console.error('Failed to fetch alert stats:', e)
    } finally {
      setStatsLoading(false)
    }
  }, [currentPlant?.id])

  const fetchAlerts = useCallback(async () => {
    if (!currentPlant?.id) return
    if (filter === 'mine' && !isInitialized) {
      setLoading(true)
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({ plant_id: currentPlant.id })
      if (filter === 'mine' || filter === 'active') {
        params.set('active', 'true')
      } else if (filter === 'expired') {
        params.set('status', 'expired')
      }

      const res = await fetch(`/api/alerts/material?${params}`)
      const json = await res.json()
      if (json.success) {
        const allAlerts = json.data || []
        if (filter === 'mine') {
          setAlerts(allAlerts.filter((a: MaterialAlert) => myActionableStatuses.includes(a.status)))
        } else {
          setAlerts(allAlerts)
        }
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err)
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id, filter, isInitialized, myActionableStatuses])

  useEffect(() => {
    fetchPlantStats()
  }, [fetchPlantStats])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  useEffect(() => {
    setFilterTabsReady(true)
  }, [])

  const closePanel = () => {
    setOpenPanel(null)
    setConfirmStep(1)
    setAvailablePOs([])
  }

  const fetchPOsForAlert = async (alert: MaterialAlert) => {
    if (!currentPlant?.id || !alert.material_id) {
      setAvailablePOs([])
      return
    }
    setLoadingPOs(true)
    try {
      const params = new URLSearchParams({
        plant_id: currentPlant.id,
        material_id: alert.material_id,
        is_service: 'false',
        active_po_header: 'true',
      })
      const res = await fetch(`/api/po/items/search?${params}`)
      if (!res.ok) {
        setAvailablePOs([])
        return
      }
      const json = await res.json()
      const items: Array<{
        material_id?: string
        is_service?: boolean
        qty_remaining?: number
        remainingKg?: number
        uom?: string
        po?: {
          id: string
          po_number?: string | null
          status?: string
          supplier?: { name?: string }
        }
      }> = json.items || []

      const byPo = new Map<
        string,
        { id: string; po_number: string; supplier_name: string; pending_summary: string }
      >()

      const alertMat = String(alert.material_id)

      for (const it of items) {
        if (it.is_service) continue
        if (String(it.material_id || '') !== alertMat) continue
        const po = it.po
        if (!po?.id) continue
        const hdr = String(po.status || '').toLowerCase()
        if (hdr !== 'open' && hdr !== 'partial') continue
        const rem =
          it.uom === 'l' && typeof it.remainingKg === 'number'
            ? it.remainingKg
            : Number(it.qty_remaining) || 0
        if (rem <= 0) continue
        const uom = (it.uom || '').trim()
        const part = `${rem.toLocaleString('es-MX', { maximumFractionDigits: 2 })}${uom ? ` ${uom}` : ''} pendiente`

        const existing = byPo.get(po.id)
        if (!existing) {
          byPo.set(po.id, {
            id: po.id,
            po_number: po.po_number?.trim() || 'OC',
            supplier_name: po.supplier?.name || 'Proveedor',
            pending_summary: part,
          })
        } else {
          existing.pending_summary = `${existing.pending_summary}; ${part}`
        }
      }

      setAvailablePOs([...byPo.values()])
    } catch {
      setAvailablePOs([])
    } finally {
      setLoadingPOs(false)
    }
  }

  const startConfirm = (alert: MaterialAlert) => {
    setFormData((prev) => ({ ...prev, physical_count_kg: '', discrepancy_notes: '' }))
    setConfirmStep(1)
    setOpenPanel({ alertId: alert.id, mode: 'confirm' })
  }

  const startValidate = (alert: MaterialAlert) => {
    setFormData((prev) => ({ ...prev, validation_notes: '', existing_po_id: '', needs_new_po: false }))
    setOpenPanel({ alertId: alert.id, mode: 'validate' })
    fetchPOsForAlert(alert)
  }

  const startSchedule = (alert: MaterialAlert) => {
    setFormData((prev) => ({ ...prev, scheduled_delivery_date: '' }))
    setOpenPanel({ alertId: alert.id, mode: 'schedule' })
  }

  const startLinkPO = (alert: MaterialAlert) => {
    setFormData((prev) => ({ ...prev, existing_po_id: '' }))
    setOpenPanel({ alertId: alert.id, mode: 'link_po' })
    void fetchPOsForAlert(alert)
  }

  const handleLinkPO = async (alertId: string) => {
    if (!formData.existing_po_id) {
      toast.error('Seleccione una orden de compra')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/alerts/material/${alertId}/link-po`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_id: formData.existing_po_id }),
      })
      const json = await res.json()
      if (json.success) {
        closePanel()
        toast.success('OC vinculada — puede programar la entrega')
        void fetchPlantStats()
        void fetchAlerts()
      } else {
        toast.error(json.error || 'No se pudo vincular la OC')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleLinkPOAfterCreate = async (alertId: string, poId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/alerts/material/${alertId}/link-po`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ po_id: poId }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('OC creada y vinculada a la alerta')
        void fetchPlantStats()
        void fetchAlerts()
      } else {
        toast.error(json.error || 'La OC se creó pero no se pudo vincular a la alerta')
        void fetchPlantStats()
        void fetchAlerts()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async (alertId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/alerts/material/${alertId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          physical_count_kg: parseFloat(formData.physical_count_kg),
          discrepancy_notes: formData.discrepancy_notes || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        closePanel()
        toast.success('Conteo confirmado — en espera de validacion del Jefe de Planta')
        void fetchPlantStats()
        void fetchAlerts()
      } else {
        toast.error(json.error || 'Error al confirmar la alerta')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleValidate = async (alertId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/alerts/material/${alertId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existing_po_id: formData.existing_po_id || undefined,
          validation_notes: formData.validation_notes || undefined,
          needs_new_po: formData.needs_new_po,
        }),
      })
      const json = await res.json()
      if (json.success) {
        closePanel()
        const nextStep = formData.existing_po_id
          ? 'OC vinculada — en espera de programacion de entrega'
          : formData.needs_new_po
            ? 'Se requiere nueva OC — en espera de gestion administrativa'
            : 'Validada — en espera de programacion de entrega'
        toast.success(nextStep)
        void fetchPlantStats()
        void fetchAlerts()
      } else {
        toast.error(json.error || 'Error al validar la alerta')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleSchedule = async (alertId: string) => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/alerts/material/${alertId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_delivery_date: formData.scheduled_delivery_date,
        }),
      })
      const json = await res.json()
      if (json.success) {
        closePanel()
        toast.success(`Entrega programada para el ${formData.scheduled_delivery_date}`)
        void fetchPlantStats()
        void fetchAlerts()
      } else {
        toast.error(json.error || 'Error al programar la entrega')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const activeAlertsForStats = statsActive.filter((a) => !['closed', 'cancelled'].includes(a.status))
  const pendingConfirmationForStats = statsActive.filter((a) => a.status === 'pending_confirmation')
  const expiredCountForStats = statsExpired.length

  const isDosificador = profile?.role === 'DOSIFICADOR'
  const isManager = ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile?.role || '')
  /** Vincular OC a alerta (API: PLANT_MANAGER, EXECUTIVE, ADMIN_OPERATIONS) */
  const canLinkPO = ['PLANT_MANAGER', 'EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile?.role || '')
  /** Crear OC (API: EXECUTIVE, ADMIN_OPERATIONS) */
  const canCreatePOFromAlert = ['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile?.role || '')
  /** Programar entrega — alineado con POST /schedule */
  const canScheduleDelivery = ['ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'EXECUTIVE', 'PLANT_MANAGER'].includes(
    profile?.role || ''
  )

  const getTimeRemaining = (deadline: string | null | undefined) => {
    if (!deadline) return null
    const diff = new Date(deadline).getTime() - Date.now()
    if (diff <= 0) return 'Vencida'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${mins}m`
  }

  const materialName = (alert: MaterialAlert) =>
    (alert.material as { material_name?: string })?.material_name || 'Material'

  const isPanelOpen = (alertId: string, mode: PanelMode) =>
    openPanel?.alertId === alertId && openPanel?.mode === mode

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full">
      <InventoryBreadcrumb />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">Alertas de material</h1>
          <p className="text-sm text-stone-600 mt-1">Protocolo POL-OPE-003 — acciones guiadas</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchPlantStats()
              void fetchAlerts()
            }}
            disabled={loading || statsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading || statsLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button size="sm" variant="secondary" asChild className="bg-emerald-100 text-emerald-900 hover:bg-emerald-200">
            <Link href="/production-control/material-request">
              <ClipboardPlus className="h-4 w-4 mr-2" />
              Solicitar material
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Alertas activas"
          value={activeAlertsForStats.length}
          icon={AlertTriangle}
          iconColor="text-amber-600"
        />
        <StatCard
          title="Pendientes confirmación"
          value={pendingConfirmationForStats.length}
          icon={Clock}
          iconColor="text-orange-600"
        />
        <StatCard
          title="Vencidas"
          value={expiredCountForStats}
          icon={XCircle}
          iconColor="text-red-600"
        />
      </div>

      <div className="flex flex-wrap gap-2 min-h-9">
        {!filterTabsReady ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-9 w-[5.5rem] rounded-md bg-stone-200/60 animate-pulse"
                aria-hidden
              />
            ))}
          </>
        ) : (
          (
            [
              { key: 'active', label: 'Activas' },
              { key: 'mine', label: 'Mis acciones' },
              { key: 'all', label: 'Todas' },
              { key: 'expired', label: 'Vencidas' },
            ] as const
          ).map(({ key, label }) => (
            <Button
              key={key}
              variant={filter === key ? 'solid' : 'outline'}
              size="sm"
              className={filter === key ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-none' : ''}
              onClick={() => setFilter(key)}
            >
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center mr-1.5 shrink-0">
                {key === 'mine' ? <UserCheck className="h-3.5 w-3.5" aria-hidden /> : null}
              </span>
              {label}
            </Button>
          ))
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-500">Cargando alertas…</div>
      ) : alerts.length === 0 ? (
        <Card className="border-stone-200">
          <CardContent className="py-12 text-center text-stone-500">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-400" />
            <p className="font-medium text-stone-800">
              {filter === 'mine'
                ? 'Nada pendiente en su bandeja'
                : filter === 'active'
                  ? 'Sin alertas activas en esta planta'
                  : filter === 'expired'
                    ? 'Sin alertas vencidas'
                    : 'Sin alertas con este filtro'}
            </p>
            <p className="text-sm mt-1">
              {filter === 'mine'
                ? 'Use “Activas” para ver el estado general de la planta o solicite material si hace falta.'
                : 'Puede solicitar material de forma proactiva si lo necesita.'}
            </p>
            <Button className="mt-4" asChild variant="outline">
              <Link href="/production-control/material-request">Solicitar material</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const config = STATUS_CONFIG[alert.status]
            const StatusIcon = config.icon
            const timeRemaining = getTimeRemaining(alert.confirmation_deadline)
            const mat = materialName(alert)

            return (
              <Card key={alert.id} className="overflow-hidden border-stone-200 bg-white">
                <div className="flex items-stretch">
                  <div
                    className={`w-1.5 shrink-0 ${
                      alert.status === 'expired'
                        ? 'bg-red-500'
                        : alert.status === 'pending_confirmation'
                          ? 'bg-amber-500'
                          : alert.status === 'closed'
                            ? 'bg-stone-300'
                            : 'bg-sky-500'
                    }`}
                  />
                  <div className="flex-1 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-stone-500">{alert.alert_number}</span>
                          <Badge className={config.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          {timeRemaining && alert.status === 'pending_confirmation' && (
                            <Badge variant="outline" className="text-amber-800 border-amber-300 font-mono text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {timeRemaining}
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-stone-900 text-lg">{mat}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-stone-600">
                          <span>
                            Stock:{' '}
                            <strong className="text-red-700 tabular-nums">
                              {Number(alert.triggered_stock_kg).toLocaleString('es-MX')} kg
                            </strong>
                          </span>
                          <span className="tabular-nums">
                            Reorden: {Number(alert.reorder_point_kg).toLocaleString('es-MX')} kg
                          </span>
                          {alert.physical_count_kg != null && (
                            <span className="tabular-nums">
                              Conteo: {Number(alert.physical_count_kg).toLocaleString('es-MX')} kg
                            </span>
                          )}
                          {alert.scheduled_delivery_date && <span>Entrega: {alert.scheduled_delivery_date}</span>}
                        </div>
                        {alert.discrepancy_notes && (
                          <p className="text-xs text-stone-500 mt-1">Discrepancia: {alert.discrepancy_notes}</p>
                        )}
                        {alert.validation_notes && (
                          <p className="text-xs text-stone-500 mt-1">Validación: {alert.validation_notes}</p>
                        )}
                        {(() => {
                          const waitingLabel = getWaitingOnLabel(alert.status)
                          return waitingLabel ? (
                            <Badge className="mt-2 bg-stone-100 text-stone-600 border border-stone-200 font-normal text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {waitingLabel}
                            </Badge>
                          ) : null
                        })()}
                      </div>

                      <div className="flex flex-wrap gap-2 shrink-0">
                        {alert.status === 'pending_confirmation' && (isDosificador || isManager) && (
                          <Button
                            size="sm"
                            variant={isPanelOpen(alert.id, 'confirm') ? 'secondary' : 'solid'}
                            className={cn(
                              'min-h-10',
                              !isPanelOpen(alert.id, 'confirm') &&
                                'bg-stone-900 text-white hover:bg-stone-800 shadow-none'
                            )}
                            onClick={() =>
                              isPanelOpen(alert.id, 'confirm') ? closePanel() : startConfirm(alert)
                            }
                          >
                            {isPanelOpen(alert.id, 'confirm') ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Cerrar
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Confirmar
                              </>
                            )}
                          </Button>
                        )}
                        {alert.status === 'pending_validation' && isManager && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-10"
                            onClick={() =>
                              isPanelOpen(alert.id, 'validate') ? closePanel() : startValidate(alert)
                            }
                          >
                            {isPanelOpen(alert.id, 'validate') ? 'Cerrar' : 'Validar'}
                          </Button>
                        )}
                        {alert.status === 'pending_po' && canLinkPO && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-10"
                              onClick={() =>
                                isPanelOpen(alert.id, 'link_po') ? closePanel() : startLinkPO(alert)
                              }
                            >
                              {isPanelOpen(alert.id, 'link_po') ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Cerrar
                                </>
                              ) : (
                                <>
                                  <Link2 className="h-4 w-4 mr-1" />
                                  Vincular OC
                                </>
                              )}
                            </Button>
                            {canCreatePOFromAlert && (
                              <Button
                                size="sm"
                                variant="solid"
                                className="min-h-10 bg-sky-800 text-white hover:bg-sky-900 shadow-none"
                                onClick={() => {
                                  setAlertForCreatePO(alert)
                                  setCreatePOOpen(true)
                                }}
                              >
                                <ShoppingCart className="h-4 w-4 mr-1" />
                                Crear OC
                              </Button>
                            )}
                          </>
                        )}
                        {['po_linked', 'validated'].includes(alert.status) && canScheduleDelivery && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-10"
                            onClick={() =>
                              isPanelOpen(alert.id, 'schedule') ? closePanel() : startSchedule(alert)
                            }
                          >
                            {isPanelOpen(alert.id, 'schedule') ? 'Cerrar' : 'Programar entrega'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Inline: guided confirm */}
                    {isPanelOpen(alert.id, 'confirm') && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                          Confirmación física — paso {confirmStep} de 3
                        </p>
                        {confirmStep === 1 && (
                          <div className="space-y-3">
                            <p className="text-sm text-stone-800">
                              <strong>1.</strong> Dirígete al silo o zona de almacenamiento de{' '}
                              <strong>{mat}</strong> y verifica el nivel físico antes de registrar.
                            </p>
                            <Button
                              type="button"
                              variant="solid"
                              onClick={() => setConfirmStep(2)}
                              className="w-full sm:w-auto min-h-11 bg-sky-800 hover:bg-sky-900 text-white shadow-none"
                            >
                              Ya estoy en el silo — continuar
                            </Button>
                          </div>
                        )}
                        {confirmStep === 2 && (
                          <div className="space-y-3">
                            <p className="text-sm text-stone-800">
                              <strong>2.</strong> Ingresa el conteo físico en kilogramos (medido o estimado de forma
                              consistente).
                            </p>
                            <div>
                              <label className="text-sm font-medium text-stone-800">Conteo físico (kg) *</label>
                              <Input
                                type="number"
                                step="0.001"
                                className="mt-1 max-w-xs font-mono"
                                placeholder="0"
                                value={formData.physical_count_kg}
                                onChange={(e) =>
                                  setFormData((prev) => ({ ...prev, physical_count_kg: e.target.value }))
                                }
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-stone-800">Notas de discrepancia</label>
                              <Textarea
                                className="mt-1"
                                placeholder="Si el conteo difiere del sistema, explique brevemente…"
                                value={formData.discrepancy_notes}
                                onChange={(e) =>
                                  setFormData((prev) => ({ ...prev, discrepancy_notes: e.target.value }))
                                }
                                rows={2}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" onClick={() => setConfirmStep(1)}>
                                Atrás
                              </Button>
                              <Button
                                type="button"
                                variant="solid"
                                onClick={() => setConfirmStep(3)}
                                disabled={!formData.physical_count_kg}
                                className="min-h-11 bg-sky-800 hover:bg-sky-900 text-white shadow-none"
                              >
                                Revisar envío
                              </Button>
                            </div>
                          </div>
                        )}
                        {confirmStep === 3 && (
                          <div className="space-y-3">
                            <p className="text-sm text-stone-800">
                              <strong>3.</strong> Confirme que el conteo <strong>{formData.physical_count_kg} kg</strong>{' '}
                              es correcto. Se enviará al Jefe de Planta para validación.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" onClick={() => setConfirmStep(2)}>
                                Atrás
                              </Button>
                              <Button
                                type="button"
                                variant="danger"
                                disabled={submitting}
                                onClick={() => handleConfirm(alert.id)}
                              >
                                {submitting ? 'Enviando…' : 'Confirmar alerta'}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Inline: validate */}
                    {isPanelOpen(alert.id, 'validate') && (
                      <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50/40 p-4 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-orange-900">
                          Validar necesidad — Jefe de Planta
                        </p>
                        <div>
                          <label className="text-sm font-medium flex items-center gap-1 mb-1.5">
                            <ShoppingCart className="h-3.5 w-3.5" />
                            OC existente (si aplica)
                          </label>
                          {loadingPOs ? (
                            <p className="text-sm text-stone-500">Cargando OCs…</p>
                          ) : availablePOs.length > 0 ? (
                            <Select
                              value={formData.existing_po_id || 'none'}
                              onValueChange={(v) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  existing_po_id: v === 'none' ? '' : v,
                                  needs_new_po: false,
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar OC abierta…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Sin OC existente —</SelectItem>
                                {availablePOs.map((po) => (
                                  <SelectItem key={po.id} value={po.id}>
                                    {po.po_number} — {po.supplier_name} — {po.pending_summary}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                              No hay OCs abiertas para este material. Marque si requiere nueva OC.
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`needs_new_po_${alert.id}`}
                            checked={formData.needs_new_po}
                            disabled={!!formData.existing_po_id}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, needs_new_po: e.target.checked }))
                            }
                          />
                          <label htmlFor={`needs_new_po_${alert.id}`} className="text-sm">
                            Requiere nueva orden de compra
                          </label>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Notas de validación</label>
                          <Textarea
                            className="mt-1"
                            placeholder="Observaciones…"
                            value={formData.validation_notes}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, validation_notes: e.target.value }))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="solid"
                          className="min-h-11 bg-sky-800 hover:bg-sky-900 text-white shadow-none"
                          onClick={() => handleValidate(alert.id)}
                          disabled={submitting}
                        >
                          {submitting ? 'Validando…' : 'Validar alerta'}
                        </Button>
                      </div>
                    )}

                    {/* Inline: vincular OC (pending_po) */}
                    {isPanelOpen(alert.id, 'link_po') && (
                      <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50/50 p-4 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-purple-900">
                          Vincular orden de compra existente
                        </p>
                        <p className="text-sm text-stone-700">
                          Elija una OC abierta con saldo pendiente para <strong>{mat}</strong> en esta planta.
                        </p>
                        {loadingPOs ? (
                          <p className="text-sm text-stone-500">Cargando OCs…</p>
                        ) : availablePOs.length > 0 ? (
                          <Select
                            value={formData.existing_po_id || 'none'}
                            onValueChange={(v) =>
                              setFormData((prev) => ({
                                ...prev,
                                existing_po_id: v === 'none' ? '' : v,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar OC…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Seleccionar —</SelectItem>
                              {availablePOs.map((po) => (
                                <SelectItem key={po.id} value={po.id}>
                                  {po.po_number} — {po.supplier_name} — {po.pending_summary}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                            No hay OCs abiertas con saldo para este material. Use &quot;Crear OC&quot; o verifique el
                            proveedor.
                          </p>
                        )}
                        <Button
                          type="button"
                          variant="solid"
                          className="min-h-11 bg-sky-800 hover:bg-sky-900 text-white shadow-none"
                          onClick={() => handleLinkPO(alert.id)}
                          disabled={submitting || !formData.existing_po_id}
                        >
                          {submitting ? 'Vinculando…' : 'Vincular OC'}
                        </Button>
                      </div>
                    )}

                    {/* Inline: schedule */}
                    {isPanelOpen(alert.id, 'schedule') && (
                      <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/40 p-4 space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-teal-900">
                          Programar entrega
                        </p>
                        <div>
                          <label className="text-sm font-medium">Fecha de entrega programada *</label>
                          <Input
                            type="date"
                            className="mt-1 max-w-xs"
                            value={formData.scheduled_delivery_date}
                            onChange={(e) =>
                              setFormData((prev) => ({ ...prev, scheduled_delivery_date: e.target.value }))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="solid"
                          className="min-h-11 bg-sky-800 hover:bg-sky-900 text-white shadow-none"
                          onClick={() => handleSchedule(alert.id)}
                          disabled={submitting || !formData.scheduled_delivery_date}
                        >
                          {submitting ? 'Guardando…' : 'Programar'}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <CreatePOModal
        open={createPOOpen}
        onClose={() => {
          setCreatePOOpen(false)
          setAlertForCreatePO(null)
        }}
        defaultPlantId={alertForCreatePO?.plant_id}
        defaultMaterialId={alertForCreatePO?.material_id}
        onSuccess={(createdPoId) => {
          if (createdPoId && alertForCreatePO) {
            const a = alertForCreatePO
            setAlertForCreatePO(null)
            void handleLinkPOAfterCreate(a.id, createdPoId)
          } else {
            void fetchPlantStats()
            void fetchAlerts()
          }
        }}
      />
    </div>
  )
}
