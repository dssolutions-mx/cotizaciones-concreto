'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowLeftRight, CheckCircle2, Clock, RefreshCw, Factory,
  FileText, Building2, Truck, Search, CalendarDays, Trash2,
} from 'lucide-react';
import InventoryBreadcrumb from '@/components/inventory/InventoryBreadcrumb';
import { usePlantContext } from '@/contexts/PlantContext';

interface RegularRemision {
  id: string;
  remision_number: string;
  fecha: string;
  hora_carga: string | null;
  volumen_fabricado: number;
  conductor: string | null;
  unidad: string | null;
  order_id: string | null;
  construction_site: string | null;
  client_name: string | null;
  is_cross_plant_billing: boolean;
  producing_plant_name: string | null;
  is_resolved: boolean;
}

interface CrossPlantRemision {
  id: string;
  remision_number: string;
  fecha: string;
  hora_carga: string | null;
  volumen_fabricado: number;
  conductor: string | null;
  unidad: string | null;
  billing_plant_name: string | null;
  is_resolved: boolean;
}

interface ArkikWasteLine {
  id: string;
  remision_number: string;
  fecha: string;
  material_code: string;
  material_id: string | null;
  waste_amount: number;
  waste_reason: string;
  notes: string | null;
  session_id: string;
}

interface LogData {
  regular: RegularRemision[];
  crossPlant: CrossPlantRemision[];
  arkik_waste: ArkikWasteLine[];
  summary: {
    total_regular: number;
    total_cross_plant: number;
    total_volume_regular: number;
    total_volume_cross_plant: number;
    total_arkik_waste_lines?: number;
  };
}

const todayISO = () => new Date().toISOString().split('T')[0];

export default function RemisionesLogPage() {
  const { currentPlant } = usePlantContext();
  const [data, setData] = useState<LogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [dateFrom, setDateFrom] = useState(todayISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<'all' | 'regular' | 'cross-plant' | 'arkik-waste'>('all');

  useEffect(() => { setMounted(true); }, []);

  const fetchData = useCallback(async (plantId?: string, from?: string, to?: string) => {
    const id = plantId || currentPlant?.id;
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        plant_id: id,
        date_from: from || dateFrom,
        date_to: to || dateTo,
      });
      const res = await fetch(`/api/production-control/remisiones-log?${params}`);
      if (!res.ok) throw new Error('Error al cargar remisiones');
      const json = await res.json();
      setData({
        regular: json.regular ?? [],
        crossPlant: json.crossPlant ?? [],
        arkik_waste: json.arkik_waste ?? [],
        summary: {
          total_regular: json.summary?.total_regular ?? 0,
          total_cross_plant: json.summary?.total_cross_plant ?? 0,
          total_volume_regular: json.summary?.total_volume_regular ?? 0,
          total_volume_cross_plant: json.summary?.total_volume_cross_plant ?? 0,
          total_arkik_waste_lines: json.summary?.total_arkik_waste_lines ?? (json.arkik_waste?.length ?? 0),
        },
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [currentPlant?.id, dateFrom, dateTo]);

  useEffect(() => {
    if (mounted && currentPlant?.id) fetchData(currentPlant.id);
  }, [mounted, currentPlant?.id]);

  const handleDateApply = () => fetchData(currentPlant?.id, dateFrom, dateTo);

  const filterRemision = (r: { remision_number: string; conductor?: string | null; construction_site?: string | null; client_name?: string | null }) =>
    !search ||
    r.remision_number.includes(search) ||
    (r.conductor || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.construction_site || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.client_name || '').toLowerCase().includes(search.toLowerCase());

  const filteredRegular = (data?.regular || []).filter(filterRemision);
  const filteredCrossPlant = (data?.crossPlant || []).filter(r =>
    !search ||
    r.remision_number.includes(search) ||
    (r.conductor || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.billing_plant_name || '').toLowerCase().includes(search.toLowerCase()),
  );

  const filteredArkikWaste = (data?.arkik_waste || []).filter(w =>
    !search ||
    w.remision_number.includes(search) ||
    w.material_code.toLowerCase().includes(search.toLowerCase()) ||
    (w.notes || '').toLowerCase().includes(search.toLowerCase()),
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <InventoryBreadcrumb />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-gray-700" />
              Registro de Remisiones
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Todas las remisiones de esta planta — incluyendo producción cruzada
            </p>
            {currentPlant && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                <Building2 className="h-3.5 w-3.5" />
                {currentPlant.name}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(currentPlant?.id)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 min-w-0">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Búsqueda</label>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-gray-400" />
                <Input
                  placeholder="# Remisión, conductor, obra, cliente..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Desde</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Hasta</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            </div>
            <Button onClick={handleDateApply} disabled={loading} className="shrink-0">
              <CalendarDays className="h-4 w-4 mr-1" />
              Aplicar
            </Button>
          </CardContent>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
        )}

        {/* Summary KPIs */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card
              className={`cursor-pointer transition-shadow hover:shadow-md ${activeSection === 'regular' ? 'ring-2 ring-blue-400' : ''}`}
              onClick={() => setActiveSection(s => s === 'regular' ? 'all' : 'regular')}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-blue-700">{data.summary.total_regular}</div>
                <div className="text-xs text-gray-500 mt-0.5">Remisiones normales</div>
                <div className="text-sm font-semibold text-blue-600 mt-1">
                  {data.summary.total_volume_regular.toFixed(1)} m³
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-shadow hover:shadow-md ${activeSection === 'cross-plant' ? 'ring-2 ring-indigo-400' : ''}`}
              onClick={() => setActiveSection(s => s === 'cross-plant' ? 'all' : 'cross-plant')}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-indigo-700">{data.summary.total_cross_plant}</div>
                <div className="text-xs text-gray-500 mt-0.5">Producción cruzada</div>
                <div className="text-sm font-semibold text-indigo-600 mt-1">
                  {data.summary.total_volume_cross_plant.toFixed(1)} m³
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-700">
                  {(data.summary.total_regular + data.summary.total_cross_plant)}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Total remisiones</div>
                <div className="text-sm font-semibold text-green-600 mt-1">
                  {(data.summary.total_volume_regular + data.summary.total_volume_cross_plant).toFixed(1)} m³
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-gray-700">
                  {data.crossPlant.filter(r => !r.is_resolved).length}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Cruzadas pendientes</div>
                <div className="text-xs text-amber-600 mt-1 font-medium">
                  {data.crossPlant.filter(r => r.is_resolved).length} vinculadas
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-shadow hover:shadow-md ${activeSection === 'arkik-waste' ? 'ring-2 ring-red-400' : ''}`}
              onClick={() => setActiveSection(s => s === 'arkik-waste' ? 'all' : 'arkik-waste')}
            >
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-700">
                  {data.summary.total_arkik_waste_lines ?? data.arkik_waste.length}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Desperdicio Arkik</div>
                <div className="text-xs text-red-600 mt-1 font-medium">Líneas de material</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Arkik waste (cancelled / incomplete — no remisión row) */}
        {(activeSection === 'all' || activeSection === 'arkik-waste') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 bg-red-100 rounded-lg flex items-center justify-center">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                Desperdicio (importación Arkik)
                {data && (
                  <Badge variant="secondary" className="ml-auto bg-red-100 text-red-800 text-xs">
                    {filteredArkikWaste.length} líneas
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-gray-500">
                Remisiones marcadas como desperdicio — no generan fila en remisiones; afectan reconciliación de inventario teórico
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : filteredArkikWaste.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Trash2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {search ? 'Sin resultados para esa búsqueda' : 'No hay registros de desperdicio Arkik en este período'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-red-50/50">
                      <TableHead className="text-xs">Remisión</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Material</TableHead>
                      <TableHead className="text-xs text-right">Cantidad (kg)</TableHead>
                      <TableHead className="text-xs">Motivo</TableHead>
                      <TableHead className="text-xs">Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredArkikWaste.map(w => (
                      <TableRow key={w.id} className="hover:bg-red-50/20">
                        <TableCell className="font-medium text-sm">#{w.remision_number}</TableCell>
                        <TableCell className="text-sm text-gray-600">{w.fecha}</TableCell>
                        <TableCell className="text-sm">
                          <span className="font-mono text-gray-800">{w.material_code}</span>
                          {w.material_id && (
                            <span className="block text-[10px] text-gray-400 truncate max-w-[120px]" title={w.material_id}>
                              id: …{w.material_id.slice(-8)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-right font-semibold text-red-800">
                          {Number(w.waste_amount).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700 capitalize">{w.waste_reason}</TableCell>
                        <TableCell className="text-xs text-gray-600 max-w-[200px] truncate" title={w.notes || ''}>
                          {w.notes || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Cross-plant production section */}
        {(activeSection === 'all' || activeSection === 'cross-plant') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Factory className="h-4 w-4 text-indigo-600" />
                </div>
                Producción Cruzada
                {data && (
                  <Badge variant="secondary" className="ml-auto bg-indigo-100 text-indigo-700 text-xs">
                    {filteredCrossPlant.length} registros · {data.summary.total_volume_cross_plant.toFixed(1)} m³
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-gray-500">
                Concreto producido en esta planta y facturado en otra — registros sin orden de venta
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : filteredCrossPlant.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Factory className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {search ? 'Sin resultados para esa búsqueda' : 'No hay registros de producción cruzada en este período'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-indigo-50/50">
                      <TableHead className="text-xs">Remisión</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Conductor</TableHead>
                      <TableHead className="text-xs">Unidad</TableHead>
                      <TableHead className="text-xs text-right">Volumen</TableHead>
                      <TableHead className="text-xs">Planta Facturación</TableHead>
                      <TableHead className="text-xs">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCrossPlant.map(r => (
                      <TableRow key={r.id} className="hover:bg-indigo-50/30">
                        <TableCell className="font-medium text-sm">
                          <div className="flex items-center gap-1.5">
                            <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                            #{r.remision_number}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{r.fecha}</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1 text-gray-700">
                            <Truck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            {r.conductor || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{r.unidad || '—'}</TableCell>
                        <TableCell className="text-sm text-right font-semibold text-indigo-700">
                          {r.volumen_fabricado.toFixed(2)} m³
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            <span className="text-gray-700">{r.billing_plant_name || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {r.is_resolved ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                              <CheckCircle2 className="h-3 w-3" />
                              Vinculada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              <Clock className="h-3 w-3" />
                              Pendiente
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Regular remisiones section */}
        {(activeSection === 'all' || activeSection === 'regular') && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="h-8 w-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                Remisiones de Órdenes
                {data && (
                  <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-700 text-xs">
                    {filteredRegular.length} registros · {data.summary.total_volume_regular.toFixed(1)} m³
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-gray-500">
                Remisiones normales vinculadas a órdenes de venta
              </p>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-2">
                  {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : filteredRegular.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    {search ? 'Sin resultados para esa búsqueda' : 'No hay remisiones en este período'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50/50">
                      <TableHead className="text-xs">Remisión</TableHead>
                      <TableHead className="text-xs">Fecha</TableHead>
                      <TableHead className="text-xs">Cliente / Obra</TableHead>
                      <TableHead className="text-xs">Conductor</TableHead>
                      <TableHead className="text-xs">Unidad</TableHead>
                      <TableHead className="text-xs text-right">Volumen</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegular.map(r => (
                      <TableRow key={r.id} className="hover:bg-blue-50/20">
                        <TableCell className="font-medium text-sm">
                          #{r.remision_number}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{r.fecha}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                            {r.client_name || '—'}
                          </div>
                          {r.construction_site && (
                            <div className="text-xs text-gray-500 truncate max-w-[180px]">{r.construction_site}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1 text-gray-700">
                            <Truck className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                            {r.conductor || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">{r.unidad || '—'}</TableCell>
                        <TableCell className="text-sm text-right font-semibold text-blue-700">
                          {r.volumen_fabricado.toFixed(2)} m³
                        </TableCell>
                        <TableCell>
                          {r.is_cross_plant_billing ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                              r.is_resolved
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : 'bg-amber-100 text-amber-700 border-amber-200'
                            }`}>
                              <ArrowLeftRight className="h-3 w-3" />
                              Cruzada{r.is_resolved ? ' ✓' : ''}
                              {r.producing_plant_name && (
                                <span className="ml-0.5 opacity-75">· {r.producing_plant_name}</span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                              Normal
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
