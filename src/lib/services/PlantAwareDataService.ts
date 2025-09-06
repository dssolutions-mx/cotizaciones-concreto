import { supabase } from '@/lib/supabase/client';
import type { UserPlantAccess } from '@/types/plant';

interface PlantFilterOptions {
  userAccess: UserPlantAccess | null;
  isGlobalAdmin: boolean;
  currentPlantId?: string | null;
}

export class PlantAwareDataService {
  private static instance: PlantAwareDataService;
  private plantIdsCache: Map<string, { plantIds: string[] | null; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): PlantAwareDataService {
    if (!PlantAwareDataService.instance) {
      PlantAwareDataService.instance = new PlantAwareDataService();
    }
    return PlantAwareDataService.instance;
  }

  /**
   * Get accessible plant IDs for the current user
   */
  async getAccessiblePlantIds(options: PlantFilterOptions): Promise<string[] | null> {
    const { userAccess, isGlobalAdmin, currentPlantId } = options;

    // Create cache key based on user access pattern
    const cacheKey = `${isGlobalAdmin}-${userAccess?.accessLevel}-${userAccess?.plantId}-${userAccess?.businessUnitId}-${currentPlantId}`;

    // Check cache first
    const cached = this.plantIdsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return cached.plantIds;
    }

    let plantIds: string[] | null = null;

    if (isGlobalAdmin) {
      if (currentPlantId) {
        plantIds = [currentPlantId];
      } else {
        plantIds = null; // Can access all plants
      }
    } else if (userAccess?.accessLevel === 'PLANT' && userAccess.plantId) {
      plantIds = [userAccess.plantId];
    } else if (userAccess?.accessLevel === 'BUSINESS_UNIT' && userAccess.businessUnitId) {
      if (currentPlantId) {
        plantIds = [currentPlantId];
      } else {
        // Get all plants in the business unit - this is the expensive query we want to cache
        const { data: plants } = await supabase
          .from('plants')
          .select('id')
          .eq('business_unit_id', userAccess.businessUnitId);

        plantIds = plants?.map(p => p.id) || [];
      }
    } else {
      plantIds = []; // Unassigned users have no access
    }

    // Cache the result
    this.plantIdsCache.set(cacheKey, { plantIds, timestamp: Date.now() });

    return plantIds;
  }

  /**
   * Get recipes filtered by plant access
   */
  async getRecipes(options: PlantFilterOptions, limit?: number) {
    const plantIds = await this.getAccessiblePlantIds(options);
    
    let query = supabase
      .from('recipes')
      .select(`
        *,
        recipe_versions(*)
      `)
      .order('created_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    // Apply plant filtering
    if (plantIds && plantIds.length > 0) {
      query = query.in('plant_id', plantIds);
    } else if (plantIds && plantIds.length === 0) {
      // User has no access - return empty result by filtering on a non-existent condition
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent UUID
    }
    // If plantIds is null, user can access all plants (global admin), so no filter applied

    return query;
  }

  /**
   * Get material prices filtered by plant access
   */
  async getMaterialPrices(options: PlantFilterOptions) {
    const plantIds = await this.getAccessiblePlantIds(options);
    
    let query = supabase
      .from('material_prices')
      .select('*')
      .order('effective_date', { ascending: false });

    // Apply plant filtering
    if (plantIds && plantIds.length > 0) {
      query = query.in('plant_id', plantIds);
    } else if (plantIds && plantIds.length === 0) {
      // User has no access - return empty result by filtering on a non-existent condition
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent UUID
    }
    // If plantIds is null, user can access all plants (global admin), so no filter applied

    return query;
  }

  /**
   * Get administrative costs filtered by plant access
   */
  async getAdministrativeCosts(options: PlantFilterOptions) {
    const plantIds = await this.getAccessiblePlantIds(options);
    
    let query = supabase
      .from('administrative_costs')
      .select('*')
      .order('effective_date', { ascending: false });

    // Apply plant filtering
    if (plantIds && plantIds.length > 0) {
      query = query.in('plant_id', plantIds);
    } else if (plantIds && plantIds.length === 0) {
      // User has no access - return empty result by filtering on a non-existent condition
      query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Non-existent UUID
    }
    // If plantIds is null, user can access all plants (global admin), so no filter applied

    return query;
  }

  /**
   * Check if user can create data in a specific plant
   */
  canCreateInPlant(plantId: string, options: PlantFilterOptions): boolean {
    const { userAccess, isGlobalAdmin } = options;

    if (isGlobalAdmin) {
      return true; // Can create in any plant
    }

    if (userAccess?.accessLevel === 'PLANT') {
      return userAccess.plantId === plantId;
    }

    if (userAccess?.accessLevel === 'BUSINESS_UNIT') {
      // Would need to check if plant belongs to user's business unit
      // For now, return true and let the backend validate
      return true;
    }

    return false; // Unassigned users can't create
  }

  /**
   * Get user's default plant for creating new data
   */
  getDefaultPlantForCreation(options: PlantFilterOptions): string | null {
    const { userAccess, isGlobalAdmin, currentPlantId } = options;

    if (isGlobalAdmin && currentPlantId) {
      return currentPlantId;
    }

    if (userAccess?.accessLevel === 'PLANT' && userAccess.plantId) {
      return userAccess.plantId;
    }

    // For business unit users or global users without selection, return null (must select)
    return null;
  }
}

export const plantAwareDataService = PlantAwareDataService.getInstance(); 