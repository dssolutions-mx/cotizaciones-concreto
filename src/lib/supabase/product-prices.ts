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
  recipe_id: string;
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
  recipe_id: string;
  recipes: Recipe;
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
      .update({ is_active: false })
      .match(updateConditions);

    if (error) throw new Error(`Error deactivating existing prices: ${error.message}`);
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
    // Get quote details with all necessary information including plant_id
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
          recipes (
            id,
            recipe_code,
            strength_fc,
            age_days,
            placement_type,
            max_aggregate_size,
            slump,
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
          if (!detail.recipes) {
            throw new Error(`Recipe data missing for quote detail ${detail.id}`);
          }

          // Log recipe data
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
            recipes: recipeData
          };
        })
      };

      // Process each quote detail
      const now = new Date().toISOString();
      const pricePromises = quote.quote_details.map(async (detail: QuoteDetail) => {
        try {
          // First deactivate existing prices for this client-recipe-construction_site combination
          await productPriceService.deactivateExistingPrices(
            quote.client_id, 
            detail.recipe_id, 
            quote.construction_site,
            detail.recipes.plant_id || quote.plant_id // Pass recipe plant_id or fallback to quote plant_id
          );

          // Create new price record with plant_id
          const priceData: ProductPriceData = {
            code: `${quote.quote_number}-${detail.recipes.recipe_code}`,
            description: `Precio específico para cliente - ${detail.recipes.recipe_code} - ${quote.construction_site}`,
            fc_mr_value: detail.recipes.strength_fc,
            type: determineProductType(),
            age_days: detail.recipes.age_days,
            placement_type: detail.recipes.placement_type,
            max_aggregate_size: detail.recipes.max_aggregate_size,
            slump: detail.recipes.slump,
            base_price: detail.final_price,
            recipe_id: detail.recipe_id,
            client_id: quote.client_id,
            construction_site: quote.construction_site,
            quote_id: quote.id,
            effective_date: now,
            approval_date: now,
            plant_id: detail.recipes.plant_id || quote.plant_id // Use recipe plant_id or fallback to quote plant_id
          };

          await productPriceService.createNewPrice(priceData);
        } catch (error: any) {
          console.error('Error details for quote detail:', {
            detail_id: detail.id,
            error: error.message,
            recipe: detail.recipes
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