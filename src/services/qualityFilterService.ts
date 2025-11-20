import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import type { DateRange } from "react-day-picker";

export interface FilterOptions {
  clients: Array<{ id: string; business_name: string }>;
  constructionSites: Array<{ id: string; name: string; client_id: string }>;
  recipes: Array<{ id: string; recipe_code: string; strength_fc: number }>;
  plants: Array<{ id: string; code: string; name: string }>;
  availableAges: Array<{ value: string; label: string }>;
  fcValues: Array<{ value: string; label: string }>;
  specimenTypes: Array<{ value: string; label: string }>;
}

export interface FilterSelections {
  selectedClient: string;
  selectedConstructionSite: string;
  selectedRecipe: string;
  selectedPlant: string;
  selectedClasificacion: 'all' | 'FC' | 'MR';
  selectedSpecimenType: string;
  selectedFcValue: string;
  selectedAge: string;
}

/**
 * Fetches all available filter options based on the date range and current selections
 * This follows the correct relationship chain: muestreos -> remisiones -> orders -> clients
 * All filters are interdependent - selecting a client will filter recipes and plants too
 */
export async function fetchFilterOptions(
  dateRange: DateRange | undefined,
  currentSelections: Partial<FilterSelections> = {}
): Promise<FilterOptions> {
  try {
    console.log('🔍 Fetching filter options with cascading filtering:', currentSelections);
    
    // Step 1: Get filtered muestreos using cascading logic
    const muestreosData = await getFilteredMuestreos(dateRange, currentSelections);
    
    if (!muestreosData || muestreosData.length === 0) {
      console.log('📊 No muestreos found after cascading filters');
      return {
        clients: [],
        constructionSites: [],
        recipes: [],
        plants: [],
        availableAges: [],
        fcValues: [],
        specimenTypes: []
      };
    }

    console.log(`📊 Found ${muestreosData.length} muestreos after cascading filters`);

    // Step 2: Extract unique IDs from the filtered muestreos
    const orderIds = new Set<string>();
    const recipeIds = new Set<string>();
    const plantIds = new Set<string>();
    const plantCodes = new Set<string>();

    muestreosData.forEach(muestreo => {
      if (muestreo.remision?.order_id) {
        orderIds.add(muestreo.remision.order_id);
      }
      if (muestreo.remision?.recipe_id) {
        recipeIds.add(muestreo.remision.recipe_id);
      }
      if (muestreo.plant_id) {
        plantIds.add(muestreo.plant_id);
      }
      if (muestreo.planta) {
        plantCodes.add(muestreo.planta);
      }
    });

    console.log('📊 Extracted IDs from filtered muestreos:', {
      orderIds: orderIds.size,
      recipeIds: recipeIds.size,
      plantIds: plantIds.size,
      plantCodes: plantCodes.size
    });

    // Step 3: Fetch related data from the filtered muestreos
    const ordersData = orderIds.size > 0 ? await fetchOrdersWithClients(Array.from(orderIds)) : [];
    const recipesData = recipeIds.size > 0 ? await fetchRecipes(Array.from(recipeIds)) : [];
    const plantsData = await fetchPlants(Array.from(plantIds), Array.from(plantCodes));

    // Step 4: Build filter options from the filtered data
    const clients = ordersData.map(order => ({
      id: order.clients?.id || order.client_id,
      business_name: order.clients?.business_name || 'Cliente Desconocido',
      client_code: order.clients?.client_code || order.client_id
    })).filter((client, index, self) => 
      index === self.findIndex(c => c.id === client.id)
    ).sort((a, b) => a.business_name.localeCompare(b.business_name));

    const constructionSites = buildConstructionSites(ordersData);
    const availableAges = buildAvailableAges(muestreosData);
    const fcValues = buildFcValues(muestreosData);
    const specimenTypes = buildSpecimenTypes(muestreosData);

    const filterOptions: FilterOptions = {
      clients,
      constructionSites: constructionSites.sort((a, b) => a.name.localeCompare(b.name)),
      recipes: recipesData.sort((a, b) => a.recipe_code.localeCompare(b.recipe_code)),
      plants: plantsData.sort((a, b) => a.name.localeCompare(b.name)),
      availableAges: availableAges.sort((a, b) => parseInt(a.value) - parseInt(b.value)),
      fcValues: fcValues.sort((a, b) => Number(a.value) - Number(b.value)),
      specimenTypes: specimenTypes.sort((a, b) => a.label.localeCompare(b.label))
    };

    console.log('✅ Filter options loaded with cascading filtering:', {
      clients: filterOptions.clients.length,
      constructionSites: filterOptions.constructionSites.length,
      recipes: filterOptions.recipes.length,
      plants: filterOptions.plants.length,
      availableAges: filterOptions.availableAges.length,
      fcValues: filterOptions.fcValues.length,
      specimenTypes: filterOptions.specimenTypes.length
    });

    return filterOptions;

  } catch (error) {
    console.error('🚨 Error in fetchFilterOptions:', error);
    return {
      clients: [],
      constructionSites: [],
      recipes: [],
      plants: [],
      availableAges: [],
      fcValues: [],
      specimenTypes: []
    };
  }
}

/**
 * Fetches orders with client information (simplified for cascading filtering)
 */
async function fetchOrdersWithClients(orderIds: string[]) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      client_id,
      construction_site,
      clients (
        id,
        business_name,
        client_code
      )
    `)
    .in('id', orderIds)
    .not('order_status', 'eq', 'cancelled');

  if (error) {
    console.error('❌ Error fetching orders:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetches recipes
 */
async function fetchRecipes(recipeIds: string[]) {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, recipe_code, strength_fc')
    .in('id', recipeIds);

  if (error) {
    console.error('❌ Error fetching recipes:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetches plants by both IDs and codes
 */
async function fetchPlants(plantIds: string[], plantCodes: string[]) {
  const plants = new Map<string, { id: string; code: string; name: string }>();

  // Fetch by plant IDs
  if (plantIds.length > 0) {
    const { data: plantsById, error: plantsByIdError } = await supabase
      .from('plants')
      .select('id, code, name')
      .in('id', plantIds);

    if (!plantsByIdError && plantsById) {
      plantsById.forEach(plant => {
        plants.set(plant.id, plant);
      });
    }
  }

  // Fetch by plant codes
  if (plantCodes.length > 0) {
    const { data: plantsByCode, error: plantsByCodeError } = await supabase
      .from('plants')
      .select('id, code, name')
      .in('code', plantCodes);

    if (!plantsByCodeError && plantsByCode) {
      plantsByCode.forEach(plant => {
        plants.set(plant.id, plant);
      });
    }
  }

  // If we still don't have all plants, try to derive from names
  const missingCodes = plantCodes.filter(code => 
    !Array.from(plants.values()).some(plant => plant.code === code)
  );

  if (missingCodes.length > 0) {
    // Try to find plants by name patterns
    const { data: allPlants, error: allPlantsError } = await supabase
      .from('plants')
      .select('id, code, name')
      .limit(100);

    if (!allPlantsError && allPlants) {
      allPlants.forEach(plant => {
        const nameLower = plant.name.toLowerCase();
        
        // Map common plant name patterns to codes
        if (nameLower.includes('planta 1') || nameLower.includes('plant 1')) {
          if (missingCodes.includes('P001') || missingCodes.includes('P1')) {
            plants.set(plant.id, plant);
          }
        }
        if (nameLower.includes('planta 2') || nameLower.includes('plant 2')) {
          if (missingCodes.includes('P002') || missingCodes.includes('P2')) {
            plants.set(plant.id, plant);
          }
        }
        if (nameLower.includes('planta 3') || nameLower.includes('plant 3')) {
          if (missingCodes.includes('P003') || missingCodes.includes('P3')) {
            plants.set(plant.id, plant);
          }
        }
        if (nameLower.includes('planta 4') || nameLower.includes('plant 4')) {
          if (missingCodes.includes('P004') || missingCodes.includes('P4')) {
            plants.set(plant.id, plant);
          }
        }
      });
    }
  }

  return Array.from(plants.values());
}

/**
 * Builds construction sites from orders data
 */
function buildConstructionSites(ordersData: any[]) {
  const sitesMap = new Map<string, { id: string; name: string; client_id: string; client_code: string }>();

  ordersData.forEach(order => {
    if (order.construction_site && order.clients?.id) {
      // Use the proper client ID from the joined table, but keep client_code for the composite key
      const clientId = order.clients.id;
      const clientCode = order.clients.client_code || order.client_id;
      const siteKey = `${clientCode}-${order.construction_site}`;
      
      console.log('🔍 Building construction site:', { 
        client_id: clientId,
        client_code: clientCode,
        construction_site: order.construction_site, 
        siteKey 
      });
      
      if (!sitesMap.has(siteKey)) {
        sitesMap.set(siteKey, {
          id: siteKey,
          name: order.construction_site,
          client_id: clientId, // Use the proper UUID
          client_code: clientCode // Keep the client code for filtering
        });
      }
    }
  });

  const sites = Array.from(sitesMap.values());
  console.log('🔍 Built construction sites:', sites);
  return sites;
}

/**
 * Builds available ages from concrete specs
 */
function buildAvailableAges(muestreosData: any[]) {
  // Use a Map to track unique age combinations (value + unit)
  const ageMap = new Map<string, { originalValue: number; unit: string; sortKey: number }>();

  muestreosData.forEach(muestreo => {
    const concreteSpecs = muestreo.concrete_specs;
    if (concreteSpecs?.valor_edad && concreteSpecs?.unidad_edad) {
      const { valor_edad, unidad_edad } = concreteSpecs;

      // Create a unique key for this age
      const key = `${valor_edad}_${unidad_edad}`;

      // Calculate sort key in days for proper ordering
      let sortKey: number;
      if (unidad_edad === 'HORA' || unidad_edad === 'H') {
        sortKey = valor_edad / 24;
      } else if (unidad_edad === 'DÍA' || unidad_edad === 'D') {
        sortKey = valor_edad;
      } else {
        sortKey = 28; // Default fallback
      }

      if (!ageMap.has(key)) {
        ageMap.set(key, {
          originalValue: valor_edad,
          unit: unidad_edad,
          sortKey
        });
      }
    }
  });

  return Array.from(ageMap.values())
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(age => {
      const { originalValue, unit } = age;
      let label: string;

      if (unit === 'HORA' || unit === 'H') {
        label = originalValue === 1 ? '1 hora' : `${originalValue} horas`;
      } else if (unit === 'DÍA' || unit === 'D') {
        label = originalValue === 1 ? '1 día' : `${originalValue} días`;
      } else {
        label = `${originalValue} ${unit}`;
      }

      // Value is originalValue_unit for filtering
      return {
        value: `${originalValue}_${unit}`,
        label
      };
    });
}

/**
 * Builds unique FC values from recipes in muestreos
 */
function buildFcValues(muestreosData: any[]) {
  const fcSet = new Set<number>();

  muestreosData.forEach(muestreo => {
    const recipe = muestreo.remision?.recipe;
    if (recipe?.strength_fc && recipe.strength_fc > 0) {
      fcSet.add(recipe.strength_fc);
    }
  });

  return Array.from(fcSet)
    .sort((a, b) => a - b)
    .map(fc => ({
      value: fc.toString(),
      label: `${fc} kg/cm2`
    }));
}

/**
 * Builds unique specimen types from muestras in muestreos
 */
function buildSpecimenTypes(muestreosData: any[]) {
  const specimenSet = new Set<string>();

  muestreosData.forEach(muestreo => {
    const muestras = muestreo.muestras || [];
    muestras.forEach((muestra: any) => {
      if (muestra.tipo_muestra) {
        specimenSet.add(muestra.tipo_muestra);
      }
    });
  });

  return Array.from(specimenSet)
    .map(type => ({
      value: type,
      label: type
    }));
}

/**
 * Filters construction sites based on selected client
 */
export function getFilteredConstructionSites(
  constructionSites: Array<{ id: string; name: string; client_id: string; client_code?: string }>,
  selectedClient: string
) {
  if (!selectedClient || selectedClient === 'all') {
    return constructionSites;
  }

  // Check if selectedClient is a UUID or client_code
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (uuidRegex.test(selectedClient)) {
    // It's a UUID, filter by client_id
    return constructionSites.filter(site => site.client_id === selectedClient);
  } else {
    // It's a client_code, filter by client_code
    return constructionSites.filter(site => site.client_code === selectedClient);
  }
}

/**
 * Validates if a filter selection is still valid given current options
 */
export function validateFilterSelection(
  selection: string,
  options: any[],
  keyField: string = 'id'
): boolean {
  if (selection === 'all') return true;
  return options.some(option => option[keyField] === selection);
}

/**
 * Gets filtered muestreos that have valid ensayos meeting regulatory conditions
 * This ensures we only show options that actually have valid data
 */
export async function getFilteredMuestreos(
  dateRange: DateRange | undefined,
  currentSelections: Partial<FilterSelections> = {},
  soloEdadGarantia: boolean = false,
  incluirEnsayosFueraTiempo: boolean = true
): Promise<any[]> {
  try {
    console.log('🔍 Getting muestreos with valid ensayos:', {
      currentSelections,
      soloEdadGarantia,
      incluirEnsayosFueraTiempo
    });

    if (!dateRange?.from || !dateRange?.to) {
      console.log('❌ No date range provided for filtering');
      return [];
    }

    const fechaDesde = format(dateRange.from, 'yyyy-MM-dd');
    const fechaHasta = format(dateRange.to, 'yyyy-MM-dd');

    console.log('📅 Date range for filtering muestreos:', { fechaDesde, fechaHasta });

    // Step 1: Get muestreos in date range with their ensayos
    const { data: muestreosWithEnsayos, error: muestreosError } = await supabase
      .from('muestreos')
      .select(`
        id,
        fecha_muestreo,
        planta,
        plant_id,
        concrete_specs,
        remision:remision_id (
          id,
          order_id,
          recipe_id,
          recipe:recipe_id (
            id,
            recipe_code,
            strength_fc
          )
        ),
        muestras (
          id,
          tipo_muestra,
          ensayos (
            id,
            fecha_ensayo,
            is_edad_garantia,
            is_ensayo_fuera_tiempo,
            resistencia_calculada
          )
        )
      `)
      .gte('fecha_muestreo', fechaDesde)
      .lte('fecha_muestreo', fechaHasta)
      .order('fecha_muestreo', { ascending: false });

    console.log('🔍 Raw muestreos data sample:', muestreosWithEnsayos?.slice(0, 2));

    if (muestreosError) {
      console.error('❌ Error fetching muestreos with ensayos:', muestreosError);
      return [];
    }

    if (!muestreosWithEnsayos || muestreosWithEnsayos.length === 0) {
      console.log('❌ No muestreos found in date range');
      return [];
    }

    console.log('📊 Muestreos found in date range:', muestreosWithEnsayos.length);

    // Step 2: Filter muestreos that have valid ensayos meeting regulatory conditions
    const validMuestreos = muestreosWithEnsayos.filter(muestreo => {
      // Check if this muestreo has any valid ensayos
      const hasValidEnsayos = muestreo.muestras?.some((muestra: any) => 
        muestra.ensayos?.some((ensayo: any) => {
          // Must have valid resistencia_calculada
          if (!ensayo.resistencia_calculada || ensayo.resistencia_calculada <= 0) {
            return false;
          }

          // Check edad garantia condition
          if (soloEdadGarantia && !ensayo.is_edad_garantia) {
            return false;
          }

          // Check ensayos fuera de tiempo condition
          if (!incluirEnsayosFueraTiempo && ensayo.is_ensayo_fuera_tiempo) {
            return false;
          }

          return true;
        })
      );

      return hasValidEnsayos;
    });

    console.log('📊 Muestreos with valid ensayos:', validMuestreos.length);

    if (validMuestreos.length === 0) {
      console.log('❌ No muestreos found with valid ensayos meeting regulatory conditions');
      return [];
    }

    // Step 3: Apply cascading filters to the valid muestreos
    let filteredMuestreos = validMuestreos;

    // Filter by plant first (direct muestreo property)
    if (currentSelections.selectedPlant && currentSelections.selectedPlant !== 'all') {
      console.log('🔍 Filtering by plant:', currentSelections.selectedPlant);
      
      // Try to find plant by name first, then by code
      const { data: plantData } = await supabase
        .from('plants')
        .select('id, code, name')
        .or(`name.eq.${currentSelections.selectedPlant},code.eq.${currentSelections.selectedPlant}`)
        .single();
      
      if (plantData) {
        filteredMuestreos = filteredMuestreos.filter(m => m.plant_id === plantData.id);
      } else {
        filteredMuestreos = filteredMuestreos.filter(m => m.planta === currentSelections.selectedPlant);
      }
      
      console.log(`📊 After plant filter: ${filteredMuestreos.length} muestreos`);
    }

    // Filter by FC/MR classification (from concrete_specs)
    if (currentSelections.selectedClasificacion && currentSelections.selectedClasificacion !== 'all') {
      console.log('🔍 Filtering by classification:', currentSelections.selectedClasificacion);
      filteredMuestreos = filteredMuestreos.filter(m => {
        const concreteSpecs = m.concrete_specs;
        if (concreteSpecs?.clasificacion) {
          return concreteSpecs.clasificacion === currentSelections.selectedClasificacion;
        }
        // Fallback: check recipe code for MR classification
        if (currentSelections.selectedClasificacion === 'MR') {
          return m.remision?.recipe?.recipe_code?.includes('MR');
        }
        return currentSelections.selectedClasificacion === 'FC';
      });
      console.log(`📊 After classification filter: ${filteredMuestreos.length} muestreos`);
    }

    // Filter by FC value (from recipe strength_fc)
    if (currentSelections.selectedFcValue && currentSelections.selectedFcValue !== 'all') {
      console.log('🔍 Filtering by FC value:', currentSelections.selectedFcValue);
      const fcValue = parseInt(currentSelections.selectedFcValue);
      filteredMuestreos = filteredMuestreos.filter(m => {
        const recipe = m.remision?.recipe;
        return recipe?.strength_fc === fcValue;
      });
      console.log(`📊 After FC value filter: ${filteredMuestreos.length} muestreos`);
    }

    // Filter by specimen type (from muestras)
    if (currentSelections.selectedSpecimenType && currentSelections.selectedSpecimenType !== 'all') {
      console.log('🔍 Filtering by specimen type:', currentSelections.selectedSpecimenType);
      filteredMuestreos = filteredMuestreos.filter(m => {
        const muestras = m.muestras || [];
        return muestras.some((muestra: any) => muestra.tipo_muestra === currentSelections.selectedSpecimenType);
      });
      console.log(`📊 After specimen type filter: ${filteredMuestreos.length} muestreos`);
    }

    // Filter by age guarantee (from concrete_specs)
    if (currentSelections.selectedAge && currentSelections.selectedAge !== 'all') {
      console.log('🔍 Filtering by age guarantee:', currentSelections.selectedAge);

      // Parse the selectedAge which is now in format "value_unit" (e.g., "12_HORA", "28_DÍA")
      const [targetValue, targetUnit] = currentSelections.selectedAge.split('_');
      const targetAgeValue = parseInt(targetValue);

      filteredMuestreos = filteredMuestreos.filter(m => {
        const concreteSpecs = m.concrete_specs;
        if (concreteSpecs?.valor_edad && concreteSpecs?.unidad_edad) {
          const { valor_edad, unidad_edad } = concreteSpecs;

          // Match by exact value and unit
          return valor_edad === targetAgeValue &&
                 (unidad_edad === targetUnit ||
                  (unidad_edad === 'H' && targetUnit === 'HORA') ||
                  (unidad_edad === 'HORA' && targetUnit === 'H') ||
                  (unidad_edad === 'D' && targetUnit === 'DÍA') ||
                  (unidad_edad === 'DÍA' && targetUnit === 'D'));
        }
        return false;
      });
      console.log(`📊 After age guarantee filter: ${filteredMuestreos.length} muestreos`);
    }

    // Filter by recipe (through remision)
    if (currentSelections.selectedRecipe && currentSelections.selectedRecipe !== 'all') {
      console.log('🔍 Filtering by recipe:', currentSelections.selectedRecipe);
      filteredMuestreos = filteredMuestreos.filter(m => 
        m.remision?.recipe?.recipe_code === currentSelections.selectedRecipe
      );
      console.log(`📊 After recipe filter: ${filteredMuestreos.length} muestreos`);
    }

    // Filter by client (through remision -> order)
    if (currentSelections.selectedClient && currentSelections.selectedClient !== 'all') {
      console.log('🔍 Filtering by client:', currentSelections.selectedClient);
      
      // Get order IDs from the filtered muestreos
      const orderIds = new Set<string>();
      filteredMuestreos.forEach(m => {
        if (m.remision?.order_id) {
          orderIds.add(m.remision.order_id);
        }
      });

      if (orderIds.size > 0) {
        // Fetch orders and filter by client
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, client_id, clients(id, client_code)')
          .in('id', Array.from(orderIds))
          .not('order_status', 'eq', 'cancelled');

        if (ordersData) {
          // Check if selectedClient is UUID or client_code
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let validOrderIds: Set<string>;

          if (uuidRegex.test(currentSelections.selectedClient)) {
            // It's a UUID, filter by client_id
            validOrderIds = new Set(
              ordersData
                .filter(order => order.client_id === currentSelections.selectedClient)
                .map(order => order.id)
            );
          } else {
            // It's a client_code, filter by client_code
            validOrderIds = new Set(
              ordersData
                .filter(order => order.clients?.client_code === currentSelections.selectedClient)
                .map(order => order.id)
            );
          }

          // Filter muestreos to only those with valid order IDs
          filteredMuestreos = filteredMuestreos.filter(m => 
            m.remision?.order_id && validOrderIds.has(m.remision.order_id)
          );
        }
      }
      
      console.log(`📊 After client filter: ${filteredMuestreos.length} muestreos`);
    }

    // Filter by construction site (through remision -> order)
    if (currentSelections.selectedConstructionSite && currentSelections.selectedConstructionSite !== 'all') {
      console.log('🔍 Filtering by construction site:', currentSelections.selectedConstructionSite);
      
      // Parse construction site (format: "client_code-construction_site")
      const [clientCode, siteName] = currentSelections.selectedConstructionSite.split('-');
      
      if (clientCode && siteName) {
        // Get order IDs from the filtered muestreos
        const orderIds = new Set<string>();
        filteredMuestreos.forEach(m => {
          if (m.remision?.order_id) {
            orderIds.add(m.remision.order_id);
          }
        });

        if (orderIds.size > 0) {
          // Find the client_id for the client_code
          const { data: clientData } = await supabase
            .from('clients')
            .select('id')
            .eq('client_code', clientCode)
            .single();

          if (clientData) {
            // Fetch orders and filter by client_id and construction_site
            const { data: ordersData } = await supabase
              .from('orders')
              .select('id')
              .in('id', Array.from(orderIds))
              .eq('client_id', clientData.id)
              .eq('construction_site', siteName)
              .not('order_status', 'eq', 'cancelled');

            if (ordersData) {
              const validOrderIds = new Set(ordersData.map(order => order.id));
              
              // Filter muestreos to only those with valid order IDs
              filteredMuestreos = filteredMuestreos.filter(m => 
                m.remision?.order_id && validOrderIds.has(m.remision.order_id)
              );
            }
          }
        }
      }
      
      console.log(`📊 After construction site filter: ${filteredMuestreos.length} muestreos`);
    }

    console.log(`✅ Final filtered muestreos: ${filteredMuestreos.length}`);
    return filteredMuestreos;

  } catch (error) {
    console.error('🚨 Error in getFilteredMuestreos:', error);
    return [];
  }
}

/**
 * Fetches filter options for a specific filter type, excluding that filter from the query
 * This allows for truly interdependent filtering
 */
export async function fetchFilterOptionsForType(
  filterType: 'clients' | 'constructionSites' | 'recipes' | 'plants' | 'availableAges' | 'fcValues' | 'specimenTypes',
  dateRange: DateRange | undefined,
  currentSelections: Partial<FilterSelections> = {}
): Promise<any[]> {
  try {
    console.log(`🔍 Fetching ${filterType} options with cascading filtering:`, currentSelections);
    
    // Use the cascading filtering logic to get filtered muestreos
    const muestreosData = await getFilteredMuestreos(dateRange, currentSelections);
    
    if (!muestreosData || muestreosData.length === 0) {
      return [];
    }

    // Extract unique IDs from the filtered muestreos
    const orderIds = new Set<string>();
    const recipeIds = new Set<string>();
    const plantIds = new Set<string>();
    const plantCodes = new Set<string>();

    muestreosData.forEach(muestreo => {
      if (muestreo.remision?.order_id) {
        orderIds.add(muestreo.remision.order_id);
      }
      if (muestreo.remision?.recipe_id) {
        recipeIds.add(muestreo.remision.recipe_id);
      }
      if (muestreo.plant_id) {
        plantIds.add(muestreo.plant_id);
      }
      if (muestreo.planta) {
        plantCodes.add(muestreo.planta);
      }
    });

    // Fetch orders with client information
    const ordersData = orderIds.size > 0 ? await fetchOrdersWithClients(Array.from(orderIds)) : [];

    // Return the appropriate data based on filter type
    switch (filterType) {
      case 'clients':
        const clients = ordersData.map(order => ({
          id: order.clients?.id || order.client_id,
          business_name: order.clients?.business_name || 'Cliente Desconocido',
          client_code: order.clients?.client_code || order.client_id
        })).filter((client, index, self) => 
          index === self.findIndex(c => c.id === client.id)
        ).sort((a, b) => a.business_name.localeCompare(b.business_name));
        
        console.log(`🔍 Fetched ${clients.length} clients with cascading filtering`);
        return clients;

      case 'constructionSites':
        const sitesMap = new Map<string, { id: string; name: string; client_id: string; client_code: string }>();
        ordersData.forEach(order => {
          if (order.construction_site && order.clients?.id) {
            const clientId = order.clients.id;
            const clientCode = order.clients.client_code || order.client_id;
            const siteKey = `${clientCode}-${order.construction_site}`;
            
            if (!sitesMap.has(siteKey)) {
              sitesMap.set(siteKey, {
                id: siteKey,
                name: order.construction_site,
                client_id: clientId,
                client_code: clientCode
              });
            }
          }
        });
        const sites = Array.from(sitesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        console.log(`🔍 Fetched ${sites.length} construction sites with cascading filtering`);
        return sites;

      case 'recipes':
        const recipesData = recipeIds.size > 0 ? await fetchRecipes(Array.from(recipeIds)) : [];
        const recipes = recipesData.sort((a, b) => a.recipe_code.localeCompare(b.recipe_code));
        console.log(`🔍 Fetched ${recipes.length} recipes with cascading filtering`);
        return recipes;

      case 'plants':
        const plantsData = await fetchPlants(Array.from(plantIds), Array.from(plantCodes));
        const plants = plantsData.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`🔍 Fetched ${plants.length} plants with cascading filtering`);
        return plants;

      case 'availableAges':
        // For ages, we need to get ALL available ages, not just from filtered muestreos
        // This prevents the circular dependency where selecting an age filters out other ages
        const allMuestreosForAge = await getFilteredMuestreos(dateRange, {
          ...currentSelections,
          selectedAge: 'all' // Exclude age from filtering to get all available ages
        });
        
        const ageSet = new Set<number>();
        allMuestreosForAge.forEach(muestreo => {
          const concreteSpecs = muestreo.concrete_specs;
          if (concreteSpecs?.valor_edad && concreteSpecs?.unidad_edad) {
            const { valor_edad, unidad_edad } = concreteSpecs;
            let ageInDays: number;
            
            if (unidad_edad === 'HORA' || unidad_edad === 'H') {
              ageInDays = Math.round(valor_edad / 24);
            } else if (unidad_edad === 'DÍA' || unidad_edad === 'D') {
              ageInDays = valor_edad;
            } else {
              ageInDays = 28; // Default fallback
            }
            
            ageSet.add(ageInDays);
          }
        });
        const ages = Array.from(ageSet)
          .sort((a, b) => a - b)
          .map(age => ({
            value: age.toString(),
            label: age === 1 ? '1 día' : `${age} días`
          }));
        console.log(`🔍 Fetched ${ages.length} available ages (excluding age filter to prevent circular dependency)`);
        return ages;

      case 'fcValues':
        // Get FC values directly from recipes to avoid circular dependency
        console.log('🔍 Fetching FC values directly from recipes...');
        
        if (!dateRange?.from || !dateRange?.to) {
          console.log('❌ No date range provided for FC values');
          return [];
        }

        // Get FC values directly from recipes that are used in muestreos within the date range
        const { data: fcRecipesData, error: recipesError } = await supabase
          .from('recipes')
          .select('id, recipe_code, strength_fc')
          .not('strength_fc', 'is', null)
          .gt('strength_fc', 0);

        if (recipesError) {
          console.error('❌ Error fetching recipes for FC values:', recipesError);
          return [];
        }

        console.log('🔍 Direct recipes query result:', fcRecipesData?.slice(0, 5));

        const fcSet = new Set<number>();
        if (fcRecipesData && fcRecipesData.length > 0) {
          fcRecipesData.forEach(recipe => {
            if (recipe.strength_fc && recipe.strength_fc > 0) {
              fcSet.add(recipe.strength_fc);
              console.log(`✅ Added FC value: ${recipe.strength_fc}`);
            }
          });
        }
        
        const fcValues = Array.from(fcSet)
          .sort((a, b) => a - b)
          .map(fc => ({
            value: fc.toString(),
            label: `${fc} kg/cm2`
          }));
        console.log(`🔍 Final FC values extracted:`, fcValues);
        console.log(`🔍 Fetched ${fcValues.length} FC values from direct recipes query`);
        return fcValues;

      case 'specimenTypes':
        // For specimen types, we need to get ALL available specimen types, not just from filtered muestreos
        // This prevents the circular dependency where selecting a specimen type filters out other specimen types
        const allMuestreosForSpecimen = await getFilteredMuestreos(dateRange, {
          ...currentSelections,
          selectedSpecimenType: 'all' // Exclude specimen type from filtering to get all available specimen types
        });
        
        const specimenSet = new Set<string>();
        allMuestreosForSpecimen.forEach(muestreo => {
          const muestras = muestreo.muestras || [];
          muestras.forEach((muestra: any) => {
            if (muestra.tipo_muestra) {
              specimenSet.add(muestra.tipo_muestra);
            }
          });
        });
        const specimenTypes = Array.from(specimenSet)
          .map(type => ({
            value: type,
            label: type
          }));
        console.log(`🔍 Fetched ${specimenTypes.length} specimen types (excluding specimen type filter to prevent circular dependency)`);
        return specimenTypes;

      default:
        return [];
    }

  } catch (error) {
    console.error(`🚨 Error in fetchFilterOptionsForType for ${filterType}:`, error);
    return [];
  }
}
