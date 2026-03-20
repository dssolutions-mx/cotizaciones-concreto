'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeftRight, CheckCircle2, Clock, RefreshCw, Factory, FileText, Info } from 'lucide-react';
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb';
import { usePlantContext } from '@/contexts/PlantContext';

interface BillingRecord {
  id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado: number;
  producing_plant_name: string | null;
  linked_production_remision_id: string | null;
  is_resolved: boolean;
  days_pending: number;
  client_name: string | null;
}

interface ProductionRecord {
  id: string;
  remision_number: string;
  fecha: string;
  volumen_fabricado: number;
  billing_plant_name: string | null;
  linked_billing_remision_number: string | null;
  is_resolved: boolean;
  days_pending: number;
}

interface CrossPlantData {
  billing: BillingRecord[];
  production: ProductionRecord[];
  summary: {
    pending_billing: number;
    pending_production: number;
    total_pending: number;
  };
}

const urgencyBorderColor = (days: number) => {
  if (days >= 3) return 'border-red-200 bg-red-50';
  if (days >= 2) return 'border-orange-200 bg-orange-50';
  if (days >= 1) return 'border-amber-200 bg-amber-50';
  return 'border-yellow-200 bg-yellow-50';
};

const DaysBadge = ({ days }: { days: number }) => {
  if (days === 0) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
      Hoy
    </span>
  );
  if (days >= 3) return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
      ⚠ Urgente · {days}d
    </span>
  );
  if (days >= 2) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
      {days} días
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
      {days} día
    </span>
  );
};

export default function CrossPlantPage() {
  const { currentPlant } = usePlantContext();
  const [data, setData] = useState<CrossPlantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'billing' | 'production'>('billing');

  useEffect(() => { setMounted(true); }, []);

  const fetchData = useCallback(async (plantId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const id = plantId || currentPlant?.id;
      const params = id ? `?plant_id=${id}` : '';
      const res = await fetch(`/api/production-control/cross-plant-status${params}`);
      if (!res.ok) throw new Error('Error al cargar datos');
      const json: CrossPlantData = await res.json();
      setData(json);
      // Auto-select the tab that has records — production takes precedence if billing is empty
      if (json.billing.length === 0 && json.production.length > 0) {
        setActiveTab('production');
      } else if (json.production.length === 0 && json.billing.length > 0) {
        setActiveTab('billing');
      } else if (json.production.length > 0) {
        // Both have data — show whichever has pending items first
        setActiveTab(json.summary.pending_production > 0 ? 'production' : 'billing');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted && currentPlant?.id) fetchData(currentPlant.id);
  }, [mounted, currentPlant?.id]);

  if (!mounted) return null;

  const pendingBilling = data?.billing.filter(r => !r.is_resolved) ?? [];
  const resolvedBilling = data?.billing.filter(r => r.is_resolved) ?? [];
  const pendingProduction = data?.production.filter(r => !r.is_resolved) ?? [];
  const resolvedProduction = data?.production.filter(r => r.is_resolved) ?? [];

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <InventoryBreadcrumb />

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-6 w-6 text-indigo-600" />
            Producción Cruzada
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Remisiones donde la planta de facturación y la planta de producción son distintas
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(currentPlant?.id)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Summary row */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card
            className={`border-amber-200 cursor-pointer transition-shadow hover:shadow-md ${activeTab === 'billing' ? 'ring-2 ring-amber-400' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-600">{data.summary?.pending_billing ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Facturadas aquí, sin vínculo</div>
            </CardContent>
          </Card>
          <Card
            className={`border-amber-200 cursor-pointer transition-shadow hover:shadow-md ${activeTab === 'production' ? 'ring-2 ring-amber-400' : ''}`}
            onClick={() => setActiveTab('production')}
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-600">{data.summary?.pending_production ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Producidas aquí, sin vínculo</div>
            </CardContent>
          </Card>
          <Card
            className={`border-green-200 cursor-pointer transition-shadow hover:shadow-md ${activeTab === 'billing' ? 'ring-2 ring-green-400' : ''}`}
            onClick={() => setActiveTab('billing')}
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{resolvedBilling.length}</div>
              <div className="text-xs text-gray-500 mt-1">Facturación vinculada</div>
            </CardContent>
          </Card>
          <Card
            className={`border-green-200 cursor-pointer transition-shadow hover:shadow-md ${activeTab === 'production' ? 'ring-2 ring-green-400' : ''}`}
            onClick={() => setActiveTab('production')}
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{resolvedProduction.length}</div>
              <div className="text-xs text-gray-500 mt-1">Producción vinculada</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'billing' | 'production')}>
        <TabsList className="mb-4">
          <TabsTrigger value="billing" className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            Facturadas aquí
            {data && (data.summary?.pending_billing ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5">
                {data.summary?.pending_billing ?? 0}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-1.5">
            <Factory className="h-4 w-4" />
            Producidas aquí
            {data && (data.summary?.pending_production ?? 0) > 0 && (
              <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-700 text-xs px-1.5">
                {data.summary?.pending_production ?? 0}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab A: Billed here, produced elsewhere ── */}
        <TabsContent value="billing">
          <div className="space-y-5">
            {/* Instructional banner */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
              <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <span className="font-medium">Remisiones facturadas en esta planta cuyo concreto fue producido en otra.</span>
                {' '}Estas remisiones quedan bloqueadas para confirmación hasta que la planta productora suba su archivo Arkik y registre su producción. El vínculo se establece automáticamente — no hay acción requerida de tu parte.
              </div>
            </div>

            {/* Pending section */}
            {pendingBilling.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Esperando producción ({pendingBilling.length})
                </h3>
                <div className="space-y-2">
                  {pendingBilling.map(r => (
                    <div
                      key={r.id}
                      className={`rounded-lg border p-4 ${urgencyBorderColor(r.days_pending)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">Remisión #{r.remision_number}</span>
                            <DaysBadge days={r.days_pending} />
                          </div>
                          {r.client_name && (
                            <div className="text-sm text-gray-600 mt-0.5 truncate">{r.client_name}</div>
                          )}
                          <div className="text-sm text-gray-700 mt-1">
                            Producida en: <span className="font-medium">{r.producing_plant_name ?? '—'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-gray-800">{r.volumen_fabricado.toFixed(1)} m³</div>
                          <div className="text-xs text-gray-500 mt-0.5">{r.fecha}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500 border-t border-gray-200 pt-2.5">
                        Cuando <span className="font-medium text-gray-700">{r.producing_plant_name ?? 'la planta productora'}</span> suba su archivo Arkik y registre esta producción, el vínculo se establecerá automáticamente y esta remisión quedará disponible para confirmar.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolved section */}
            {resolvedBilling.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Vinculadas ({resolvedBilling.length})
                </h3>
                <div className="space-y-2">
                  {resolvedBilling.map(r => (
                    <div key={r.id} className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-green-800">Remisión #{r.remision_number}</span>
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle2 className="h-3 w-3" /> Vinculada
                          </span>
                        </div>
                        {r.client_name && <div className="text-sm text-green-700 mt-0.5 truncate">{r.client_name}</div>}
                        <div className="text-sm text-green-700 mt-0.5">
                          Producida en: <span className="font-medium">{r.producing_plant_name ?? '—'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm text-green-700 font-semibold">{r.volumen_fabricado.toFixed(1)} m³</div>
                        <div className="text-xs text-green-600 mt-0.5">{r.fecha}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && data && data.billing.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-gray-400">
                  <ArrowLeftRight className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">No hay remisiones de facturación cruzada en esta planta</div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Tab B: Produced here, billed elsewhere ── */}
        <TabsContent value="production">
          <div className="space-y-5">
            {/* Instructional banner */}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 flex items-start gap-3">
              <Factory className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-800">
                <span className="font-medium">Remisiones producidas en esta planta que se facturaron en otra.</span>
                {' '}Aquí puedes ver el estado del vínculo. Las remisiones pendientes se resolverán automáticamente cuando la planta de facturación suba su archivo. Si llevan varios días sin resolver, considera comunicarte directamente con esa planta.
              </div>
            </div>

            {/* Pending section */}
            {pendingProduction.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Esperando vínculo de facturación ({pendingProduction.length})
                </h3>
                <div className="space-y-2">
                  {pendingProduction.map(r => (
                    <div
                      key={r.id}
                      className={`rounded-lg border p-4 ${urgencyBorderColor(r.days_pending)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900">Remisión #{r.remision_number}</span>
                            <DaysBadge days={r.days_pending} />
                          </div>
                          <div className="text-sm text-gray-700 mt-1">
                            Facturada en: <span className="font-medium">{r.billing_plant_name ?? '—'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-gray-800">{r.volumen_fabricado.toFixed(1)} m³</div>
                          <div className="text-xs text-gray-500 mt-0.5">{r.fecha}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-gray-500 border-t border-gray-200 pt-2.5">
                        Cuando <span className="font-medium text-gray-700">{r.billing_plant_name ?? 'la planta de facturación'}</span> suba su archivo Arkik{r.days_pending >= 3 ? ' — considera contactarlos directamente' : ', el vínculo se establecerá automáticamente'}.
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolved section */}
            {resolvedProduction.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Vinculadas ({resolvedProduction.length})
                </h3>
                <div className="space-y-2">
                  {resolvedProduction.map(r => (
                    <div key={r.id} className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-green-800">Remisión #{r.remision_number}</span>
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle2 className="h-3 w-3" /> Vinculada
                          </span>
                        </div>
                        <div className="text-sm text-green-700 mt-0.5">
                          Facturada en: <span className="font-medium">{r.billing_plant_name ?? '—'}</span>
                          {r.linked_billing_remision_number && (
                            <span className="ml-2 text-green-600">— Remisión facturación #{r.linked_billing_remision_number}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm text-green-700 font-semibold">{r.volumen_fabricado.toFixed(1)} m³</div>
                        <div className="text-xs text-green-600 mt-0.5">{r.fecha}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && data && data.production.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-gray-400">
                  <Factory className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">No hay registros de producción cruzada en esta planta</div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
