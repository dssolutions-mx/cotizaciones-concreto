'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Settings,
  RefreshCw,
  Plus,
  Edit2,
  AlertTriangle,
  TrendingDown,
  CheckCircle,
} from 'lucide-react'
import { usePlantContext } from '@/contexts/PlantContext'
import { useAuthSelectors } from '@/hooks/use-auth-zustand'
import InventoryBreadcrumb from './InventoryBreadcrumb'
import StatCard from './ui/StatCard'
import type { ReorderConfig, ReorderConfigInput } from '@/types/alerts'

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return '—'
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ---------- Edit/Create Dialog ----------
function ConfigDialog({
  config,
  plantId,
  onClose,
  onSaved,
}: {
  config: ReorderConfig | null   // null = creating new
  plantId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [materialSearch, setMaterialSearch] = useState('')
  const [materials, setMaterials] = useState<{ id: string; material_name: string; category: string }[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [form, setForm] = useState<ReorderConfigInput>({
    plant_id: plantId,
    material_id: config?.material_id || '',
    reorder_point_kg: config?.reorder_point_kg || 0,
    reorder_qty_kg: config?.reorder_qty_kg ?? undefined,
    notes: config?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!materialSearch || config) return
    const timeout = setTimeout(async () => {
      setLoadingMaterials(true)
      try {
        const res = await fetch(`/api/inventory/materials?plant_id=${plantId}&search=${encodeURIComponent(materialSearch)}&limit=10`)
        const json = await res.json()
        setMaterials(json.data || [])
      } finally {
        setLoadingMaterials(false)
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [materialSearch, plantId, config])

  const handleSave = async () => {
    if (!form.material_id) { setError('Seleccione un material'); return }
    if (!form.reorder_point_kg || form.reorder_point_kg <= 0) { setError('Ingrese un punto de reorden valido'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/inventory/reorder-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.success) {
        onSaved()
      } else {
        setError(json.error || 'Error al guardar')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{config ? 'Editar Punto de Reorden' : 'Nuevo Punto de Reorden'}</DialogTitle>
          <DialogDescription>
            Configure el nivel de inventario que dispara una alerta de reabastecimiento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Material selector — locked when editing */}
          {config ? (
            <div>
              <label className="text-sm font-medium">Material</label>
              <div className="mt-1 px-3 py-2 bg-stone-50 rounded-md text-sm font-medium text-stone-700">
                {config.material?.material_name || 'Material'}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium">Buscar Material *</label>
              <Input
                className="mt-1"
                placeholder="Nombre del material..."
                value={materialSearch}
                onChange={e => setMaterialSearch(e.target.value)}
              />
              {materials.length > 0 && (
                <div className="mt-1 border rounded-md divide-y max-h-40 overflow-y-auto">
                  {materials.map(m => (
                    <button
                      key={m.id}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-100 transition-colors ${form.material_id === m.id ? 'bg-stone-100 font-medium' : ''}`}
                      onClick={() => { setForm(prev => ({ ...prev, material_id: m.id })); setMaterialSearch(m.material_name); setMaterials([]) }}
                    >
                      <span>{m.material_name}</span>
                      <span className="text-stone-400 ml-2 text-xs">{m.category}</span>
                    </button>
                  ))}
                </div>
              )}
              {loadingMaterials && <p className="text-xs text-stone-500 mt-1">Buscando...</p>}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Punto de Reorden (kg) *</label>
            <Input
              type="number"
              min="0"
              step="0.001"
              className="mt-1"
              placeholder="Ej: 5000"
              value={form.reorder_point_kg || ''}
              onChange={e => setForm(prev => ({ ...prev, reorder_point_kg: parseFloat(e.target.value) || 0 }))}
            />
            <p className="text-xs text-stone-500 mt-1">
              Se generara una alerta cuando el stock caiga por debajo de este nivel.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">Cantidad Sugerida de Reorden (kg)</label>
            <Input
              type="number"
              min="0"
              step="0.001"
              className="mt-1"
              placeholder="Opcional — cantidad tipica de pedido"
              value={form.reorder_qty_kg || ''}
              onChange={e => setForm(prev => ({ ...prev, reorder_qty_kg: parseFloat(e.target.value) || undefined }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Notas</label>
            <Textarea
              className="mt-1"
              placeholder="Observaciones sobre este punto de reorden..."
              value={form.notes || ''}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !form.material_id || !form.reorder_point_kg}>
            {saving ? 'Guardando...' : config ? 'Actualizar' : 'Crear Configuracion'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------- Main Page ----------
export default function ReorderConfigPage() {
  const { currentPlant } = usePlantContext()
  const { profile } = useAuthSelectors()
  const [configs, setConfigs] = useState<ReorderConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<ReorderConfig | 'new' | null>(null)

  const canEdit = ['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile?.role || '')

  const fetchConfigs = useCallback(async () => {
    if (!currentPlant?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/reorder-config?plant_id=${currentPlant.id}`)
      const json = await res.json()
      if (json.success) setConfigs(json.data || [])
    } catch (err) {
      console.error('Failed to fetch reorder configs:', err)
    } finally {
      setLoading(false)
    }
  }, [currentPlant?.id])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  const activeConfigs = configs.filter(c => c.is_active)

  return (
    <div className="space-y-6 w-full">
      <InventoryBreadcrumb />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Puntos de Reorden</h1>
          <p className="text-sm text-stone-500 mt-1">
            Configuración de alertas automáticas de reabastecimiento — POL-OPE-003
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchConfigs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setEditTarget('new')}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Material
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Materiales Configurados"
          value={activeConfigs.length}
          icon={Settings}
          iconColor="text-sky-700"
        />
        <StatCard
          title="Con Monitoreo Activo"
          value={activeConfigs.filter(c => c.is_active).length}
          icon={CheckCircle}
          iconColor="text-green-600"
        />
        <StatCard
          title="Total Configuraciones"
          value={configs.length}
          icon={AlertTriangle}
          iconColor="text-amber-600"
        />
      </div>

      {/* Info banner for non-editors */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>Solo usuarios con rol Ejecutivo o Admin de Operaciones pueden modificar los puntos de reorden.</p>
        </div>
      )}

      {/* Config List */}
      {loading ? (
        <div className="text-center py-12 text-stone-500">Cargando configuraciones...</div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-stone-500">
            <Settings className="h-12 w-12 mx-auto mb-3 text-stone-300" />
            <p className="font-medium">Sin configuraciones de reorden</p>
            <p className="text-sm mt-1">
              {canEdit
                ? 'Agregue materiales para activar alertas automaticas de reabastecimiento.'
                : 'Contacte al Ejecutivo de Operaciones para configurar los puntos de reorden.'}
            </p>
            {canEdit && (
              <Button className="mt-4" onClick={() => setEditTarget('new')}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primer Material
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Header row */}
          <div className="hidden md:grid md:grid-cols-5 gap-4 px-4 py-2 text-xs font-medium text-stone-500 uppercase tracking-wider">
            <span className="col-span-2">Material</span>
            <span className="text-right">Punto de Reorden</span>
            <span className="text-right">Qty Sugerida</span>
            <span className="text-right">Acciones</span>
          </div>

          {configs.map(config => (
            <Card key={config.id} className={`overflow-hidden ${!config.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-stretch">
                <div className={`w-1.5 ${config.is_active ? 'bg-green-400' : 'bg-stone-300'}`} />
                <div className="flex-1 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-stone-900">
                          {config.material?.material_name || 'Material'}
                        </h3>
                        <Badge
                          className={config.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-stone-100 text-stone-600'}
                        >
                          {config.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                        {config.material?.category && (
                          <span className="text-xs text-stone-500">{config.material.category}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-6 mt-2 text-sm">
                        <div className="flex items-center gap-1.5">
                          <TrendingDown className="h-4 w-4 text-amber-500" />
                          <span className="text-stone-600">Reorden en</span>
                          <strong className="text-amber-700">{fmt(config.reorder_point_kg)} kg</strong>
                        </div>
                        {config.reorder_qty_kg && (
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="h-4 w-4 text-sky-600" />
                            <span className="text-stone-600">Pedir</span>
                            <strong className="text-sky-900">{fmt(config.reorder_qty_kg)} kg</strong>
                          </div>
                        )}
                      </div>

                      {config.notes && (
                        <p className="text-xs text-stone-500 mt-1.5">{config.notes}</p>
                      )}
                    </div>

                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-4 flex-shrink-0"
                        onClick={() => setEditTarget(config)}
                      >
                        <Edit2 className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* How it works explainer */}
      <Card className="bg-stone-50 border-stone-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-stone-900">Cómo funcionan los puntos de reorden</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-stone-700 space-y-1">
          <p>1. El sistema monitorea el inventario en tiempo real para cada material configurado.</p>
          <p>2. Cuando el stock cae por debajo del punto de reorden, se genera una alerta automatica.</p>
          <p>3. El dosificador recibe notificacion y tiene 4 horas para confirmar con conteo fisico.</p>
          <p>4. El Jefe de Planta valida la necesidad y gestiona la Orden de Compra.</p>
          <p>5. El ciclo completo sigue el protocolo POL-OPE-003 hasta la recepcion en almacen.</p>
        </CardContent>
      </Card>

      {/* Dialog */}
      {editTarget !== null && currentPlant?.id && (
        <ConfigDialog
          config={editTarget === 'new' ? null : editTarget}
          plantId={currentPlant.id}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); fetchConfigs() }}
        />
      )}
    </div>
  )
}
