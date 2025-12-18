import { supabase } from '@/lib/supabase/client';
import { handleError } from '@/utils/errorHandler';

export interface DistanceRangeConfig {
  id: string;
  plant_id: string;
  bloque_number: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  range_code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  min_distance_km: number;
  max_distance_km: number;
  diesel_per_trip: number;
  maintenance_per_trip: number;
  operator_bonus_per_trip: number;
  tires_per_trip: number;
  total_per_trip: number;
  diesel_per_m3: number;
  maintenance_per_m3: number;
  bonus_per_m3: number;
  tires_per_m3: number;
  additive_te_per_m3: number | null;
  total_transport_per_m3: number;
  diferencial: number | null;
  is_active: boolean;
}

export interface DistanceCalculation {
  distance_km: number;
  bloque_number: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  range_code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  transport_cost_per_m3: number;
  total_per_trip: number;
  operator_bonus_per_trip: number;
  cost_breakdown: {
    diesel_per_m3: number;
    maintenance_per_m3: number;
    bonus_per_m3: number;
    tires_per_m3: number;
    additive_te_per_m3: number | null;
    diferencial: number | null;
  };
}

export interface CostBreakdown {
  diesel_per_m3: number;
  maintenance_per_m3: number;
  bonus_per_m3: number;
  tires_per_m3: number;
  additive_te_per_m3: number | null;
  diferencial: number | null;
}

/**
 * Calculate road distance between plant and construction site using Google Maps Distance Matrix API
 * Falls back to Haversine formula if API is unavailable
 */
export async function calculateRoadDistance(
  plantId: string,
  constructionSiteId: string
): Promise<number> {
  try {
    // Get plant coordinates
    const { data: plant, error: plantError } = await supabase
      .from('plants')
      .select('latitude, longitude')
      .eq('id', plantId)
      .single();

    if (plantError || !plant) {
      throw new Error(`Plant not found: ${plantId}`);
    }

    if (!plant.latitude || !plant.longitude) {
      throw new Error(`Plant coordinates not set for plant: ${plantId}`);
    }

    // Get construction site coordinates
    const { data: site, error: siteError } = await supabase
      .from('construction_sites')
      .select('latitude, longitude')
      .eq('id', constructionSiteId)
      .single();

    if (siteError || !site) {
      throw new Error(`Construction site not found: ${constructionSiteId}`);
    }

    if (!site.latitude || !site.longitude) {
      throw new Error(`Construction site coordinates not set for site: ${constructionSiteId}`);
    }

    // Try Google Maps API first
    try {
      const response = await fetch('/api/google-maps/distance-matrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origins: [{ lat: plant.latitude, lng: plant.longitude }],
          destinations: [{ lat: site.latitude, lng: site.longitude }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.rows?.[0]?.elements?.[0]?.distance?.value) {
          // Convert meters to kilometers
          const distanceKm = data.rows[0].elements[0].distance.value / 1000;
          console.log('Google Maps road distance calculated:', distanceKm, 'km');
          return Math.round(distanceKm * 100) / 100; // Round to 2 decimal places
        } else if (data.rows?.[0]?.elements?.[0]?.status) {
          console.warn('Google Maps API returned status:', data.rows[0].elements[0].status);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn('Google Maps API request failed:', response.status, errorData);
      }
    } catch (apiError) {
      console.warn('Google Maps API failed, falling back to Haversine:', apiError);
    }

    // Fallback to Haversine formula
    return calculateHaversineDistance(
      plant.latitude,
      plant.longitude,
      site.latitude,
      site.longitude
    );
  } catch (error) {
    const errorMessage = handleError(error, 'calculateRoadDistance');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Calculate distance using Haversine formula (fallback)
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get distance range configuration for a given distance
 */
export async function getDistanceRange(
  plantId: string,
  distanceKm: number
): Promise<DistanceRangeConfig | null> {
  try {
    // Get all active ranges for the plant
    const { data: allRanges, error: fetchError } = await supabase
      .from('distance_range_configs')
      .select('*')
      .eq('plant_id', plantId)
      .eq('is_active', true)
      .order('min_distance_km', { ascending: true });

    if (fetchError) throw fetchError;

    // Find the range that contains this distance
    // Note: max_distance_km is exclusive for all ranges except the last one
    // For the last range (G), we include distances >= max_distance_km
    const matchingRange = (allRanges || []).find(
      (range) => {
        if (range.range_code === 'G') {
          // Last range includes distances >= min_distance_km
          return distanceKm >= range.min_distance_km;
        }
        return distanceKm >= range.min_distance_km && distanceKm < range.max_distance_km;
      }
    );

    return matchingRange || null;
  } catch (error) {
    const errorMessage = handleError(error, 'getDistanceRange');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Calculate transportation cost per m³ based on distance range
 * Note: diferencial is the difference from the lowest range, not an addition
 */
export async function calculateTransportCostPerM3(
  plantId: string,
  distanceKm: number
): Promise<number> {
  try {
    const range = await getDistanceRange(plantId, distanceKm);
    if (!range) {
      console.warn(`No range config found for plant ${plantId} and distance ${distanceKm}km`);
      return 0;
    }

    // Get all ranges to find the lowest transport cost
    const allRanges = await getDistanceRangeConfigs(plantId);
    const lowestRange = allRanges.reduce((lowest, current) => {
      return current.total_transport_per_m3 < lowest.total_transport_per_m3 ? current : lowest;
    }, allRanges[0]);

    // Calculate diferencial as difference from lowest range
    const diferencial = range.total_transport_per_m3 - (lowestRange?.total_transport_per_m3 || 0);
    
    // Transport cost = base transport cost (diferencial is just for display, not added)
    return Math.round(range.total_transport_per_m3 * 100) / 100;
  } catch (error) {
    const errorMessage = handleError(error, 'calculateTransportCostPerM3');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Get total per trip cost for a distance range
 */
export async function getTotalPerTripCost(
  plantId: string,
  distanceKm: number
): Promise<number> {
  try {
    const range = await getDistanceRange(plantId, distanceKm);
    if (!range) {
      console.warn(`No range config found for plant ${plantId} and distance ${distanceKm}km`);
      return 0;
    }

    return range.total_per_trip;
  } catch (error) {
    const errorMessage = handleError(error, 'getTotalPerTripCost');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Get all distance range configurations for a plant
 */
export async function getDistanceRangeConfigs(
  plantId: string
): Promise<DistanceRangeConfig[]> {
  try {
    const { data, error } = await supabase
      .from('distance_range_configs')
      .select('*')
      .eq('plant_id', plantId)
      .eq('is_active', true)
      .order('min_distance_km', { ascending: true });

    if (error) throw error;
    return (data || []) as DistanceRangeConfig[];
  } catch (error) {
    const errorMessage = handleError(error, 'getDistanceRangeConfigs');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Get detailed cost breakdown for a distance
 * Note: diferencial is calculated as difference from lowest range
 */
export async function getCostBreakdown(
  plantId: string,
  distanceKm: number
): Promise<CostBreakdown | null> {
  try {
    const range = await getDistanceRange(plantId, distanceKm);
    if (!range) {
      return null;
    }

    // Get all ranges to find the lowest transport cost for diferencial calculation
    const allRanges = await getDistanceRangeConfigs(plantId);
    const lowestRange = allRanges.reduce((lowest, current) => {
      return current.total_transport_per_m3 < lowest.total_transport_per_m3 ? current : lowest;
    }, allRanges[0]);

    // Calculate diferencial as difference from lowest range
    const diferencial = range.total_transport_per_m3 - (lowestRange?.total_transport_per_m3 || 0);

    return {
      diesel_per_m3: range.diesel_per_m3,
      maintenance_per_m3: range.maintenance_per_m3,
      bonus_per_m3: range.bonus_per_m3,
      tires_per_m3: range.tires_per_m3,
      additive_te_per_m3: range.additive_te_per_m3,
      diferencial: diferencial > 0 ? diferencial : null, // Only show if positive difference
    };
  } catch (error) {
    const errorMessage = handleError(error, 'getCostBreakdown');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Calculate complete distance information including range and costs
 */
export async function calculateDistanceInfo(
  plantId: string,
  constructionSiteId: string
): Promise<DistanceCalculation> {
  try {
    // Calculate distance
    const distanceKm = await calculateRoadDistance(plantId, constructionSiteId);

    // Get range configuration
    const range = await getDistanceRange(plantId, distanceKm);
    
    // If no range found, return a default structure with warning
    if (!range) {
      console.warn(`No distance range configuration found for plant ${plantId} and distance ${distanceKm}km. Please configure distance ranges in admin.`);
      // Return a default structure that won't break the UI
    return {
      distance_km: distanceKm,
      bloque_number: 8, // Default to highest bloque
      range_code: 'G', // Default to highest range
      transport_cost_per_m3: 0,
      total_per_trip: 0,
      operator_bonus_per_trip: 0,
      cost_breakdown: {
        diesel_per_m3: 0,
        maintenance_per_m3: 0,
        bonus_per_m3: 0,
        tires_per_m3: 0,
        additive_te_per_m3: null,
        diferencial: null,
      },
    };
    }

    // Calculate costs
    const transportCostPerM3 = await calculateTransportCostPerM3(plantId, distanceKm);
    const totalPerTrip = await getTotalPerTripCost(plantId, distanceKm);
    const costBreakdown = await getCostBreakdown(plantId, distanceKm);

    return {
      distance_km: distanceKm,
      bloque_number: range.bloque_number,
      range_code: range.range_code,
      transport_cost_per_m3: transportCostPerM3,
      total_per_trip: totalPerTrip,
      operator_bonus_per_trip: range.operator_bonus_per_trip || 0,
      cost_breakdown: costBreakdown || {
        diesel_per_m3: 0,
        maintenance_per_m3: 0,
        bonus_per_m3: 0,
        tires_per_m3: 0,
        additive_te_per_m3: null,
        diferencial: null,
      },
    };
  } catch (error) {
    const errorMessage = handleError(error, 'calculateDistanceInfo');
    console.error(errorMessage);
    // Don't throw - return a default structure instead
    const distanceKm = await calculateRoadDistance(plantId, constructionSiteId).catch(() => 0);
    return {
      distance_km: distanceKm,
      bloque_number: 8,
      range_code: 'G',
      transport_cost_per_m3: 0,
      total_per_trip: 0,
      operator_bonus_per_trip: 0,
      cost_breakdown: {
        diesel_per_m3: 0,
        maintenance_per_m3: 0,
        bonus_per_m3: 0,
        tires_per_m3: 0,
        additive_te_per_m3: null,
        diferencial: null,
      },
    };
  }
}

