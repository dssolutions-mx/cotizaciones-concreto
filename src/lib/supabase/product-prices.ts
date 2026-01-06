/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { supabase } from './client';

// Valid types for product prices according to database constraint
type ProductType = 'STANDARD' | 'SPECIAL' | 'QUOTED';

interface ProductPriceData {
  code: string;
  description: string;
  fc_mr_value: number;
  type: ProductType;
  age_days: number;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  base_price: number;
  recipe_id: string | null; // Allow null for master-recipe based quotes
  master_recipe_id: string | null; // Allow null for recipe-based quotes
  client_id: string;
  construction_site: string;
  quote_id: string;
  effective_date: string;
  approval_date: string;
  plant_id: string; // Add plant_id field
}

interface Recipe {
  id: string;
  recipe_code: string;
  strength_fc: number;
  age_days: number;
  placement_type: string;
  max_aggregate_size: number;
  slump: number;
  plant_id: string;
}

interface QuoteDetail {
  id: string;
  final_price: number;
  recipe_id?: string | null;
  master_recipe_id?: string | null; // Added master_recipe_id
  product_id?: string | null;
  pump_service?: boolean;
  recipes?: Recipe;
  master_recipes?: Recipe; // Added master_recipes
  product_prices?: {
    id: string;
    code: string;
    description: string;
    type: string;
    plant_id?: string | null;
  };
}

interface Quote {
  id: string;
  quote_number: string;
  client_id: string;
  construction_site: string;
  plant_id: string; // Add plant_id to Quote interface
  quote_details: QuoteDetail[];
}

/**
 * Determines the product type based on the context
 * Since this is coming from a quote, it's always a QUOTED type
 * @returns 'QUOTED' for all quote-based prices
 */
const determineProductType = (): ProductType => {
  return 'QUOTED';
};

export const productPriceService = {
  async deactivateExistingPrices(clientId: string, recipeId: string, constructionSite: string, plantId?: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    
    const updateConditions: any = { 
      client_id: clientId,
      recipe_id: recipeId,
      construction_site: constructionSite,
      is_active: true 
    };
    
    // Add plant_id filter if provided
    if (plantId) {
      updateConditions.plant_id = plantId;
    }

    const { error } = await client
      .from('product_prices')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString() // Update timestamp for audit trail
      })
      .match(updateConditions);

    if (error) throw new Error(`Error deactivating existing prices: ${error.message}`);
  },

  async deactivateExistingMasterPrices(clientId: string, masterRecipeId: string, constructionSite: string, plantId?: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    
    const updateConditions: any = { 
      client_id: clientId,
      master_recipe_id: masterRecipeId,
      construction_site: constructionSite,
      is_active: true 
    };
    
    // Add plant_id filter if provided
    if (plantId) {
      updateConditions.plant_id = plantId;
    }

    const { error } = await client
      .from('product_prices')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString() // Update timestamp for audit trail
      })
      .match(updateConditions);

    if (error) throw new Error(`Error deactivating existing master prices: ${error.message}`);
  },

  /**
   * Deactivates recipe-based prices that map to a given master_recipe_id.
   * This is CRITICAL when creating a new master-level price - we need to also
   * deactivate any old recipe-level prices whose recipe.master_recipe_id matches.
   */
  async deactivateRecipePricesForMaster(clientId: string, masterRecipeId: string, constructionSite: string, plantId?: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    
    console.log(`[deactivateRecipePricesForMaster] Finding recipe-based prices that map to master ${masterRecipeId}`);
    
    // First, find all recipes that belong to this master
    const { data: recipes, error: recipesError } = await client
      .from('recipes')
      .select('id')
      .eq('master_recipe_id', masterRecipeId);
    
    if (recipesError) {
      console.error(`[deactivateRecipePricesForMaster] Error fetching recipes for master ${masterRecipeId}:`, recipesError);
      throw new Error(`Error fetching recipes for master: ${recipesError.message}`);
    }
    
    if (!recipes || recipes.length === 0) {
      console.log(`[deactivateRecipePricesForMaster] No recipes found for master ${masterRecipeId}`);
      return;
    }
    
    const recipeIds = recipes.map((r: any) => r.id);
    console.log(`[deactivateRecipePricesForMaster] Found ${recipeIds.length} recipes for master ${masterRecipeId}:`, recipeIds);
    
    // Now deactivate all product_prices that have these recipe_ids
    let updateQuery = client
      .from('product_prices')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('client_id', clientId)
      .eq('construction_site', constructionSite)
      .eq('is_active', true)
      .in('recipe_id', recipeIds);
    
    // Add plant_id filter if provided
    if (plantId) {
      updateQuery = updateQuery.eq('plant_id', plantId);
    }
    
    const { error, count } = await updateQuery;
    
    if (error) {
      console.error(`[deactivateRecipePricesForMaster] Error deactivating recipe-based prices:`, error);
      throw new Error(`Error deactivating recipe-based prices for master: ${error.message}`);
    }
    
    console.log(`[deactivateRecipePricesForMaster] Deactivated recipe-based prices for master ${masterRecipeId}, affected: ${count ?? 'unknown'}`);
  },

  async createNewPrice(priceData: ProductPriceData, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    
    // Log the data being inserted
    console.log('[createNewPrice] Creating new price with data:', {
      code: priceData.code,
      type: priceData.type,
      fc_mr_value: priceData.fc_mr_value,
      construction_site: priceData.construction_site,
      plant_id: priceData.plant_id,
      using_admin_client: !!supabaseClient
    });

    const { error } = await client
      .from('product_prices')
      .insert({
        ...priceData,
        is_active: true
      });

    if (error) {
      console.error('[createNewPrice] Error details:', error);
      throw new Error(`Error creating new price: ${error.message}`);
    }
    
    console.log('[createNewPrice] Successfully created product_price:', priceData.code);
  },

  async handleQuoteApproval(quoteId: string, supabaseClient?: any) {
    const client = supabaseClient || supabase;
    console.log(`[handleQuoteApproval] Starting approval process for quote: ${quoteId}`);
    
    // Get quote details with all necessary information including plant_id AND master_recipe_id
    const { data: quoteDataArray, error: quoteError } = await client
      .from('quotes')
      .select(`
        id,
        quote_number,
        client_id,
        construction_site,
        plant_id,
        quote_details (
          id,
          final_price,
          recipe_id,
          master_recipe_id,
          product_id,
          pump_service,
          recipes (
            id,
            recipe_code,
            strength_fc,
            age_days,
            placement_type,
            max_aggregate_size,
            slump,
            plant_id
          ),
          master_recipes (
            id,
            master_code,
            strength_fc,
            age_days,
            placement_type,
            max_aggregate_size,
            slump,
            plant_id
          ),
          product_prices (
            id,
            code,
            description,
            type,
            plant_id
          )
        )
      `)
      .eq('id', quoteId)
      .limit(1);
    
    if (quoteError) {
      console.error(`[handleQuoteApproval] Error fetching quote:`, quoteError);
      throw new Error(`Error fetching quote details: ${quoteError.message}`);
    }
    
    // Handle the result - take first item if array, or use directly if single
    const quoteData = Array.isArray(quoteDataArray) 
      ? (quoteDataArray.length > 0 ? quoteDataArray[0] : null)
      : quoteDataArray;
    
    if (!quoteData) {
      console.error(`[handleQuoteApproval] Quote not found: ${quoteId}`, {
        quoteDataArray,
        isArray: Array.isArray(quoteDataArray),
        length: Array.isArray(quoteDataArray) ? quoteDataArray.length : 'N/A'
      });
      throw new Error('Quote not found');
    }
    if (!quoteData.quote_details || quoteData.quote_details.length === 0) {
      console.error(`[handleQuoteApproval] Quote has no details: ${quoteId}`);
      throw new Error('Quote has no details');
    }

    // Log the raw quote data structure
    console.log('[handleQuoteApproval] Raw quote data:', {
      id: quoteData.id,
      quote_number: quoteData.quote_number,
      construction_site: quoteData.construction_site,
      plant_id: quoteData.plant_id,
      details_count: quoteData.quote_details.length,
      details: quoteData.quote_details.map((d: any) => ({
        id: d.id,
        recipe_id: d.recipe_id,
        master_recipe_id: d.master_recipe_id,
        product_id: d.product_id,
        has_recipes: !!d.recipes,
        has_master_recipes: !!d.master_recipes,
        has_product_prices: !!d.product_prices,
        recipes_type: Array.isArray(d.recipes) ? 'array' : typeof d.recipes,
        master_recipes_type: Array.isArray(d.master_recipes) ? 'array' : typeof d.master_recipes
      }))
    });

    // Transform the data to ensure correct typing with fallback fetching
    try {
      // Helper function to fetch master recipe if relationship is missing
      const fetchMasterRecipe = async (masterRecipeId: string): Promise<Recipe | null> => {
        console.log(`[handleQuoteApproval] Fetching master recipe fallback: ${masterRecipeId}`);
        const { data, error } = await client
          .from('master_recipes')
          .select('id, master_code, strength_fc, age_days, placement_type, max_aggregate_size, slump, plant_id')
          .eq('id', masterRecipeId)
          .single();
        
        if (error) {
          console.error(`[handleQuoteApproval] Error fetching master recipe ${masterRecipeId}:`, error);
          return null;
        }
        
        if (data) {
          console.log(`[handleQuoteApproval] Successfully fetched master recipe: ${data.master_code}`);
          // Convert master_recipe to Recipe format
          return {
            id: data.id,
            recipe_code: data.master_code,
            strength_fc: data.strength_fc,
            age_days: data.age_days,
            placement_type: data.placement_type,
            max_aggregate_size: data.max_aggregate_size,
            slump: data.slump,
            plant_id: data.plant_id
          };
        }
        return null;
      };

      // Helper function to fetch recipe if relationship is missing
      const fetchRecipe = async (recipeId: string): Promise<Recipe | null> => {
        console.log(`[handleQuoteApproval] Fetching recipe fallback: ${recipeId}`);
        const { data, error } = await client
          .from('recipes')
          .select('id, recipe_code, strength_fc, age_days, placement_type, max_aggregate_size, slump, plant_id')
          .eq('id', recipeId)
          .single();
        
        if (error) {
          console.error(`[handleQuoteApproval] Error fetching recipe ${recipeId}:`, error);
          return null;
        }
        
        if (data) {
          console.log(`[handleQuoteApproval] Successfully fetched recipe: ${data.recipe_code}`);
          return data as Recipe;
        }
        return null;
      };

      // Map quote details with fallback fetching
      const mappedDetails: QuoteDetail[] = [];
      for (const detail of quoteData.quote_details) {
        console.log(`[handleQuoteApproval] Processing detail ${detail.id}:`, {
          recipe_id: detail.recipe_id,
          master_recipe_id: detail.master_recipe_id,
          product_id: detail.product_id,
          has_recipes: !!detail.recipes,
          has_master_recipes: !!detail.master_recipes,
          has_product_prices: !!detail.product_prices
        });

        // Handle recipe-based quote details (concrete products)
        if (detail.recipe_id) {
          let recipeData: Recipe | null = null;
          
          if (detail.recipes) {
            recipeData = Array.isArray(detail.recipes) 
              ? detail.recipes[0] 
              : detail.recipes;
            console.log(`[handleQuoteApproval] Using loaded recipe data for detail ${detail.id}`);
          } else {
            // Fallback: fetch recipe if relationship wasn't loaded
            console.log(`[handleQuoteApproval] Recipe relationship missing, fetching fallback for detail ${detail.id}`);
            recipeData = await fetchRecipe(detail.recipe_id);
          }

          if (recipeData) {
            console.log('[handleQuoteApproval] Recipe data mapped:', {
              detail_id: detail.id,
              recipe_code: recipeData.recipe_code,
              strength_fc: recipeData.strength_fc,
              plant_id: recipeData.plant_id
            });

            mappedDetails.push({
              id: detail.id,
              final_price: detail.final_price,
              recipe_id: detail.recipe_id,
              product_id: detail.product_id,
              pump_service: detail.pump_service,
              recipes: recipeData
            });
            continue;
          }
        }
        
        // Handle master-recipe-based quote details (NEW: master pricing flow)
        if (detail.master_recipe_id) {
          let masterData: Recipe | null = null;
          
          if (detail.master_recipes) {
            const rawMasterData = Array.isArray(detail.master_recipes) 
              ? detail.master_recipes[0] 
              : detail.master_recipes;
            
            // Convert master_recipe to Recipe format
            masterData = {
              id: rawMasterData.id,
              recipe_code: rawMasterData.master_code,
              strength_fc: rawMasterData.strength_fc,
              age_days: rawMasterData.age_days,
              placement_type: rawMasterData.placement_type,
              max_aggregate_size: rawMasterData.max_aggregate_size,
              slump: rawMasterData.slump,
              plant_id: rawMasterData.plant_id
            };
            console.log(`[handleQuoteApproval] Using loaded master recipe data for detail ${detail.id}`);
          } else {
            // Fallback: fetch master recipe if relationship wasn't loaded
            console.log(`[handleQuoteApproval] Master recipe relationship missing, fetching fallback for detail ${detail.id}`);
            masterData = await fetchMasterRecipe(detail.master_recipe_id);
          }

          if (masterData) {
            console.log('[handleQuoteApproval] Master recipe data mapped:', {
              detail_id: detail.id,
              master_code: masterData.recipe_code,
              strength_fc: masterData.strength_fc,
              plant_id: masterData.plant_id
            });

            mappedDetails.push({
              id: detail.id,
              final_price: detail.final_price,
              recipe_id: detail.recipe_id, // Can be null for master-based quotes
              master_recipe_id: detail.master_recipe_id,
              product_id: detail.product_id,
              pump_service: detail.pump_service,
              recipes: masterData // Treat master recipe same as recipe for price creation
            });
            continue;
          }
        }
        
        // Handle product-based quote details (standalone pumping services)
        if (detail.product_id && detail.product_prices) {
          const productData = Array.isArray(detail.product_prices) 
            ? detail.product_prices[0] 
            : detail.product_prices;

          console.log('[handleQuoteApproval] Product data mapped:', {
            detail_id: detail.id,
            product_code: productData.code,
            product_description: productData.description,
            product_type: productData.type,
            plant_id: productData.plant_id
          });

          mappedDetails.push({
            id: detail.id,
            final_price: detail.final_price,
            recipe_id: detail.recipe_id,
            product_id: detail.product_id,
            pump_service: detail.pump_service,
            product_prices: productData
          });
          continue;
        }

        // If we get here, the detail couldn't be processed
        console.error(`[handleQuoteApproval] Cannot process detail ${detail.id}:`, {
          recipe_id: detail.recipe_id,
          master_recipe_id: detail.master_recipe_id,
          product_id: detail.product_id,
          has_recipes: !!detail.recipes,
          has_master_recipes: !!detail.master_recipes,
          has_product_prices: !!detail.product_prices
        });
        throw new Error(`Neither recipe nor product data available for quote detail ${detail.id}. Recipe ID: ${detail.recipe_id || 'null'}, Master Recipe ID: ${detail.master_recipe_id || 'null'}, Product ID: ${detail.product_id || 'null'}`);
      }

      const quote: Quote = {
        id: quoteData.id,
        quote_number: quoteData.quote_number,
        client_id: quoteData.client_id,
        construction_site: quoteData.construction_site,
        plant_id: quoteData.plant_id,
        quote_details: mappedDetails
      };

      console.log(`[handleQuoteApproval] Successfully mapped ${mappedDetails.length} out of ${quoteData.quote_details.length} details`);

      // Process each quote detail with improved error handling
      const now = new Date().toISOString();
      const errors: Array<{ detailId: string; error: string }> = [];
      const expectedPriceCount = quote.quote_details.filter(
        (d: QuoteDetail) => (d.recipe_id || d.master_recipe_id) && d.recipes && !d.product_id
      ).length;

      console.log(`[handleQuoteApproval] Expected to create ${expectedPriceCount} product_prices records`);

      const pricePromises = quote.quote_details.map(async (detail: QuoteDetail) => {
        try {
          // Handle recipe-based quote details (concrete products)
          if ((detail.recipe_id || detail.master_recipe_id) && detail.recipes) {
            // Validate required fields before processing
            if (!detail.recipes.plant_id && !quote.plant_id) {
              throw new Error(`Missing plant_id for detail ${detail.id}. Recipe plant_id: ${detail.recipes.plant_id}, Quote plant_id: ${quote.plant_id}`);
            }

            if (!detail.recipes.strength_fc && detail.recipes.strength_fc !== 0) {
              throw new Error(`Missing strength_fc for detail ${detail.id}`);
            }

            if (!detail.final_price && detail.final_price !== 0) {
              throw new Error(`Missing final_price for detail ${detail.id}`);
            }

            const plantId = detail.recipes.plant_id || quote.plant_id;
            
            console.log(`[handleQuoteApproval] Processing detail ${detail.id} for price creation:`, {
              recipe_id: detail.recipe_id,
              master_recipe_id: detail.master_recipe_id,
              plant_id: plantId,
              final_price: detail.final_price
            });
            
            // Deactivate existing prices based on whether it's recipe-based or master-based
            // IMPORTANT: Deactivate both types if both exist, and also handle prices that might have both fields
            if (detail.recipe_id) {
              // Recipe-based: deactivate existing recipe-level prices
              // This will also catch prices that have both recipe_id and master_recipe_id set
              console.log(`[handleQuoteApproval] Deactivating existing recipe-level prices for detail ${detail.id}`);
              await productPriceService.deactivateExistingPrices(
                quote.client_id, 
                detail.recipe_id, 
                quote.construction_site,
                plantId,
                client
              );
            }
            
            if (detail.master_recipe_id) {
              // Master-based: deactivate existing master-level prices
              // This will also catch prices that have both recipe_id and master_recipe_id set
              console.log(`[handleQuoteApproval] Deactivating existing master-level prices for detail ${detail.id}`);
              await productPriceService.deactivateExistingMasterPrices(
                quote.client_id, 
                detail.master_recipe_id, 
                quote.construction_site,
                plantId,
                client
              );
              
              // CRITICAL: Also deactivate recipe-based prices that map to this master
              // This ensures that when a new master-level price is created, all old
              // recipe-variant prices for the same master are also deactivated
              console.log(`[handleQuoteApproval] Deactivating recipe-based prices that map to master for detail ${detail.id}`);
              await productPriceService.deactivateRecipePricesForMaster(
                quote.client_id,
                detail.master_recipe_id,
                quote.construction_site,
                plantId,
                client
              );
            }
            
            // CRITICAL: Also deactivate any prices that have BOTH recipe_id and master_recipe_id set
            // This handles edge cases where old prices might have both fields
            if (detail.recipe_id && detail.master_recipe_id) {
              console.log(`[handleQuoteApproval] Deactivating prices with both recipe_id and master_recipe_id for detail ${detail.id}`);
              const { error: deactivateBothError } = await client
                .from('product_prices')
                .update({ 
                  is_active: false,
                  updated_at: new Date().toISOString()
                })
                .match({
                  client_id: quote.client_id,
                  construction_site: quote.construction_site,
                  recipe_id: detail.recipe_id,
                  master_recipe_id: detail.master_recipe_id,
                  plant_id: plantId,
                  is_active: true
                });
              
              if (deactivateBothError) {
                console.warn(`[handleQuoteApproval] Error deactivating prices with both recipe_id and master_recipe_id for detail ${detail.id}:`, deactivateBothError);
                // Don't throw - this is a cleanup operation, not critical
              }
            }

            // Create new price record with plant_id
            // PRIORITY: If master_recipe_id exists, create master-level price (applies to all variants)
            // Otherwise, create recipe-level price (specific variant)
            const codePrefix = detail.master_recipe_id
              ? (detail.recipes.recipe_code || 'MASTER') // recipe_code contains master_code for master recipes
              : (detail.recipe_id ? detail.recipes.recipe_code : 'UNKNOWN');
            
            // Determine which fields to set based on priority
            // Master-level prices should have master_recipe_id set and recipe_id = null
            // Recipe-level prices should have recipe_id set and master_recipe_id = null
            const isMasterLevel = !!detail.master_recipe_id;
               
            const priceData: ProductPriceData = {
              code: `${quote.quote_number}-${codePrefix}`,
              description: `Precio específico para cliente - ${codePrefix} - ${quote.construction_site}`,
              fc_mr_value: detail.recipes.strength_fc,
              type: determineProductType(),
              age_days: detail.recipes.age_days,
              placement_type: detail.recipes.placement_type,
              max_aggregate_size: detail.recipes.max_aggregate_size,
              slump: detail.recipes.slump,
              base_price: detail.final_price,
              // CRITICAL: Only set one of recipe_id or master_recipe_id, never both
              // Master-level prices take precedence (they apply to all variants)
              recipe_id: isMasterLevel ? null : (detail.recipe_id || null),
              master_recipe_id: isMasterLevel ? (detail.master_recipe_id || null) : null,
              client_id: quote.client_id,
              construction_site: quote.construction_site,
              quote_id: quote.id, // Link to quote for traceability
              effective_date: now,
              approval_date: now,
              plant_id: plantId
            };

            console.log(`[handleQuoteApproval] Creating product_price for detail ${detail.id}:`, {
              code: priceData.code,
              master_level: isMasterLevel,
              recipe_id: priceData.recipe_id,
              master_recipe_id: priceData.master_recipe_id,
              plant_id: priceData.plant_id,
              base_price: priceData.base_price
            });

            await productPriceService.createNewPrice(priceData, client);
            console.log(`[handleQuoteApproval] Successfully created product_price for detail ${detail.id}`);
          }
          
          // Handle product-based quote details (standalone pumping services)
          else if (detail.product_id && detail.product_prices) {
            // For pumping services, we don't need to create new product prices
            // since they're already using the special pumping service product
            console.log(`[handleQuoteApproval] Skipping price creation for pumping service product detail ${detail.id}:`, {
              product_code: detail.product_prices.code,
              product_description: detail.product_prices.description
            });
          }
          
          else {
            const errorMsg = `Invalid quote detail: neither recipe nor product data available for detail ${detail.id}. Recipe ID: ${detail.recipe_id || 'null'}, Master Recipe ID: ${detail.master_recipe_id || 'null'}, Product ID: ${detail.product_id || 'null'}, Has recipes: ${!!detail.recipes}`;
            console.error(`[handleQuoteApproval] ${errorMsg}`);
            throw new Error(errorMsg);
          }
        } catch (error: any) {
          const errorMsg = `Error processing quote detail ${detail.id}: ${error.message}`;
          console.error(`[handleQuoteApproval] ${errorMsg}`, {
            detail_id: detail.id,
            error: error.message,
            recipe: detail.recipes,
            product: detail.product_prices,
            stack: error.stack
          });
          errors.push({ detailId: detail.id, error: errorMsg });
          // Don't throw - continue processing other details
        }
      });

      // Wait for all price updates to complete
      await Promise.all(pricePromises);

      // Report any errors that occurred
      if (errors.length > 0) {
        console.error(`[handleQuoteApproval] ${errors.length} error(s) occurred while processing details:`, errors);
        // Still throw an error if any details failed, but include all errors
        throw new Error(`Failed to process ${errors.length} detail(s): ${errors.map(e => e.error).join('; ')}`);
      }

      // Post-creation verification: Check that prices were actually created
      console.log(`[handleQuoteApproval] Verifying created product_prices for quote ${quoteId}`);
      const { data: createdPrices, error: verifyError } = await client
        .from('product_prices')
        .select('id, quote_id, is_active')
        .eq('quote_id', quoteId)
        .eq('is_active', true);

      if (verifyError) {
        console.warn(`[handleQuoteApproval] Error verifying created prices:`, verifyError);
      } else {
        const createdCount = createdPrices?.length || 0;
        console.log(`[handleQuoteApproval] Verification: Created ${createdCount} product_prices, expected ${expectedPriceCount}`);
        
        if (createdCount !== expectedPriceCount) {
          console.warn(`[handleQuoteApproval] WARNING: Price count mismatch! Expected ${expectedPriceCount}, but found ${createdCount} active prices for quote ${quoteId}`);
        } else {
          console.log(`[handleQuoteApproval] ✓ Verification passed: All expected prices were created`);
        }
      }
    } catch (error: any) {
      console.error('Full error details:', error);
      throw new Error(`Error in price history processing: ${error.message}`);
    }
  }
}; 