import { supabase } from '@/lib/supabase/client';
import { calculateBasePrice, calculateBasePriceBreakdown, calculateMaterialCostOnly, getMaterialLineItems, type MaterialLineItem } from '@/lib/utils/priceCalculator';

export type { MaterialLineItem };

export interface MaterialBreakdown {
  materialCost: number;
  administrativeCosts: number;
  total: number;
}

interface MasterVariantRow {
  master_id: string;
  variant_id: string;
}

interface RecipeRow {
  id: string;
  master_recipe_id: string;
  created_at: string | null;
}

export interface MasterRecipeRow {
  id: string;
  master_code: string;
  display_name: string | null;
  strength_fc: number;
  age_days: number | null;
  age_hours: number | null;
  placement_type: string;
  slump: number;
  max_aggregate_size: number | null;
  plant_id: string;
}

export interface PricingFamily {
  key: string;
  strengthFc: number;
  ageLabel: string;
  ageDays: number | null;
  ageHours: number | null;
  masters: MasterRecipeRow[];
  anchorMasterId: string | null;
  slumpValues: number[];
  placements: string[];
}

/**
 * Resolves the preferred recipe variant for a set of master IDs.
 * First tries master_quotebuilder_variant view; falls back to most recent recipe.
 */
async function resolveVariantByMaster(masterIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (masterIds.length === 0) return result;

  const { data: preferredRows, error: preferredError } = await supabase
    .from('master_quotebuilder_variant')
    .select('master_id, variant_id')
    .in('master_id', masterIds);

  if (!preferredError && preferredRows) {
    (preferredRows as MasterVariantRow[]).forEach((row) => {
      if (row.master_id && row.variant_id) {
        result.set(row.master_id, row.variant_id);
      }
    });
  }

  const unresolvedIds = masterIds.filter((id) => !result.has(id));
  if (unresolvedIds.length === 0) return result;

  const { data: recipesRows, error: recipesError } = await supabase
    .from('recipes')
    .select('id, master_recipe_id, created_at')
    .in('master_recipe_id', unresolvedIds)
    .order('created_at', { ascending: false });

  if (recipesError || !recipesRows) return result;

  const grouped = new Map<string, RecipeRow[]>();
  (recipesRows as RecipeRow[]).forEach((row) => {
    if (!grouped.has(row.master_recipe_id)) grouped.set(row.master_recipe_id, []);
    grouped.get(row.master_recipe_id)!.push(row);
  });

  grouped.forEach((rows, masterId) => {
    if (rows[0]?.id && !result.has(masterId)) result.set(masterId, rows[0].id);
  });

  return result;
}

function buildAgeLabel(master: MasterRecipeRow): string {
  if (master.age_days != null) return `${master.age_days} días`;
  if (master.age_hours != null) return `${master.age_hours} horas`;
  return '28 días';
}

/**
 * Groups master recipes into pricing families.
 * A family = same (strength_fc + age_label).
 * Within each family, masters are ordered by placement_type asc + slump asc.
 * The "anchor" master is DIRECTO + lowest slump in the family.
 */
export function groupMastersIntoFamilies(masters: MasterRecipeRow[]): PricingFamily[] {
  const familyMap = new Map<string, PricingFamily>();

  masters.forEach((m) => {
    const ageLabel = buildAgeLabel(m);
    const key = `${m.strength_fc}-${ageLabel}`;

    if (!familyMap.has(key)) {
      familyMap.set(key, {
        key,
        strengthFc: m.strength_fc,
        ageLabel,
        ageDays: m.age_days,
        ageHours: m.age_hours,
        masters: [],
        anchorMasterId: null,
        slumpValues: [],
        placements: [],
      });
    }

    const family = familyMap.get(key)!;
    family.masters.push(m);

    if (!family.slumpValues.includes(m.slump)) {
      family.slumpValues.push(m.slump);
    }

    const pt = m.placement_type.toUpperCase();
    if (!family.placements.includes(pt)) {
      family.placements.push(pt);
    }
  });

  familyMap.forEach((family) => {
    // Sort masters: DIRECTO first, then by slump ascending
    family.masters.sort((a, b) => {
      const ptA = a.placement_type.toUpperCase();
      const ptB = b.placement_type.toUpperCase();
      if (ptA.startsWith('D') && !ptB.startsWith('D')) return -1;
      if (!ptA.startsWith('D') && ptB.startsWith('D')) return 1;
      return a.slump - b.slump;
    });

    family.slumpValues.sort((a, b) => a - b);
    family.placements.sort((a, b) => {
      if (a.startsWith('D') && !b.startsWith('D')) return -1;
      if (!a.startsWith('D') && b.startsWith('D')) return 1;
      return a.localeCompare(b);
    });

    // Anchor = DIRECTO + lowest slump, else just first master
    const anchor =
      family.masters.find(
        (m) => m.placement_type.toUpperCase().startsWith('D') && m.slump === family.slumpValues[0]
      ) ?? family.masters[0];

    family.anchorMasterId = anchor?.id ?? null;
  });

  return Array.from(familyMap.values()).sort((a, b) => {
    if (b.strengthFc !== a.strengthFc) return b.strengthFc - a.strengthFc;
    // Sort by age descending: convert everything to hours for comparison.
    // age_days takes precedence; age_hours as fallback.
    const toHours = (fam: PricingFamily) => {
      if (fam.ageDays != null)   return fam.ageDays * 24;
      if (fam.ageHours != null)  return fam.ageHours;
      return 28 * 24; // default 28d if missing
    };
    return toHours(b) - toHours(a); // descending: 28d → 14d → 7d → 24h
  });
}

/**
 * Calculates material cost for ONE representative master per family.
 * Much cheaper than calculating for every single master.
 */
export async function getFamilyAnchorCost(
  anchorMasterId: string,
  plantId: string
): Promise<number | null> {
  try {
    const variantMap = await resolveVariantByMaster([anchorMasterId]);
    const variantId = variantMap.get(anchorMasterId);
    if (!variantId) return null;

    const cost = await calculateMaterialCostOnly(variantId, plantId);
    return Number.isFinite(cost) ? cost : null;
  } catch {
    return null;
  }
}

/**
 * Batch-calculates anchor costs for all families in parallel.
 * Only computes for the anchor master of each family (1 per family vs N per family).
 */
export async function getAllFamilyAnchorCosts(
  families: PricingFamily[],
  plantId: string
): Promise<Map<string, number>> {
  const costByFamilyKey = new Map<string, number>();
  if (!plantId || families.length === 0) return costByFamilyKey;

  const anchorMasterIds = families
    .map((f) => f.anchorMasterId)
    .filter((id): id is string => id !== null);

  const variantMap = await resolveVariantByMaster(anchorMasterIds);

  await Promise.all(
    families.map(async (family) => {
      const anchorMasterId = family.anchorMasterId;
      if (!anchorMasterId) return;
      const variantId = variantMap.get(anchorMasterId);
      if (!variantId) return;
      try {
        const cost = await calculateMaterialCostOnly(variantId, plantId);
        if (Number.isFinite(cost)) costByFamilyKey.set(family.key, Number(cost.toFixed(2)));
      } catch {
        // Cost unavailable
      }
    })
  );

  return costByFamilyKey;
}

/**
 * Batch-calculates RAW MATERIAL costs (no admin, no transport) for all masters in a family.
 * Used in List Prices so the executive sees pure material cost as a reference floor.
 */
export async function getAllMasterCosts(
  masters: MasterRecipeRow[],
  plantId: string
): Promise<Map<string, number>> {
  const costByMasterId = new Map<string, number>();
  if (!plantId || masters.length === 0) return costByMasterId;

  const masterIds = masters.map((m) => m.id);
  const variantMap = await resolveVariantByMaster(masterIds);

  await Promise.all(
    masters.map(async (master) => {
      const variantId = variantMap.get(master.id);
      if (!variantId) return;
      try {
        const cost = await calculateMaterialCostOnly(variantId, plantId);
        if (Number.isFinite(cost)) costByMasterId.set(master.id, cost);
      } catch {
        // Cost unavailable for this master
      }
    })
  );

  return costByMasterId;
}

/**
 * Computes the list price for each master in a family given:
 * - anchorPrice: base price for DIRECTO + base slump + anchor TMA
 * - slumpDeltaPerStep: price increment per slump step (4cm each)
 * - placementUplift: additional price for BOMBEADO vs DIRECTO
 * - tmaDeltaSmaller: add when master TMA < anchor TMA (finer aggregate = higher cost)
 * - tmaDeltaLarger: add when master TMA > anchor TMA
 */
export function computeFamilyMatrix(
  family: PricingFamily,
  anchorPrice: number,
  slumpDeltaPerStep: number,
  placementUplift: number,
  tmaDeltaSmaller = 0,
  tmaDeltaLarger = 0
): Map<string, number> {
  const result = new Map<string, number>();
  const baseSlump = family.slumpValues[0] ?? 0;
  const SLUMP_STEP_CM = 4;

  const anchorMaster = family.masters.find((m) => m.id === family.anchorMasterId);
  const anchorTma = anchorMaster?.max_aggregate_size ?? 20;

  family.masters.forEach((master) => {
    const slumpSteps = Math.max(0, Math.round((master.slump - baseSlump) / SLUMP_STEP_CM));
    const isBombeado = !master.placement_type.toUpperCase().startsWith('D');

    let price = anchorPrice;
    price += slumpSteps * slumpDeltaPerStep;
    if (isBombeado) price += placementUplift;

    // TMA deltas: finer aggregate (< anchor) or coarser (> anchor) can mean different cost
    const tma = master.max_aggregate_size;
    if (tma != null) {
      if (tma < anchorTma) price += tmaDeltaSmaller;
      else if (tma > anchorTma) price += tmaDeltaLarger;
    }

    result.set(master.id, Math.max(0, Number(price.toFixed(2))));
  });

  return result;
}

/**
 * Returns the full material + admin cost breakdown for a single master recipe.
 * Resolves master → latest recipe variant internally.
 */
export async function getMasterBreakdown(
  masterId: string,
  plantId: string
): Promise<MaterialBreakdown | null> {
  const variantMap = await resolveVariantByMaster([masterId]);
  const variantId = variantMap.get(masterId);
  if (!variantId) return null;
  try {
    return await calculateBasePriceBreakdown(variantId, undefined, plantId);
  } catch {
    return null;
  }
}

/**
 * Returns per-material line items for a single master recipe (no admin costs).
 * Used in the List Prices breakdown dialog.
 */
export async function getMasterMaterialLineItems(
  masterId: string,
  plantId: string
): Promise<MaterialLineItem[]> {
  const variantMap = await resolveVariantByMaster([masterId]);
  const variantId = variantMap.get(masterId);
  if (!variantId) return [];
  return getMaterialLineItems(variantId, plantId);
}
