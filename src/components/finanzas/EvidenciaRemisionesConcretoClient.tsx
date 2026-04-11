'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, ExternalLink, Loader2, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSignedUrls } from '@/hooks/useSignedUrls';
import { toast } from 'sonner';

type EvidenceFile = {
  id: string;
  created_at: string;
  updated_at: string;
  original_name: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  file_path: string;
};

type Row = {
  order_id: string;
  order_number: string;
  delivery_date: string;
  construction_site: string | null;
  client_name: string | null;
  concrete_remisiones_count: number;
  has_evidence: boolean;
  evidence_count: number;
  evidence_files: EvidenceFile[];
  evidence_last_at: string | null;
  evidence_last_uploader_name: string | null;
};

export default function EvidenciaRemisionesConcretoClient() {
  const [from, setFrom] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [to, setTo] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [missingOnly, setMissingOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const { getSignedUrl, isLoading: urlLoading } = useSignedUrls('remision-documents', 3600);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({
        date_from: from,
        date_to: to,
        missing_only: missingOnly ? 'true' : 'false',
        limit: '100',
        offset: '0',
      });
      const res = await fetch(`/api/finanzas/concrete-evidence?${sp.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setRows(json.data?.rows || []);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [from, to, missingOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const openEvidence = async (filePath: string) => {
    const url = await getSignedUrl(filePath);
    if (url) window.open(url, '_blank');
    else toast.error('No se pudo abrir el archivo');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-large-title text-gray-900">Evidencia remisiones (concreto)</h1>
        <p className="text-footnote text-muted-foreground mt-1">
          Verificación de uno o varios archivos por pedido (p. ej. varios PDF con remisiones de concreto).
        </p>
      </div>

      <Card className="glass-base rounded-2xl border border-stone-200/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-title-3">Filtros</CardTitle>
          <CardDescription>Rango de fechas por fecha de entrega del pedido</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="ev-from">Desde</Label>
            <input
              id="ev-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ev-to">Hasta</Label>
            <input
              id="ev-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm min-h-11"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer min-h-11">
            <Checkbox checked={missingOnly} onCheckedChange={(v) => setMissingOnly(v === true)} />
            Solo pedidos con remisiones y sin evidencia
          </label>
          <Button type="button" onClick={load} disabled={loading} className="min-h-11">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
          </Button>
        </CardContent>
      </Card>

      <div className="glass-base rounded-2xl p-0 overflow-hidden border border-stone-200/80">
        {loading && rows.length === 0 ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">Rem. concreto</TableHead>
                <TableHead>Evidencia</TableHead>
                <TableHead>Última carga</TableHead>
                <TableHead className="text-right">Archivos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                    Sin resultados
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.order_id}>
                    <TableCell className="font-medium">{r.order_number}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{r.client_name || '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{r.construction_site || '—'}</TableCell>
                    <TableCell className="text-right">{r.concrete_remisiones_count}</TableCell>
                    <TableCell>
                      {r.has_evidence ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-sm">
                          <CheckCircle2 className="h-4 w-4" /> {r.evidence_count}{' '}
                          {r.evidence_count === 1 ? 'archivo' : 'archivos'}
                        </span>
                      ) : r.concrete_remisiones_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 text-sm">
                          <XCircle className="h-4 w-4" /> Falta
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.evidence_last_at
                        ? format(new Date(r.evidence_last_at), 'dd/MM/yyyy HH:mm', { locale: es })
                        : '—'}
                      {r.evidence_last_uploader_name && (
                        <span className="block text-xs">{r.evidence_last_uploader_name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      {r.evidence_files.length > 0 ? (
                        <div className="flex flex-col items-end gap-1">
                          {r.evidence_files.map((f, i) => (
                            <Button
                              key={f.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 max-w-[220px]"
                              disabled={urlLoading(f.file_path)}
                              title={f.original_name}
                              onClick={() => openEvidence(f.file_path)}
                            >
                              <ExternalLink className="h-3.5 w-3.5 mr-1 shrink-0" />
                              <span className="truncate">Abrir {i + 1}</span>
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
