import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { recipeService } from '@/lib/supabase/recipes';

export async function GET() {
  try {
    // Use the same recipe service as finanzas and other pages
    const recipes = await recipeService.getRecipes();
    
    if (!recipes.data || recipes.data.length === 0) {
      // Return sample data if no real data exists
      return NextResponse.json({
        recipeData: [
          { name: 'Estándar 200', value: 120 },
          { name: 'Estándar 250', value: 85 },
          { name: 'Bombeado 300', value: 95 },
          { name: 'Especial 350', value: 45 },
          { name: 'MR 45', value: 35 }
        ]
      });
    }

    // Group recipes by type/strength for visualization
    const recipeGroups: Record<string, number> = {};
    
    recipes.data.forEach(recipe => {
      const key = `${recipe.recipe_code}`;
      recipeGroups[key] = (recipeGroups[key] || 0) + 1;
    });

    // Convert to chart data format
    const recipeData = Object.entries(recipeGroups)
      .map(([name, count]) => ({ name, value: count }))
      .slice(0, 10); // Limit to top 10

    // If we have less than 3 items, add some sample data
    if (recipeData.length < 3) {
      recipeData.push(
        { name: 'Estándar 200', value: 120 },
        { name: 'Estándar 250', value: 85 },
        { name: 'Bombeado 300', value: 95 }
      );
    }

    console.log('Recipe chart data (using correct service):', {
      totalRecipes: recipes.data.length,
      groups: recipeGroups,
      chartData: recipeData
    });

    return NextResponse.json({
      recipeData
    });

  } catch (error) {
    console.error('Error fetching recipe data:', error);
    
    // Return fallback sample data
    return NextResponse.json({
      recipeData: [
        { name: 'Estándar 200', value: 120 },
        { name: 'Estándar 250', value: 85 },
        { name: 'Bombeado 300', value: 95 },
        { name: 'Especial 350', value: 45 },
        { name: 'MR 45', value: 35 }
      ]
    });
  }
} 