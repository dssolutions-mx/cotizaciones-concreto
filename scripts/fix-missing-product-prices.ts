/**
 * Script to fix quotes that are missing product_prices records
 * This validates that the fixes in handleQuoteApproval work correctly
 */

import { productPriceService } from '../src/lib/supabase/product-prices';
import { supabase } from '../src/lib/supabase/client';

interface QuoteToFix {
  quote_id: string;
  quote_number: string;
  client_id: string;
  construction_site: string;
  detail_count: number;
  master_recipe_details: number;
  recipe_details: number;
}

async function findQuotesMissingProductPrices(): Promise<QuoteToFix[]> {
  console.log('🔍 Finding quotes missing product_prices...');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT 
        q.id as quote_id,
        q.quote_number,
        q.client_id,
        q.construction_site,
        COUNT(qd.id) as detail_count,
        COUNT(CASE WHEN qd.master_recipe_id IS NOT NULL THEN 1 END) as master_recipe_details,
        COUNT(CASE WHEN qd.recipe_id IS NOT NULL THEN 1 END) as recipe_details
      FROM quotes q
      LEFT JOIN quote_details qd ON qd.quote_id = q.id
      LEFT JOIN product_prices pp ON pp.quote_id = q.id AND pp.is_active = true
      WHERE q.status = 'APPROVED'
        AND q.approval_date IS NOT NULL
      GROUP BY q.id, q.quote_number, q.client_id, q.construction_site
      HAVING COUNT(qd.id) > 0 
        AND COUNT(CASE WHEN qd.master_recipe_id IS NOT NULL OR qd.recipe_id IS NOT NULL THEN 1 END) > 0
        AND COUNT(pp.id) = 0
      ORDER BY q.approval_date DESC
    `
  });

  if (error) {
    // Fallback: use direct query
    const { data: quotesData, error: quotesError } = await supabase
      .from('quotes')
      .select(`
        id,
        quote_number,
        client_id,
        construction_site,
        quote_details (
          id,
          recipe_id,
          master_recipe_id
        )
      `)
      .eq('status', 'APPROVED')
      .not('approval_date', 'is', null)
      .order('approval_date', { ascending: false });

    if (quotesError) {
      throw new Error(`Error fetching quotes: ${quotesError.message}`);
    }

    // Get quotes that have details but no product_prices
    const quotesToFix: QuoteToFix[] = [];
    
    for (const quote of quotesData || []) {
      const details = quote.quote_details || [];
      const hasRecipeDetails = details.some((d: any) => d.recipe_id || d.master_recipe_id);
      
      if (details.length > 0 && hasRecipeDetails) {
        // Check if product_prices exist
        const { count } = await supabase
          .from('product_prices')
          .select('*', { count: 'exact', head: true })
          .eq('quote_id', quote.id)
          .eq('is_active', true);

        if (count === 0) {
          quotesToFix.push({
            quote_id: quote.id,
            quote_number: quote.quote_number,
            client_id: quote.client_id,
            construction_site: quote.construction_site,
            detail_count: details.length,
            master_recipe_details: details.filter((d: any) => d.master_recipe_id).length,
            recipe_details: details.filter((d: any) => d.recipe_id && !d.master_recipe_id).length
          });
        }
      }
    }

    return quotesToFix;
  }

  return data || [];
}

async function fixQuote(quoteId: string, quoteNumber: string): Promise<{ success: boolean; error?: string; pricesCreated?: number }> {
  try {
    console.log(`\n📝 Processing quote ${quoteNumber} (${quoteId})...`);
    
    // Call the fixed handleQuoteApproval function
    await productPriceService.handleQuoteApproval(quoteId);
    
    // Verify prices were created
    const { data: createdPrices, error: verifyError } = await supabase
      .from('product_prices')
      .select('id', { count: 'exact' })
      .eq('quote_id', quoteId)
      .eq('is_active', true);

    if (verifyError) {
      return { success: false, error: `Verification error: ${verifyError.message}` };
    }

    const pricesCreated = createdPrices?.length || 0;
    
    if (pricesCreated > 0) {
      console.log(`✅ Successfully created ${pricesCreated} product_price(s) for quote ${quoteNumber}`);
      return { success: true, pricesCreated };
    } else {
      return { success: false, error: 'No prices were created' };
    }
  } catch (error: any) {
    console.error(`❌ Error processing quote ${quoteNumber}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting fix for missing product_prices...\n');

  try {
    // Find all quotes that need fixing
    const quotesToFix = await findQuotesMissingProductPrices();
    
    console.log(`\n📊 Found ${quotesToFix.length} quotes missing product_prices\n`);
    
    if (quotesToFix.length === 0) {
      console.log('✅ No quotes need fixing!');
      return;
    }

    // Process each quote
    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ quote: string; error: string }>
    };

    for (const quote of quotesToFix) {
      const result = await fixQuote(quote.quote_id, quote.quote_number);
      
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          quote: quote.quote_number,
          error: result.error || 'Unknown error'
        });
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully fixed: ${results.success} quotes`);
    console.log(`❌ Failed: ${results.failed} quotes`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.forEach(({ quote, error }) => {
        console.log(`  - ${quote}: ${error}`);
      });
    }
    
    console.log('='.repeat(60));
  } catch (error: any) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✨ Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}

export { fixQuote, findQuotesMissingProductPrices };


