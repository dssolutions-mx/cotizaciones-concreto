'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePlantContext } from '@/contexts/PlantContext';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { Button } from '@/components/ui/button';
import { CreateRecipeFromArkikModal } from '@/components/arkik/CreateRecipeFromArkikModal';
import type { StagingRemision } from '@/types/arkik';
import { toast } from 'sonner';
import { Loader2, FileUp } from 'lucide-react';

type QualityRequestRow = {
  id?: string;
  plant_id: string;
  primary_code: string;
  status: string;
  request_type: string;
  payload?: { rows?: Record<string, unknown>[]; remision_numbers?: string[]; file_label?: string | null };
  created_at: string;
};

function payloadRowsToStaging(rows: Record<string, unknown>[]): StagingRemision[] {
  return rows.map((raw, i) => ({
    id: (raw.id as string) || crypto.randomUUID(),
    session_id: (raw.session_id as string) || '',
    row_number: (raw.row_number as number) ?? i + 1,
    fecha: new Date(),
    hora_carga: new Date(),
    remision_number: String(raw.remision_number ?? ''),
    estatus: String(raw.estatus ?? 'pendiente'),
    volumen_fabricado: Number(raw.volumen_fabricado) || 0,
    cliente_codigo: '',
    cliente_name: String(raw.cliente_name ?? ''),
    obra_name: String(raw.obra_name ?? ''),
    prod_tecnico: String(raw.prod_tecnico ?? raw.recipe_code ?? ''),
    product_description: raw.product_description as string | undefined,
    recipe_code: raw.recipe_code as string | undefined,
    materials_teorico: (raw.materials_teorico as Record<string, number>) || {},
    materials_real: (raw.materials_real as Record<string, number>) || {},
    materials_retrabajo: (raw.materials_retrabajo as Record<string, number>) || {},
    materials_manual: (raw.materials_manual as Record<string, number>) || {},
    validation_status: (raw.validation_status as StagingRemision['validation_status']) || 'error',
    validation_errors: (raw.validation_errors as StagingRemision['validation_errors']) || [],
    suggested_order_group: '',
  }));
}

export default function ArkikQualityRequestsPage() {
  const { currentPlant } = usePlantContext();
  const { profile } = useAuthBridge();
  const [rows, setRows] = useState<QualityRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalCode, setModalCode] = useState<string | null>(null);
  const [modalSourceRows, setModalSourceRows] = useState<StagingRemision[]>([]);

  const allowed =
    profile?.role === 'QUALITY_TEAM' ||
    profile?.role === 'EXECUTIVE' ||
    profile?.role === 'PLANT_MANAGER';

  const load = useCallback(async () => {
    if (!currentPlant?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/arkik/quality-request?plant_id=${encodeURIComponent(currentPlant.id)}&status=open`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cargar');
      setRows(json.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al cargar solicitudes');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentPlant?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const resolveRequest = async (id: string, status: 'resolved' | 'dismissed') => {
    try {
      const res = await fetch('/api/arkik/quality-request', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success(status === 'resolved' ? 'Marcada como resuelta' : 'Descartada');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error');
    }
  };

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-gray-600">No tienes permisos para ver esta página.</p>
      </div>
    );
  }

  if (!currentPlant) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Selecciona una planta para ver las solicitudes.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileUp className="h-8 w-8 text-gray-700" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Solicitudes Arkik (calidad)</h1>
          <p className="text-sm text-gray-600">
            Códigos faltantes notificados desde el procesador Arkik — {currentPlant.name}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-gray-600">No hay solicitudes abiertas para esta planta.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => {
            const pr = r.payload?.rows || [];
            const staging = Array.isArray(pr) ? payloadRowsToStaging(pr as Record<string, unknown>[]) : [];
            return (
              <li key={r.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-medium">{r.primary_code}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {r.request_type} · {new Date(r.created_at).toLocaleString('es-MX')}
                    </div>
                    {r.payload?.remision_numbers && r.payload.remision_numbers.length > 0 && (
                      <div className="text-xs text-gray-600 mt-2">
                        Remisiones: {r.payload.remision_numbers.slice(0, 8).join(', ')}
                        {r.payload.remision_numbers.length > 8 ? '…' : ''}
                      </div>
                    )}
                    {r.payload?.file_label && (
                      <div className="text-xs text-gray-500">Archivo: {r.payload.file_label}</div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="default" onClick={() => {
                      setModalCode(r.primary_code);
                      setModalSourceRows(staging);
                    }}>
                      Crear receta
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => r.id && resolveRequest(r.id, 'resolved')}>
                      Resolver
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => r.id && resolveRequest(r.id, 'dismissed')}>
                      Descartar
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalCode && currentPlant.id && (
        <CreateRecipeFromArkikModal
          isOpen={!!modalCode}
          arkikCode={modalCode}
          sourceRows={
            modalSourceRows.length > 0
              ? modalSourceRows
              : [
                  {
                    id: crypto.randomUUID(),
                    session_id: '',
                    row_number: 1,
                    fecha: new Date(),
                    hora_carga: new Date(),
                    remision_number: '',
                    estatus: 'pendiente',
                    volumen_fabricado: 0,
                    cliente_codigo: '',
                    cliente_name: '',
                    obra_name: '',
                    prod_tecnico: modalCode,
                    product_description: modalCode,
                    recipe_code: modalCode,
                    materials_teorico: {},
                    materials_real: {},
                    validation_status: 'error',
                    validation_errors: [],
                    suggested_order_group: '',
                  } as StagingRemision,
                ]
          }
          plantId={currentPlant.id}
          onSuccess={() => {
            setModalCode(null);
            setModalSourceRows([]);
            load();
          }}
          onCancel={() => {
            setModalCode(null);
            setModalSourceRows([]);
          }}
        />
      )}
    </div>
  );
}
