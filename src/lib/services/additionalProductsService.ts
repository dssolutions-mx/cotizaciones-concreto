import { supabase } from '@/lib/supabase/client';
import { handleError } from '@/utils/errorHandler';
import type {
  AdditionalProduct,
  QuoteAdditionalProduct,
  OrderAdditionalProduct,
} from '@/types/additionalProducts';

/**
 * Get available additional products catalog
 */
export async function getAvailableProducts(plantId?: string): Promise<AdditionalProduct[]> {
  try {
    let query = supabase
      .from('additional_products')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (plantId) {
      query = query.or(`plant_id.is.null,plant_id.eq.${plantId}`);
    } else {
      query = query.is('plant_id', null);
    }

    const { data, error } = await query;

    // Handle case where table doesn't exist yet (migrations not run)
    if (error) {
      // Check if it's a 404 or table doesn't exist error
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.warn('additional_products table does not exist yet. Please run migrations.');
        return []; // Return empty array instead of throwing error
      }
      throw error;
    }
    return (data || []) as AdditionalProduct[];
  } catch (error) {
    const errorMessage = handleError(error, 'getAvailableProducts');
    console.error(errorMessage);
    // Return empty array if table doesn't exist to prevent UI crashes
    if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
      console.warn('additional_products table not found. Returning empty array.');
      return [];
    }
    throw new Error(errorMessage);
  }
}

/**
 * Calculate product price: base_price × (1 + margin_percentage/100)
 */
export function calculateProductPrice(basePrice: number, marginPercentage: number): number {
  return Math.round(basePrice * (1 + marginPercentage / 100) * 100) / 100;
}

/**
 * Add product to quote with base price + margin
 */
export async function addProductToQuote(
  quoteId: string,
  productId: string,
  quantity: number,
  marginPercentage: number,
  notes?: string
): Promise<QuoteAdditionalProduct> {
  try {
    // Get product base price
    const { data: product, error: productError } = await supabase
      .from('additional_products')
      .select('base_price')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      throw new Error(`Product not found: ${productId}`);
    }

    const basePrice = product.base_price;
    const unitPrice = calculateProductPrice(basePrice, marginPercentage);
    const totalPrice = Math.round(quantity * unitPrice * 100) / 100;

    // Insert into quote_additional_products
    const { data, error } = await supabase
      .from('quote_additional_products')
      .insert({
        quote_id: quoteId,
        additional_product_id: productId,
        quantity,
        base_price: basePrice,
        margin_percentage: marginPercentage,
        unit_price: unitPrice,
        total_price: totalPrice,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as QuoteAdditionalProduct;
  } catch (error) {
    const errorMessage = handleError(error, 'addProductToQuote');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Update product margin in quote
 */
export async function updateProductMargin(
  quoteId: string,
  productId: string,
  marginPercentage: number
): Promise<void> {
  try {
    // Get current product data
    const { data: quoteProduct, error: fetchError } = await supabase
      .from('quote_additional_products')
      .select('base_price, quantity')
      .eq('quote_id', quoteId)
      .eq('additional_product_id', productId)
      .single();

    if (fetchError || !quoteProduct) {
      throw new Error(`Quote product not found`);
    }

    const unitPrice = calculateProductPrice(quoteProduct.base_price, marginPercentage);
    const totalPrice = Math.round(quoteProduct.quantity * unitPrice * 100) / 100;

    // Update
    const { error } = await supabase
      .from('quote_additional_products')
      .update({
        margin_percentage: marginPercentage,
        unit_price: unitPrice,
        total_price: totalPrice,
      })
      .eq('quote_id', quoteId)
      .eq('additional_product_id', productId);

    if (error) throw error;
  } catch (error) {
    const errorMessage = handleError(error, 'updateProductMargin');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Remove product from quote
 */
export async function removeProductFromQuote(
  quoteId: string,
  productId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('quote_additional_products')
      .delete()
      .eq('quote_id', quoteId)
      .eq('additional_product_id', productId);

    if (error) throw error;
  } catch (error) {
    const errorMessage = handleError(error, 'removeProductFromQuote');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Get additional products for a quote
 */
export async function getQuoteAdditionalProducts(
  quoteId: string
): Promise<QuoteAdditionalProduct[]> {
  try {
    const { data, error } = await supabase
      .from('quote_additional_products')
      .select(`
        *,
        product:additional_products(*)
      `)
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      product: item.product as AdditionalProduct,
    })) as QuoteAdditionalProduct[];
  } catch (error) {
    const errorMessage = handleError(error, 'getQuoteAdditionalProducts');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Copy quote products to order (used during order creation)
 */
export async function copyQuoteProductsToOrder(
  quoteId: string,
  orderId: string
): Promise<OrderAdditionalProduct[]> {
  try {
    // Get quote products
    const quoteProducts = await getQuoteAdditionalProducts(quoteId);

    if (quoteProducts.length === 0) {
      return [];
    }

    // Copy to order_additional_products
    const orderProducts = quoteProducts.map((qp) => ({
      order_id: orderId,
      quote_additional_product_id: qp.id,
      additional_product_id: qp.additional_product_id,
      quantity: qp.quantity, // Can be adjusted later if needed
      unit_price: qp.unit_price, // Locked from quote
      total_price: qp.quantity * qp.unit_price,
      notes: qp.notes || null,
    }));

    const { data, error } = await supabase
      .from('order_additional_products')
      .insert(orderProducts)
      .select(`
        *,
        product:additional_products(*),
        quote_product:quote_additional_products(*)
      `);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      product: item.product as AdditionalProduct,
      quote_product: item.quote_product as QuoteAdditionalProduct,
    })) as OrderAdditionalProduct[];
  } catch (error) {
    const errorMessage = handleError(error, 'copyQuoteProductsToOrder');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Get additional products for an order
 */
export async function getOrderAdditionalProducts(
  orderId: string
): Promise<OrderAdditionalProduct[]> {
  try {
    const { data, error } = await supabase
      .from('order_additional_products')
      .select(`
        *,
        product:additional_products(*),
        quote_product:quote_additional_products(*)
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      product: item.product as AdditionalProduct,
      quote_product: item.quote_product as QuoteAdditionalProduct,
    })) as OrderAdditionalProduct[];
  } catch (error) {
    const errorMessage = handleError(error, 'getOrderAdditionalProducts');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

