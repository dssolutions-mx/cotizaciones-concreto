'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, ExternalLink, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { useApprovalTasks } from '@/hooks/useApprovalTasks';
import { QuotesService } from '@/services/quotes';
import { productPriceService } from '@/lib/supabase/product-prices';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { ClientApprovalRow } from './ClientApprovalRow';
import { SiteApprovalRow } from './SiteApprovalRow';
import { QuoteApprovalRow } from './QuoteApprovalRow';
import type { PendingClient, PendingSite, PendingQuote } from '@/hooks/useApprovalTasks';

const APPROVAL_ROLES = ['EXECUTIVE', 'PLANT_MANAGER'];
const MAX_ROWS = 5;

export function ApprovalTasksSection() {
  const { profile } = useAuthBridge();
  const {
    clients,
    sites,
    pendingQuotes,
    isLoading,
    refetch,
  } = useApprovalTasks();

  const [acting, setActing] = useState<string | null>(null);
  const [rejectClient, setRejectClient] = useState<PendingClient | null>(null);
  const [rejectSite, setRejectSite] = useState<PendingSite | null>(null);
  const [approveAllClientsOpen, setApproveAllClientsOpen] = useState(false);
  const [approveAllSitesOpen, setApproveAllSitesOpen] = useState(false);

  const canAccess = profile?.role && APPROVAL_ROLES.includes(profile.role);
  if (!canAccess) return null;

  const totalPending = clients.length + sites.length + pendingQuotes.length;

  const approveClient = async (id: string) => {
    try {
      setActing(id);
      const res = await fetch(`/api/governance/clients/${id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Cliente aprobado');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aprobar');
    } finally {
      setActing(null);
    }
  };

  const rejectClientFn = async (id: string) => {
    try {
      setActing(id);
      const res = await fetch(`/api/governance/clients/${id}/reject`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Cliente rechazado');
      setRejectClient(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al rechazar');
    } finally {
      setActing(null);
    }
  };

  const approveSite = async (id: string) => {
    try {
      setActing(id);
      const res = await fetch(`/api/governance/sites/${id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Obra aprobada');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aprobar obra');
    } finally {
      setActing(null);
    }
  };

  const rejectSiteFn = async (id: string) => {
    try {
      setActing(id);
      const res = await fetch(`/api/governance/sites/${id}/reject`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Obra rechazada');
      setRejectSite(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al rechazar obra');
    } finally {
      setActing(null);
    }
  };

  const approveQuote = async (quoteId: string) => {
    try {
      setActing(String(quoteId));
      await QuotesService.updateStatus(String(quoteId), 'APPROVED');
      try {
        await productPriceService.handleQuoteApproval(String(quoteId));
      } catch (priceError: unknown) {
        await QuotesService.updateStatus(String(quoteId), 'PENDING_APPROVAL');
        throw new Error(
          priceError instanceof Error ? priceError.message : 'Error al crear precios'
        );
      }
      toast.success('Cotización aprobada');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo aprobar la cotización');
    } finally {
      setActing(null);
    }
  };

  const rejectQuote = async (quoteId: string, reason: string) => {
    try {
      setActing(String(quoteId));
      await QuotesService.updateStatus(String(quoteId), 'REJECTED', {
        rejection_reason: reason.trim() || 'Rechazado desde el dashboard',
      });
      toast.success('Cotización rechazada');
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo rechazar la cotización');
    } finally {
      setActing(null);
    }
  };

  const approveAllClients = async () => {
    setApproveAllClientsOpen(false);
    for (const c of clients) {
      await approveClient(c.id);
    }
  };

  const approveAllSites = async () => {
    setApproveAllSitesOpen(false);
    for (const s of sites) {
      await approveSite(s.id);
    }
  };

  if (isLoading && totalPending === 0) {
    return (
      <div className="glass-base rounded-2xl p-6 mb-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (totalPending === 0) {
    return null;
  }

  return (
    <>
      <motion.div
        className="glass-base rounded-2xl p-6 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-title-3 text-gray-800 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Pendientes de Aprobación
          </h2>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Clientes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-callout font-semibold text-gray-800">
                  Clientes {clients.length > 0 && (
                    <span className="ml-1.5 text-muted-foreground font-normal">
                      ({clients.length})
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-1.5">
                  {clients.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      onClick={() => setApproveAllClientsOpen(true)}
                      disabled={!!acting}
                    >
                      Aprobar todos
                    </Button>
                  )}
                  <Link
                    href="/finanzas/gobierno-precios"
                    className="text-footnote text-primary hover:underline flex items-center"
                  >
                    Ver todos <ExternalLink className="h-3 w-3 ml-0.5" />
                  </Link>
                </div>
              </div>
              <div className="space-y-1">
                {clients.slice(0, MAX_ROWS).map((c) => (
                  <ClientApprovalRow
                    key={c.id}
                    client={c}
                    onApprove={() => approveClient(c.id)}
                    onReject={() => setRejectClient(c)}
                    isActing={acting === c.id}
                  />
                ))}
              </div>
            </div>

            {/* Obras */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-callout font-semibold text-gray-800">
                  Obras {sites.length > 0 && (
                    <span className="ml-1.5 text-muted-foreground font-normal">
                      ({sites.length})
                    </span>
                  )}
                </h3>
                <div className="flex items-center gap-1.5">
                  {sites.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      onClick={() => setApproveAllSitesOpen(true)}
                      disabled={!!acting}
                    >
                      Aprobar todas
                    </Button>
                  )}
                  <Link
                    href="/finanzas/gobierno-precios"
                    className="text-footnote text-primary hover:underline flex items-center"
                  >
                    Ver todos <ExternalLink className="h-3 w-3 ml-0.5" />
                  </Link>
                </div>
              </div>
              <div className="space-y-1">
                {sites.slice(0, MAX_ROWS).map((s) => (
                  <SiteApprovalRow
                    key={s.id}
                    site={s}
                    onApprove={() => approveSite(s.id)}
                    onReject={() => setRejectSite(s)}
                    isActing={acting === s.id}
                  />
                ))}
              </div>
            </div>

            {/* Cotizaciones */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-callout font-semibold text-gray-800">
                  Cotizaciones {pendingQuotes.length > 0 && (
                    <span className="ml-1.5 text-muted-foreground font-normal">
                      ({pendingQuotes.length})
                    </span>
                  )}
                </h3>
                <Link
                  href="/quotes"
                  className="text-footnote text-primary hover:underline flex items-center"
                >
                  Ver todas <ExternalLink className="h-3 w-3 ml-0.5" />
                </Link>
              </div>
              <div className="space-y-1">
                {pendingQuotes.slice(0, MAX_ROWS).map((q: PendingQuote) => (
                  <QuoteApprovalRow
                    key={q.id}
                    quote={q}
                    onApprove={() => approveQuote(String(q.id))}
                    onReject={(reason) => rejectQuote(String(q.id), reason)}
                    isActing={acting === String(q.id)}
                  />
                ))}
              </div>
            </div>
          </div>
      </motion.div>

      {/* Reject client confirmation */}
      <AlertDialog open={!!rejectClient} onOpenChange={(open) => !open && setRejectClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectClient && (
                <>
                  Se rechazará a <strong>{rejectClient.business_name}</strong>. Este cliente no
                  podrá ser utilizado en cotizaciones ni órdenes. ¿Continuar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectClient && rejectClientFn(rejectClient.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject site confirmation */}
      <AlertDialog open={!!rejectSite} onOpenChange={(open) => !open && setRejectSite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar obra?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectSite && (
                <>
                  Se rechazará la obra <strong>{rejectSite.name}</strong>. No podrá usarse en
                  cotizaciones ni órdenes. ¿Continuar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectSite && rejectSiteFn(rejectSite.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve all clients */}
      <AlertDialog open={approveAllClientsOpen} onOpenChange={setApproveAllClientsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar todos los clientes?</AlertDialogTitle>
            <AlertDialogDescription>
              Se aprobarán los {clients.length} cliente{clients.length !== 1 ? 's' : ''}{' '}
              pendientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={approveAllClients}
              className="bg-green-600 hover:bg-green-700"
            >
              Aprobar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve all sites */}
      <AlertDialog open={approveAllSitesOpen} onOpenChange={setApproveAllSitesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar todas las obras?</AlertDialogTitle>
            <AlertDialogDescription>
              Se aprobarán las {sites.length} obra{sites.length !== 1 ? 's' : ''} pendientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={approveAllSites}
              className="bg-green-600 hover:bg-green-700"
            >
              Aprobar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
