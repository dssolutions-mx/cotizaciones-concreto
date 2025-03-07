import { NextResponse } from 'next/server';
import { recipeService } from '@/lib/supabase/recipes';

export async function GET() {
  try {
    // Fetch recipe distribution
    const { data: recipes } = await recipeService.getRecipes();
    
    // Group recipes by strength/type
    const recipeGroups: Record<string, number> = {};
    if (recipes) {
      recipes.forEach(recipe => {
        const key = `H-${recipe.strength_fc}`;
        if (!recipeGroups[key]) {
          recipeGroups[key] = 0;
        }
        recipeGroups[key]++;
      });
    }
    
    // Convert to the expected chart data format
    const recipeData = Object.entries(recipeGroups).map(([name, value]) => ({
      name, 
      value
    }));
    
    return NextResponse.json({ 
      recipeData 
    }, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' // Cache for 1 hour, stale for 2
      }
    });
    
  } catch (error) {
    console.error('Error fetching recipe data:', error);
    return NextResponse.json({ error: 'Error loading recipe data' }, { status: 500 });
  }
} 