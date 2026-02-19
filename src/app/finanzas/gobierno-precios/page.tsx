'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { toast } from 'sonner';
import { CheckCircle, RefreshCw, ShieldCheck, ArrowLeft } from 'lucide-react';
import { usePlantContext } from '@/contexts/PlantContext';
import { calculateRoadDistance } from '@/lib/services/distanceService';
import { ClientApprovalCard } from '@/components/finanzas/ClientApprovalCard';
import { SiteApprovalCard } from '@/components/finanzas/SiteApprovalCard';
import { PriceGovernanceTable } from '@/components/finanzas/PriceGovernanceTable';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PendingClient = { id: string; business_name: string; client_code: string | null; rfc: string | null; created_at: string };
type PendingSite = {
  id: string;
  name: string;
  location: string | null;
  client_id: string;
  created_at: string;
  clients?: { business_name: string } | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_km?: number | null;
  distance_plant_name?: string | null;
};

export default function GobiernoPreciosPage() {
  const router = useRouter();
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();
  const [clients, setClients] = useState<PendingClient[]>([]);
  const [constructionSites, setConstructionSites] = useState<PendingSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingClient | null>(null);
  const [rejectSiteTarget, setRejectSiteTarget] = useState<PendingSite | null>(null);
  const [approveAllOpen, setApproveAllOpen] = useState(false);
  const [approveAllSitesOpen, setApproveAllSitesOpen] = useState(false);
  const [siteDistances, setSiteDistances] = useState<Record<string, { distance_km: number; plant_name: string }>>({});

  const canAccess = ['EXECUTIVE', 'PLANT_MANAGER'].includes(profile?.role || '');

  const loadPending = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/governance/pending');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      setClients(json.clients || []);
      setConstructionSites(json.construction_sites || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cargar pendientes');
      setClients([]);
      setConstructionSites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canAccess) {
      router.push('/finanzas');
      return;
    }
    loadPending();
  }, [canAccess, router, loadPending]);

  // Calcular distancias en el cliente (como QuoteBuilder) para que funcione con la sesión del usuario
  useEffect(() => {
    if (!currentPlant?.id || !currentPlant?.name) {
      setSiteDistances({});
      return;
    }
    const sites = constructionSites.filter(
      (s) => s.latitude != null && s.longitude != null
    );
    if (sites.length === 0) {
      setSiteDistances({});
      return;
    }
    let cancelled = false;
    const next: Record<string, { distance_km: number; plant_name: string }> = {};
    Promise.all(
      sites.map(async (site) => {
        if (cancelled) return;
        try {
          const km = await calculateRoadDistance(currentPlant.id, site.id);
          if (cancelled) return;
          next[site.id] = {
            distance_km: Math.round(km * 100) / 100,
            plant_name: currentPlant.name ?? '',
          };
        } catch {
          // Ignorar errores por sitio
        }
      })
    ).then(() => {
      if (!cancelled) setSiteDistances(next);
    });
    return () => {
      cancelled = true;
    };
  }, [constructionSites, currentPlant?.id, currentPlant?.name]);

  async function approve(id: string) {
    try {
      setActing(id);
      const res = await fetch(`/api/governance/clients/${id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Cliente aprobado');
      await loadPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aprobar');
    } finally {
      setActing(null);
    }
  }

  async function reject(id: string) {
    try {
      setActing(id);
      const res = await fetch(`/api/governance/clients/${id}/reject`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Cliente rechazado');
      setRejectTarget(null);
      await loadPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al rechazar');
    } finally {
      setActing(null);
    }
  }

  async function approveAll() {
    setApproveAllOpen(false);
    for (const c of clients) {
      await approve(c.id);
    }
  }

  async function approveSite(id: string) {
    try {
      setActing(id);
      const res = await fetch(`/api/governance/sites/${id}/approve`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Obra aprobada');
      await loadPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al aprobar obra');
    } finally {
      setActing(null);
    }
  }

  async function rejectSite(id: string) {
    try {
      setActing(id);
      const res = await fetch(`/api/governance/sites/${id}/reject`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error');
      toast.success('Obra rechazada');
      setRejectSiteTarget(null);
      await loadPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al rechazar obra');
    } finally {
      setActing(null);
    }
  }

  async function approveAllSites() {
    setApproveAllSitesOpen(false);
    for (const s of constructionSites) {
      await approveSite(s.id);
    }
  }

  if (!canAccess) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/finanzas"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al Centro Financiero
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-slate-600" />
            Autorización de Clientes
          </h1>
          <p className="text-slate-600 mt-1">
            Aprueba o rechaza clientes y obras nuevas. Solo los aprobados estarán disponibles para cotizaciones y órdenes.
          </p>
        </div>
      </div>

      <Tabs defaultValue="clients" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="clients">
            Clientes {clients.length > 0 && `(${clients.length})`}
          </TabsTrigger>
          <TabsTrigger value="sites">
            Obras {constructionSites.length > 0 && `(${constructionSites.length})`}
          </TabsTrigger>
          <TabsTrigger value="prices">
            Precios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Clientes pendientes de aprobación</CardTitle>
              <CardDescription>
                {loading
                  ? 'Cargando...'
                  : clients.length === 0
                    ? 'No hay clientes pendientes'
                    : `${clients.length} ${clients.length === 1 ? 'cliente' : 'clientes'} esperando autorización`}
              </CardDescription>
            </div>
            {!loading && clients.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadPending}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setApproveAllOpen(true)}
                  disabled={!!acting}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprobar todos
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[180px] rounded-lg" />
              ))}
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Todo al día</h3>
              <p className="text-sm text-slate-600 mt-1 text-center max-w-sm">
                No hay clientes pendientes de aprobación en este momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((c) => (
                <ClientApprovalCard
                  key={c.id}
                  client={c}
                  onApprove={() => approve(c.id)}
                  onReject={() => setRejectTarget(c)}
                  isActing={acting === c.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="sites" className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Obras pendientes de aprobación</CardTitle>
              <CardDescription>
                {loading
                  ? 'Cargando...'
                  : constructionSites.length === 0
                    ? 'No hay obras pendientes'
                    : `${constructionSites.length} ${constructionSites.length === 1 ? 'obra' : 'obras'} esperando autorización`}
              </CardDescription>
            </div>
            {!loading && constructionSites.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadPending}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => setApproveAllSitesOpen(true)}
                  disabled={!!acting}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aprobar todas
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[160px] rounded-lg" />
              ))}
            </div>
          ) : constructionSites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/50">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mb-4">
                <CheckCircle className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Todo al día</h3>
              <p className="text-sm text-slate-600 mt-1 text-center max-w-sm">
                No hay obras pendientes de aprobación en este momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {constructionSites.map((s) => (
                <SiteApprovalCard
                  key={s.id}
                  site={{
                    ...s,
                    distance_km: siteDistances[s.id]?.distance_km ?? null,
                    distance_plant_name: siteDistances[s.id]?.plant_name ?? null,
                  }}
                  onApprove={() => approveSite(s.id)}
                  onReject={() => setRejectSiteTarget(s)}
                  isActing={acting === s.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="prices" className="space-y-6">
          <PriceGovernanceTable />
        </TabsContent>
      </Tabs>

      <p className="text-sm text-slate-500">
        Los clientes y obras aprobados estarán disponibles para cotizaciones y órdenes. Los rechazados no podrán usarse.
      </p>

      {/* Reject site confirmation */}
      <AlertDialog open={!!rejectSiteTarget} onOpenChange={(open) => !open && setRejectSiteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar obra?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectSiteTarget && (
                <>
                  Se rechazará la obra <strong>{rejectSiteTarget.name}</strong>. No podrá usarse en cotizaciones ni órdenes.
                  ¿Continuar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectSiteTarget && rejectSite(rejectSiteTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve all sites confirmation */}
      <AlertDialog open={approveAllSitesOpen} onOpenChange={setApproveAllSitesOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar todas las obras?</AlertDialogTitle>
            <AlertDialogDescription>
              Se aprobarán las {constructionSites.length} obra{constructionSites.length !== 1 ? 's' : ''} pendientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={approveAllSites} className="bg-green-600 hover:bg-green-700">
              Aprobar todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject client confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectTarget && (
                <>
                  Se rechazará a <strong>{rejectTarget.business_name}</strong>. Este cliente no podrá ser utilizado en cotizaciones ni órdenes.
                  ¿Continuar?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectTarget && reject(rejectTarget.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Approve all confirmation */}
      <AlertDialog open={approveAllOpen} onOpenChange={setApproveAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aprobar todos los clientes?</AlertDialogTitle>
            <AlertDialogDescription>
              Se aprobarán los {clients.length} cliente{clients.length !== 1 ? 's' : ''} pendientes. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={approveAll} className="bg-green-600 hover:bg-green-700">
              Aprobar todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
