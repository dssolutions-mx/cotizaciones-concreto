'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import RoleProtectedButton from '@/components/auth/RoleProtectedButton';
import RoleProtectedSection from '@/components/auth/RoleProtectedSection';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { Search, Eye, Pencil, Trash2 } from 'lucide-react';

interface Client {
  id: string;
  business_name: string;
  client_code: string | null;
  current_balance: number;
  credit_status: string;
  approval_status: string;
  sites_count: number;
  sites_pending_count: number;
}

const creditStatusLabels: Record<string, string> = {
  approved: 'Aprobado',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  rejected_by_validator: 'Rechazado',
};

function formatCreditStatus(status: string) {
  return creditStatusLabels[status?.toLowerCase()] ?? status ?? '—';
}

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [creditFilter, setCreditFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; clientId: string; businessName: string }>({
    open: false,
    clientId: '',
    businessName: '',
  });
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadClients = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clients/list-enriched');
      if (!res.ok) throw new Error('Error al cargar');
      const json = await res.json();
      setClients(json.clients || []);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar los clientes';
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const handleDeleteClick = (clientId: string, businessName: string) => {
    setDeleteDialog({ open: true, clientId, businessName });
  };

  const handleDeleteConfirm = async () => {
    const { clientId, businessName } = deleteDialog;
    try {
      setIsDeleting(true);
      const { default: clientService } = await import('@/lib/supabase/clients');
      await clientService.deleteClient(clientId);
      setDeleteDialog({ open: false, clientId: '', businessName: '' });
      await loadClients();
      setToastMessage({ type: 'success', text: 'Cliente eliminado correctamente' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar el cliente';
      setToastMessage({ type: 'error', text: errorMessage });
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredClients = clients.filter((client) => {
    const name = (client.business_name || '').toLowerCase();
    const code = (client.client_code || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();
    const matchesSearch = name.includes(term) || code.includes(term);
    if (!matchesSearch) return false;
    const status = (client.credit_status || '').toLowerCase();
    if (creditFilter !== 'all') {
      if (creditFilter === 'approved' && status !== 'approved') return false;
      if (creditFilter === 'pending' && status !== 'pending') return false;
      if (creditFilter === 'rejected' && ['approved', 'pending'].includes(status)) return false;
    }
    const approval = (client.approval_status || '').toUpperCase();
    if (approvalFilter === 'pending' && approval !== 'PENDING_APPROVAL') return false;
    if (approvalFilter === 'approved' && approval !== 'APPROVED') return false;
    return true;
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-large-title text-gray-900">Clientes</h1>
          <p className="text-footnote text-muted-foreground mt-1">
            Flujo: Crear cliente → Aprobar cliente → Obras → Cotizar → Orden → Crédito
          </p>
        </div>
        <RoleProtectedButton
          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'EXTERNAL_SALES_AGENT', 'CREDIT_VALIDATOR']}
          onClick={() => router.push('/clients/new')}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          showDisabled={true}
        >
          Crear Nuevo Cliente
        </RoleProtectedButton>
      </div>

      {toastMessage && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg ${
            toastMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar cliente por nombre o código..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex flex-wrap gap-2">
          <span className="text-footnote text-muted-foreground mr-2 self-center">Aprobación:</span>
          {[
            { value: 'all' as const, label: 'Todos' },
            { value: 'pending' as const, label: 'Pendiente' },
            { value: 'approved' as const, label: 'Aprobado' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setApprovalFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                approvalFilter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="text-footnote text-muted-foreground mr-2 self-center">Crédito:</span>
          {[
            { value: 'all' as const, label: 'Todos' },
            { value: 'approved' as const, label: 'Aprobado' },
            { value: 'pending' as const, label: 'Pendiente' },
            { value: 'rejected' as const, label: 'Sin crédito' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCreditFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                creditFilter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading || isDeleting ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <div
            className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-gray-400 rounded-full"
            role="status"
          >
            <span className="sr-only">Cargando...</span>
          </div>
          <p className="mt-2 text-gray-600">
            {isDeleting ? 'Eliminando cliente...' : 'Cargando clientes...'}
          </p>
        </div>
      ) : error ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white shadow-md rounded-lg p-6 text-center">
          <p className="text-gray-600">
            {clients.length === 0
              ? 'No hay clientes registrados.'
              : 'No se encontraron clientes con ese criterio de búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="glass-base rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border/50">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Saldo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Crédito
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-muted/30 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
                      {client.client_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/clients/${client.id}`} className="text-callout text-gray-900 hover:text-primary hover:underline">
                        {client.business_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={client.approval_status === 'APPROVED' ? 'success' : 'warning'}
                          className="text-xs"
                        >
                          {client.approval_status === 'APPROVED' ? 'Aprobado' : 'Pendiente aprob.'}
                        </Badge>
                        {client.sites_count > 0 && (
                          <span className="text-footnote text-muted-foreground">
                            {client.sites_count} obra{client.sites_count !== 1 ? 's' : ''}
                            {client.sites_pending_count > 0 && (
                              <Badge variant="secondary" className="ml-1 text-xs">
                                +{client.sites_pending_count} pend.
                              </Badge>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <span className={client.current_balance > 0 ? 'text-red-600' : 'text-gray-600'}>
                        {formatCurrency(client.current_balance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatCreditStatus(client.credit_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => router.push(`/clients/${client.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver</TooltipContent>
                          </Tooltip>

                          <RoleProtectedButton
                            allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'CREDIT_VALIDATOR']}
                            onClick={() => router.push(`/clients/${client.id}/edit`)}
                            showDisabled={true}
                            asChild
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                          </RoleProtectedButton>

                          <RoleProtectedButton
                            allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
                            onClick={() => handleDeleteClick(client.id, client.business_name)}
                            disabled={isDeleting}
                            showDisabled={true}
                            asChild
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar</TooltipContent>
                            </Tooltip>
                          </RoleProtectedButton>
                        </TooltipProvider>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RoleProtectedSection allowedRoles={['EXECUTIVE']} action="ver estadísticas avanzadas de clientes" className="mt-8">
        <div>
          <h2 className="text-title-3 text-gray-800 mb-4">Estadísticas de Clientes (Solo Ejecutivos)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-base rounded-2xl p-6">
              <h3 className="text-footnote text-muted-foreground">Total de Clientes</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{filteredClients.length}</p>
            </div>
            <div className="glass-base rounded-2xl p-6">
              <h3 className="text-footnote text-muted-foreground">Clientes con Crédito Aprobado</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {filteredClients.filter((c) => c.credit_status?.toLowerCase() === 'approved').length}
              </p>
            </div>
            <div className="glass-base rounded-2xl p-6">
              <h3 className="text-footnote text-muted-foreground">Clientes con Saldo Pendiente</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {filteredClients.filter((c) => c.current_balance > 0).length}
              </p>
            </div>
          </div>
        </div>
      </RoleProtectedSection>

      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, clientId: '', businessName: '' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el cliente "{deleteDialog.businessName}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
