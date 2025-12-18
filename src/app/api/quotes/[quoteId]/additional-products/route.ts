import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getQuoteAdditionalProducts,
  addProductToQuote,
  updateProductMargin,
  removeProductFromQuote,
} from '@/lib/services/additionalProductsService';

/**
 * GET /api/quotes/[quoteId]/additional-products
 * Get additional products for a quote
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { quoteId } = await params;
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await getQuoteAdditionalProducts(quoteId);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching quote additional products:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quotes/[quoteId]/additional-products
 * Add product to quote (with base price + margin calculation)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { quoteId } = await params;
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, quantity, margin_percentage, notes } = body;

    if (!product_id || quantity === undefined || margin_percentage === undefined) {
      return NextResponse.json(
        { error: 'product_id, quantity, and margin_percentage are required' },
        { status: 400 }
      );
    }

    const product = await addProductToQuote(
      quoteId,
      product_id,
      quantity,
      margin_percentage,
      notes
    );

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error adding product to quote:', error);
    return NextResponse.json(
      { 
        error: 'Failed to add product',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/quotes/[quoteId]/additional-products
 * Update product quantity/margin/notes in quote
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { quoteId } = await params;
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, quantity, margin_percentage, notes } = body;

    if (!product_id) {
      return NextResponse.json(
        { error: 'product_id is required' },
        { status: 400 }
      );
    }

    // Update margin if provided
    if (margin_percentage !== undefined) {
      await updateProductMargin(quoteId, product_id, margin_percentage);
    }

    // Update quantity and notes if provided
    if (quantity !== undefined || notes !== undefined) {
      // Get current product to recalculate total
      const { data: currentProduct } = await supabase
        .from('quote_additional_products')
        .select('base_price, margin_percentage, unit_price')
        .eq('quote_id', quoteId)
        .eq('additional_product_id', product_id)
        .single();

      if (currentProduct) {
        const finalQuantity = quantity !== undefined ? quantity : currentProduct.quantity;
        const finalMargin = margin_percentage !== undefined ? margin_percentage : currentProduct.margin_percentage;
        const unitPrice = currentProduct.base_price * (1 + finalMargin / 100);
        const totalPrice = finalQuantity * unitPrice;

        const { error: updateError } = await supabase
          .from('quote_additional_products')
          .update({
            quantity: finalQuantity,
            margin_percentage: finalMargin,
            unit_price: unitPrice,
            total_price: totalPrice,
            notes: notes !== undefined ? notes : undefined,
          })
          .eq('quote_id', quoteId)
          .eq('additional_product_id', product_id);

        if (updateError) throw updateError;
      }
    }

    // Return updated product
    const products = await getQuoteAdditionalProducts(quoteId);
    const updatedProduct = products.find(p => p.additional_product_id === product_id);

    return NextResponse.json(updatedProduct || {});
  } catch (error) {
    console.error('Error updating quote product:', error);
    return NextResponse.json(
      { 
        error: 'Failed to update product',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/quotes/[quoteId]/additional-products
 * Remove product from quote
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { quoteId } = await params;
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const product_id = searchParams.get('product_id');

    if (!product_id) {
      return NextResponse.json(
        { error: 'product_id query parameter is required' },
        { status: 400 }
      );
    }

    await removeProductFromQuote(quoteId, product_id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing product from quote:', error);
    return NextResponse.json(
      { 
        error: 'Failed to remove product',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

