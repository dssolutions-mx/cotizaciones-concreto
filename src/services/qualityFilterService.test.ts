import { fetchFilterOptions, fetchFilterOptionsForType } from './qualityFilterService';
import { format, subDays } from 'date-fns';

// Simple test to verify the filtering system works
export async function testQualityFiltering() {
  console.log('🧪 Testing Quality Filtering System...');
  
  try {
    // Test with a recent date range
    const endDate = new Date();
    const startDate = subDays(endDate, 30);
    
    const dateRange = {
      from: startDate,
      to: endDate
    };
    
    console.log('📅 Testing with date range:', {
      from: format(startDate, 'yyyy-MM-dd'),
      to: format(endDate, 'yyyy-MM-dd')
    });
    
    const filterOptions = await fetchFilterOptions(dateRange);
    
    console.log('✅ Filter Options Retrieved:', {
      clients: filterOptions.clients.length,
      constructionSites: filterOptions.constructionSites.length,
      recipes: filterOptions.recipes.length,
      plants: filterOptions.plants.length,
      availableAges: filterOptions.availableAges.length
    });
    
    // Log sample data
    if (filterOptions.clients.length > 0) {
      console.log('👥 Sample Clients:', filterOptions.clients.slice(0, 3));
    }
    
    if (filterOptions.plants.length > 0) {
      console.log('🏭 Sample Plants:', filterOptions.plants.slice(0, 3));
    }
    
    if (filterOptions.recipes.length > 0) {
      console.log('📋 Sample Recipes:', filterOptions.recipes.slice(0, 3));
    }
    
    if (filterOptions.constructionSites.length > 0) {
      console.log('🏗️ Sample Construction Sites:', filterOptions.constructionSites.slice(0, 3));
    }
    
    // Test cascading filtering
    console.log('🔄 Testing cascading filtering system...');
    
    if (filterOptions.clients.length > 0) {
      const testClient = filterOptions.clients[0];
      console.log(`🎯 Testing with client: ${testClient.business_name}`);
      console.log(`🎯 Client ID: ${testClient.id}`);
      console.log(`🎯 Client Code: ${testClient.client_code}`);
      
      // Test cascading: Client → Recipes
      console.log('🔄 Testing cascading: Client → Recipes');
      const filteredRecipes = await fetchFilterOptionsForType('recipes', dateRange, {
        selectedClient: testClient.id
      });
      
      // Test cascading: Client → Plants
      console.log('🔄 Testing cascading: Client → Plants');
      const filteredPlants = await fetchFilterOptionsForType('plants', dateRange, {
        selectedClient: testClient.id
      });
      
      // Test cascading: Client → Construction Sites
      console.log('🔄 Testing cascading: Client → Construction Sites');
      const filteredConstructionSites = await fetchFilterOptionsForType('constructionSites', dateRange, {
        selectedClient: testClient.id
      });
      
      console.log('📊 Cascading filtering results:', {
        originalRecipes: filterOptions.recipes.length,
        filteredRecipes: filteredRecipes.length,
        originalPlants: filterOptions.plants.length,
        filteredPlants: filteredPlants.length,
        originalConstructionSites: filterOptions.constructionSites.length,
        filteredConstructionSites: filteredConstructionSites.length
      });
      
      // Test multi-level cascading: Client + Recipe → Plants
      if (filteredRecipes.length > 0) {
        console.log('🔄 Testing multi-level cascading: Client + Recipe → Plants');
        const testRecipe = filteredRecipes[0];
        const multiLevelFilteredPlants = await fetchFilterOptionsForType('plants', dateRange, {
          selectedClient: testClient.id,
          selectedRecipe: testRecipe.recipe_code
        });
        
        console.log('📊 Multi-level cascading results:', {
          singleLevelFilteredPlants: filteredPlants.length,
          multiLevelFilteredPlants: multiLevelFilteredPlants.length,
          testRecipe: testRecipe.recipe_code
        });
      }
      
      // Test with client code as well
      if (testClient.client_code) {
        console.log('🔄 Testing cascading with client code...');
        const filteredRecipesByCode = await fetchFilterOptionsForType('recipes', dateRange, {
          selectedClient: testClient.client_code
        });
        
        console.log('📊 Cascading by client code results:', {
          filteredRecipesByCode: filteredRecipesByCode.length
        });
      }
    }

    return {
      success: true,
      filterOptions,
      message: 'Quality filtering system test completed successfully'
    };
    
  } catch (error) {
    console.error('❌ Quality filtering test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Quality filtering system test failed'
    };
  }
}

// Make test function available globally for console testing
if (typeof window !== 'undefined') {
  (window as any).testQualityFiltering = testQualityFiltering;
}
