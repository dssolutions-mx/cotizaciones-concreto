'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import type { HrWeeklyComplianceDispute } from '@/services/hrWeeklyRemisionesService';

type DisputeStatus =
  | 'pending_dispute'
  | 'disputed'
  | 'accepted'
  | 'rejected'
  | 'resolved_nc'
  | 'payroll_waived';

const STATUS_LABELS: Record<DisputeStatus, string> = {
  pending_dispute: 'Pendiente',
  disputed: 'Disputado',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  resolved_nc: 'NC resuelta',
  payroll_waived: 'Nómina exceptuada',
};

const STATUS_COLORS: Record<DisputeStatus, string> = {
  pending_dispute: 'bg-amber-100 text-amber-800',
  disputed: 'bg-blue-100 text-blue-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  resolved_nc: 'bg-stone-100 text-stone-700',
  payroll_waived: 'bg-purple-100 text-purple-800',
};

const CATEGORY_LABELS: Record<string, string> = {
  missingProduction: 'Sin remisiones CONCRETO',
  missingMaterialEntries: 'Sin entradas de material',
  missingEvidence: 'Evidencia faltante',
  missingPumping: 'Bombeo faltante',
  missingChecklist: 'Checklist faltante',
  operatorMismatch: 'Conductor ≠ operador',
  unknownUnit: 'Unidad no registrada',
};

function StatusBadge({ status }: { status: string }) {
  const s = status as DisputeStatus;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_COLORS[s] ?? 'bg-stone-100 text-stone-700'
      }`}
    >
      {STATUS_LABELS[s] ?? status}
    </span>
  );
}

function DisputeDrawer({
  dispute,
  open,
  onClose,
  onResolved,
}: {
  dispute: HrWeeklyComplianceDispute;
  open: boolean;
  onClose: () => void;
  onResolved: (updated: Partial<HrWeeklyComplianceDispute>) => void;
}) {
  const [status, setStatus] = useState<DisputeStatus>(dispute.status as DisputeStatus);
  const [notes, setNotes] = useState(dispute.resolution_notes ?? '');
  const [saving, setSaving] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  useEffect(() => {
    setStatus(dispute.status as DisputeStatus);
    setNotes(dispute.resolution_notes ?? '');
  }, [dispute]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/compliance/daily/dispute/${dispute.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution_notes: notes }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'No se pudo guardar');
        return;
      }
      toast.success('Estado actualizado');
      onResolved({ status, resolution_notes: notes, resolved_at: new Date().toISOString() });
      onClose();
    } catch {
      toast.error('Error de red');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="flex w-full max-w-2xl flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b border-stone-200 px-6 py-4">
          <SheetTitle className="text-base">
            {CATEGORY_LABELS[dispute.category] ?? dispute.category} — {dispute.plant?.code} —{' '}
            {dispute.run?.target_date}
          </SheetTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            {dispute.sent_at && (
              <span>Enviado: {new Date(dispute.sent_at).toLocaleString('es-MX')}</span>
            )}
            {dispute.sender?.email && <span>· Por: {dispute.sender.email}</span>}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {dispute.recipients && (
            <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-xs space-y-1">
              <p>
                <span className="font-medium text-stone-600">Para:</span>{' '}
                {dispute.recipients.to.join(', ') || '—'}
              </p>
              <p>
                <span className="font-medium text-stone-600">CC:</span>{' '}
                {dispute.recipients.cc.join(', ') || '—'}
              </p>
            </div>
          )}

          {dispute.subject && (
            <div>
              <p className="text-xs text-stone-500">Asunto</p>
              <p className="text-sm font-medium text-stone-900">{dispute.subject}</p>
            </div>
          )}

          {dispute.body && (
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700"
                onClick={() => setShowEmail((v) => !v)}
              >
                {showEmail ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {showEmail ? 'Ocultar cuerpo del correo' : 'Ver cuerpo del correo'}
              </button>
              {showEmail && (
                <iframe
                  srcDoc={dispute.body}
                  sandbox="allow-same-origin"
                  className="mt-2 h-64 w-full rounded border border-stone-200"
                  title="Cuerpo del correo"
                />
              )}
            </div>
          )}

          <div className="space-y-3 rounded-md border border-stone-200 p-4">
            <p className="text-sm font-semibold text-stone-800">Actualizar estado</p>
            <div className="space-y-1">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as DisputeStatus)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_LABELS) as [DisputeStatus, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notas de resolución / sanción</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contexto, justificación o acción de nómina…"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-stone-200 px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

type Props = {
  disputes: HrWeeklyComplianceDispute[];
  onRefresh: () => void;
};

export function HrWeeklyCompliancePanel({ disputes: initial, onRefresh }: Props) {
  const [disputes, setDisputes] = useState(initial);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<HrWeeklyComplianceDispute | null>(null);

  useEffect(() => {
    setDisputes(initial);
  }, [initial]);

  const load = useCallback(async () => {
    onRefresh();
  }, [onRefresh]);

  const visible =
    statusFilter === 'all' ? disputes : disputes.filter((d) => d.status === statusFilter);

  const handleResolved = (id: string, updated: Partial<HrWeeklyComplianceDispute>) => {
    setDisputes((prev) => prev.map((d) => (d.id === id ? { ...d, ...updated } : d)));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Correos de cumplimiento enviados en el período. El estado y las notas ayudan a documentar
        sanciones o excepciones de nómina. Las alertas por remisión aparecen en la pestaña Detalle.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {(Object.entries(STATUS_LABELS) as [DisputeStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Actualizar
        </Button>
        <span className="text-xs text-gray-500">
          {visible.length} registro{visible.length !== 1 ? 's' : ''}
        </span>
      </div>

      {disputes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
          No hay correos de cumplimiento registrados en este rango o no hay corridas diarias guardadas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium text-gray-500">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Planta</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Para</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Enviado</th>
                <th className="px-4 py-3">Resuelto</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">
                    {d.run?.target_date ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-medium">{d.plant?.code ?? '—'}</td>
                  <td className="px-4 py-3">{CATEGORY_LABELS[d.category] ?? d.category}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">
                    {d.recipients?.to?.join(', ') ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {d.sent_at ? new Date(d.sent_at).toLocaleDateString('es-MX') : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {d.resolved_at ? new Date(d.resolved_at).toLocaleDateString('es-MX') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setSelected(d)}>
                      Ver / resolver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <DisputeDrawer
          dispute={selected}
          open
          onClose={() => setSelected(null)}
          onResolved={(updated) => {
            handleResolved(selected.id, updated);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
