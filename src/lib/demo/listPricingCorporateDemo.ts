export type RecipeFamily = 'FC' | 'MR';
export type PlacementType = 'D' | 'B';
export type PricingMode = 'MARGIN_OVER_COST' | 'FINAL_PRICE';
export type ScopeLevel = 'GLOBAL' | 'PLANT' | 'CLIENT' | 'SITE';
export type RoundingRule = 'NONE' | 'CEIL_5';

export interface DemoMasterRecipe {
  id: string;
  code: string;
  family: RecipeFamily;
  strength: number;
  ageDays: number;
  placement: PlacementType;
  slump: number;
  tmaFactor: '2' | '4';
  baseCost: number;
}

export interface DemoPlant {
  id: string;
  name: string;
}

export interface DemoClient {
  id: string;
  name: string;
}

export interface DemoSite {
  id: string;
  clientId: string;
  name: string;
}

export interface ListPriceEntry {
  id: string;
  recipeId: string;
  recipeCode: string;
  recipeFamily: RecipeFamily;
  floorPrice: number;
  baseCost: number;
  pricingMode: PricingMode;
  inputValue: number;
  derivedMarginPct: number;
  scopeLevel: ScopeLevel;
  plantId?: string;
  clientId?: string;
  siteId?: string;
  rounding: RoundingRule;
  requireApprovalBelowFloor: boolean;
  updatedAt: string;
}

export interface QuoteLineSimulation {
  id: string;
  recipeId: string;
  volume: number;
  quotedPrice: number;
}

export interface ResolvedFloorResult {
  floorPrice: number;
  source: 'SITE' | 'CLIENT' | 'PLANT' | 'GLOBAL';
  entryId: string;
}

const storageKey = 'demo.corporate-list-prices.v1';

const roundTo = (value: number, rounding: RoundingRule): number => {
  if (rounding === 'CEIL_5') return Math.ceil(value / 5) * 5;
  return Number(value.toFixed(2));
};

const computeBaseCost = (family: RecipeFamily, strength: number, ageDays: number, placement: PlacementType): number => {
  const familyBase = family === 'FC' ? 1350 : 1850;
  const strengthFactor = family === 'FC' ? (strength - 100) * 2.3 : (strength - 36) * 18;
  const agePremium = ageDays === 28 ? 0 : ageDays === 14 ? 90 : ageDays === 7 ? 150 : 230;
  const placementPremium = placement === 'B' ? 55 : 0;
  return Number((familyBase + strengthFactor + agePremium + placementPremium).toFixed(2));
};

const generateMasterCode = (recipe: {
  family: RecipeFamily;
  strength: number;
  ageDays: number;
  slump: number;
  placement: PlacementType;
  tmaFactor: '2' | '4';
}) => {
  const age = String(recipe.ageDays).padStart(2, '0');
  const slump = String(recipe.slump).padStart(2, '0');
  const prefix = recipe.family === 'FC' ? (recipe.placement === 'D' ? '6' : '5') : 'P';
  return `${prefix}-${recipe.strength}-${recipe.tmaFactor}-B-${age}-${slump}-${recipe.placement}`;
};

export const demoPlants: DemoPlant[] = [
  { id: 'plant-silao', name: 'Planta Silao' },
  { id: 'plant-leon', name: 'Planta Leon' },
];

export const demoClients: DemoClient[] = [
  { id: 'cli-marabis', name: 'Desarrolladora Marabis' },
  { id: 'cli-bajio', name: 'Constructora Bajio' },
  { id: 'cli-industrial', name: 'Industrial Del Centro' },
];

export const demoSites: DemoSite[] = [
  { id: 'site-ikd2', clientId: 'cli-marabis', name: 'IKD2 - Torres Norte' },
  { id: 'site-puerto', clientId: 'cli-bajio', name: 'Puerto Interior - Fase 2' },
  { id: 'site-corporativo', clientId: 'cli-industrial', name: 'Parque Corporativo Poniente' },
];

const fcCombos = [100, 150, 200, 250, 300, 350].flatMap((strength) =>
  [28, 14, 7, 3].flatMap((ageDays) =>
    [
      { placement: 'D' as PlacementType, slump: 10, tmaFactor: '2' as const },
      { placement: 'B' as PlacementType, slump: 14, tmaFactor: '2' as const },
    ].map((cfg) => ({ family: 'FC' as RecipeFamily, strength, ageDays, ...cfg }))
  )
);

const mrCombos = [36, 40, 45].flatMap((strength) =>
  [28, 14, 7, 3].flatMap((ageDays) =>
    [
      { placement: 'D' as PlacementType, slump: 8, tmaFactor: '4' as const },
      { placement: 'B' as PlacementType, slump: 14, tmaFactor: '4' as const },
    ].map((cfg) => ({ family: 'MR' as RecipeFamily, strength, ageDays, ...cfg }))
  )
);

export const demoMasterRecipes: DemoMasterRecipe[] = [...fcCombos, ...mrCombos].map((combo, index) => {
  const code = generateMasterCode(combo);
  return {
    id: `mr-${index + 1}`,
    code,
    family: combo.family,
    strength: combo.strength,
    ageDays: combo.ageDays,
    placement: combo.placement,
    slump: combo.slump,
    tmaFactor: combo.tmaFactor,
    baseCost: computeBaseCost(combo.family, combo.strength, combo.ageDays, combo.placement),
  };
});

export const computeFloorPrice = (
  recipe: DemoMasterRecipe,
  mode: PricingMode,
  inputValue: number,
  rounding: RoundingRule
) => {
  if (mode === 'MARGIN_OVER_COST') {
    const margin = Number(inputValue) || 0;
    const raw = recipe.baseCost * (1 + margin / 100);
    const floor = roundTo(raw, rounding);
    return {
      floorPrice: floor,
      derivedMarginPct: Number((((floor / recipe.baseCost) - 1) * 100).toFixed(2)),
    };
  }

  const final = roundTo(Number(inputValue) || 0, rounding);
  return {
    floorPrice: final,
    derivedMarginPct: Number((((final / recipe.baseCost) - 1) * 100).toFixed(2)),
  };
};

export const createBulkEntries = ({
  recipes,
  mode,
  inputValue,
  scopeLevel,
  rounding,
  requireApprovalBelowFloor,
  plantId,
  clientId,
  siteId,
}: {
  recipes: DemoMasterRecipe[];
  mode: PricingMode;
  inputValue: number;
  scopeLevel: ScopeLevel;
  rounding: RoundingRule;
  requireApprovalBelowFloor: boolean;
  plantId?: string;
  clientId?: string;
  siteId?: string;
}): ListPriceEntry[] => {
  const now = new Date().toISOString();
  return recipes.map((recipe) => {
    const computed = computeFloorPrice(recipe, mode, inputValue, rounding);
    return {
      id: `lp-${recipe.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      recipeId: recipe.id,
      recipeCode: recipe.code,
      recipeFamily: recipe.family,
      floorPrice: computed.floorPrice,
      baseCost: recipe.baseCost,
      pricingMode: mode,
      inputValue,
      derivedMarginPct: computed.derivedMarginPct,
      scopeLevel,
      plantId: scopeLevel === 'PLANT' || scopeLevel === 'CLIENT' || scopeLevel === 'SITE' ? plantId : undefined,
      clientId: scopeLevel === 'CLIENT' || scopeLevel === 'SITE' ? clientId : undefined,
      siteId: scopeLevel === 'SITE' ? siteId : undefined,
      rounding,
      requireApprovalBelowFloor,
      updatedAt: now,
    };
  });
};

export const resolveFloorForQuote = (
  entries: ListPriceEntry[],
  recipeId: string,
  scope: { plantId?: string; clientId?: string; siteId?: string }
): ResolvedFloorResult | null => {
  const recipeEntries = entries
    .filter((entry) => entry.recipeId === recipeId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const siteMatch = recipeEntries.find(
    (entry) =>
      entry.scopeLevel === 'SITE' &&
      entry.plantId === scope.plantId &&
      entry.clientId === scope.clientId &&
      entry.siteId === scope.siteId
  );
  if (siteMatch) return { floorPrice: siteMatch.floorPrice, source: 'SITE', entryId: siteMatch.id };

  const clientMatch = recipeEntries.find(
    (entry) => entry.scopeLevel === 'CLIENT' && entry.plantId === scope.plantId && entry.clientId === scope.clientId
  );
  if (clientMatch) return { floorPrice: clientMatch.floorPrice, source: 'CLIENT', entryId: clientMatch.id };

  const plantMatch = recipeEntries.find(
    (entry) => entry.scopeLevel === 'PLANT' && entry.plantId === scope.plantId
  );
  if (plantMatch) return { floorPrice: plantMatch.floorPrice, source: 'PLANT', entryId: plantMatch.id };

  const globalMatch = recipeEntries.find((entry) => entry.scopeLevel === 'GLOBAL');
  if (globalMatch) return { floorPrice: globalMatch.floorPrice, source: 'GLOBAL', entryId: globalMatch.id };

  return null;
};

export const quoteDecision = (quotedPrice: number, floor: ResolvedFloorResult | null) => {
  if (!floor) {
    return {
      status: 'NO_FLOOR' as const,
      requiresApproval: true,
      delta: null,
      deltaPct: null,
    };
  }

  const delta = Number((quotedPrice - floor.floorPrice).toFixed(2));
  const deltaPct = floor.floorPrice > 0 ? Number(((delta / floor.floorPrice) * 100).toFixed(2)) : 0;

  if (Math.abs(delta) < 0.01) {
    return { status: 'ON_FLOOR' as const, requiresApproval: false, delta, deltaPct };
  }

  if (delta > 0) {
    return { status: 'ABOVE_FLOOR' as const, requiresApproval: false, delta, deltaPct };
  }

  return { status: 'BELOW_FLOOR' as const, requiresApproval: true, delta, deltaPct };
};

export const loadEntriesFromLocal = (): ListPriceEntry[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ListPriceEntry[];
  } catch {
    return [];
  }
};

export const saveEntriesToLocal = (entries: ListPriceEntry[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey, JSON.stringify(entries));
};

export const clearEntriesFromLocal = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey);
};
