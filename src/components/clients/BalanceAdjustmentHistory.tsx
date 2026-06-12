'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const MANAGE_ROLES = new Set([
  'EXECUTIVE',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
  'ADMIN_OPERATIONS',
  'ADMINISTRATIVE',
]);

interface BalanceAdjustmentHistoryProps {
  clientId?: string;
  onMutated?: () => void;
}

interface AdjustmentRecord {
  id: string;
  adjustment_type: 'TRANSFER' | 'SITE_TRANSFER' | 'MANUAL_ADDITION';
  transfer_type: 'DEBT' | 'CREDIT';
  source_client_id: string;
  source_client_name: string;
  target_client_id: string | null;
  target_client_name: string | null;
  source_site: string | null;
  target_site: string | null;
  amount: number;
  notes: string;
  created_by_name: string;
  created_at: string;
  effect_on_client?: number;
}

export function BalanceAdjustmentHistory({ clientId, onMutated }: BalanceAdjustmentHistoryProps) {
  const { profile } = useAuthBridge();
  const canManage = profile?.role ? MANAGE_ROLES.has(profile.role) : false;

  const [adjustments, setAdjustments] = useState<AdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    adjustmentType: 'all',
    startDate: '',
    endDate: ''
  });
  const [editing, setEditing] = useState<AdjustmentRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdjustmentRecord | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [editForm, setEditForm] = useState({
    amount: '',
    notes: '',
    transfer_type: 'DEBT' as 'DEBT' | 'CREDIT',
    reason: '',
  });

  const loadAdjustments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { error: testError } = await supabase.rpc('get_client_balance_adjustments', {});

      if (testError && testError.message.includes('function does not exist')) {
        setError('El historial de ajustes es una funcionalidad actualmente en implementación. Estará disponible próximamente.');
        setAdjustments([]);
        return;
      }

      const params: Record<string, string> = {};

      if (clientId) {
        params.p_client_id = clientId;
      }

      if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        if (!isNaN(startDate.getTime())) {
          params.p_start_date = startDate.toISOString();
        }
      }

      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          params.p_end_date = endDate.toISOString();
        }
      }

      if (filters.adjustmentType !== 'all') {
        params.p_adjustment_type = filters.adjustmentType;
      }

      const { data, error: queryError } = await supabase.rpc('get_client_balance_adjustments', params);

      if (queryError) {
        throw new Error(queryError.message || 'No se pudieron cargar los ajustes de saldo.');
      }

      setAdjustments((data as AdjustmentRecord[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cargar los ajustes de balance';
      console.error('Error loading balance adjustments:', err);
      setError(message);
      toast.error('Error al cargar el historial de ajustes');
    } finally {
      setLoading(false);
    }
  }, [clientId, filters]);

  useEffect(() => {
    void loadAdjustments();
  }, [loadAdjustments]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatAdjustmentType = (type: string) => {
    switch (type) {
      case 'TRANSFER': return 'Transferencia entre Clientes';
      case 'SITE_TRANSFER': return 'Transferencia entre Obras';
      case 'MANUAL_ADDITION': return 'Ajuste Manual';
      default: return type;
    }
  };

  const startEdit = (adjustment: AdjustmentRecord) => {
    setEditing(adjustment);
    setEditForm({
      amount: String(adjustment.amount ?? ''),
      notes: adjustment.notes || '',
      transfer_type: adjustment.transfer_type || 'DEBT',
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
    if (!editForm.notes.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        amount: amountNum,
        notes: editForm.notes.trim(),
        reason: editForm.reason.trim() || null,
      };

      if (editing.adjustment_type === 'MANUAL_ADDITION') {
        body.transfer_type = editForm.transfer_type;
      }

      const res = await fetch(`/api/finanzas/balance-adjustments/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((payload as { error?: string })?.error || 'No se pudo actualizar el ajuste');
      }

      toast.success('Ajuste actualizado');
      setEditing(null);
      await loadAdjustments();
      onMutated?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar el ajuste';
      console.error(err);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    const adjustmentId = deleteTarget.id;
    setDeletingId(adjustmentId);
    try {
      const qp = deleteReason.trim()
        ? `?reason=${encodeURIComponent(deleteReason.trim())}`
        : '';
      const res = await fetch(
        `/api/finanzas/balance-adjustments/${encodeURIComponent(adjustmentId)}${qp}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { error?: string })?.error || 'No se pudo eliminar el ajuste');
      }

      toast.success('Ajuste eliminado y saldo corregido');
      if (editing?.id === adjustmentId) setEditing(null);
      await loadAdjustments();
      onMutated?.();
      setDeleteTarget(null);
      setDeleteReason('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al eliminar el ajuste';
      console.error(err);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Historial de Ajustes de Saldo</CardTitle>
            <CardDescription>
              {clientId
                ? 'Registro de ajustes de saldo para este cliente. Puede corregir montos o eliminar ajustes erróneos.'
                : 'Registro de todos los ajustes de saldo realizados'}
            </CardDescription>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void loadAdjustments()} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-md bg-gray-50">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="adjustmentType" className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Ajuste
            </label>
            <Select
              value={filters.adjustmentType}
              onValueChange={(value) => handleFilterChange('adjustmentType', value)}
            >
              <SelectTrigger id="adjustmentType">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="TRANSFER">Transferencia entre Clientes</SelectItem>
                <SelectItem value="SITE_TRANSFER">Transferencia entre Obras</SelectItem>
                <SelectItem value="MANUAL_ADDITION">Ajuste Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Desde
            </label>
            <Input
              type="date"
              id="startDate"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              Hasta
            </label>
            <Input
              type="date"
              id="endDate"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-amber-600">
            <h3 className="font-semibold mb-1">Información</h3>
            <p className="text-sm">{error}</p>
          </div>
        ) : adjustments.length > 0 ? (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente Origen</TableHead>
                  <TableHead>Cliente Destino</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Notas</TableHead>
                  {canManage && <TableHead className="text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adjustment) => (
                  <TableRow key={adjustment.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(adjustment.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        adjustment.adjustment_type === 'TRANSFER' ? 'bg-blue-100 text-blue-800' :
                        adjustment.adjustment_type === 'SITE_TRANSFER' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {formatAdjustmentType(adjustment.adjustment_type)}
                        {adjustment.transfer_type && (
                          <span className="ml-1">
                            ({adjustment.transfer_type === 'DEBT' ? 'Cargo' : 'Abono'})
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell>{adjustment.source_client_name}</TableCell>
                    <TableCell>{adjustment.target_client_name || '-'}</TableCell>
                    <TableCell>
                      {adjustment.adjustment_type === 'SITE_TRANSFER'
                        ? `${adjustment.source_site || 'General'} → ${adjustment.target_site || 'General'}`
                        : adjustment.source_site || '-'}
                    </TableCell>
                    <TableCell className={`font-medium ${
                      adjustment.transfer_type === 'DEBT' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatCurrency(adjustment.amount)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={adjustment.notes}>
                      {adjustment.notes}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => startEdit(adjustment)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setDeleteTarget(adjustment);
                              setDeleteReason('');
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No se encontraron ajustes con los filtros seleccionados.</p>
          </div>
        )}

        {canManage && editing && (
          <div id="edit-adjustment-section" className="mt-6 rounded-md border p-4 space-y-4 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-sm">Editar ajuste</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatAdjustmentType(editing.adjustment_type)}
                  {editing.adjustment_type === 'TRANSFER' && editing.target_client_name
                    ? ` — ${editing.source_client_name} → ${editing.target_client_name}`
                    : ''}
                  {editing.adjustment_type === 'SITE_TRANSFER'
                    ? ` — ${editing.source_site || 'General'} → ${editing.target_site || 'General'}`
                    : ''}
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setEditing(null)} disabled={saving}>
                Cerrar
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_adj_amount">Monto</Label>
                <Input
                  id="edit_adj_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((s) => ({ ...s, amount: e.target.value }))}
                />
              </div>

              {editing.adjustment_type === 'MANUAL_ADDITION' && (
                <div className="space-y-2">
                  <Label htmlFor="edit_adj_type">Tipo</Label>
                  <Select
                    value={editForm.transfer_type}
                    onValueChange={(v) => setEditForm((s) => ({ ...s, transfer_type: v as 'DEBT' | 'CREDIT' }))}
                  >
                    <SelectTrigger id="edit_adj_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBT">Cargo (aumenta deuda)</SelectItem>
                      <SelectItem value="CREDIT">Abono (reduce deuda)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit_adj_notes">Descripción / justificación</Label>
                <Input
                  id="edit_adj_notes"
                  value={editForm.notes}
                  onChange={(e) => setEditForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_adj_reason">Motivo de la corrección (opcional)</Label>
              <Input
                id="edit_adj_reason"
                value={editForm.reason}
                onChange={(e) => setEditForm((s) => ({ ...s, reason: e.target.value }))}
                placeholder="Ej. monto capturado incorrectamente"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={() => void saveEdit()} disabled={saving}>
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
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar ajuste de saldo</AlertDialogTitle>
              <AlertDialogDescription>
                Se revertirá el efecto de este ajuste en el saldo del cliente
                {deleteTarget ? ` (${formatCurrency(deleteTarget.amount)})` : ''}.
                Esta acción no se puede deshacer, pero quedará registrada en auditoría.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <Label htmlFor="delete_adj_reason">Motivo (opcional)</Label>
              <Input
                id="delete_adj_reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ej. ajuste duplicado, error de captura…"
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
                {deletingId ? 'Eliminando…' : 'Eliminar y corregir saldo'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
