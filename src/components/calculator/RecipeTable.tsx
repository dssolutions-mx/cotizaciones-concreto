import React, { useMemo, useState, memo } from 'react';
import { Eye, EyeOff, Download, Edit2, ToggleLeft, ToggleRight, ChevronRight, ChevronDown } from 'lucide-react';
import { Recipe, Materials, FCROverrides } from '@/types/calculator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RecipeTableProps {
  recipes: Recipe[];
  materials: Materials;
  fcrOverrides: FCROverrides;
  selectedRecipesForExport: Set<string>;
  showDetails: boolean;
  editingFCR: string | null;
  tempFCR: string;
  onToggleDetails: () => void;
  onSaveSelected: () => void;
  onExportArkik: () => void;
  onToggleRecipeSelection: (code: string) => void;
  onToggleAllRecipes: () => void;
  onStartEditingFCR: (code: string, fcr: number) => void;
  onTempFCRChange: (value: string) => void;
  onSaveFCR: (code: string) => void;
  onCancelEditingFCR: () => void;
  // ARKIK code map and change handler for inline override
  arkikCodes?: Record<string, { longCode: string; shortCode: string }>;
  onArkikCodeChange?: (recipeCode: string, newLongCode: string) => void;
}

export const RecipeTable: React.FC<RecipeTableProps> = memo(({
  recipes,
  materials,
  fcrOverrides,
  selectedRecipesForExport,
  showDetails,
  editingFCR,
  tempFCR,
  onToggleDetails,
  onSaveSelected,
  onExportArkik,
  onToggleRecipeSelection,
  onToggleAllRecipes,
  onStartEditingFCR,
  onTempFCRChange,
  onSaveFCR,
  onCancelEditingFCR,
  arkikCodes,
  onArkikCodeChange
}) => {
  const allSelected = recipes.length > 0 && recipes.every(r => selectedRecipesForExport.has(r.code));
  const someSelected = recipes.some(r => selectedRecipesForExport.has(r.code));
  const [showSSS, setShowSSS] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingArkik, setEditingArkik] = useState<string | null>(null);

  // Memoize unique additives calculation to avoid recalculating on every render
  const uniqueAdditives = useMemo(() => {
    if (recipes.length === 0) return [];
    const additiveMap = new Map();
    recipes.forEach(recipe => {
      recipe.calculatedAdditives.forEach(additive => {
        additiveMap.set(additive.id, additive);
      });
    });
    // Sort by ID for consistent column order
    return Array.from(additiveMap.values()).sort((a, b) => a.id - b.id);
  }, [recipes]);
  const totalColumns = useMemo(() => {
    // selection + expand + code + fc + fcr + age + slump + placement + ac
    const fixed = 9;
    const matCols = materials.sands.length + materials.gravels.length + uniqueAdditives.length + 2; // cement + water already included below
    const detailCols = showDetails ? 4 : 0; // unit mass, mortar, mc, cost
    return 1 /* selection */ + 1 /* expand */ + 6 /* code+fc+fcr+age+slump+placement */ + 1 /* ac */ + 2 /* cement+water */ + materials.sands.length + materials.gravels.length + uniqueAdditives.length + detailCols;
  }, [materials.sands.length, materials.gravels.length, uniqueAdditives.length, showDetails]);

  const toggleRow = (code: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const renderExpandedDetails = (recipe: Recipe) => {
    const additivesLiters = recipe.calculatedAdditives.reduce((s, a) => s + a.totalCC / 1000, 0);
    const cementVolume = materials.cement ? (recipe.materialsSSS.cement / materials.cement.density) : 0;
    const sssWater = recipe.materialsSSS.water || 0;
    const dryWater = recipe.materialsDry.water || 0;

    const aggregateRows = [
      ...materials.sands.map((m, idx) => ({
        type: 'sand', label: m.name, absorption: m.absorption, sss: recipe.materialsSSS[`sand${idx}`] || 0, dry: recipe.materialsDry[`sand${idx}`] || 0
      })),
      ...materials.gravels.map((m, idx) => ({
        type: 'gravel', label: m.name, absorption: m.absorption, sss: recipe.materialsSSS[`gravel${idx}`] || 0, dry: recipe.materialsDry[`gravel${idx}`] || 0
      }))
    ];

    const absorptionTotals = aggregateRows.reduce((acc, r) => acc + Math.max(r.sss - r.dry, 0), 0);

    return (
      <div className="p-4 bg-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-gray-500">F'cr:</span> <span className="font-mono font-semibold">{typeof recipe.fcr === 'number' ? recipe.fcr.toFixed(2) : recipe.fcr}</span></div>
          <div><span className="text-gray-500">A/C:</span> <span className="font-mono font-semibold">{recipe.acRatio.toFixed(2)}</span></div>
          <div><span className="text-gray-500">Agua SSS:</span> <span className="font-mono font-semibold">{sssWater} L</span></div>
          <div><span className="text-gray-500">Agua Seco:</span> <span className="font-mono font-semibold">{dryWater} L</span></div>
          <div><span className="text-gray-500">Vol MC:</span> <span className="font-mono font-semibold">{recipe.volumes.mcVolume} L</span></div>
          <div><span className="text-gray-500">Vol Mortero:</span> <span className="font-mono font-semibold">{recipe.volumes.mortar} L</span></div>
          <div><span className="text-gray-500">Vol Arena:</span> <span className="font-mono font-semibold">{recipe.volumes.sand} L</span></div>
          <div><span className="text-gray-500">Vol Grava:</span> <span className="font-mono font-semibold">{recipe.volumes.gravel} L</span></div>
          <div><span className="text-gray-500">Vol Aire:</span> <span className="font-mono font-semibold">{recipe.volumes.air} L</span></div>
          <div><span className="text-gray-500">Vol Aditivos:</span> <span className="font-mono font-semibold">{additivesLiters.toFixed(2)} L</span></div>
        </div>

        <div className="mt-4">
          <div className="text-sm font-semibold mb-2">Arenas y Gravas: SSD vs Seco</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
            {aggregateRows.map((r, i) => (
              <div key={i} className="p-2 rounded border bg-gray-50">
                <div className="font-medium">{r.label}</div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">SSD:</span>
                  <span className="font-mono">{r.sss || '-'} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Seco:</span>
                  <span className="font-mono">{r.dry || '-'} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Absorción:</span>
                  <span className="font-mono">{(r.absorption ?? 0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Agua absorción:</span>
                  <span className="font-mono">{Math.max(r.sss - r.dry, 0)} L</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-right text-xs text-gray-700 mt-2">Σ Agua absorción: <span className="font-mono font-semibold">{absorptionTotals} L</span></div>
        </div>
      </div>
    );
  };

  // Helper function to get additive value by ID from a recipe
  const getAdditiveValueById = (recipe: Recipe, additiveId: number, materialsToShow: any) => {
    // Find the additive in the recipe's calculatedAdditives by ID
    const calculatedAdditive = recipe.calculatedAdditives.find(additive => additive.id === additiveId);
    if (!calculatedAdditive) {
      return 0;
    }
    
    // Find the index of this additive in the calculatedAdditives array
    const additiveIndex = recipe.calculatedAdditives.findIndex(additive => additive.id === additiveId);
    if (additiveIndex >= 0) {
      const value = materialsToShow[`additive${additiveIndex}`];
      return value ? parseFloat(value) : 0;
    }
    return 0;
  };

  const formatMaterialName = (key: string): string => {
    if (key === 'cement') return materials.cement.name;
    if (key === 'water') return 'AGUA';
    
    if (key.startsWith('sand')) {
      const idx = parseInt(key.replace('sand', ''));
      return materials.sands[idx]?.name || key;
    }
    
    if (key.startsWith('gravel')) {
      const idx = parseInt(key.replace('gravel', ''));
      return materials.gravels[idx]?.name || key;
    }
    
    if (key.startsWith('additive')) {
      const idx = parseInt(key.replace('additive', ''));
      return materials.additives[idx]?.name || key;
    }
    
    return key;
  };

  const getResistanceColor = (strength: number) => {
    if (strength <= 150) return 'border-l-green-400 bg-green-50';
    if (strength <= 250) return 'border-l-blue-400 bg-blue-50';
    if (strength <= 350) return 'border-l-orange-400 bg-orange-50';
    return 'border-l-red-400 bg-red-50';
  };

  const groupRecipesByStrength = (recipes: Recipe[]) => {
    return recipes.reduce((groups, recipe) => {
      const strength = recipe.strength;
      if (!groups[strength]) {
        groups[strength] = [];
      }
      groups[strength].push(recipe);
      return groups;
    }, {} as Record<number, Recipe[]>);
  };

  const groupedRecipes = groupRecipesByStrength(recipes);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onToggleDetails}
            className="flex items-center gap-2"
          >
            {showDetails ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showDetails ? 'Ocultar Detalles' : 'Mostrar Detalles'}
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSSS(!showSSS)}
            className="flex items-center gap-2"
          >
            {showSSS ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
            {showSSS ? 'SSS' : 'Seco'}
          </Button>
          
          <div className="text-sm text-gray-600">
            Mostrando pesos en estado: <strong>{showSSS ? 'Saturado Superficie Seca (SSS)' : 'Seco'}</strong>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={onSaveSelected}
            disabled={selectedRecipesForExport.size === 0}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Guardar en sistema ({selectedRecipesForExport.size})
          </Button>
          <Button
            onClick={onExportArkik}
            disabled={selectedRecipesForExport.size === 0}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar ARKIK
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAllRecipes}
                />
              </TableHead>
              <TableHead className="w-10" />
              <TableHead>Código</TableHead>
              <TableHead className="text-center">F'c/MR</TableHead>
              <TableHead className="text-center">F'cr</TableHead>
              <TableHead className="text-center">Edad</TableHead>
              <TableHead className="text-center">Rev.</TableHead>
              <TableHead className="text-center">Coloc.</TableHead>
              <TableHead className="text-center">A/C</TableHead>
              
              {/* Material columns */}
              <TableHead className="text-center bg-blue-50">
                Cemento<br/>
                <span className="text-xs text-gray-600">(kg)</span>
              </TableHead>
              <TableHead className="text-center bg-blue-50">
                Agua Total<br/>
                <span className="text-xs text-gray-600">(L)</span>
              </TableHead>
              
              {materials.sands.map((sand, idx) => (
                <TableHead key={`sand-${idx}`} className="text-center bg-yellow-50">
                  {sand.name}<br/>
                  <span className="text-xs text-gray-600">(kg)</span>
                </TableHead>
              ))}
              
              {materials.gravels.map((gravel, idx) => (
                <TableHead key={`gravel-${idx}`} className="text-center bg-gray-100">
                  {gravel.name}<br/>
                  <span className="text-xs text-gray-600">(kg)</span>
                </TableHead>
              ))}
              
              {/* Show all unique additives for consistent columns */}
              {uniqueAdditives.map((additive) => (
                <TableHead key={`additive-${additive.id}`} className="text-center bg-green-50">
                  {additive.name}<br/>
                  <span className="text-xs text-gray-600">(L)</span>
                </TableHead>
              ))}
              
              {showDetails && (
                <>
                  <TableHead className="text-center">
                    Masa Unitaria<br/>
                    <span className="text-xs text-gray-600">(kg/m³)</span>
                  </TableHead>
                  <TableHead className="text-center">
                    Vol. Mortero<br/>
                    <span className="text-xs text-gray-600">(L/m³)</span>
                  </TableHead>
                  <TableHead className="text-center">
                    MC<br/>
                    <span className="text-xs text-gray-600">(%)</span>
                  </TableHead>
                  <TableHead className="text-center">
                    Costo<br/>
                    <span className="text-xs text-gray-600">($/m³)</span>
                  </TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          
          <TableBody>
            {Object.entries(groupedRecipes).map(([strength, strengthRecipes]) => {
              const resistanceColor = getResistanceColor(parseInt(strength));
              return (
                <React.Fragment key={`strength-${strength}`}>
                  {/* Strength Header Row */}
                  <TableRow className={`${resistanceColor} border-l-4`}>
                    <TableCell>
                      <Checkbox
                        checked={strengthRecipes.every(r => selectedRecipesForExport.has(r.code)) && strengthRecipes.length > 0}
                        onCheckedChange={(checked) => {
                          strengthRecipes.forEach(recipe => {
                            if (checked) {
                              if (!selectedRecipesForExport.has(recipe.code)) {
                                onToggleRecipeSelection(recipe.code);
                              }
                            } else {
                              if (selectedRecipesForExport.has(recipe.code)) {
                                onToggleRecipeSelection(recipe.code);
                              }
                            }
                          });
                        }}
                        className="cursor-pointer"
                      />
                    </TableCell>
                    <TableCell colSpan={totalColumns - 1}>
                      <div className="flex items-center gap-2 py-1">
                        <div className="font-bold text-lg">F'c = {strength} kg/cm²</div>
                        <div className="text-sm text-gray-600">({strengthRecipes.length} receta{strengthRecipes.length > 1 ? 's' : ''})</div>
                        <div className="text-xs text-gray-500 ml-2">
                          ({strengthRecipes.filter(r => selectedRecipesForExport.has(r.code)).length} seleccionada{strengthRecipes.filter(r => selectedRecipesForExport.has(r.code)).length !== 1 ? 's' : ''})
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Recipe Rows for this strength */}
                  {strengthRecipes.map((recipe) => {
                    const materialsToShow = showSSS ? recipe.materialsSSS : recipe.materialsDry;
                    return (
                      <React.Fragment key={`recipe-${recipe.code}`}>
                      <TableRow key={`${recipe.code}-main`} className={`hover:bg-gray-50 ${resistanceColor.split('bg-')[1]}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRecipesForExport.has(recipe.code)}
                            onCheckedChange={() => onToggleRecipeSelection(recipe.code)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <button onClick={() => toggleRow(recipe.code)} className="p-1 rounded hover:bg-gray-100">
                            {expandedRows.has(recipe.code) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </TableCell>
                        
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-1">
                            {editingArkik === recipe.code ? (
                              <input
                                autoFocus
                                value={arkikCodes?.[recipe.code]?.longCode || ''}
                                onChange={(e) => onArkikCodeChange && onArkikCodeChange(recipe.code, e.target.value)}
                                className="font-mono text-xs border rounded px-1 py-0.5 flex-1 min-w-[200px]"
                                onBlur={() => setEditingArkik(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') setEditingArkik(null);
                                  if (e.key === 'Escape') setEditingArkik(null);
                                }}
                              />
                            ) : (
                              <span
                                className="cursor-pointer hover:text-blue-600 flex-1 truncate max-w-[240px]"
                                title={arkikCodes?.[recipe.code]?.longCode}
                                onClick={() => setEditingArkik(recipe.code)}
                              >
                                {arkikCodes?.[recipe.code]?.longCode || recipe.code}
                              </span>
                            )}
                            {editingArkik !== recipe.code && (
                              <Edit2 className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{recipe.strength}</TableCell>
                        
                        <TableCell className="text-center">
                          {editingFCR === recipe.code ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                value={tempFCR}
                                onChange={(e) => onTempFCRChange(e.target.value)}
                                className="w-20 h-7 text-center"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') onSaveFCR(recipe.code);
                                  if (e.key === 'Escape') onCancelEditingFCR();
                                }}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onSaveFCR(recipe.code)}
                                className="h-7 w-7 p-0"
                              >
                                ✓
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={onCancelEditingFCR}
                                className="h-7 w-7 p-0"
                              >
                                ✕
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <span className={fcrOverrides[recipe.code] ? 'font-bold text-blue-600' : ''}>
                                {typeof recipe.fcr === 'number' ? recipe.fcr.toFixed(2) : recipe.fcr}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onStartEditingFCR(recipe.code, recipe.fcr)}
                                className="h-5 w-5 p-0 opacity-50 hover:opacity-100"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        
                        <TableCell className="text-center">{recipe.age}{recipe.ageUnit}</TableCell>
                        <TableCell className="text-center">{recipe.slump}cm</TableCell>
                        <TableCell className="text-center">{recipe.placement}</TableCell>
                        <TableCell className="text-center">{recipe.acRatio.toFixed(2)}</TableCell>
                        
                        {/* Material quantities */}
                        <TableCell className="text-center bg-blue-50 font-mono">
                          {materialsToShow.cement}
                        </TableCell>
                        <TableCell className="text-center bg-blue-50 font-mono">
                          {materialsToShow.water}
                        </TableCell>
                        
                        {materials.sands.map((_, idx) => (
                          <TableCell key={`sand-${idx}`} className="text-center bg-yellow-50 font-mono">
                            {materialsToShow[`sand${idx}`] || '-'}
                          </TableCell>
                        ))}
                        
                        {materials.gravels.map((_, idx) => (
                          <TableCell key={`gravel-${idx}`} className="text-center bg-gray-100 font-mono">
                            {materialsToShow[`gravel${idx}`] || '-'}
                          </TableCell>
                        ))}
                        
                        {uniqueAdditives.map((additive) => {
                          const value = getAdditiveValueById(recipe, additive.id, materialsToShow);
                          return (
                            <TableCell key={`additive-${additive.id}`} className="text-center bg-green-50 font-mono">
                              {value > 0 ? value.toFixed(3) : '-'}
                            </TableCell>
                          );
                        })}
                        
                        {showDetails && (
                          <>
                            <TableCell className="text-center font-mono">
                              {showSSS ? recipe.unitMass.sss : recipe.unitMass.dry}
                            </TableCell>
                            <TableCell className="text-center font-mono">{recipe.volumes.mortar || '-'}</TableCell>
                            <TableCell className="text-center font-mono">{recipe.volumes.mc || '-'}%</TableCell>
                            <TableCell className="text-center font-semibold">
                              ${recipe.costs.total.toFixed(2)}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                      {expandedRows.has(recipe.code) && (
                        <TableRow key={`${recipe.code}-expanded`}>
                          <TableCell colSpan={totalColumns}>
                            {renderExpandedDetails(recipe)}
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {recipes.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total de recetas:</span>
              <span className="ml-2 font-semibold">{recipes.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Seleccionadas:</span>
              <span className="ml-2 font-semibold">{selectedRecipesForExport.size}</span>
            </div>
            <div>
              <span className="text-gray-600">Costo promedio:</span>
              <span className="ml-2 font-semibold">
                ${(recipes.reduce((sum, r) => sum + r.costs.total, 0) / recipes.length).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Rango A/C:</span>
              <span className="ml-2 font-semibold">
                {Math.min(...recipes.map(r => r.acRatio)).toFixed(2)} - 
                {Math.max(...recipes.map(r => r.acRatio)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});