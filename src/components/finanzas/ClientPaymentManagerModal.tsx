'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Pencil, Trash2, RefreshCw } from 'lucide-react';
import type { ConstructionSite } from '@/types/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type ClientPayment = {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  construction_site: string | null;
  created_at?: string;
  created_by?: string;
};

function toYMD(dateStr: string): string {
  if (!dateStr) return '';
  // If the DB already returned a date-only string, do NOT timezone-shift it.
  // JS parses YYYY-MM-DD as UTC midnight, which would shift the date in many timezones.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 10);
}

export function ClientPaymentManagerModal({
  clientId,
  clientName,
  sites,
  triggerLabel = 'Pagos',
  triggerVariant = 'secondary',
  triggerSize = 'sm',
  triggerClassName,
  onMutated,
}: {
  clientId: string;
  clientName?: string;
  sites?: ConstructionSite[];
  triggerLabel?: string;
  triggerVariant?: 'primary' | 'secondary' | 'ghost' | 'glass' | 'destructive';
  triggerSize?: 'default' | 'sm' | 'lg' | 'icon';
  triggerClassName?: string;
  onMutated?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [payments, setPayments] = React.useState<ClientPayment[]>([]);
  const [editing, setEditing] = React.useState<ClientPayment | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ClientPayment | null>(null);
  const [deleteReason, setDeleteReason] = React.useState('');

  const [editForm, setEditForm] = React.useState<{
    amount: string;
    payment_date: string;
    payment_method: string;
    reference_number: string;
    notes: string;
    construction_site: string; // 'general' or site name
    reason: string;
  }>({
    amount: '',
    payment_date: '',
    payment_method: 'TRANSFER',
    reference_number: '',
    notes: '',
    construction_site: 'general',
    reason: '',
  });

  const fetchPayments = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finanzas/client-payments?client_id=${encodeURIComponent(clientId)}`);
      if (!res.ok) throw new Error('No se pudieron cargar los pagos');
      const data = await res.json();
      setPayments((data?.payments || []) as ClientPayment[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al cargar pagos');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    if (open) fetchPayments();
  }, [open, fetchPayments]);

  const startEdit = (p: ClientPayment) => {
    setEditing(p);
    setEditForm({
      amount: String(p.amount ?? ''),
      payment_date: toYMD(p.payment_date),
      payment_method: p.payment_method || 'TRANSFER',
      reference_number: p.reference_number || '',
      notes: p.notes || '',
      construction_site: p.construction_site ? p.construction_site : 'general',
      reason: '',
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const amountNum = Number(editForm.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Monto inválido');
      return;
    }
    if (!editForm.payment_date) {
      toast.error('Fecha requerida');
      return;
    }
    if (!editForm.payment_method) {
      toast.error('Método requerido');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/finanzas/client-payments/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          payment_date: editForm.payment_date,
          payment_method: editForm.payment_method,
          reference_number: editForm.reference_number || null,
          notes: editForm.notes || null,
          construction_site: editForm.construction_site === 'general' ? 'general' : editForm.construction_site,
          reason: editForm.reason || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || 'No se pudo actualizar el pago');
      toast.success('Pago actualizado');
      setEditing(null);
      await fetchPayments();
      onMutated?.();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al actualizar el pago');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const paymentId = deleteTarget.id;

    setDeletingId(paymentId);
    try {
      const qp = deleteReason ? `?reason=${encodeURIComponent(deleteReason)}` : '';
      const res = await fetch(`/api/finanzas/client-payments/${encodeURIComponent(paymentId)}${qp}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'No se pudo eliminar el pago');
      }
      toast.success('Pago eliminado');
      if (editing?.id === paymentId) setEditing(null);
      await fetchPayments();
      onMutated?.();
      setDeleteTarget(null);
      setDeleteReason('');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al eliminar el pago');
    } finally {
      setDeletingId(null);
    }
  };

  const siteOptions: Array<{ value: string; label: string }> = React.useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [{ value: 'general', label: 'General (Distribución automática)' }];
    (sites || []).forEach((s) => {
      opts.push({ value: s.name, label: s.name });
    });
    return opts;
  }, [sites]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagos del Cliente</DialogTitle>
          <DialogDescription>
            {clientName ? `${clientName} — ` : ''}Editar o eliminar pagos registrados.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">
            {loading ? 'Cargando…' : `${payments.length} pago${payments.length === 1 ? '' : 's'}`}
          </div>
          <Button variant="secondary" size="sm" onClick={fetchPayments} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                  <TableCell>{p.payment_method || '-'}</TableCell>
                  <TableCell className="truncate max-w-[160px]" title={p.reference_number || ''}>
                    {p.reference_number || '-'}
                  </TableCell>
                  <TableCell className="truncate max-w-[200px]" title={p.construction_site || 'General'}>
                    {p.construction_site || 'General'}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(p.amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => startEdit(p)}>
                        <Pencil className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setDeleteTarget(p);
                          setDeleteReason('');
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Eliminar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No hay pagos para este cliente.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {editing && (
          <div className="mt-6 rounded-md border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Editar pago</div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={saving}>
                Cerrar edición
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_amount">Monto</Label>
                <Input
                  id="edit_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((s) => ({ ...s, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_date">Fecha</Label>
                <Input
                  id="edit_date"
                  type="date"
                  value={editForm.payment_date}
                  onChange={(e) => setEditForm((s) => ({ ...s, payment_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_method">Método</Label>
                <Select
                  value={editForm.payment_method}
                  onValueChange={(v) => setEditForm((s) => ({ ...s, payment_method: v }))}
                >
                  <SelectTrigger id="edit_method">
                    <SelectValue placeholder="Seleccione método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Efectivo</SelectItem>
                    <SelectItem value="TRANSFER">Transferencia</SelectItem>
                    <SelectItem value="CHECK">Cheque</SelectItem>
                    <SelectItem value="CREDIT_CARD">Tarjeta de Crédito</SelectItem>
                    <SelectItem value="OTHER">Otro</SelectItem>
                    {/* Keep whatever is stored even if it doesn't match our presets */}
                    {['CASH', 'TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'].includes(editForm.payment_method) ? null : (
                      <SelectItem value={editForm.payment_method}>{editForm.payment_method}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_ref">Referencia</Label>
                <Input
                  id="edit_ref"
                  value={editForm.reference_number}
                  onChange={(e) => setEditForm((s) => ({ ...s, reference_number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_site">Obra</Label>
                {siteOptions.length > 1 ? (
                  <Select
                    value={editForm.construction_site}
                    onValueChange={(v) => setEditForm((s) => ({ ...s, construction_site: v }))}
                  >
                    <SelectTrigger id="edit_site">
                      <SelectValue placeholder="General" />
                    </SelectTrigger>
                    <SelectContent>
                      {siteOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="edit_site"
                    placeholder="General (vacío) o nombre de obra"
                    value={editForm.construction_site === 'general' ? '' : editForm.construction_site}
                    onChange={(e) => setEditForm((s) => ({ ...s, construction_site: e.target.value || 'general' }))}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_notes">Notas</Label>
                <Input
                  id="edit_notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_reason">Motivo (opcional)</Label>
                <Input
                  id="edit_reason"
                  value={editForm.reason}
                  onChange={(e) => setEditForm((s) => ({ ...s, reason: e.target.value }))}
                  placeholder="Se guardará en auditoría"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        )}

        <AlertDialog
          open={!!deleteTarget}
          onOpenChange={(next) => {
            if (!next) {
              setDeleteTarget(null);
              setDeleteReason('');
            }
          }}
        >
          <AlertDialogTrigger asChild>
            <span />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar pago</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará el pago permanentemente. Se conservará un registro de auditoría (quién/cuándo/motivo).
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <Label htmlFor="delete_reason">Motivo (opcional)</Label>
              <Input
                id="delete_reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ej. pago duplicado, captura incorrecta…"
              />
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!deletingId}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void confirmDelete();
                }}
                className="bg-systemRed text-white hover:bg-systemRed/90"
                disabled={!!deletingId}
              >
                {deletingId ? 'Eliminando…' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

