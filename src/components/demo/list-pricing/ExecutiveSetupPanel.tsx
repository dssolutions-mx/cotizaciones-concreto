'use client';

import { useMemo, useState } from 'react';
import { Filter, Layers3, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  createBulkEntries,
  demoClients,
  demoMasterRecipes,
  demoPlants,
  demoSites,
  type ListPriceEntry,
  type PricingMode,
  type RecipeFamily,
  type RoundingRule,
  type ScopeLevel,
} from '@/lib/demo/listPricingCorporateDemo';

const mx = (value: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(value);

interface ExecutiveSetupPanelProps {
  entries: ListPriceEntry[];
  onApplyEntries: (entries: ListPriceEntry[]) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
}

export default function ExecutiveSetupPanel({
  entries,
  onApplyEntries,
  onDeleteEntry,
  onClearAll,
}: ExecutiveSetupPanelProps) {
  const [search, setSearch] = useState('');
  const [familyFilter, setFamilyFilter] = useState<'ALL' | RecipeFamily>('ALL');
  const [ageFilter, setAgeFilter] = useState<'ALL' | string>('ALL');
  const [placementFilter, setPlacementFilter] = useState<'ALL' | 'D' | 'B'>('ALL');
  const [mode, setMode] = useState<PricingMode>('MARGIN_OVER_COST');
  const [inputValue, setInputValue] = useState(12);
  const [rounding, setRounding] = useState<RoundingRule>('CEIL_5');
  const [scopeLevel, setScopeLevel] = useState<ScopeLevel>('PLANT');
  const [plantId, setPlantId] = useState(demoPlants[0]?.id ?? '');
  const [clientId, setClientId] = useState(demoClients[0]?.id ?? '');
  const [siteId, setSiteId] = useState(
    demoSites.find((site) => site.clientId === demoClients[0]?.id)?.id ?? demoSites[0]?.id ?? ''
  );

  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return demoMasterRecipes.filter((recipe) => {
      if (familyFilter !== 'ALL' && recipe.family !== familyFilter) return false;
      if (ageFilter !== 'ALL' && String(recipe.ageDays) !== ageFilter) return false;
      if (placementFilter !== 'ALL' && recipe.placement !== placementFilter) return false;
      if (!q) return true;
      return (
        recipe.code.toLowerCase().includes(q) ||
        String(recipe.strength).includes(q) ||
        String(recipe.slump).includes(q)
      );
    });
  }, [ageFilter, familyFilter, placementFilter, search]);

  const selectedScopeSiteOptions = useMemo(
    () => demoSites.filter((site) => !clientId || site.clientId === clientId),
    [clientId]
  );

  const selectedCount = selectedRecipeIds.length;

  const toggleRecipeSelection = (recipeId: string) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
    );
  };

  const selectAllFiltered = () => {
    setSelectedRecipeIds(filteredRecipes.map((recipe) => recipe.id));
  };

  const clearSelection = () => setSelectedRecipeIds([]);

  const applyPolicyPreset = (preset: 'DEFENSIVE' | 'BALANCED' | 'GROWTH') => {
    if (preset === 'DEFENSIVE') {
      setMode('MARGIN_OVER_COST');
      setInputValue(16);
      setRounding('CEIL_5');
      return;
    }
    if (preset === 'BALANCED') {
      setMode('MARGIN_OVER_COST');
      setInputValue(12);
      setRounding('CEIL_5');
      return;
    }
    setMode('MARGIN_OVER_COST');
    setInputValue(8);
    setRounding('NONE');
  };

  const applyPricingRule = () => {
    const selectedRecipes = demoMasterRecipes.filter((recipe) => selectedRecipeIds.includes(recipe.id));
    if (selectedRecipes.length === 0) return;

    const bulk = createBulkEntries({
      recipes: selectedRecipes,
      mode,
      inputValue,
      scopeLevel,
      rounding,
      requireApprovalBelowFloor: true,
      plantId: scopeLevel === 'PLANT' || scopeLevel === 'CLIENT' || scopeLevel === 'SITE' ? plantId : undefined,
      clientId: scopeLevel === 'CLIENT' || scopeLevel === 'SITE' ? clientId : undefined,
      siteId: scopeLevel === 'SITE' ? siteId : undefined,
    });

    onApplyEntries(bulk);
    setSelectedRecipeIds([]);
  };

  return (
    <div className="space-y-5">
      <Card variant="thick" className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-title-3">
            <Layers3 className="w-5 h-5 text-blue-600" />
            Configuracion Ejecutiva de Lista de Precios
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="xl:col-span-2">
              <label className="text-footnote font-semibold text-muted-foreground">Recetas maestras</label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por codigo o fuerza" />
            </div>
            <div>
              <label className="text-footnote font-semibold text-muted-foreground">Familia</label>
              <Select value={familyFilter} onValueChange={(value: 'ALL' | RecipeFamily) => setFamilyFilter(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="FC">FC</SelectItem>
                  <SelectItem value="MR">MR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-footnote font-semibold text-muted-foreground">Edad</label>
              <Select value={ageFilter} onValueChange={setAgeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="28">28 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-footnote font-semibold text-muted-foreground">Colocacion</label>
              <Select value={placementFilter} onValueChange={(value: 'ALL' | 'D' | 'B') => setPlacementFilter(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas</SelectItem>
                  <SelectItem value="D">Directa</SelectItem>
                  <SelectItem value="B">Bombeado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white/60">
            <div className="p-3 flex items-center justify-between border-b border-gray-200">
              <p className="text-sm font-medium text-gray-700">{selectedCount} recetas seleccionadas</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={selectAllFiltered}>Seleccionar filtradas</Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>Limpiar</Button>
              </div>
            </div>
            <div className="max-h-[280px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead />
                    <TableHead>Codigo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Costo base</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipes.map((recipe) => (
                    <TableRow key={recipe.id}>
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedRecipeIds.includes(recipe.id)}
                          onChange={() => toggleRecipeSelection(recipe.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{recipe.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {recipe.family} {recipe.strength} · {recipe.ageDays}d · REV {recipe.slump} · {recipe.placement === 'D' ? 'Directa' : 'Bombeado'}
                        </p>
                      </TableCell>
                      <TableCell>{recipe.placement === 'D' ? 'Directa' : 'Bombeado'}</TableCell>
                      <TableCell className="text-right">{mx(recipe.baseCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card variant="thin" className="border-0">
        <CardHeader>
          <CardTitle className="text-title-3 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-blue-600" />
            Motor de configuracion de pisos
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="xl:col-span-4 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => applyPolicyPreset('DEFENSIVE')}>
              Preset defensivo
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPolicyPreset('BALANCED')}>
              Preset balanceado
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyPolicyPreset('GROWTH')}>
              Preset crecimiento
            </Button>
          </div>
          <div>
            <label className="text-footnote font-semibold text-muted-foreground">Metodo</label>
            <Select value={mode} onValueChange={(value: PricingMode) => setMode(value)}>
              <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MARGIN_OVER_COST">Margen sobre costo</SelectItem>
                <SelectItem value="FINAL_PRICE">Precio final directo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-footnote font-semibold text-muted-foreground">{mode === 'MARGIN_OVER_COST' ? 'Margen %' : 'Precio final MXN'}</label>
            <Input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(parseFloat(e.target.value) || 0)}
              className="bg-white/70"
            />
          </div>
          <div>
            <label className="text-footnote font-semibold text-muted-foreground">Redondeo</label>
            <Select value={rounding} onValueChange={(value: RoundingRule) => setRounding(value)}>
              <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CEIL_5">Subir a multiplo de 5</SelectItem>
                <SelectItem value="NONE">Sin redondeo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-footnote font-semibold text-muted-foreground">Alcance</label>
            <Select value={scopeLevel} onValueChange={(value: ScopeLevel) => setScopeLevel(value)}>
              <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GLOBAL">Global</SelectItem>
                <SelectItem value="PLANT">Planta</SelectItem>
                <SelectItem value="CLIENT">Cliente</SelectItem>
                <SelectItem value="SITE">Cliente + Obra</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(scopeLevel === 'PLANT' || scopeLevel === 'CLIENT' || scopeLevel === 'SITE') && (
            <div>
              <label className="text-footnote font-semibold text-muted-foreground">Planta</label>
              <Select value={plantId} onValueChange={setPlantId}>
                <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {demoPlants.map((plant) => (
                    <SelectItem key={plant.id} value={plant.id}>{plant.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {(scopeLevel === 'CLIENT' || scopeLevel === 'SITE') && (
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
                <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {demoClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {scopeLevel === 'SITE' && (
            <div>
              <label className="text-footnote font-semibold text-muted-foreground">Obra</label>
              <Select value={siteId} onValueChange={setSiteId}>
                <SelectTrigger className="bg-white/70"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {selectedScopeSiteOptions.map((site) => (
                    <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="xl:col-span-4 flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-footnote text-muted-foreground">
              <Filter className="w-4 h-4" />
              Regla aplica a las recetas seleccionadas, con autorizacion obligatoria debajo del piso.
            </div>
            <Button onClick={applyPricingRule} disabled={selectedCount === 0 || inputValue <= 0}>
              Aplicar regla
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="thick" className="border-0">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-title-3">Pisos cargados ({entries.length})</CardTitle>
          <Button variant="destructive" size="sm" onClick={onClearAll}>
            <Trash2 className="w-4 h-4 mr-1" />
            Limpiar demo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="max-h-[280px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receta</TableHead>
                  <TableHead>Alcance</TableHead>
                  <TableHead className="text-right">Piso</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <p className="font-medium">{entry.recipeCode}</p>
                      <p className="text-xs text-muted-foreground">{entry.recipeFamily} · {entry.pricingMode === 'FINAL_PRICE' ? 'Final' : 'Margen'}</p>
                    </TableCell>
                    <TableCell className="text-xs">{entry.scopeLevel}</TableCell>
                    <TableCell className="text-right">{mx(entry.floorPrice)}</TableCell>
                    <TableCell className="text-right">{entry.derivedMarginPct.toFixed(2)}%</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onDeleteEntry(entry.id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Aun no hay pisos configurados</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
