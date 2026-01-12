import { supabase } from '@/lib/supabase/client';
import { recipeService } from '@/lib/supabase/recipes';
import type { MaterialQuantity } from '@/types/recipes';

export interface MaterialQuantityWithDetails {
  id?: string;
  recipe_version_id: string;
  material_type: string;
  material_id?: string;
  quantity: number;
  unit: string;
  material?: {
    id: string;
    material_name: string;
    material_code: string;
    category: string;
  };
}

export interface MaterialValidationIssue {
  type: 'missing_cement' | 'missing_water' | 'low_cement' | 'too_few_materials' | 'low_quantities' | 'invalid_quantities';
  severity: 'error' | 'warning';
  message: string;
  details?: string;
}

export interface VariantVersionStatus {
  variantId: string;
  recipeCode: string;
  variantSuffix: string | null;
  latestVersion: {
    id: string;
    versionNumber: number;
    createdAt: string;
    isCurrent: boolean;
  } | null;
  materials: MaterialQuantityWithDetails[];
  status: 'up-to-date' | 'outdated' | 'no-version' | 'inconsistent';
  isQuoteBuilderVariant?: boolean; // True if this is the variant QuoteBuilder uses for this master
  validationIssues?: MaterialValidationIssue[]; // Smart management state flags
}

export interface MasterGovernanceData {
  masterId: string;
  masterCode: string;
  strengthFc: number;
  placementType: string;
  slump: number;
  maxAggregateSize: number;
  variants: VariantVersionStatus[];
  summary: {
    totalVariants: number;
    upToDateCount: number;
    outdatedCount: number;
    noVersionCount: number;
    validationErrors: number;
    validationWarnings: number;
  };
}

export interface AvailableMaterial {
  id: string;
  material_name: string;
  material_code: string;
  category: string;
  unit: string;
}

/**
 * Validate recipe materials and return issues
 * @param materials - The materials to validate
 * @param isQuoteBuilderVariant - Whether this variant is used by QuoteBuilder. Errors are only errors if true.
 */
function validateRecipeMaterials(materials: MaterialQuantityWithDetails[], isQuoteBuilderVariant: boolean = false): MaterialValidationIssue[] {
  const issues: MaterialValidationIssue[] = [];
  
  // Determine severity based on whether this variant is used by QuoteBuilder
  const getSeverity = (shouldBeError: boolean): 'error' | 'warning' => {
    // Only show as error if it's the QuoteBuilder variant, otherwise show as warning
    return (shouldBeError && isQuoteBuilderVariant) ? 'error' : 'warning';
  };
  
  if (materials.length === 0) {
    issues.push({
      type: 'too_few_materials',
      severity: getSeverity(true),
      message: 'No hay materiales definidos',
      details: isQuoteBuilderVariant 
        ? 'Esta variante se usa en QuoteBuilder y debe tener materiales definidos'
        : 'Esta variante no tiene materiales definidos',
    });
    return issues;
  }

  // Check for too few materials
  if (materials.length <= 3) {
    issues.push({
      type: 'too_few_materials',
      severity: 'warning',
      message: `Solo ${materials.length} material${materials.length !== 1 ? 'es' : ''} definido${materials.length !== 1 ? 's' : ''}`,
      details: `Una receta típica debería tener al menos 4-5 materiales (cemento, agua, agregados, aditivos)`,
    });
  }

  // Find cement and water materials
  const cementMaterial = materials.find(m => {
    const category = m.material?.category?.toLowerCase() || '';
    const materialType = m.material_type?.toLowerCase() || '';
    const materialCode = m.material?.material_code?.toLowerCase() || '';
    return category === 'cemento' || 
           category === 'binder' ||
           materialType === 'cement' || 
           materialType === 'cemento' ||
           materialCode === 'cement' ||
           materialCode === 'cemento';
  });

  const waterMaterial = materials.find(m => {
    const category = m.material?.category?.toLowerCase() || '';
    const materialType = m.material_type?.toLowerCase() || '';
    const materialCode = m.material?.material_code?.toLowerCase() || '';
    return category === 'agua' || 
           category === 'water' ||
           category === 'liquid' ||
           materialType === 'water' || 
           materialType === 'agua' ||
           materialCode === 'water' ||
           materialCode === 'agua';
  });

  // Check for missing cement (required)
  if (!cementMaterial) {
    issues.push({
      type: 'missing_cement',
      severity: getSeverity(true),
      message: 'Falta material de cemento',
      details: isQuoteBuilderVariant
        ? 'El cemento es obligatorio. Esta variante se usa en QuoteBuilder y debe tener cemento definido'
        : 'El cemento es obligatorio en todas las recetas',
    });
  } else {
    // Check cement quantity (only error if <= 0)
    const cementQty = cementMaterial.quantity || 0;
    if (cementQty <= 0) {
      issues.push({
        type: 'invalid_quantities',
        severity: getSeverity(true),
        message: `Cantidad de cemento inválida: ${cementQty.toFixed(2)} kg/m³`,
        details: isQuoteBuilderVariant
          ? `El cemento debe tener una cantidad mayor a 0. Valor actual: ${cementQty.toFixed(2)} kg/m³. Esta variante se usa en QuoteBuilder.`
          : `El cemento debe tener una cantidad mayor a 0. Valor actual: ${cementQty.toFixed(2)} kg/m³`,
      });
    }
  }

  // Check for missing water (required)
  if (!waterMaterial) {
    issues.push({
      type: 'missing_water',
      severity: getSeverity(true),
      message: 'Falta material de agua',
      details: isQuoteBuilderVariant
        ? 'El agua es obligatoria. Esta variante se usa en QuoteBuilder y debe tener agua definida'
        : 'El agua es obligatoria en todas las recetas',
    });
  } else {
    // Check water quantity (only error if <= 0)
    const waterQty = waterMaterial.quantity || 0;
    if (waterQty <= 0) {
      issues.push({
        type: 'invalid_quantities',
        severity: getSeverity(true),
        message: `Cantidad de agua inválida: ${waterQty.toFixed(2)} ${waterMaterial.unit}`,
        details: isQuoteBuilderVariant
          ? `El agua debe tener una cantidad mayor a 0. Valor actual: ${waterQty.toFixed(2)} ${waterMaterial.unit}. Esta variante se usa en QuoteBuilder.`
          : `El agua debe tener una cantidad mayor a 0. Valor actual: ${waterQty.toFixed(2)} ${waterMaterial.unit}`,
      });
    }
  }

  // Check for invalid quantities (zero or negative) in all materials
  const invalidMaterials = materials.filter(m => !m.quantity || m.quantity <= 0);
  if (invalidMaterials.length > 0) {
    issues.push({
      type: 'invalid_quantities',
      severity: getSeverity(true),
      message: `${invalidMaterials.length} material${invalidMaterials.length !== 1 ? 'es' : ''} con cantidad cero o negativa`,
      details: isQuoteBuilderVariant
        ? `${invalidMaterials.map(m => m.material?.material_name || m.material_type).join(', ')}. Esta variante se usa en QuoteBuilder.`
        : invalidMaterials.map(m => `${m.material?.material_name || m.material_type}`).join(', '),
    });
  }

  return issues;
}

export const recipeGovernanceService = {
  /**
   * Get all master recipes with their variants and latest version status
   */
  async getMasterGovernanceData(plantId: string): Promise<MasterGovernanceData[]> {
    try {
      const startTime = performance.now();
      
      // 1. Fetch masters with variants in one query
      const { data: masters, error: masterError } = await supabase
        .from('master_recipes')
        .select(`
          id,
          master_code,
          strength_fc,
          placement_type,
          max_aggregate_size,
          slump,
          recipes!recipes_master_recipe_id_fkey(
            id,
            recipe_code,
            variant_suffix
          )
        `)
        .eq('plant_id', plantId)
        .eq('is_active', true)
        .order('master_code');

      if (masterError) throw masterError;
      if (!masters || masters.length === 0) {
        return [];
      }

      // 2. Collect all variant IDs
      const variantIds: string[] = [];
      masters.forEach((m: any) => {
        if (m.recipes && Array.isArray(m.recipes)) {
          m.recipes.forEach((r: any) => {
            if (r.id) variantIds.push(r.id);
          });
        }
      });

      if (variantIds.length === 0) {
        return masters.map((m: any) => ({
          masterId: m.id,
          masterCode: m.master_code,
          strengthFc: m.strength_fc,
          placementType: m.placement_type,
          slump: m.slump,
          maxAggregateSize: m.max_aggregate_size,
          variants: [],
          summary: {
            totalVariants: 0,
            upToDateCount: 0,
            outdatedCount: 0,
            noVersionCount: 0,
            validationErrors: 0,
            validationWarnings: 0,
          },
        }));
      }

      // 3. Fetch all versions first (needed to get version IDs for material quantities)
      const { data: allVersions, error: versionsError } = await supabase
        .from('recipe_versions')
        .select('id, recipe_id, version_number, created_at, is_current')
        .in('recipe_id', variantIds)
        .order('created_at', { ascending: false });

      if (versionsError) throw versionsError;

      // 4. Group versions by recipe_id and get latest (by created_at)
      const latestVersionMap = new Map<string, any>();
      const versionMap = new Map<string, any[]>();

      allVersions.forEach((v: any) => {
        const recipeId = v.recipe_id;
        
        // Track all versions for this recipe
        if (!versionMap.has(recipeId)) {
          versionMap.set(recipeId, []);
        }
        versionMap.get(recipeId)!.push(v);

        // Track latest version (by created_at)
        const existing = latestVersionMap.get(recipeId);
        if (!existing || new Date(v.created_at) > new Date(existing.created_at)) {
          latestVersionMap.set(recipeId, v);
        }
      });

      // 5. Get latest version IDs and fetch material quantities + details in parallel
      const latestVersionIds = Array.from(latestVersionMap.values())
        .map(v => v.id)
        .filter(Boolean);

      let materialQuantities: any[] = [];
      if (latestVersionIds.length > 0) {
        // Fetch material quantities for latest versions in parallel chunks
        const chunkSize = 200; // Increased chunk size for better performance
        const materialPromises: Promise<any[]>[] = [];
        
        for (let i = 0; i < latestVersionIds.length; i += chunkSize) {
          const chunk = latestVersionIds.slice(i, i + chunkSize);
          materialPromises.push(
            supabase
              .from('material_quantities')
              .select('id, recipe_version_id, material_type, material_id, quantity, unit')
              .in('recipe_version_id', chunk)
              .then(({ data, error }) => {
                if (error) {
                  console.error('Error fetching material quantities:', error);
                  return [];
                }
                return data || [];
              })
          );
        }
        
        const materialChunks = await Promise.all(materialPromises);
        materialQuantities = materialChunks.flat();
        
        // Fetch material details in parallel for all unique material IDs
        const materialIds = [...new Set(materialQuantities
          .map((m: any) => m.material_id)
          .filter((id: any): id is string => !!id))];
        
        let materialDetailsMap = new Map<string, any>();
        if (materialIds.length > 0) {
          const detailChunkSize = 100; // Increased chunk size
          const detailPromises: Promise<any[]>[] = [];
          
          for (let i = 0; i < materialIds.length; i += detailChunkSize) {
            const chunk = materialIds.slice(i, i + detailChunkSize);
            detailPromises.push(
              supabase
                .from('materials')
                .select('id, material_name, material_code, category')
                .in('id', chunk)
                .then(({ data, error }) => {
                  if (error) {
                    console.warn('Error fetching material details:', error);
                    return [];
                  }
                  return data || [];
                })
            );
          }
          
          const detailChunks = await Promise.all(detailPromises);
          detailChunks.flat().forEach((m: any) => {
            materialDetailsMap.set(m.id, m);
          });
        }
        
        // Combine material quantities with their details
        materialQuantities = materialQuantities.map((mq: any) => {
          const materialDetail = mq.material_id ? materialDetailsMap.get(mq.material_id) : undefined;
          return {
            ...mq,
            material: materialDetail || (mq.material_type ? {
              id: null,
              material_name: mq.material_type,
              material_code: mq.material_type,
              category: 'legacy',
            } : undefined),
          };
        });
      }
      
      const fetchTime = performance.now() - startTime;
      console.log(`[RecipeGovernance] Fetched data in ${fetchTime.toFixed(2)}ms: ${masters.length} masters, ${variantIds.length} variants, ${latestVersionIds.length} versions, ${materialQuantities.length} materials`);

      // 6. Group materials by recipe_version_id
      const materialsByVersion = new Map<string, MaterialQuantityWithDetails[]>();
      materialQuantities.forEach((mq: any) => {
        const versionId = mq.recipe_version_id;
        if (!materialsByVersion.has(versionId)) {
          materialsByVersion.set(versionId, []);
        }
        materialsByVersion.get(versionId)!.push({
          id: mq.id,
          recipe_version_id: mq.recipe_version_id,
          material_type: mq.material_type,
          material_id: mq.material_id,
          quantity: mq.quantity,
          unit: mq.unit,
          material: mq.material ? {
            id: mq.material.id,
            material_name: mq.material.material_name,
            material_code: mq.material.material_code,
            category: mq.material.category,
          } : undefined,
        });
      });

      // 7. Build governance data structure
      const governanceData: MasterGovernanceData[] = masters.map((m: any) => {
        const recipeVariants = m.recipes || [];
        
        // For each master, determine which variant QuoteBuilder would use
        // QuoteBuilder uses the variant with the most recent version (by created_at)
        let quoteBuilderVariantId: string | null = null;
        let quoteBuilderVersionCreatedAt: Date | null = null;
        let quoteBuilderVariantCode: string | null = null;
        
        recipeVariants.forEach((r: any) => {
          const variantLatestVersion = latestVersionMap.get(r.id);
          if (variantLatestVersion) {
            const versionDate = new Date(variantLatestVersion.created_at);
            if (!quoteBuilderVersionCreatedAt || versionDate > quoteBuilderVersionCreatedAt) {
              quoteBuilderVersionCreatedAt = versionDate;
              quoteBuilderVariantId = r.id;
              quoteBuilderVariantCode = r.recipe_code;
            }
          }
        });
        
        // Debug logging for QuoteBuilder variant identification
        if (quoteBuilderVariantId) {
          console.log(`[RecipeGovernance] Master ${m.master_code}: QuoteBuilder variant = ${quoteBuilderVariantCode} (ID: ${quoteBuilderVariantId}, latest version date: ${quoteBuilderVersionCreatedAt?.toISOString()})`);
        } else {
          console.warn(`[RecipeGovernance] Master ${m.master_code}: No QuoteBuilder variant found (no versions)`);
        }
        
        const variants: VariantVersionStatus[] = recipeVariants.map((r: any) => {
          const latestVersion = latestVersionMap.get(r.id);
          const allVersionsForRecipe = versionMap.get(r.id) || [];
          
          // Determine status based on QuoteBuilder logic
          // QuoteBuilder uses latest version by created_at (not is_current flag)
          // Sort versions by created_at DESC to match QuoteBuilder's logic
          const sortedVersions = [...allVersionsForRecipe].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          
          let status: VariantVersionStatus['status'] = 'no-version';
          const isQuoteBuilderVariant = r.id === quoteBuilderVariantId;
          
          if (latestVersion) {
            const currentVersions = allVersionsForRecipe.filter((v: any) => v.is_current === true);
            
            // Check if this is the latest by created_at (what QuoteBuilder uses)
            const isLatestByCreatedAt = latestVersion.id === sortedVersions[0]?.id;
            const isMarkedCurrent = latestVersion.is_current === true;
            
            if (currentVersions.length > 1) {
              status = 'inconsistent'; // Multiple versions marked as current
            } else if (isLatestByCreatedAt && isMarkedCurrent) {
              status = 'up-to-date'; // Latest by created_at AND marked as current - perfect alignment
            } else if (isLatestByCreatedAt && !isMarkedCurrent) {
              status = 'outdated'; // Latest by created_at but NOT marked as current (QuoteBuilder will use this, but flag is wrong - needs fix)
            } else {
              status = 'outdated'; // Not the latest by created_at
            }
          }

          const materials = latestVersion 
            ? (materialsByVersion.get(latestVersion.id) || [])
            : [];

          // Validate materials and get issues
          // Only show errors if this is the QuoteBuilder variant
          const validationIssues = materials.length > 0 
            ? validateRecipeMaterials(materials, isQuoteBuilderVariant)
            : latestVersion 
              ? [{ 
                  type: 'too_few_materials' as const, 
                  severity: isQuoteBuilderVariant ? 'error' as const : 'warning' as const, 
                  message: 'No hay materiales definidos para esta versión',
                  details: isQuoteBuilderVariant
                    ? 'Esta variante se usa en QuoteBuilder y debe tener materiales definidos'
                    : 'Esta variante no tiene materiales definidos',
                }]
              : [];

          return {
            variantId: r.id,
            recipeCode: r.recipe_code,
            variantSuffix: r.variant_suffix,
            latestVersion: latestVersion ? {
              id: latestVersion.id,
              versionNumber: latestVersion.version_number,
              createdAt: latestVersion.created_at,
              isCurrent: latestVersion.is_current,
            } : null,
            materials,
            status,
            isQuoteBuilderVariant, // Mark which variant QuoteBuilder uses
            validationIssues, // Smart management state flags
          };
        });

        const summary = {
          totalVariants: variants.length,
          upToDateCount: variants.filter(v => v.status === 'up-to-date').length,
          outdatedCount: variants.filter(v => v.status === 'outdated').length,
          noVersionCount: variants.filter(v => v.status === 'no-version').length,
          validationErrors: variants.reduce((sum, v) => 
            sum + (v.validationIssues?.filter(i => i.severity === 'error').length || 0), 0
          ),
          validationWarnings: variants.reduce((sum, v) => 
            sum + (v.validationIssues?.filter(i => i.severity === 'warning').length || 0), 0
          ),
        };

        return {
          masterId: m.id,
          masterCode: m.master_code,
          strengthFc: m.strength_fc,
          placementType: m.placement_type,
          slump: m.slump,
          maxAggregateSize: m.max_aggregate_size,
          variants,
          summary,
        };
      });

      return governanceData;
    } catch (error) {
      console.error('Error fetching master governance data:', error);
      throw error;
    }
  },

  /**
   * Get available materials for a plant (for adding new materials)
   */
  async getAvailableMaterials(plantId: string): Promise<AvailableMaterial[]> {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('id, material_name, material_code, category, unit_of_measure')
        .eq('plant_id', plantId)
        .eq('is_active', true)
        .order('material_name', { ascending: true });

      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.id,
        material_name: m.material_name,
        material_code: m.material_code,
        category: m.category,
        unit: m.unit_of_measure || 'kg/m³', // Use unit_of_measure, fallback to default
      }));
    } catch (error) {
      console.error('Error fetching available materials:', error);
      throw error;
    }
  },

  /**
   * Update variant materials by creating a new version
   */
  async updateVariantMaterials(
    variantId: string,
    materials: MaterialQuantity[],
    notes?: string
  ): Promise<void> {
    try {
      // Ensure materials have required fields
      const validMaterials = materials
        .filter(m => m.material_id || m.material_type) // Must have at least one identifier
        .map(m => ({
          recipe_version_id: '', // Will be set by createRecipeVersion
          material_type: m.material_type || '', // Legacy field
          material_id: m.material_id, // New field
          quantity: m.quantity,
          unit: m.unit,
        }));

      if (validMaterials.length === 0) {
        throw new Error('Debe haber al menos un material válido');
      }

      // Use the existing recipeService.createRecipeVersion which handles:
      // - Creating new version with incremented version_number
      // - Setting previous version's is_current to false
      // - Inserting new material quantities
      await recipeService.createRecipeVersion(variantId, validMaterials, notes);
    } catch (error) {
      console.error('Error updating variant materials:', error);
      throw error;
    }
  },
};
