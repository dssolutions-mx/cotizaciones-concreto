'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LineChart, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  demoClients,
  demoMasterRecipes,
  demoPlants,
  demoSites,
  quoteDecision,
  resolveFloorForQuote,
  type ListPriceEntry,
  type QuoteLineSimulation,
} from '@/lib/demo/listPricingCorporateDemo';

const mx = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(value);

interface QuoteBuilderSimulationPanelProps {
  entries: ListPriceEntry[];
}

const emptyLine = (): QuoteLineSimulation => ({
  id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  recipeId: demoMasterRecipes[0]?.id ?? '',
  volume: 1,
  quotedPrice: demoMasterRecipes[0]?.baseCost ?? 0,
});

export default function QuoteBuilderSimulationPanel({ entries }: QuoteBuilderSimulationPanelProps) {
  const [plantId, setPlantId] = useState(demoPlants[0]?.id ?? '');
  const [clientId, setClientId] = useState(demoClients[0]?.id ?? '');
  const [siteId, setSiteId] = useState(demoSites.find((site) => site.clientId === demoClients[0]?.id)?.id ?? '');
  const [lines, setLines] = useState<QuoteLineSimulation[]>([emptyLine()]);

  const siteOptions = useMemo(
    () => demoSites.filter((site) => site.clientId === clientId),
    [clientId]
  );

  const evaluatedLines = useMemo(() => {
    return lines.map((line) => {
      const recipe = demoMasterRecipes.find((item) => item.id === line.recipeId);
      const resolved = resolveFloorForQuote(entries, line.recipeId, { plantId, clientId, siteId });
      const decision = quoteDecision(line.quotedPrice, resolved);
      const lineTotal = line.quotedPrice * line.volume;
      return { line, recipe, resolved, decision, lineTotal };
    });
  }, [clientId, entries, lines, plantId, siteId]);

  const summary = useMemo(() => {
    const requiresApproval = evaluatedLines.filter((item) => item.decision.requiresApproval).length;
    const total = evaluatedLines.reduce((sum, item) => sum + item.lineTotal, 0);
    const approvalVolume = evaluatedLines
      .filter((item) => item.decision.requiresApproval)
      .reduce((sum, item) => sum + item.line.volume, 0);
    const protectedRevenue = evaluatedLines
      .filter((item) => item.decision.delta !== null && item.decision.delta < 0)
      .reduce((sum, item) => sum + Math.abs(item.decision.delta || 0) * item.line.volume, 0);
    const approvalRatio = evaluatedLines.length > 0 ? Number(((requiresApproval / evaluatedLines.length) * 100).toFixed(1)) : 0;
    return { requiresApproval, total, lines: evaluatedLines.length, approvalVolume, protectedRevenue, approvalRatio };
  }, [evaluatedLines]);

  const updateLine = (lineId: string, patch: Partial<QuoteLineSimulation>) => {
    setLines((prev) => prev.map((line) => (line.id === lineId ? { ...line, ...patch } : line)));
  };

  return (
    <div className="space-y-5">
      <Card variant="thick" className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title-3">
            <LineChart className="w-5 h-5 text-blue-600" />
            Simulador de Quote Builder con pisos de lista
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-footnote font-semibold text-muted-foreground">Planta</label>
            <Select value={plantId} onValueChange={setPlantId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {demoPlants.map((plant) => (
                  <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-footnote font-semibold text-muted-foreground">Cliente</label>
            <Select
              value={clientId}
              onValueChange={(value) => {
                setClientId(value);
                const firstSite = demoSites.find((site) => site.clientId === value);
                if (firstSite) setSiteId(firstSite.id);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {demoClients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-footnote font-semibold text-muted-foreground">Obra</label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {siteOptions.map((site) => (
                  <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card variant="thick" className="border-0">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-title-3">Lineas de cotizacion ({lines.length})</CardTitle>
          <Button
            variant="secondary"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
          >
            <Plus className="w-4 h-4 mr-1" />
            Agregar linea
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[360px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receta</TableHead>
                  <TableHead className="text-right">Volumen</TableHead>
                  <TableHead className="text-right">Cotizado</TableHead>
                  <TableHead className="text-right">Piso resuelto</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluatedLines.map(({ line, recipe, resolved, decision }) => (
                  <TableRow key={line.id}>
                    <TableCell className="min-w-[240px]">
                      <Select
                        value={line.recipeId}
                        onValueChange={(recipeId) => {
                          const selected = demoMasterRecipes.find((item) => item.id === recipeId);
                          updateLine(line.id, {
                            recipeId,
                            quotedPrice: selected?.baseCost ?? line.quotedPrice,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {demoMasterRecipes.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {recipe?.placement === 'D' ? 'Directa' : 'Bombeado'} · Costo referencia: {mx(recipe?.baseCost || 0)}
                      </p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={line.volume}
                        onChange={(e) => updateLine(line.id, { volume: parseFloat(e.target.value) || 0 })}
                        className="w-[92px] ml-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        value={line.quotedPrice}
                        onChange={(e) => updateLine(line.id, { quotedPrice: parseFloat(e.target.value) || 0 })}
                        className="w-[140px] ml-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {resolved ? (
                        <div>
                          <p className="font-semibold">{mx(resolved.floorPrice)}</p>
                          <p className="text-xs text-muted-foreground">{resolved.source}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin piso</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {decision.requiresApproval ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-1 text-xs font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Requiere autorizacion
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-1 text-xs font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Autoaprobada
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLines((prev) => prev.filter((item) => item.id !== line.id))}
                        disabled={lines.length === 1}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card variant="thin" className="border-0">
        <CardHeader>
          <CardTitle className="text-title-3">Resultado ejecutivo del simulador</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Lineas evaluadas</p>
            <p className="text-title-3 text-gray-900">{summary.lines}</p>
          </div>
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Lineas que requieren autorizacion</p>
            <p className="text-title-3 text-gray-900">{summary.requiresApproval}</p>
          </div>
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Total cotizado</p>
            <p className="text-title-3 text-gray-900">{mx(summary.total)}</p>
          </div>
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Volumen sujeto a aprobacion</p>
            <p className="text-title-3 text-gray-900">{summary.approvalVolume.toFixed(2)} m3</p>
          </div>
          <div className="glass-base rounded-xl p-3">
            <p className="text-footnote text-muted-foreground">Ingreso protegido por piso</p>
            <p className="text-title-3 text-gray-900">{mx(summary.protectedRevenue)}</p>
          </div>
        </CardContent>
      </Card>

      <Card variant="thick" className="border-0">
        <CardHeader>
          <CardTitle className="text-title-3">Lectura para comite comercial</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white/60 p-3">
            <p className="text-footnote text-muted-foreground">Nivel de excepcion</p>
            <p className="text-title-3 text-gray-900 mt-1">
              {summary.approvalRatio >= 40 ? 'ALTO' : summary.approvalRatio >= 20 ? 'MEDIO' : 'BAJO'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{summary.approvalRatio}% de lineas requieren autorizacion</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white/60 p-3">
            <p className="text-footnote text-muted-foreground">Disciplina de precio</p>
            <p className="text-title-3 text-gray-900 mt-1">
              {summary.requiresApproval === 0 ? 'CONTROLADA' : 'MONITOREAR'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Las desviaciones bajo piso se canalizan al flujo de autorizacion.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white/60 p-3">
            <p className="text-footnote text-muted-foreground">Mensaje ejecutivo</p>
            <p className="text-sm text-gray-900 mt-1 leading-relaxed">
              El modelo desacopla costo tecnico y precio comercial, fijando un minimo gobernado por alcance y
              preservando margen con trazabilidad de excepciones.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
