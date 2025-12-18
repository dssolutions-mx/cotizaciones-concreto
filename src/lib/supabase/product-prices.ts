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
  async deactivateExistingPrices(clientId: string, recipeId: string, constructionSite: string, plantId?: string) {
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

    const { error } = await supabase
      .from('product_prices')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString() // Update timestamp for audit trail
      })
      .match(updateConditions);

    if (error) throw new Error(`Error deactivating existing prices: ${error.message}`);
  },

  async deactivateExistingMasterPrices(clientId: string, masterRecipeId: string, constructionSite: string, plantId?: string) {
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

    const { error } = await supabase
      .from('product_prices')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString() // Update timestamp for audit trail
      })
      .match(updateConditions);

    if (error) throw new Error(`Error deactivating existing master prices: ${error.message}`);
  },

  async createNewPrice(priceData: ProductPriceData) {
    // Log the data being inserted
    console.log('Creating new price with data:', {
      code: priceData.code,
      type: priceData.type,
      fc_mr_value: priceData.fc_mr_value,
      construction_site: priceData.construction_site,
      plant_id: priceData.plant_id
    });

    const { error } = await supabase
      .from('product_prices')
      .insert({
        ...priceData,
        is_active: true
      });

    if (error) {
      console.error('Error details:', error);
      throw new Error(`Error creating new price: ${error.message}`);
    }
  },

  async handleQuoteApproval(quoteId: string) {
    // Get quote details with all necessary information including plant_id AND master_recipe_id
    const { data: quoteData, error: quoteError } = await supabase
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
      .single();

    if (quoteError) throw new Error(`Error fetching quote details: ${quoteError.message}`);
    if (!quoteData) throw new Error('Quote not found');
    if (!quoteData.quote_details || quoteData.quote_details.length === 0) {
      throw new Error('Quote has no details');
    }

    // Log the quote data
    console.log('Quote data:', {
      id: quoteData.id,
      quote_number: quoteData.quote_number,
      construction_site: quoteData.construction_site,
      plant_id: quoteData.plant_id,
      details_count: quoteData.quote_details.length
    });

    // Transform the data to ensure correct typing
    try {
      const quote: Quote = {
        id: quoteData.id,
        quote_number: quoteData.quote_number,
        client_id: quoteData.client_id,
        construction_site: quoteData.construction_site,
        plant_id: quoteData.plant_id,
        quote_details: quoteData.quote_details.map((detail: any) => {
          // Handle recipe-based quote details (concrete products)
          if (detail.recipe_id && detail.recipes) {
            const recipeData = Array.isArray(detail.recipes) 
              ? detail.recipes[0] 
              : detail.recipes;

            console.log('Recipe data:', {
              detail_id: detail.id,
              recipe_code: recipeData.recipe_code,
              strength_fc: recipeData.strength_fc,
              plant_id: recipeData.plant_id
            });

            return {
              id: detail.id,
              final_price: detail.final_price,
              recipe_id: detail.recipe_id,
              product_id: detail.product_id,
              pump_service: detail.pump_service,
              recipes: recipeData
            };
          }
          
          // Handle master-recipe-based quote details (NEW: master pricing flow)
          if (detail.master_recipe_id && detail.master_recipes) {
            const masterData = Array.isArray(detail.master_recipes) 
              ? detail.master_recipes[0] 
              : detail.master_recipes;

            console.log('Master recipe data:', {
              detail_id: detail.id,
              master_code: masterData.master_code,
              strength_fc: masterData.strength_fc,
              plant_id: masterData.plant_id
            });

            return {
              id: detail.id,
              final_price: detail.final_price,
              recipe_id: detail.recipe_id, // Can be null for master-based quotes
              master_recipe_id: detail.master_recipe_id,
              product_id: detail.product_id,
              pump_service: detail.pump_service,
              recipes: masterData // Treat master recipe same as recipe for price creation
            };
          }
          
          // Handle product-based quote details (standalone pumping services)
          if (detail.product_id && detail.product_prices) {
            const productData = Array.isArray(detail.product_prices) 
              ? detail.product_prices[0] 
              : detail.product_prices;

            console.log('Product data:', {
              detail_id: detail.id,
              product_code: productData.code,
              product_description: productData.description,
              product_type: productData.type,
              plant_id: productData.plant_id
            });

            return {
              id: detail.id,
              final_price: detail.final_price,
              recipe_id: detail.recipe_id,
              product_id: detail.product_id,
              pump_service: detail.pump_service,
              product_prices: productData
            };
          }

          // If neither recipe nor product data is available, throw an error
          throw new Error(`Neither recipe nor product data available for quote detail ${detail.id}`);
        })
      };

      // Process each quote detail
      const now = new Date().toISOString();
      const pricePromises = quote.quote_details.map(async (detail: QuoteDetail) => {
        try {
          // Handle recipe-based quote details (concrete products)
          if ((detail.recipe_id || detail.master_recipe_id) && detail.recipes) {
            const plantId = detail.recipes.plant_id || quote.plant_id;
            
            // Deactivate existing prices based on whether it's recipe-based or master-based
            // IMPORTANT: Deactivate both types if both exist, and also handle prices that might have both fields
            if (detail.recipe_id) {
              // Recipe-based: deactivate existing recipe-level prices
              // This will also catch prices that have both recipe_id and master_recipe_id set
              await productPriceService.deactivateExistingPrices(
                quote.client_id, 
                detail.recipe_id, 
                quote.construction_site,
                plantId
              );
            }
            
            if (detail.master_recipe_id) {
              // Master-based: deactivate existing master-level prices
              // This will also catch prices that have both recipe_id and master_recipe_id set
              await productPriceService.deactivateExistingMasterPrices(
                quote.client_id, 
                detail.master_recipe_id, 
                quote.construction_site,
                plantId
              );
            }
            
            // CRITICAL: Also deactivate any prices that have BOTH recipe_id and master_recipe_id set
            // This handles edge cases where old prices might have both fields
            if (detail.recipe_id && detail.master_recipe_id) {
              const { error: deactivateBothError } = await supabase
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
                console.warn('Error deactivating prices with both recipe_id and master_recipe_id:', deactivateBothError);
                // Don't throw - this is a cleanup operation, not critical
              }
            }

            // Create new price record with plant_id
            // PRIORITY: If master_recipe_id exists, create master-level price (applies to all variants)
            // Otherwise, create recipe-level price (specific variant)
            const codePrefix = detail.master_recipe_id
              ? (detail.recipes.master_code || 'MASTER')
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

            await productPriceService.createNewPrice(priceData);
          }
          
          // Handle product-based quote details (standalone pumping services)
          else if (detail.product_id && detail.product_prices) {
            // For pumping services, we don't need to create new product prices
            // since they're already using the special pumping service product
            console.log('Skipping price creation for pumping service product:', {
              detail_id: detail.id,
              product_code: detail.product_prices.code,
              product_description: detail.product_prices.description
            });
          }
          
          else {
            throw new Error(`Invalid quote detail: neither recipe nor product data available for detail ${detail.id}`);
          }
        } catch (error: any) {
          console.error('Error details for quote detail:', {
            detail_id: detail.id,
            error: error.message,
            recipe: detail.recipes,
            product: detail.product_prices
          });
          throw new Error(`Error processing quote detail ${detail.id}: ${error.message}`);
        }
      });

      // Wait for all price updates to complete
      await Promise.all(pricePromises);
    } catch (error: any) {
      console.error('Full error details:', error);
      throw new Error(`Error in price history processing: ${error.message}`);
    }
  }
}; 