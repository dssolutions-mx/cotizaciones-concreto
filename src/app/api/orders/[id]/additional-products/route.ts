import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getOrderAdditionalProducts,
  copyQuoteProductsToOrder,
} from '@/lib/services/additionalProductsService';

/**
 * GET /api/orders/[id]/additional-products
 * Get additional products for an order (from quote)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const products = await getOrderAdditionalProducts(id);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching order additional products:', error);
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
 * POST /api/orders/[id]/additional-products
 * Copy quote products to order (during order creation)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { quote_id } = body;

    if (!quote_id) {
      return NextResponse.json(
        { error: 'quote_id is required' },
        { status: 400 }
      );
    }

    const products = await copyQuoteProductsToOrder(quote_id, id);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error copying products to order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to copy products',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orders/[id]/additional-products
 * Update quantity (if allowed, maintaining quote unit price)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;
    
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product_id, quantity } = body;

    if (!product_id || quantity === undefined) {
      return NextResponse.json(
        { error: 'product_id and quantity are required' },
        { status: 400 }
      );
    }

    // Get current product to maintain unit_price
    const { data: currentProduct } = await supabase
      .from('order_additional_products')
      .select('unit_price')
      .eq('order_id', id)
      .eq('additional_product_id', product_id)
      .single();

    if (!currentProduct) {
      return NextResponse.json(
        { error: 'Product not found in order' },
        { status: 404 }
      );
    }

    // Update quantity while maintaining unit_price from quote
    const totalPrice = quantity * currentProduct.unit_price;

    const { error: updateError } = await supabase
      .from('order_additional_products')
      .update({
        quantity,
        total_price: totalPrice,
      })
      .eq('order_id', id)
      .eq('additional_product_id', product_id);

    if (updateError) throw updateError;

    const products = await getOrderAdditionalProducts(id);
    const updatedProduct = products.find(p => p.additional_product_id === product_id);

    return NextResponse.json(updatedProduct || {});
  } catch (error) {
    console.error('Error updating order product:', error);
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
 * DELETE /api/orders/[id]/additional-products
 * Remove product from order (if order not yet fulfilled)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { id } = await params;
    
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

    // Check order status - only allow deletion if order is not fulfilled
    const { data: order } = await supabase
      .from('orders')
      .select('order_status')
      .eq('id', id)
      .single();

    if (order && ['fulfilled', 'delivered', 'completed'].includes(order.order_status)) {
      return NextResponse.json(
        { error: 'Cannot remove products from fulfilled orders' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('order_additional_products')
      .delete()
      .eq('order_id', id)
      .eq('additional_product_id', product_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing product from order:', error);
    return NextResponse.json(
      { 
        error: 'Failed to remove product',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

