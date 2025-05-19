import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';

export async function fetchAvailableRecipes() {
  try {
    // Primero, obtener las recetas
    const { data: recipes, error: recipesError } = await supabase
      .from('recipes')
      .select('id, recipe_code, age_days')
      .order('recipe_code', { ascending: true });
      
    if (recipesError) throw recipesError;
    
    // Luego obtener los precios activos para cada receta
    const { data: prices, error: pricesError } = await supabase
      .from('product_prices')
      .select('recipe_id, base_price')
      .eq('is_active', true)
      .in('recipe_id', recipes?.map(r => r.id) || []);
    
    if (pricesError) throw pricesError;
    
    // Crear un mapa de precios por receta
    const priceMap = (prices || []).reduce((acc, price) => {
      acc[price.recipe_id] = price.base_price;
      return acc;
    }, {} as Record<string, number>);
    
    // Enriquecer las recetas con sus precios
    const enrichedRecipes = (recipes || []).map(recipe => ({
      ...recipe,
      unit_price: priceMap[recipe.id] || 0
    }));
    
    return enrichedRecipes;
  } catch (error) {
    handleError(error, 'fetchAvailableRecipes');
    return [];
  }
} 