'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FileText, Upload, CheckCircle2, Loader2, Search, Smartphone, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb';
import { usePlantContext } from '@/contexts/PlantContext';
import { getOrdersForDosificador } from '@/lib/supabase/orders';
import { supabase } from '@/lib/supabase/client';
import { parseJsonResponse } from '@/lib/http/safeJsonResponse';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { toast } from 'sonner';
import type { OrderWithClient } from '@/types/orders';

/** Must match API route; files go to Supabase from the browser to avoid Vercel body limits. */
const MAX_EVIDENCE_BYTES = 50 * 1024 * 1024;
/** Multipart fallback only safe under typical serverless limits (~4.5 MB on Vercel). */
const MULTIPART_FALLBACK_MAX_BYTES = 4 * 1024 * 1024;

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

function formatBytes(n: number): string {
  if (n <= 0) return '0 B';
  const k = 1024;
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0))} ${['B', 'KB', 'MB', 'GB'][i]}`;
}

export default function EvidenciaConcretoPage() {
  const { currentPlant, isLoading: plantLoading } = usePlantContext();
  const { getSignedUrl } = useSignedUrls('remision-documents', 3600);
  const [orders, setOrders] = useState<OrderWithClient[]>([]);
  const [evidenceOrderIds, setEvidenceOrderIds] = useState<Set<string>>(new Set());
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [checklist, setChecklist] = useState<ConcreteRemRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  /** Avoid PlantContext SSR vs client mismatch on the subtitle (hydration). */
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const loadOrders = useCallback(async () => {
    if (!currentPlant?.id) {
      setOrders([]);
      setEvidenceOrderIds(new Set());
      setLoadingOrders(false);
      return;
    }
    setLoadingOrders(true);
    try {
      const { data } = await getOrdersForDosificador(500, 0, {
        plantFilterId: currentPlant.id,
        requireConcreteRemisiones: true,
      });
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
  }, [currentPlant?.id]);

  useEffect(() => {
    if (plantLoading) return;
    void loadOrders();
  }, [loadOrders, plantLoading, currentPlant?.id]);

  useEffect(() => {
    setSelectedOrderId(null);
    setEvidence([]);
    setChecklist([]);
  }, [currentPlant?.id]);

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
    setEvidence([]);
    setChecklist([]);
    try {
      const res = await fetch(`/api/orders/${orderId}/concrete-evidence`);
      const json = await parseJsonResponse<{
        data?: { evidence: EvidenceRow[]; concrete_remisiones_ordered: ConcreteRemRow[] };
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(json.error || 'Error');
      const list = json.data?.evidence;
      setEvidence(Array.isArray(list) ? list : []);
      setChecklist(json.data?.concrete_remisiones_ordered || []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el detalle del pedido');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const uploadOneFile = async (file: File, selectedOrderId: string, order: OrderWithClient) => {
    if (!order?.plant_id) {
      throw new Error('No se encontró la planta del pedido. Vuelva a cargar la lista.');
    }
    if (file.size > MAX_EVIDENCE_BYTES) {
      throw new Error(`El archivo supera el máximo de ${MAX_EVIDENCE_BYTES / (1024 * 1024)} MB`);
    }

    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
    const okExt = ['pdf', 'png', 'jpg', 'jpeg'].includes(ext);
    if (!okExt) {
      throw new Error('Solo se permiten PDF, JPEG o PNG.');
    }

    let mime = file.type.trim();
    if (!mime || mime === 'application/octet-stream') {
      if (ext === 'pdf') mime = 'application/pdf';
      else if (ext === 'png') mime = 'image/png';
      else mime = 'image/jpeg';
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const storagePath = `${order.plant_id}/order_concrete_evidence/${selectedOrderId}/${timestamp}_${randomString}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from('remision-documents')
      .upload(storagePath, file, { cacheControl: '3600', upsert: false });

    if (storageError) {
      if (file.size <= MULTIPART_FALLBACK_MAX_BYTES) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(`/api/orders/${selectedOrderId}/concrete-evidence`, {
          method: 'POST',
          body: fd,
        });
        const json = await parseJsonResponse<{ data?: EvidenceRow; error?: string }>(res);
        if (!res.ok) throw new Error(json.error || 'Error al subir');
        if (!json.data) throw new Error('No se recibió el registro de evidencia');
        return json.data;
      }
      throw new Error(
        storageError.message || 'No se pudo subir el archivo. Verifique permisos o comprima el PDF.'
      );
    }

    const res = await fetch(`/api/orders/${selectedOrderId}/concrete-evidence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: storagePath,
        original_name: file.name,
        file_size: file.size,
        mime_type: mime,
      }),
    });
    let json: { data?: EvidenceRow; error?: string };
    try {
      json = await parseJsonResponse<{ data?: EvidenceRow; error?: string }>(res);
    } catch (err) {
      await supabase.storage.from('remision-documents').remove([storagePath]).catch(() => {});
      throw err;
    }
    if (!res.ok) {
      await supabase.storage.from('remision-documents').remove([storagePath]).catch(() => {});
      throw new Error(json.error || 'Error al guardar la evidencia');
    }
    if (!json.data) {
      await supabase.storage.from('remision-documents').remove([storagePath]).catch(() => {});
      throw new Error('No se recibió el registro de evidencia');
    }
    return json.data;
  };

  const onFiles = async (fileList: FileList | null) => {
    if (!fileList?.length || !selectedOrderId) return;
    const order = orders.find((o) => o.id === selectedOrderId);
    if (!order) {
      toast.error('Pedido no encontrado en la lista.');
      return;
    }

    const files = Array.from(fileList);
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Subiendo ${i + 1}/${files.length}…`);
        const row = await uploadOneFile(files[i], selectedOrderId, order);
        setEvidence((prev) => [...prev, row]);
        setEvidenceOrderIds((prev) => new Set(prev).add(selectedOrderId));
      }
      toast.success(
        files.length === 1 ? 'Evidencia guardada' : `${files.length} archivos guardados`
      );
      setFileInputKey((k) => k + 1);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setUploadProgress(null);
      setUploading(false);
    }
  };

  const openFile = async (filePath: string) => {
    const url = await getSignedUrl(filePath);
    if (url) window.open(url, '_blank');
    else toast.error('No se pudo abrir el archivo');
  };

  const onDeleteEvidence = async (evidenceId: string) => {
    if (!selectedOrderId) return;
    if (!confirm('¿Eliminar este archivo de evidencia?')) return;
    const oid = selectedOrderId;
    try {
      const res = await fetch(
        `/api/orders/${oid}/concrete-evidence?evidence_id=${encodeURIComponent(evidenceId)}`,
        { method: 'DELETE' }
      );
      const json = await parseJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(json.error || 'Error');
      setEvidence((prev) => {
        const next = prev.filter((e) => e.id !== evidenceId);
        queueMicrotask(() => {
          setEvidenceOrderIds((ids) => {
            const n = new Set(ids);
            if (next.length === 0) n.delete(oid);
            else n.add(oid);
            return n;
          });
        });
        return next;
      });
      toast.success('Archivo eliminado');
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
          Uno o varios archivos por pedido (p. ej. varios PDF) con las remisiones en el orden indicado.
          {mounted && currentPlant?.name ? (
            <span className="block mt-1 font-medium text-stone-800">Planta: {currentPlant.name}</span>
          ) : null}
        </p>
      </div>

      <Card className="border-stone-200 bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cómo prepararlo</CardTitle>
          <CardDescription>
            Imprima o exporte desde Arkik → escanee en el orden de la lista → puede subir un PDF único o varios
            archivos. En el teléfono puede usar una app de escaneo y subir aquí.
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
            {plantLoading || loadingOrders ? (
              <div className="flex items-center gap-2 text-stone-500 text-sm py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando…
              </div>
            ) : !currentPlant?.id ? (
              <p className="text-sm text-stone-500 py-6 text-center">
                No hay planta seleccionada. Use el selector de planta en la barra superior.
              </p>
            ) : filteredOrders.length === 0 ? (
              <p className="text-sm text-stone-500 py-6 text-center">
                {search.trim()
                  ? 'No hay pedidos que coincidan con la búsqueda.'
                  : 'No hay pedidos abiertos con remisiones de concreto en esta planta.'}
              </p>
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
              Incluya en su evidencia (en este orden)
            </CardTitle>
            <CardDescription>Escanee en el mismo orden para que coincida con finanzas.</CardDescription>
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
                    Subir PDF o imágenes
                    <input
                      key={fileInputKey}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => void onFiles(e.target.files)}
                    />
                  </label>
                  {uploading && (
                    <span className="text-sm text-stone-500 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploadProgress || 'Subiendo…'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 flex items-start gap-2">
                  <Smartphone className="h-4 w-4 shrink-0 mt-0.5" />
                  Puede elegir varios archivos a la vez. En móvil puede usar cámara o archivos desde el selector del
                  sistema.
                </p>
                {evidence.length > 0 && (
                  <ul className="space-y-2">
                    {evidence.map((ev) => (
                      <li
                        key={ev.id}
                        className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-stone-800 truncate">{ev.original_name}</div>
                          <div className="text-xs text-stone-500">
                            {formatBytes(ev.file_size)} ·{' '}
                            {format(new Date(ev.updated_at || ev.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void openFile(ev.file_path)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Abrir
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void onDeleteEvidence(ev.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
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