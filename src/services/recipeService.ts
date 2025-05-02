import { supabase } from '@/lib/supabase';
import { handleError } from '@/utils/errorHandler';

export async function fetchAvailableRecipes() {
  try {
    const { data, error } = await supabase
      .from('recipes')
      .select('id, recipe_code, age_days')
      .order('recipe_code', { ascending: true });
      
    if (error) throw error;
    
    return data || [];
  } catch (error) {
    handleError(error, 'fetchAvailableRecipes');
    return [];
  }
} 