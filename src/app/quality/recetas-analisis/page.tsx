'use client';

import React, { useState, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuthBridge } from '@/adapters/auth-context-bridge';
import { usePlantContext } from '@/contexts/PlantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbLink,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import PlantContextDisplay from '@/components/plants/PlantContextDisplay';
import { 
  Loader2, 
  BarChart3, 
  Target, 
  FileBarChart, 
  FlaskConical, 
  TrendingUp, 
  Search,
  AlertTriangle 
} from 'lucide-react';
import { useProgressiveRecipeQuality } from '@/hooks/useProgressiveRecipeQuality';
import { MasterRecipeSearchModal } from '@/components/quality/recipes/MasterRecipeSearchModal';
import { RecipeQualityMetrics } from '@/components/quality/recipes/RecipeQualityMetrics';
import { RecipeAdvancedMetrics } from '@/components/quality/recipes/RecipeAdvancedMetrics';
import { RecipeQualityCharts } from '@/components/quality/recipes/RecipeQualityCharts';
import { VariantsComparisonTable } from '@/components/quality/recipes/VariantsComparisonTable';
import RecipeMuestreosCharts from '@/components/quality/recipes/RecipeMuestreosCharts';

export default function RecipeAnalysisPage() {
  const { profile } = useAuthBridge();
  const { currentPlant } = usePlantContext();

  // Default to last 3 months like client analysis
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 90),
    to: new Date()
  });
  const [selectedMasterId, setSelectedMasterId] = useState<string | null>(null);
  const [selectedMasterCode, setSelectedMasterCode] = useState<string | null>(null);
  const [selectedVariantCount, setSelectedVariantCount] = useState<number>(0);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data, summary, loading, streaming, progress, error } = useProgressiveRecipeQuality({
    masterRecipeId: selectedMasterId || undefined,
    plantId: currentPlant?.id || '',
    fromDate: dateRange?.from,
    toDate: dateRange?.to,
    options: {
      granularity: 'week',
      newestFirst: true
    }
  });

  const allowedRoles = ['QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'ADMIN'];
  const hasAccess = profile && allowedRoles.includes(profile.role);

  // Breadcrumb items for navigation
  const breadcrumbItems = [
    { label: 'Calidad', href: '/quality' },
    { label: 'Análisis por Receta', href: '/quality/recetas-analisis' }
  ];

  const headerSubtitle = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'Selecciona un período y una receta maestra para comenzar';
    if (selectedMasterCode) {
      return `${selectedMasterCode} (${selectedVariantCount} variante${selectedVariantCount !== 1 ? 's' : ''}) | ${format(dateRange.from, 'dd/MM/yyyy', { locale: es })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: es })}`;
    }
    return `Período: ${format(dateRange.from, 'dd/MM/yyyy', { locale: es })} - ${format(dateRange.to, 'dd/MM/yyyy', { locale: es })}`;
  }, [dateRange, selectedMasterCode, selectedVariantCount]);

  const handleMasterSelect = (masterId: string, masterCode: string, variantCount: number) => {
    setSelectedMasterId(masterId);
    setSelectedMasterCode(masterCode);
    setSelectedVariantCount(variantCount);
  };

  const clearSelection = () => {
    setSelectedMasterId(null);
    setSelectedMasterCode(null);
    setSelectedVariantCount(0);
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto py-16 px-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No tienes permisos para acceder al análisis por receta. Contacta al administrador.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentPlant) {
    return (
      <div className="container mx-auto py-16 px-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Selecciona una planta para continuar con el análisis por receta.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6">
      {/* Breadcrumb Navigation */}
      <div className="mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbItems.map((item, index) => {
              const isLast = index === breadcrumbItems.length - 1;
              return (
                <React.Fragment key={item.href}>
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="flex items-center gap-2">
                        <FileBarChart className="h-4 w-4" />
                        {item.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <a href={item.href} className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          {item.label}
                        </a>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FlaskConical className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Análisis por Receta</h1>
            <p className="text-sm text-gray-600">{headerSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PlantContextDisplay compact={true} showLabel={false} />
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Master Recipe Selection */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Receta Maestra
              </label>

              <Button
                variant={selectedMasterId ? "secondary" : "outline"}
                onClick={() => setSearchOpen(true)}
                className="w-full justify-start"
              >
                <Search className="h-4 w-4 mr-2" />
                {selectedMasterId ? 'Cambiar receta maestra...' : 'Seleccionar receta maestra...'}
              </Button>

              {selectedMasterId && selectedMasterCode && (
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-blue-900">
                          {selectedMasterCode}
                        </div>
                        <div className="text-xs text-blue-600 mt-1">
                          {selectedVariantCount} variante{selectedVariantCount !== 1 ? 's' : ''} en análisis
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="h-8 w-8 p-0 hover:bg-blue-100"
                        aria-label="Limpiar selección"
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Date Range */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">
                Período de Análisis
              </label>
              <DatePickerWithRange
                date={dateRange}
                onDateChange={setDateRange}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Resumen</div>
              {summary ? (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Volumen:</span>
                    <span className="font-medium">{summary.totals.volume.toFixed(1)} m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remisiones:</span>
                    <span className="font-medium">{summary.totals.remisiones}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ensayos:</span>
                    <span className="font-medium">{summary.totals.ensayosEdadGarantia}</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  {selectedRecipeIds.length === 0 
                    ? 'Selecciona recetas para ver el resumen'
                    : 'Cargando datos...'
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {loading && selectedMasterId && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-4">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <div>
                <div className="font-medium">Cargando análisis de receta...</div>
                {streaming && (
                  <div className="text-sm text-gray-600">
                    Procesando {progress.processed} de {progress.total} períodos
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      {selectedMasterId && data && summary && !loading && (
        <div className="space-y-6">
          {/* Recipe Header Info */}
          <RecipeQualityMetrics summary={summary} loading={loading} />

          {/* Tabs for different views */}
          <Tabs defaultValue="metrics" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="metrics" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Métricas Clave
              </TabsTrigger>
              <TabsTrigger value="variants" className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Variantes
              </TabsTrigger>
              <TabsTrigger value="statistical" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Análisis Estadístico
              </TabsTrigger>
              <TabsTrigger value="charts" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Gráficos Avanzados
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <FileBarChart className="h-4 w-4" />
                Detalles
              </TabsTrigger>
            </TabsList>

            <TabsContent value="metrics" className="space-y-6">
              <RecipeAdvancedMetrics summary={summary} loading={loading} />
            </TabsContent>

            <TabsContent value="variants" className="space-y-6">
              <VariantsComparisonTable
                remisiones={data.remisiones}
                targetStrength={summary.recipeInfo.strength_fc}
              />
            </TabsContent>

            <TabsContent value="statistical" className="space-y-6">
              <RecipeMuestreosCharts remisiones={data.remisiones} />
            </TabsContent>

            <TabsContent value="charts" className="space-y-6">
              <RecipeQualityCharts
                remisiones={data.remisiones}
                targetStrength={summary.recipeInfo.strength_fc}
                targetAge={summary.recipeInfo.age_days}
              />
            </TabsContent>

            <TabsContent value="details">
              <Card>
                <CardHeader>
                  <CardTitle>Detalles por Remisión</CardTitle>
                  <CardDescription>
                    Datos detallados de cada entrega de concreto para las recetas seleccionadas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-4 md:mx-0">
                    <table className="min-w-[960px] md:min-w-0 text-sm">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th className="py-2 pr-4">Fecha</th>
                          <th className="py-2 pr-4">Remisión</th>
                          <th className="py-2 pr-4">Código Receta</th>
                          <th className="py-2 pr-4">Sitio</th>
                          <th className="py-2 pr-4">Volumen</th>
                          <th className="py-2 pr-4">Resistencia</th>
                          <th className="py-2 pr-4">Cumplimiento</th>
                          <th className="py-2 pr-4">Rendimiento</th>
                          <th className="py-2 pr-4">Costo/m³</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.remisiones.map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="py-2 pr-4">{format(new Date(r.fecha), 'dd/MM/yyyy')}</td>
                            <td className="py-2 pr-4">{r.remisionNumber}</td>
                            <td className="py-2 pr-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-xs">
                                  {r.arkikLongCode || r.recipeCode}
                                </span>
                                {r.variantSuffix && (
                                  <span className="text-xs text-gray-500">
                                    Variante: {r.variantSuffix}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 pr-4 max-w-xs truncate">{r.constructionSite}</td>
                            <td className="py-2 pr-4">{r.volume.toFixed(2)} m³</td>
                            <td className="py-2 pr-4">
                              {r.avgResistencia ? `${r.avgResistencia.toFixed(1)} kg/cm²` : '—'}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant={r.complianceStatus === 'compliant' ? 'default' :
                                           r.complianceStatus === 'pending' ? 'secondary' : 'destructive'}>
                                {r.complianceStatus === 'compliant' ? 'Excelente' :
                                 r.complianceStatus === 'pending' ? 'Aceptable' : 'Requiere Atención'}
                              </Badge>
                            </td>
                            <td className="py-2 pr-4">
                              {r.rendimientoVolumetrico ? `${r.rendimientoVolumetrico.toFixed(1)}%` : '—'}
                            </td>
                            <td className="py-2 pr-4">
                              {r.costPerM3 ? `$${r.costPerM3.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Empty State */}
      {!selectedMasterId && (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <FlaskConical className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona una receta maestra para analizar
              </h3>
              <p className="text-gray-600 mb-4">
                El análisis se realiza por receta maestra, agrupando todas sus variantes.
                Podrás ver métricas globales y comparación detallada entre variantes.
              </p>
              <Button onClick={() => setSearchOpen(true)} size="lg">
                <Search className="h-4 w-4 mr-2" />
                Buscar Receta Maestra
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Master Recipe Search Modal */}
      <MasterRecipeSearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onMasterSelect={handleMasterSelect}
      />
    </div>
  );
}