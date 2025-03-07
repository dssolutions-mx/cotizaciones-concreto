import { priceService } from '@/lib/supabase/prices';

interface MaterialQuantity {
  material_type: string;
  quantity: number;
  unit: string;
}

export const calculateBasePrice = async (
  recipeId: string,
  materials: MaterialQuantity[]
): Promise<number> => {
  try {
    // Obtener precios actuales de materiales
    const { data: currentPrices } = await priceService.getCurrentMaterialPrices();
    if (!currentPrices) throw new Error('No se encontraron precios de materiales');

    // Obtener gastos administrativos actuales
    const { data: adminCosts } = await priceService.getCurrentAdminCosts();
    if (!adminCosts) throw new Error('No se encontraron gastos administrativos');

    // Calcular costo de materiales
    let materialCost = 0;
    for (const material of materials) {
      const price = currentPrices.find(p => p.material_type === material.material_type);
      if (price) {
        materialCost += material.quantity * price.price_per_unit;
      }
    }

    // Sumar gastos administrativos
    const adminCostTotal = adminCosts.reduce((sum, cost) => sum + cost.amount, 0);

    // Calcular precio base (con un margen de utilidad del 20% por defecto)
    const basePrice = (materialCost + adminCostTotal) * 1.0;

    return Number(basePrice.toFixed(2));
  } catch (error) {
    console.error('Error calculando precio base:', error);
    throw error;
  }
}; 