import { NextRequest, NextResponse } from 'next/server';
import { productPriceService } from '@/lib/supabase/product-prices';
import { supabase } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';

// Use service role for admin operations (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request: NextRequest) {
  try {
    const { quoteIds, fixAll } = await request.json();

    // Security: Check if user is admin (you may want to add proper auth check)
    // For now, we'll allow it but log the operation

    let quotesToFix: Array<{ quote_id: string; quote_number: string }> = [];

    if (fixAll) {
      // Find all quotes missing product_prices
      const { data: quotesData, error: quotesError } = await supabaseAdmin
        .from('quotes')
        .select(`
          id,
          quote_number,
          quote_details (
            id,
            recipe_id,
            master_recipe_id
          )
        `)
        .eq('status', 'APPROVED')
        .not('approval_date', 'is', null)
        .order('approval_date', { ascending: false })
        .limit(100); // Limit to prevent timeout

      if (quotesError) {
        return NextResponse.json(
          { error: `Error fetching quotes: ${quotesError.message}` },
          { status: 500 }
        );
      }

      // Filter quotes that have details but no product_prices
      for (const quote of quotesData || []) {
        const details = quote.quote_details || [];
        const hasRecipeDetails = details.some((d: any) => d.recipe_id || d.master_recipe_id);
        
        if (details.length > 0 && hasRecipeDetails) {
          const { count } = await supabaseAdmin
            .from('product_prices')
            .select('*', { count: 'exact', head: true })
            .eq('quote_id', quote.id)
            .eq('is_active', true);

          if (count === 0) {
            quotesToFix.push({
              quote_id: quote.id,
              quote_number: quote.quote_number
            });
          }
        }
      }
    } else if (quoteIds && Array.isArray(quoteIds)) {
      // Fix specific quotes
      const { data: quotesData } = await supabaseAdmin
        .from('quotes')
        .select('id, quote_number')
        .in('id', quoteIds);

      quotesToFix = (quotesData || []).map(q => ({
        quote_id: q.id,
        quote_number: q.quote_number
      }));
    } else {
      return NextResponse.json(
        { error: 'Either quoteIds array or fixAll=true must be provided' },
        { status: 400 }
      );
    }

    console.log(`[fix-product-prices] Found ${quotesToFix.length} quotes to fix`);

    const results = {
      success: [] as Array<{ quote_id: string; quote_number: string; prices_created: number }>,
      failed: [] as Array<{ quote_id: string; quote_number: string; error: string }>
    };

    // Process each quote
    for (const quote of quotesToFix) {
      try {
        console.log(`[fix-product-prices] Processing quote ${quote.quote_number} (${quote.quote_id})`);
        
        // Call the fixed handleQuoteApproval function with admin client
        await productPriceService.handleQuoteApproval(quote.quote_id, supabaseAdmin);
        
        // Verify prices were created
        const { data: createdPrices, error: verifyError } = await supabaseAdmin
          .from('product_prices')
          .select('id')
          .eq('quote_id', quote.quote_id)
          .eq('is_active', true);

        if (verifyError) {
          results.failed.push({
            quote_id: quote.quote_id,
            quote_number: quote.quote_number,
            error: `Verification error: ${verifyError.message}`
          });
          continue;
        }

        const pricesCreated = createdPrices?.length || 0;
        
        if (pricesCreated > 0) {
          results.success.push({
            quote_id: quote.quote_id,
            quote_number: quote.quote_number,
            prices_created: pricesCreated
          });
          console.log(`[fix-product-prices] ✅ Successfully created ${pricesCreated} prices for ${quote.quote_number}`);
        } else {
          results.failed.push({
            quote_id: quote.quote_id,
            quote_number: quote.quote_number,
            error: 'No prices were created'
          });
        }
      } catch (error: any) {
        console.error(`[fix-product-prices] ❌ Error processing ${quote.quote_number}:`, error);
        results.failed.push({
          quote_id: quote.quote_id,
          quote_number: quote.quote_number,
          error: error.message || 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: `Processed ${quotesToFix.length} quotes`,
      results: {
        success_count: results.success.length,
        failed_count: results.failed.length,
        success: results.success,
        failed: results.failed
      }
    });
  } catch (error: any) {
    console.error('[fix-product-prices] Fatal error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return list of quotes missing product_prices
    const { data: quotesData, error: quotesError } = await supabaseAdmin
      .from('quotes')
      .select(`
        id,
        quote_number,
        client_id,
        construction_site,
        approval_date,
        quote_details (
          id,
          recipe_id,
          master_recipe_id
        )
      `)
      .eq('status', 'APPROVED')
      .not('approval_date', 'is', null)
      .order('approval_date', { ascending: false })
      .limit(100);

    if (quotesError) {
      return NextResponse.json(
        { error: `Error fetching quotes: ${quotesError.message}` },
        { status: 500 }
      );
    }

    const quotesMissingPrices = [];

    for (const quote of quotesData || []) {
      const details = quote.quote_details || [];
      const hasRecipeDetails = details.some((d: any) => d.recipe_id || d.master_recipe_id);
      
      if (details.length > 0 && hasRecipeDetails) {
        const { count } = await supabaseAdmin
          .from('product_prices')
          .select('*', { count: 'exact', head: true })
          .eq('quote_id', quote.id)
          .eq('is_active', true);

        if (count === 0) {
          quotesMissingPrices.push({
            quote_id: quote.id,
            quote_number: quote.quote_number,
            construction_site: quote.construction_site,
            approval_date: quote.approval_date,
            detail_count: details.length,
            master_recipe_details: details.filter((d: any) => d.master_recipe_id).length,
            recipe_details: details.filter((d: any) => d.recipe_id && !d.master_recipe_id).length
          });
        }
      }
    }

    return NextResponse.json({
      count: quotesMissingPrices.length,
      quotes: quotesMissingPrices
    });
  } catch (error: any) {
    console.error('[fix-product-prices] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

