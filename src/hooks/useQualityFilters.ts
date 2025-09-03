import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import type { DateRange } from "react-day-picker";
import { supabase } from '@/lib/supabase';
import type { DatoGraficoResistencia } from '@/types/quality';
import { 
  fetchFilterOptions, 
  fetchFilterOptionsForType,
  getFilteredConstructionSites, 
  validateFilterSelection,
  type FilterOptions,
  type FilterSelections 
} from '@/services/qualityFilterService';

// Re-export types from the service
export type { FilterOptions, FilterSelections };

export function useQualityFilters(dateRange: DateRange | undefined) {
  // Filter data states
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    clients: [],
    constructionSites: [],
    recipes: [],
    plants: [],
    availableAges: []
  });
  const [loading, setLoading] = useState(false);

  // Selection states
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('all');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedClasificacion, setSelectedClasificacion] = useState<'all' | 'FC' | 'MR'>('all');
  const [selectedSpecimenType, setSelectedSpecimenType] = useState<'all' | 'CILINDRO' | 'VIGA' | 'CUBO'>('all');
  const [selectedStrengthRange, setSelectedStrengthRange] = useState<'all' | 'lt-200' | '200-250' | '250-300' | '300-350' | '350-400' | 'gt-400'>('all');
  const [selectedAge, setSelectedAge] = useState<string>('all');

  // Popover states
  const [openClient, setOpenClient] = useState(false);
  const [openSite, setOpenSite] = useState(false);
  const [openRecipe, setOpenRecipe] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);
  const [openStrengthRange, setOpenStrengthRange] = useState(false);
  const [openAge, setOpenAge] = useState(false);

  // Load filter options when date range changes
  const loadFilterOptions = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setFilterOptions({
        clients: [],
        constructionSites: [],
        recipes: [],
        plants: [],
        availableAges: []
      });
      return;
    }

    setLoading(true);
    try {
      const options = await fetchFilterOptions(dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedStrengthRange,
        selectedAge
      });
      
      setFilterOptions(options);
      
      // Validate current selections and reset if invalid
      if (!validateFilterSelection(selectedClient, options.clients, 'id')) {
        setSelectedClient('all');
      }
      if (!validateFilterSelection(selectedConstructionSite, options.constructionSites, 'id')) {
        setSelectedConstructionSite('all');
      }
      if (!validateFilterSelection(selectedRecipe, options.recipes, 'recipe_code')) {
        setSelectedRecipe('all');
      }
      if (!validateFilterSelection(selectedPlant, options.plants, 'name')) {
        setSelectedPlant('all');
      }
      if (!validateFilterSelection(selectedAge, options.availableAges, 'value')) {
        setSelectedAge('all');
      }
      
    } catch (error) {
      console.error('Error loading filter options:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, selectedAge]);

  // Filter construction sites based on selected client
  useEffect(() => {
    if (selectedClient && selectedClient !== 'all') {
      // If client changes, reset construction site selection
      setSelectedConstructionSite('all');
    }
  }, [selectedClient]);

  // Function to get filtered construction sites based on selected client
  const getFilteredConstructionSitesCallback = useCallback(() => {
    return getFilteredConstructionSites(filterOptions.constructionSites, selectedClient);
  }, [filterOptions.constructionSites, selectedClient]);

  // Load filter options when dependencies change
  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  // Load individual filter options when specific selections change
  const loadClients = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      const clients = await fetchFilterOptionsForType('clients', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedStrengthRange,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, clients }));
      
      // Reset client selection if no longer available
      if (selectedClient !== 'all' && !clients.some(c => c.id === selectedClient)) {
        setSelectedClient('all');
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, selectedAge]);

  const loadConstructionSites = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      const constructionSites = await fetchFilterOptionsForType('constructionSites', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedStrengthRange,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, constructionSites }));
      
      // Reset construction site selection if no longer available
      if (selectedConstructionSite !== 'all' && !constructionSites.some(s => s.id === selectedConstructionSite)) {
        setSelectedConstructionSite('all');
      }
    } catch (error) {
      console.error('Error loading construction sites:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, selectedAge]);

  const loadRecipes = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      const recipes = await fetchFilterOptionsForType('recipes', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedStrengthRange,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, recipes }));
      
      // Reset recipe selection if no longer available
      if (selectedRecipe !== 'all' && !recipes.some(r => r.recipe_code === selectedRecipe)) {
        setSelectedRecipe('all');
      }
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, selectedAge]);

  const loadPlants = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      const plants = await fetchFilterOptionsForType('plants', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedStrengthRange,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, plants }));
      
      // Reset plant selection if no longer available
      if (selectedPlant !== 'all' && !plants.some(p => p.name === selectedPlant)) {
        setSelectedPlant('all');
      }
    } catch (error) {
      console.error('Error loading plants:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, selectedAge]);

  const loadAvailableAges = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      const availableAges = await fetchFilterOptionsForType('availableAges', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedStrengthRange,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, availableAges }));
      
      // Reset age selection if no longer available
      if (selectedAge !== 'all' && !availableAges.some(a => a.value === selectedAge)) {
        setSelectedAge('all');
      }
    } catch (error) {
      console.error('Error loading available ages:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedStrengthRange, selectedAge]);

  // Load interdependent filters when selections change
  useEffect(() => {
    loadClients();
  }, [loadClients]);

  useEffect(() => {
    loadConstructionSites();
  }, [loadConstructionSites]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

  useEffect(() => {
    loadAvailableAges();
  }, [loadAvailableAges]);



  // Function to reset all filters
  const resetAllFilters = useCallback(() => {
    setSelectedClient('all');
    setSelectedConstructionSite('all');
    setSelectedRecipe('all');
    setSelectedPlant('all');
    setSelectedClasificacion('all');
    setSelectedSpecimenType('all');
    setSelectedStrengthRange('all');
    setSelectedAge('all');
  }, []);

  return {
    // Data states
    clients: filterOptions.clients,
    constructionSites: filterOptions.constructionSites,
    recipes: filterOptions.recipes,
    plants: filterOptions.plants.map(plant => plant.name), // Convert to string array for compatibility
    availableAges: filterOptions.availableAges,
    loading,

    // Selection states
    selectedClient,
    selectedConstructionSite,
    selectedRecipe,
    selectedPlant,
    selectedClasificacion,
    selectedSpecimenType,
    selectedStrengthRange,
    selectedAge,

    // Popover states
    openClient,
    openSite,
    openRecipe,
    openPlant,
    openStrengthRange,
    openAge,

    // Setters
    setSelectedClient,
    setSelectedConstructionSite,
    setSelectedRecipe,
    setSelectedPlant,
    setSelectedClasificacion,
    setSelectedSpecimenType,
    setSelectedStrengthRange,
    setSelectedAge,

    // Popover setters
    setOpenClient,
    setOpenSite,
    setOpenRecipe,
    setOpenPlant,
    setOpenStrengthRange,
    setOpenAge,

    // Utility functions
    getFilteredConstructionSites: getFilteredConstructionSitesCallback,
    resetAllFilters
  };
}
