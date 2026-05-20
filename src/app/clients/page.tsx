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
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, cn } from '@/lib/utils';
import { Search, Eye, Pencil, Trash2 } from 'lucide-react';
import CommercialWorkspaceLayout from '@/components/commercial/CommercialWorkspaceLayout';
import CommercialResponsiveTable from '@/components/commercial/CommercialResponsiveTable';
import {
  commercialHubPrimaryButtonClass,
  commercialPanelClass,
  commercialCardClass,
} from '@/components/commercial/commercialHubUi';

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

type FilterChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-10 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-stone-900 text-white'
          : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-50'
      )}
    >
      {label}
    </button>
  );
}

function ClientRowActions({
  client,
  router,
  isDeleting,
  onDelete,
}: {
  client: Client;
  router: ReturnType<typeof useRouter>;
  isDeleting: boolean;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <TooltipProvider>
      <div className="flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
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
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>
        </RoleProtectedButton>

        <RoleProtectedButton
          allowedRoles={['PLANT_MANAGER', 'EXECUTIVE']}
          onClick={() => onDelete(client.id, client.business_name)}
          disabled={isDeleting}
          showDisabled={true}
          asChild
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar</TooltipContent>
          </Tooltip>
        </RoleProtectedButton>
      </div>
    </TooltipProvider>
  );
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
    const { clientId } = deleteDialog;
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

  const stickyToolbar = (
    <div className={cn(commercialPanelClass, 'p-4 space-y-4 shadow-sm')}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          type="search"
          placeholder="Buscar cliente por nombre o código..."
          className="min-h-11 pl-10 bg-white border-stone-200"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-500 mr-1">Aprobación</span>
          {[
            { value: 'all' as const, label: 'Todos' },
            { value: 'pending' as const, label: 'Pendiente' },
            { value: 'approved' as const, label: 'Aprobado' },
          ].map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              active={approvalFilter === opt.value}
              onClick={() => setApprovalFilter(opt.value)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-500 mr-1">Crédito</span>
          {[
            { value: 'all' as const, label: 'Todos' },
            { value: 'approved' as const, label: 'Aprobado' },
            { value: 'pending' as const, label: 'Pendiente' },
            { value: 'rejected' as const, label: 'Sin crédito' },
          ].map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              active={creditFilter === opt.value}
              onClick={() => setCreditFilter(opt.value)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <CommercialWorkspaceLayout
      title="Clientes"
      subtitle="Flujo: Crear cliente → Aprobar cliente → Obras → Cotizar → Orden → Crédito"
      maxWidth="1600"
      headerActions={
        <RoleProtectedButton
          allowedRoles={['SALES_AGENT', 'PLANT_MANAGER', 'EXECUTIVE', 'EXTERNAL_SALES_AGENT', 'CREDIT_VALIDATOR']}
          onClick={() => router.push('/clients/new')}
          className={cn('min-h-11 px-4 py-2 rounded-md text-sm font-medium', commercialHubPrimaryButtonClass)}
          showDisabled={true}
        >
          Crear Nuevo Cliente
        </RoleProtectedButton>
      }
      stickyHeaderExtra={stickyToolbar}
    >
      {toastMessage && (
        <div
          className={cn(
            'px-4 py-3 rounded-lg text-sm border',
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          )}
        >
          {toastMessage.text}
        </div>
      )}

      {loading || isDeleting ? (
        <div className={cn(commercialPanelClass, 'text-center py-12')}>
          <div
            className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-stone-400 rounded-full"
            role="status"
          >
            <span className="sr-only">Cargando...</span>
          </div>
          <p className="mt-2 text-stone-600">
            {isDeleting ? 'Eliminando cliente...' : 'Cargando clientes...'}
          </p>
        </div>
      ) : error ? (
        <div className={cn(commercialPanelClass, 'text-center py-12 text-red-600')}>{error}</div>
      ) : filteredClients.length === 0 ? (
        <div className={cn(commercialPanelClass, 'text-center py-12 text-stone-600')}>
          {clients.length === 0
            ? 'No hay clientes registrados.'
            : 'No se encontraron clientes con ese criterio de búsqueda.'}
        </div>
      ) : (
        <CommercialResponsiveTable
          rows={filteredClients}
          emptyMessage="No hay clientes"
          renderMobileCard={(client) => (
            <div
              key={client.id}
              className={cn(commercialCardClass, 'p-4 min-h-12 flex flex-col gap-3')}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-stone-500">{client.client_code}</p>
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-base font-semibold text-stone-900 hover:text-sky-700"
                  >
                    {client.business_name}
                  </Link>
                </div>
                <ClientRowActions
                  client={client}
                  router={router}
                  isDeleting={isDeleting}
                  onDelete={handleDeleteClick}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={client.approval_status === 'APPROVED' ? 'success' : 'warning'}
                  className="text-xs"
                >
                  {client.approval_status === 'APPROVED' ? 'Aprobado' : 'Pendiente aprob.'}
                </Badge>
                <Badge variant="outline" className="text-xs text-stone-600">
                  {formatCreditStatus(client.credit_status)}
                </Badge>
                {client.sites_count > 0 && (
                  <span className="text-xs text-stone-500 self-center">
                    {client.sites_count} obra{client.sites_count !== 1 ? 's' : ''}
                    {client.sites_pending_count > 0 && ` (+${client.sites_pending_count} pend.)`}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-stone-500">Saldo</span>
                <span className={cn('font-semibold', client.current_balance > 0 ? 'text-red-600' : 'text-stone-700')}>
                  {formatCurrency(client.current_balance)}
                </span>
              </div>
            </div>
          )}
          desktopTable={
            <table className="min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  {['Código', 'Cliente', 'Estado', 'Saldo', 'Crédito', 'Acciones'].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-semibold text-stone-600 uppercase tracking-wider',
                        i >= 3 && i <= 4 && 'text-right',
                        i === 5 && 'text-right'
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {filteredClients.map((client) => (
                  <tr key={client.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-stone-800">
                      {client.client_code}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-sm font-medium text-stone-900 hover:text-sky-700 hover:underline"
                      >
                        {client.business_name}
                      </Link>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap gap-1">
                        <Badge
                          variant={client.approval_status === 'APPROVED' ? 'success' : 'warning'}
                          className="text-xs"
                        >
                          {client.approval_status === 'APPROVED' ? 'Aprobado' : 'Pendiente aprob.'}
                        </Badge>
                        {client.sites_count > 0 && (
                          <span className="text-xs text-stone-500 self-center">
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
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <span className={client.current_balance > 0 ? 'text-red-600' : 'text-stone-600'}>
                        {formatCurrency(client.current_balance)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-stone-600">
                      {formatCreditStatus(client.credit_status)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <ClientRowActions
                        client={client}
                        router={router}
                        isDeleting={isDeleting}
                        onDelete={handleDeleteClick}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        />
      )}

      <RoleProtectedSection allowedRoles={['EXECUTIVE']} action="ver estadísticas avanzadas de clientes" className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-600 mb-4">
          Estadísticas de Clientes (Solo Ejecutivos)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total de Clientes', value: filteredClients.length },
            {
              label: 'Clientes con Crédito Aprobado',
              value: filteredClients.filter((c) => c.credit_status?.toLowerCase() === 'approved').length,
            },
            {
              label: 'Clientes con Saldo Pendiente',
              value: filteredClients.filter((c) => c.current_balance > 0).length,
            },
          ].map((stat) => (
            <div key={stat.label} className={cn(commercialPanelClass)}>
              <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500">{stat.label}</h3>
              <p className="text-2xl font-bold text-stone-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      </RoleProtectedSection>

      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && setDeleteDialog({ open: false, clientId: '', businessName: '' })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de eliminar el cliente &quot;{deleteDialog.businessName}&quot;? Esta acción no se puede
              deshacer.
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
    </CommercialWorkspaceLayout>
  );
}
