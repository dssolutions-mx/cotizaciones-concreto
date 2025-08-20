'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  AlertTriangle, 
  ChevronLeft, 
  FileText, 
  Calendar,
  Building,
  User,
  Truck,
  Beaker,
  CheckCircle,
  Clock,
  Plus,
  Package,
  ArrowUpRight,
  Thermometer
} from 'lucide-react';
import { fetchMuestreoById } from '@/services/qualityService';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { MuestreoWithRelations } from '@/types/quality';
import Link from 'next/link';
import { formatDate, createSafeDate } from '@/lib/utils';
import AddSampleModal from '@/components/quality/muestreos/AddSampleModal';
import RemisionMaterialsAnalysis from '@/components/quality/RemisionMaterialsAnalysis';

// Helper function to get order info for integration
function getOrderInfo(muestreo: MuestreoWithRelations) {
  if (!muestreo.remision?.order?.id) return null;
  return muestreo.remision.order;
}

export default function MuestreoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuthBridge();
  const [muestreo, setMuestreo] = useState<MuestreoWithRelations | null>(null);
  const [orderTotals, setOrderTotals] = useState<{
    totalOrderVolume: number;
    totalOrderSamplings: number;
    totalRemisiones: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddSampleModal, setShowAddSampleModal] = useState(false);
  const [orderTotalsLoading, setOrderTotalsLoading] = useState(false);
  
  const fetchMuestreoDetails = async () => {
    if (!params.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const muestreoId = Array.isArray(params.id) ? params.id[0] : params.id;
      const data = await fetchMuestreoById(muestreoId);
      setMuestreo(data);
      
      // Fetch order totals if we have order info
      if (data?.remision?.order?.id) {
        setOrderTotalsLoading(true);
        try {
          // First test if the API is accessible
          console.log('Testing API accessibility...');
          try {
            const healthResponse = await fetch('/api/health');
            console.log('Health endpoint status:', healthResponse.status);
          } catch (healthErr) {
            console.warn('Health endpoint test failed:', healthErr);
          }
          
          // Add timeout to prevent hanging requests
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          console.log('Fetching order totals for order:', data.remision.order.id);
          
          const totalsResponse = await fetch(`/api/orders/${data.remision.order.id}/order-totals`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          console.log('Order totals response status:', totalsResponse.status);
          
          if (totalsResponse.ok) {
            const totals = await totalsResponse.json();
            console.log('Order totals received:', totals);
            setOrderTotals(totals);
          } else {
            const errorText = await totalsResponse.text();
            console.warn('Failed to fetch order totals:', totalsResponse.status, totalsResponse.statusText, errorText);
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            console.warn('Order totals request timed out');
          } else {
            console.error('Error fetching order totals:', err);
          }
          // Don't fail the entire component if order totals fail
        } finally {
          setOrderTotalsLoading(false);
        }
      }
    } catch (err) {
      console.error('Error al cargar detalle de muestreo:', err);
      setError('No se pudo cargar la información del muestreo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMuestreoDetails();
  }, [params.id]);

  const handleSampleAdded = () => {
    // Refresh muestreo data after adding a sample
    fetchMuestreoDetails();
  };

  const retryOrderTotals = async () => {
    if (!muestreo?.remision?.order?.id) return;
    
    setOrderTotalsLoading(true);
    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const totalsResponse = await fetch(`/api/orders/${muestreo.remision.order.id}/order-totals`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (totalsResponse.ok) {
        const totals = await totalsResponse.json();
        setOrderTotals(totals);
      } else {
        console.warn('Failed to fetch order totals:', totalsResponse.status, totalsResponse.statusText);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('Order totals request timed out');
      } else {
        console.error('Error fetching order totals:', err);
      }
    } finally {
      setOrderTotalsLoading(false);
    }
  };

  // Verificar roles permitidos
  const allowedRoles = ['QUALITY_TEAM', 'LABORATORY', 'PLANT_MANAGER', 'EXECUTIVE'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <div className="max-w-3xl mx-auto bg-yellow-50 border border-yellow-300 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <h2 className="text-2xl font-semibold text-yellow-800">Acceso Restringido</h2>
          </div>
          
          <p className="text-lg mb-4 text-yellow-700">
            No tienes permiso para acceder a esta sección.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
            <p className="text-gray-500">Cargando detalle del muestreo...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !muestreo) {
    return (
      <div className="container mx-auto p-4 md:p-6">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => router.back()} 
          className="mb-6"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-3xl mx-auto">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-xl font-medium text-red-800 mb-2">
                Error al cargar el muestreo
              </h3>
              <p className="text-red-700">
                {error || 'No se encontró el muestreo solicitado'}
              </p>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={() => {
              const muestreoId = Array.isArray(params.id) ? params.id[0] : params.id;
              if (muestreoId) {
                fetchMuestreoById(muestreoId);
              }
            }}
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  // Agrupar muestras por tipo
  const cilindros = muestreo.muestras?.filter(m => m.tipo_muestra === 'CILINDRO') || [];
  const vigas = muestreo.muestras?.filter(m => m.tipo_muestra === 'VIGA') || [];
  const cubos = muestreo.muestras?.filter(m => m.tipo_muestra === 'CUBO') || [];
  const firstEnsayoId = (() => {
		const all = muestreo.muestras?.flatMap(m => m.ensayos || []) || [];
		if (all.length === 0) return undefined;
		const sorted = [...all].sort((a: any, b: any) => {
			const at = (a as any).fecha_ensayo_ts || a.fecha_ensayo || '';
			const bt = (b as any).fecha_ensayo_ts || b.fecha_ensayo || '';
			return (new Date(at).getTime()) - (new Date(bt).getTime());
		});
		return sorted[0]?.id;
	})();

	// Ordenar muestras de izquierda a derecha por fecha programada (TS > DATE > real > created_at)
	const getDateForSort = (m: any): Date => {
		const ts = (m as any).fecha_programada_ensayo_ts as string | undefined;
		const byTs = ts ? createSafeDate(ts) : null;
		if (byTs) return byTs;
		const byDate = m.fecha_programada_ensayo ? createSafeDate(m.fecha_programada_ensayo) : null;
		if (byDate) return byDate;
		const ensayo = (m.ensayos && m.ensayos[0]) ? m.ensayos[0] as any : null;
		const realTs = ensayo?.fecha_ensayo_ts ? createSafeDate(ensayo.fecha_ensayo_ts) : null;
		if (realTs) return realTs;
		const real = ensayo?.fecha_ensayo ? createSafeDate(ensayo.fecha_ensayo) : null;
		if (real) return real;
		return createSafeDate((m as any).created_at) || new Date(0);
	};

	const muestrasOrdenadas = [...(muestreo.muestras || [])].sort((a, b) => {
		const ad = getDateForSort(a).getTime();
		const bd = getDateForSort(b).getTime();
		if (ad !== bd) return ad - bd;
		// desempate estable por identificacion
		const ai = (a.identificacion || '').localeCompare(b.identificacion || '');
		if (ai !== 0) return ai;
		return ((a as any).created_at || '').localeCompare((b as any).created_at || '');
	});

	// Construir etiquetas de visualización consecutivas por tipo/dimensión
	const prefixFor = (m: any) => {
		const tipo = m.tipo_muestra as string | undefined;
		if (tipo === 'CUBO') {
			const side = (m as any).cube_side_cm ?? 15;
			return `CUBO-${String(side)}X${String(side)}`;
		}
		if (tipo === 'CILINDRO') {
			const dia = (m as any).diameter_cm ?? 15;
			return `CILINDRO-${String(dia)}`;
		}
		return 'VIGA';
	};

	const counters: Record<string, number> = {};
	const displayNameById = new Map<string, string>();
	muestrasOrdenadas.forEach((m) => {
		const pref = prefixFor(m as any);
		counters[pref] = (counters[pref] || 0) + 1;
		displayNameById.set(m.id, `${pref}-${counters[pref]}`);
	});

  return (
    <div className="container mx-auto px-4 py-8">
      
      {/* Breadcrumbs */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/quality">Calidad</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/quality/muestreos">Muestreos</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink>Detalle</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-1">
            Muestreo #{muestreo.numero_muestreo}
          </h1>
          <p className="text-gray-500">
            Remisión {muestreo.remision?.remision_number || muestreo.manual_reference || 'Sin remisión'}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
      
      {/* Tabbed Interface */}
      <Tabs defaultValue="general" className="mb-8">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">Información General</TabsTrigger>
          <TabsTrigger value="materials" disabled={!muestreo.remision}>Análisis de Materiales</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Muestreo Information */}
        <Card className="lg:col-span-2 border border-gray-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Beaker className="h-5 w-5 text-gray-600" />
              Información del Muestreo
            </CardTitle>
            <CardDescription>
              Detalles del muestreo y condiciones de fabricación
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left Column - Basic Sampling Info */}
              <div className="space-y-4">
                {/* Primary sampling identification */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Muestreo #</p>
                    <div className="flex items-center gap-2">
                      <Beaker className="h-4 w-4 text-gray-600" />
                      <span className="font-semibold text-gray-900">{muestreo.numero_muestreo}</span>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Estado</p>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                        Completado
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Fecha Muestreo</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <p className="font-semibold text-gray-900">
                      {formatDate(muestreo.fecha_muestreo, 'PPP')}
                    </p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Planta</p>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-600" />
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                      {muestreo.planta}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Cliente</p>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-600" />
                    <p className="font-semibold text-gray-900">{muestreo.remision?.order?.clients?.business_name || 'No disponible'}</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Remisión</p>
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-gray-600" />
                    <Badge variant="secondary">
                      {muestreo.remision?.remision_number || muestreo.manual_reference || 'No disponible'}
                    </Badge>
                  </div>
                </div>
                
                {/* Order link */}
                {getOrderInfo(muestreo) && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Orden</p>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-600" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/orders/${getOrderInfo(muestreo)?.id}`, '_blank')}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 px-2 py-1 h-auto text-xs"
                      >
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        {getOrderInfo(muestreo)?.order_number || `#${getOrderInfo(muestreo)?.id?.slice(0, 8)}...`}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Environmental conditions summary */}
                {(typeof muestreo.temperatura_ambiente === 'number' || typeof muestreo.temperatura_concreto === 'number') && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-500 mb-2">Condiciones Ambientales</p>
                    <div className="grid grid-cols-2 gap-3">
                      {typeof muestreo.temperatura_ambiente === 'number' && (
                        <div className="flex items-center gap-2">
                          <Thermometer className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-600">
                            {muestreo.temperatura_ambiente}°C
                          </span>
                        </div>
                      )}
                      {typeof muestreo.temperatura_concreto === 'number' && (
                        <div className="flex items-center gap-2">
                          <Beaker className="h-3 w-3 text-gray-500" />
                          <span className="text-xs text-gray-600">
                            {muestreo.temperatura_concreto}°C
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Column - Technical & Order Summary */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Fórmula</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                      {muestreo.remision?.recipe?.recipe_code || 'No disponible'}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Resistencia Diseño</p>
                  <div className="text-lg font-bold text-gray-900">
                    {muestreo.remision?.recipe?.strength_fc || '--'} kg/cm²
                  </div>
                </div>
                
                {muestreo.revenimiento_sitio && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Revenimiento en Sitio</p>
                    <div className="text-2xl font-bold text-gray-900">
                      {muestreo.revenimiento_sitio} 
                      <span className="text-sm font-normal text-gray-500 ml-1">cm</span>
                    </div>
                  </div>
                )}
                
                {typeof muestreo.masa_unitaria === 'number' && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Masa Unitaria</p>
                    <div className="text-2xl font-bold text-gray-900">
                      {muestreo.masa_unitaria}
                      <span className="text-sm font-normal text-gray-500 ml-1">kg/m³</span>
                    </div>
                  </div>
                )}
                
                {/* Order summary section */}
                {getOrderInfo(muestreo) && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Resumen de la Orden</h4>
                    
                    {orderTotalsLoading ? (
                      <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Cargando resumen...</span>
                      </div>
                    ) : orderTotals ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Volumen Total</p>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-gray-600" />
                            <span className="text-lg font-bold text-gray-900">
                              {orderTotals.totalOrderVolume} m³
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">Total Muestreos</p>
                          <div className="flex items-center gap-2">
                            <Beaker className="h-4 w-4 text-gray-600" />
                            <span className="text-lg font-bold text-gray-900">
                              {orderTotals.totalOrderSamplings}
                            </span>
                            <span className="text-xs text-gray-500">muestreos</span>
                          </div>
                        </div>
                      </div>
                                         ) : (
                       <div className="flex items-center gap-2">
                         <span className="text-sm text-gray-500">
                           No se pudo cargar el resumen de la orden
                         </span>
                         <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={retryOrderTotals}
                           className="h-6 px-2 text-xs"
                         >
                           Reintentar
                         </Button>
                       </div>
                     )}
                    
                    {getOrderInfo(muestreo)?.construction_site && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-500 mb-1">Obra</p>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-gray-600" />
                          <span className="text-sm text-gray-900">{getOrderInfo(muestreo)?.construction_site}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Environmental Conditions & Sample Summary */}
        <div className="space-y-6">
          {/* Environmental Conditions */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Thermometer className="h-5 w-5 text-gray-600" />
                Condiciones Ambientales
              </CardTitle>
              <CardDescription>
                Temperatura y condiciones durante el muestreo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {typeof muestreo.temperatura_ambiente === 'number' && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Temperatura Ambiente</p>
                  <div className="text-3xl font-bold text-gray-900">
                    {muestreo.temperatura_ambiente}
                    <span className="text-sm font-normal text-gray-500 ml-1">°C</span>
                  </div>
                </div>
              )}
              
              {(typeof muestreo.temperatura_ambiente === 'number' && typeof muestreo.temperatura_concreto === 'number') && <Separator />}
              
              {typeof muestreo.temperatura_concreto === 'number' && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Temperatura Concreto</p>
                  <div className="text-3xl font-bold text-gray-900">
                    {muestreo.temperatura_concreto}
                    <span className="text-sm font-normal text-gray-500 ml-1">°C</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sample Summary */}
          <Card className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Beaker className="h-5 w-5 text-gray-600" />
                Resumen de Muestras
              </CardTitle>
              <CardDescription>
                Estado actual de los especímenes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{cilindros.length}</div>
                    <p className="text-xs text-gray-500">Cilindros</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {cilindros.filter(c => c.estado === 'ENSAYADO').length} ensayados
                    </Badge>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{vigas.length}</div>
                    <p className="text-xs text-gray-500">Vigas</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {vigas.filter(v => v.estado === 'ENSAYADO').length} ensayadas
                    </Badge>
                  </div>

                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{cubos.length}</div>
                    <p className="text-xs text-gray-500">Cubos</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {cubos.filter(c => c.estado === 'ENSAYADO').length} ensayados
                    </Badge>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Próximo Ensayo</p>
                  {muestreo.muestras && muestreo.muestras.some(m => m.estado === 'PENDIENTE') ? (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-600" />
                      <p className="text-gray-600 font-medium text-sm">
                        {(() => {
                          const asDate = (d?: string) => (d ? createSafeDate(d) : null);
                          const pending = [...(muestreo.muestras || [])]
                            .filter(m => m.estado === 'PENDIENTE')
                            .map(m => {
                              const ts = (m as any).fecha_programada_ensayo_ts as string | undefined;
                              const dstr = ts || m.fecha_programada_ensayo;
                              return { m, d: asDate(dstr || undefined) };
                            })
                            .filter(x => !!x.d)
                            .sort((a, b) => (a.d!.getTime() - b.d!.getTime()));
                          const next = pending[0]?.d;
                          return next ? formatDate(next, 'PPP') : 'Fecha no programada';
                        })()}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <p className="text-green-600 text-sm">Todos los ensayos completados</p>
                    </div>
                  )}
                </div>
                
                <div className="pt-2">
                  {firstEnsayoId ? (
                    <Link href={`/quality/ensayos/${firstEnsayoId}`}>
                      <Button size="sm" className="w-full">
                        Ver Ensayo
                      </Button>
                    </Link>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full" disabled>
                      No hay ensayos
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
        
        {/* Listado de muestras */}
      <Card className="mb-6 border border-gray-200 bg-white shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Beaker className="h-5 w-5 text-gray-600" />
                Especímenes de Ensayo
              </CardTitle>
              <CardDescription>
                Muestras registradas para este muestreo
              </CardDescription>
            </div>

            <Button 
              onClick={() => setShowAddSampleModal(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Agregar Muestra
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {muestreo.muestras && muestreo.muestras.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {muestrasOrdenadas.map((muestra) => (
                <Card 
                  key={muestra.id} 
                  className="overflow-hidden transition-all hover:shadow-md border border-gray-200 bg-white"
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                        {muestra.tipo_muestra === 'CILINDRO' ? 'Cilindro' : muestra.tipo_muestra === 'VIGA' ? 'Viga' : 'Cubo'}
                      </Badge>
                      <Badge 
                        variant={
                          muestra.estado === 'ENSAYADO' 
                            ? 'default' 
                            : muestra.estado === 'DESCARTADO'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className={`text-xs ${
                          muestra.estado === 'ENSAYADO' 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : muestra.estado === 'DESCARTADO'
                              ? ''
                              : 'bg-gray-100 text-gray-800 border-gray-300'
                        }`}
                      >
                        {muestra.estado}
                      </Badge>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 mb-1">{displayNameById.get(muestra.id) || muestra.identificacion}</h3>
                    
                    {(() => {
                      const ensayo = (muestra.ensayos && muestra.ensayos.length > 0) ? muestra.ensayos[0] : null;
                      const realTs = ensayo ? ((ensayo as any).fecha_ensayo_ts as string | undefined) : undefined;
                      const realDateStr = realTs || (ensayo ? ensayo.fecha_ensayo : undefined);
                      const schedTs = (muestra as any).fecha_programada_ensayo_ts as string | undefined;
                      const schedDateStr = schedTs || muestra.fecha_programada_ensayo;
                      if (muestra.estado === 'ENSAYADO' && realDateStr) {
                        return (
                          <div className="text-xs text-gray-600 mb-2">
                            Ensayo realizado: {formatDate(realDateStr, 'PPP')}
                          </div>
                        );
                      }
                      return schedDateStr ? (
                        <div className="text-xs text-gray-600 mb-2">
                          Ensayo programado: {formatDate(schedDateStr, 'PPP')}
                        </div>
                      ) : null;
                    })()}
                    
                    {muestra.estado === 'PENDIENTE' ? (
                      <Link href={`/quality/ensayos/new?muestra=${muestra.id}`}>
                        <Button size="sm" className="w-full">
                          Registrar Ensayo
                        </Button>
                      </Link>
                    ) : (
                      (muestra.ensayos && muestra.ensayos.length > 0) ? (() => {
                        const sorted = [...muestra.ensayos].sort((a: any, b: any) => {
                          const at = (a as any).fecha_ensayo_ts || a.fecha_ensayo || '';
                          const bt = (b as any).fecha_ensayo_ts || b.fecha_ensayo || '';
                          return (new Date(at).getTime()) - (new Date(bt).getTime());
                        });
                        const targetId = sorted[0]?.id;
                        if (!targetId) {
                          return (
                            <Button size="sm" variant="outline" className="w-full" disabled>
                              Ver Ensayo
                            </Button>
                          );
                        }
                        return (
                          <Link href={`/quality/ensayos/${targetId}`}>
                            <Button size="sm" variant="outline" className="w-full">
                              Ver Ensayo
                            </Button>
                          </Link>
                        );
                      })() : (
                        <Button size="sm" variant="outline" className="w-full" disabled>
                          Ver Ensayo
                        </Button>
                      )
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-500">
              No hay muestras registradas para este muestreo
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>
        
        <TabsContent value="materials" className="mt-6">
          {muestreo.remision ? (
            <RemisionMaterialsAnalysis remision={muestreo.remision} />
          ) : (
            <div className="text-center py-12">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay remisión asociada
              </h3>
              <p className="text-gray-500">
                Este muestreo no tiene una remisión asociada para analizar materiales.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal para agregar nueva muestra */}
      {muestreo && (
        <AddSampleModal
          isOpen={showAddSampleModal}
          onClose={() => setShowAddSampleModal(false)}
          muestreoId={muestreo.id}
          muestreoDate={muestreo.fecha_muestreo}
          onSampleAdded={handleSampleAdded}
        />
      )}
    </div>
  );
} 