'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Upload, CheckCircle2, Loader2, Search, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb';
import { usePlantContext } from '@/contexts/PlantContext';
import { getOrdersForDosificador } from '@/lib/supabase/orders';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { OrderWithClient } from '@/types/orders';

type EvidenceRow = {
  id: string;
  file_path: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
};

type ConcreteRemRow = {
  id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado?: number | null;
  unidad?: string | null;
  conductor?: string | null;
};

export default function EvidenciaConcretoPage() {
  const { currentPlant } = usePlantContext();
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [evidenceOrderIds, setEvidenceOrderIds] = useState<Set<string>>(new Set());
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceRow | null>(null);
  const [checklist, setChecklist] = useState<ConcreteRemRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const { data } = await getOrdersForDosificador(500, 0);
      const list = data || [];
      setOrders(list);
      const ids = list.map((o) => o.id);
      if (ids.length === 0) {
        setEvidenceOrderIds(new Set());
        return;
      }
      const { data: evRows, error: evErr } = await supabase
        .from('order_concrete_evidence')
        .select('order_id')
        .in('order_id', ids);
      if (evErr) throw evErr;
      setEvidenceOrderIds(new Set((evRows || []).map((r) => r.order_id)));
    } catch (e) {
      console.error(e);
      toast.error('No se pudieron cargar los pedidos');
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => {
      const num = (o.order_number || '').toLowerCase();
      const site = (o.construction_site || '').toLowerCase();
      const client = (o.clients as { business_name?: string } | undefined)?.business_name?.toLowerCase() || '';
      return num.includes(q) || site.includes(q) || client.includes(q);
    });
  }, [orders, search]);

  const loadDetail = useCallback(async (orderId: string) => {
    setDetailLoading(true);
    setSelectedOrderId(orderId);
    setEvidence(null);
    setChecklist([]);
    try {
      const res = await fetch(`/api/orders/${orderId}/concrete-evidence`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setEvidence(json.data?.evidence || null);
      setChecklist(json.data?.concrete_remisiones_ordered || []);
    } catch (e) {
      console.error(e);
      toast.error('No se pudo cargar el detalle del pedido');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const onFile = async (file: File | null) => {
    if (!file || !selectedOrderId) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/orders/${selectedOrderId}/concrete-evidence`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al subir');
      setEvidence(json.data);
      setEvidenceOrderIds((prev) => new Set(prev).add(selectedOrderId));
      toast.success('Evidencia guardada');
      setFileInputKey((k) => k + 1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async () => {
    if (!selectedOrderId || !evidence) return;
    if (!confirm('¿Eliminar la evidencia de este pedido?')) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrderId}/concrete-evidence`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setEvidence(null);
      setEvidenceOrderIds((prev) => {
        const n = new Set(prev);
        n.delete(selectedOrderId);
        return n;
      });
      toast.success('Evidencia eliminada');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
      <InventoryBreadcrumb />
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Evidencia de remisiones (concreto)</h1>
        <p className="text-sm text-stone-600 mt-1">
          Un solo archivo por pedido (PDF recomendado) con las remisiones en el orden indicado. {currentPlant?.name}
        </p>
      </div>

      <Card className="border-stone-200 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cómo prepararlo</CardTitle>
          <CardDescription>
            Imprima o exporte desde Arkik → escanee en el orden de la lista → una sola carpeta PDF. En el teléfono puede
            usar una app de escaneo y subir el PDF aquí.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-stone-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Buscar pedido
            </CardTitle>
            <div className="pt-2">
              <Input
                placeholder="Número, obra o cliente…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="min-h-11"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
            {loadingOrders ? (
              <div className="flex items-center gap-2 text-stone-500 text-sm py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
              </div>
            ) : filteredOrders.length === 0 ? (
              <p className="text-sm text-stone-500 py-6 text-center">No hay pedidos que coincidan.</p>
            ) : (
              filteredOrders.map((o) => {
                const hasEv = evidenceOrderIds.has(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => loadDetail(o.id)}
                    className={`w-full text-left rounded-lg border px-3 py-3 min-h-[48px] transition-colors ${
                      selectedOrderId === o.id
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-stone-900 truncate">{o.order_number}</div>
                        <div className="text-xs text-stone-500 truncate">
                          {(o.clients as { business_name?: string } | undefined)?.business_name || '—'} ·{' '}
                          {o.construction_site || '—'}
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          {o.delivery_date
                            ? format(new Date(`${o.delivery_date}T12:00:00`), 'dd/MM/yyyy', { locale: es })
                            : '—'}
                        </div>
                      </div>
                      {hasEv ? (
                        <Badge className="shrink-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Con evidencia
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0">
                          Sin evidencia
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="border-stone-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Incluya en su PDF (en este orden)
            </CardTitle>
            <CardDescription>
              Escanee en el mismo orden para que coincida con finanzas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedOrderId ? (
              <p className="text-sm text-stone-500">Seleccione un pedido a la izquierda.</p>
            ) : detailLoading ? (
              <div className="flex items-center gap-2 text-stone-500 text-sm py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando remisiones…
              </div>
            ) : checklist.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No hay remisiones de concreto en este pedido. No se puede adjuntar evidencia hasta que existan
                remisiones CONCRETO.
              </div>
            ) : (
              <ol className="list-decimal list-inside space-y-2 text-sm text-stone-800">
                {checklist.map((r) => (
                  <li key={r.id} className="pl-1">
                    <span className="font-medium">#{r.remision_number}</span>
                    {r.fecha && (
                      <span className="text-stone-500">
                        {' '}
                        · {format(new Date(`${String(r.fecha).split('T')[0]}T12:00:00`), 'dd/MM/yyyy', { locale: es })}
                      </span>
                    )}
                    {r.volumen_fabricado != null && (
                      <span className="text-stone-600"> · {r.volumen_fabricado} m³</span>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {selectedOrderId && checklist.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <label className="inline-flex items-center justify-center gap-2 rounded-lg bg-stone-900 text-white px-4 py-3 min-h-[48px] cursor-pointer hover:bg-stone-800 w-full sm:w-auto">
                    <Upload className="h-4 w-4" />
                    {evidence ? 'Reemplazar archivo' : 'Subir PDF o imagen'}
                    <input
                      key={fileInputKey}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {uploading && (
                    <span className="text-sm text-stone-500 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Subiendo…
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 flex items-start gap-2">
                  <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
                  En móvil puede elegir cámara o archivos desde el selector del sistema.
                </p>
                {evidence && (
                  <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
                    <div className="font-medium text-stone-800">{evidence.original_name}</div>
                    <div className="text-xs text-stone-500">
                      Actualizado:{' '}
                      {format(new Date(evidence.updated_at || evidence.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={onDelete}
                    >
                      Eliminar evidencia
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-stone-400 text-center">
        ¿Procesó Arkik? También puede ir desde el final del asistente:{' '}
        <Link href="/production-control/arkik-upload" className="text-sky-700 underline">
          Procesar Arkik
        </Link>
      </p>
    </div>
  );
}
