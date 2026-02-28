'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, Building2, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Container } from '@/components/ui/Container';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import ExecutiveSetupPanel from '@/components/demo/list-pricing/ExecutiveSetupPanel';
import QuoteBuilderSimulationPanel from '@/components/demo/list-pricing/QuoteBuilderSimulationPanel';
import {
  clearEntriesFromLocal,
  demoMasterRecipes,
  loadEntriesFromLocal,
  saveEntriesToLocal,
  type ListPriceEntry,
} from '@/lib/demo/listPricingCorporateDemo';

export default function DemoListPricePage() {
  const [entries, setEntries] = useState<ListPriceEntry[]>([]);

  useEffect(() => {
    setEntries(loadEntriesFromLocal());
  }, []);

  useEffect(() => {
    saveEntriesToLocal(entries);
  }, [entries]);

  const scopeMetrics = useMemo(() => {
    const global = entries.filter((entry) => entry.scopeLevel === 'GLOBAL').length;
    const plant = entries.filter((entry) => entry.scopeLevel === 'PLANT').length;
    const client = entries.filter((entry) => entry.scopeLevel === 'CLIENT').length;
    const site = entries.filter((entry) => entry.scopeLevel === 'SITE').length;
    return { global, plant, client, site };
  }, [entries]);

  const boardroomMetrics = useMemo(() => {
    const totalRecipes = demoMasterRecipes.length;
    const coveredRecipeIds = new Set(entries.map((entry) => entry.recipeId));
    const coveragePct = totalRecipes > 0 ? Number(((coveredRecipeIds.size / totalRecipes) * 100).toFixed(1)) : 0;

    const averageMarginPct =
      entries.length > 0
        ? Number((entries.reduce((acc, entry) => acc + entry.derivedMarginPct, 0) / entries.length).toFixed(2))
        : 0;

    const avgFloorUpliftPct =
      entries.length > 0
        ? Number(
            (
              (entries.reduce((acc, entry) => acc + (entry.floorPrice - entry.baseCost), 0) /
                entries.reduce((acc, entry) => acc + entry.baseCost, 0)) *
              100
            ).toFixed(2)
          )
        : 0;

    const siteSpecificityPct =
      entries.length > 0 ? Number(((scopeMetrics.site / entries.length) * 100).toFixed(1)) : 0;

    const governanceReadiness = (() => {
      if (coveragePct >= 75 && siteSpecificityPct >= 15 && averageMarginPct >= 8) return 'ALTA';
      if (coveragePct >= 45 && averageMarginPct >= 6) return 'MEDIA';
      return 'BAJA';
    })();

    return {
      totalRecipes,
      coveredRecipes: coveredRecipeIds.size,
      coveragePct,
      averageMarginPct,
      avgFloorUpliftPct,
      siteSpecificityPct,
      governanceReadiness,
    };
  }, [entries, scopeMetrics.site]);

  return (
    <Container maxWidth="full" className="py-8 space-y-6">
      <div className="mb-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/prices">Precios</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Demo Corporativo de Lista de Precios</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <header className="glass-thick rounded-2xl p-6 md:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge variant="outline">DEMO CORPORATIVO</Badge>
          <Badge variant="outline">STANDALONE</Badge>
        </div>
        <h1 className="text-large-title font-bold text-label-primary tracking-tight">
          Simulador Ejecutivo de Lista de Precios + Quote Builder
        </h1>
        <p className="text-body text-label-secondary mt-2 max-w-4xl">
          Simula una capa intermedia de precios de lista para recetas maestras (FC/MR) con reglas por alcance
          (global, planta, cliente y obra) y validacion de cotizacion como lo haria el cotizador.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Total pisos</p>
            <p className="text-title-3 text-gray-900">{entries.length}</p>
          </div>
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Global</p>
            <p className="text-title-3 text-gray-900">{scopeMetrics.global}</p>
          </div>
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Planta</p>
            <p className="text-title-3 text-gray-900">{scopeMetrics.plant}</p>
          </div>
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Cliente</p>
            <p className="text-title-3 text-gray-900">{scopeMetrics.client}</p>
          </div>
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Obra</p>
            <p className="text-title-3 text-gray-900">{scopeMetrics.site}</p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="glass-base rounded-xl p-4">
          <p className="text-footnote text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            Cobertura de catalogo
          </p>
          <p className="text-title-3 text-gray-900 mt-1">{boardroomMetrics.coveragePct}%</p>
          <p className="text-xs text-muted-foreground mt-1">
            {boardroomMetrics.coveredRecipes}/{boardroomMetrics.totalRecipes} recetas maestras con piso definido
          </p>
        </div>
        <div className="glass-base rounded-xl p-4">
          <p className="text-footnote text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            Uplift promedio vs costo
          </p>
          <p className="text-title-3 text-gray-900 mt-1">{boardroomMetrics.avgFloorUpliftPct}%</p>
          <p className="text-xs text-muted-foreground mt-1">Margen promedio configurado: {boardroomMetrics.averageMarginPct}%</p>
        </div>
        <div className="glass-base rounded-xl p-4">
          <p className="text-footnote text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-600" />
            Precision comercial
          </p>
          <p className="text-title-3 text-gray-900 mt-1">{boardroomMetrics.siteSpecificityPct}%</p>
          <p className="text-xs text-muted-foreground mt-1">Reglas a nivel obra para control fino por frente</p>
        </div>
        <div className="glass-base rounded-xl p-4">
          <p className="text-footnote text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            Readiness de gobierno
          </p>
          <p className="text-title-3 text-gray-900 mt-1">{boardroomMetrics.governanceReadiness}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Semaforo ejecutivo para adopcion operativa del esquema de pisos
          </p>
        </div>
      </section>

      <Alert>
        <Building2 className="h-4 w-4" />
        <AlertTitle>Modo demo sin impacto operativo</AlertTitle>
        <AlertDescription>
          Este modulo no toca base de datos de negocio. Las reglas se guardan en localStorage para workshop
          ejecutivo y validacion de politica antes de desarrollo productivo.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="executive" className="space-y-4">
        <TabsList className="bg-gray-100/80 p-1 rounded-xl h-auto flex-wrap justify-start w-full">
          <TabsTrigger
            value="executive"
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Setup Ejecutivo
          </TabsTrigger>
          <TabsTrigger
            value="quote-sim"
            className="rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            Simulador Quote Builder
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executive" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ExecutiveSetupPanel
            entries={entries}
            onApplyEntries={(newEntries) => setEntries((prev) => [...newEntries, ...prev])}
            onDeleteEntry={(id) => setEntries((prev) => prev.filter((entry) => entry.id !== id))}
            onClearAll={() => {
              setEntries([]);
              clearEntriesFromLocal();
            }}
          />
        </TabsContent>

        <TabsContent value="quote-sim" className="mt-0 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
          <QuoteBuilderSimulationPanel entries={entries} />
        </TabsContent>
      </Tabs>
    </Container>
  );
}
