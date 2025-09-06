import { useState, useEffect, useCallback, useRef } from 'react';
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
    availableAges: [],
    fcValues: [],
    specimenTypes: []
  });
  const [loading, setLoading] = useState(false);
  
  // Debouncing refs to prevent rapid filter updates
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // Selection states
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedConstructionSite, setSelectedConstructionSite] = useState<string>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<string>('all');
  const [selectedPlant, setSelectedPlant] = useState<string>('all');
  const [selectedClasificacion, setSelectedClasificacion] = useState<'all' | 'FC' | 'MR'>('all');
  const [selectedSpecimenType, setSelectedSpecimenType] = useState<string>('all');
  const [selectedFcValue, setSelectedFcValue] = useState<string>('all');
  const [selectedAge, setSelectedAge] = useState<string>('all');

  // Popover states
  const [openClient, setOpenClient] = useState(false);
  const [openSite, setOpenSite] = useState(false);
  const [openRecipe, setOpenRecipe] = useState(false);
  const [openPlant, setOpenPlant] = useState(false);
  const [openFcValue, setOpenFcValue] = useState(false);
  const [openAge, setOpenAge] = useState(false);

  // Load filter options when date range changes - without aggressive validation
  const loadFilterOptions = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) {
      setFilterOptions({
        clients: [],
        constructionSites: [],
        recipes: [],
        plants: [],
        availableAges: [],
        fcValues: [],
        specimenTypes: []
      });
      return;
    }

    setLoading(true);
    try {
      // Load options without current selections to avoid circular dependencies
      const options = await fetchFilterOptions(dateRange, {});
      
      setFilterOptions(options);
      
      // Only validate selections on initial load, not on every filter change
      // This prevents the aggressive resetting that was breaking user selections
      
    } catch (error) {
      console.error('Error loading filter options:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]); // Only depend on dateRange to avoid circular dependencies

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // Smart validation function that only resets when truly necessary
  const validateAndResetSelection = useCallback((
    currentSelection: string,
    availableOptions: any[],
    keyField: string,
    setter: (value: string) => void,
    filterName: string
  ) => {
    if (currentSelection !== 'all' && !availableOptions.some(option => option[keyField] === currentSelection)) {
      console.log(`🔄 Resetting invalid ${filterName} selection:`, currentSelection);
      setter('all');
    }
  }, []);

  // Debounced filter update function to prevent rapid updates
  const debouncedUpdateFilters = useCallback((updateFunction: () => void, delay: number = 300) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      // Only update if enough time has passed since last update
      if (now - lastUpdateRef.current > delay) {
        lastUpdateRef.current = now;
        updateFunction();
      }
    }, delay);
  }, []);

  // Load individual filter options when specific selections change
  const loadClients = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      // Don't include selectedClient in the filter selections to avoid circular dependency
      const clients = await fetchFilterOptionsForType('clients', dateRange, {
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedFcValue,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, clients }));
      
      // Only validate if the selection is truly invalid
      validateAndResetSelection(selectedClient, clients, 'id', setSelectedClient, 'client');
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }, [dateRange, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedFcValue, selectedAge, selectedClient, validateAndResetSelection]);

  const loadConstructionSites = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      // Don't include selectedConstructionSite in the filter selections to avoid circular dependency
      const constructionSites = await fetchFilterOptionsForType('constructionSites', dateRange, {
        selectedClient,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedFcValue,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, constructionSites }));
      
      // Only validate if the selection is truly invalid
      validateAndResetSelection(selectedConstructionSite, constructionSites, 'id', setSelectedConstructionSite, 'construction site');
    } catch (error) {
      console.error('Error loading construction sites:', error);
    }
  }, [dateRange, selectedClient, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedFcValue, selectedAge, selectedConstructionSite, validateAndResetSelection]);

  const loadRecipes = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      // Don't include selectedRecipe in the filter selections to avoid circular dependency
      const recipes = await fetchFilterOptionsForType('recipes', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedFcValue,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, recipes }));
      
      // Only validate if the selection is truly invalid
      validateAndResetSelection(selectedRecipe, recipes, 'recipe_code', setSelectedRecipe, 'recipe');
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedFcValue, selectedAge, selectedRecipe, validateAndResetSelection]);

  const loadPlants = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      // Don't include selectedPlant in the filter selections to avoid circular dependency
      const plants = await fetchFilterOptionsForType('plants', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedClasificacion,
        selectedSpecimenType,
        selectedFcValue,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, plants }));
      
      // Only validate if the selection is truly invalid
      validateAndResetSelection(selectedPlant, plants, 'name', setSelectedPlant, 'plant');
    } catch (error) {
      console.error('Error loading plants:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedClasificacion, selectedSpecimenType, selectedFcValue, selectedAge, selectedPlant, validateAndResetSelection]);

  const loadAvailableAges = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      // Don't include selectedAge in the filter selections to avoid circular dependency
      const availableAges = await fetchFilterOptionsForType('availableAges', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedFcValue
      });
      
      setFilterOptions(prev => ({ ...prev, availableAges }));
      
      // Only validate if the selection is truly invalid
      validateAndResetSelection(selectedAge, availableAges, 'value', setSelectedAge, 'age');
    } catch (error) {
      console.error('Error loading available ages:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedFcValue, selectedAge, validateAndResetSelection]);

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

  const loadFcValues = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      // Don't include selectedFcValue in the filter selections to avoid circular dependency
      const fcValues = await fetchFilterOptionsForType('fcValues', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedSpecimenType,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, fcValues }));
      
      // Only validate if the selection is truly invalid
      validateAndResetSelection(selectedFcValue, fcValues, 'value', setSelectedFcValue, 'FC value');
    } catch (error) {
      console.error('Error loading FC values:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedSpecimenType, selectedAge, selectedFcValue, validateAndResetSelection]);

  const loadSpecimenTypes = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    try {
      // Don't include selectedSpecimenType in the filter selections to avoid circular dependency
      const specimenTypes = await fetchFilterOptionsForType('specimenTypes', dateRange, {
        selectedClient,
        selectedConstructionSite,
        selectedRecipe,
        selectedPlant,
        selectedClasificacion,
        selectedFcValue,
        selectedAge
      });
      
      setFilterOptions(prev => ({ ...prev, specimenTypes }));
      
      // Only validate if the selection is truly invalid
      validateAndResetSelection(selectedSpecimenType, specimenTypes, 'value', setSelectedSpecimenType, 'specimen type');
    } catch (error) {
      console.error('Error loading specimen types:', error);
    }
  }, [dateRange, selectedClient, selectedConstructionSite, selectedRecipe, selectedPlant, selectedClasificacion, selectedFcValue, selectedAge, selectedSpecimenType, validateAndResetSelection]);

  useEffect(() => {
    loadFcValues();
  }, [loadFcValues]);

  useEffect(() => {
    loadSpecimenTypes();
  }, [loadSpecimenTypes]);



  // Function to reset all filters
  const resetAllFilters = useCallback(() => {
    setSelectedClient('all');
    setSelectedConstructionSite('all');
    setSelectedRecipe('all');
    setSelectedPlant('all');
    setSelectedClasificacion('all');
    setSelectedSpecimenType('all');
    setSelectedFcValue('all');
    setSelectedAge('all');
  }, []);

  return {
    // Data states
    clients: filterOptions.clients,
    constructionSites: filterOptions.constructionSites,
    recipes: filterOptions.recipes,
    plants: filterOptions.plants.map(plant => plant.name), // Convert to string array for compatibility
    availableAges: filterOptions.availableAges,
    fcValues: filterOptions.fcValues,
    specimenTypes: filterOptions.specimenTypes,
    loading,

    // Selection states
    selectedClient,
    selectedConstructionSite,
    selectedRecipe,
    selectedPlant,
    selectedClasificacion,
    selectedSpecimenType,
    selectedFcValue,
    selectedAge,

    // Popover states
    openClient,
    openSite,
    openRecipe,
    openPlant,
    openFcValue,
    openAge,

    // Setters
    setSelectedClient,
    setSelectedConstructionSite,
    setSelectedRecipe,
    setSelectedPlant,
    setSelectedClasificacion,
    setSelectedSpecimenType,
    setSelectedFcValue,
    setSelectedAge,

    // Popover setters
    setOpenClient,
    setOpenSite,
    setOpenRecipe,
    setOpenPlant,
    setOpenFcValue,
    setOpenAge,

    // Utility functions
    getFilteredConstructionSites: getFilteredConstructionSitesCallback,
    resetAllFilters
  };
}
