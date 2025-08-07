// Constants for the Concrete Mix Calculator

import { WaterQuantities, WaterDefinition, AdditiveSystemConfig } from '@/types/calculator';

export const DEFAULT_WATER_QUANTITIES_TD: WaterQuantities = {
  '10D': 180,
  '14D': 185,
  '14B': 190,
  '18B': 195,
  '8D': 175
};

export const DEFAULT_WATER_QUANTITIES_BOMB: WaterQuantities = {
  '10D': 165,
  '14D': 175,
  '14B': 185,
  '18B': 195,
  '8D': 160
};

export const AIR_CONTENTS = {
  6.5: 0.065,
  7.0: 0.070,
  7.5: 0.075,
  8.0: 0.080
};

export const AGGREGATE_SIZES = [
  { value: 1/2, label: '1/2"' },
  { value: 3/4, label: '3/4"' },
  { value: 1, label: '1"' }
];

export const FC_STRENGTHS = [100, 150, 200, 250, 300, 350, 400, 450, 500];
export const MR_STRENGTHS = [36, 38, 40, 42, 45, 48];

export const FC_SLUMPS = [10, 14, 18];
export const MR_SLUMPS = [8, 10, 14];

export const FC_PLACEMENTS = ['D', 'B'] as const;
export const MR_PLACEMENTS = ['D'] as const;

export const DEFAULT_DESIGN_AGE = 28;

// Default water definitions - defines which combinations will generate recipes
export const DEFAULT_WATER_DEFINITIONS: WaterDefinition[] = [
  { slump: 10, placement: 'D', waterTD: 180, waterBomb: 165, enabled: true },
  { slump: 14, placement: 'D', waterTD: 185, waterBomb: 175, enabled: true },
  { slump: 14, placement: 'B', waterTD: 190, waterBomb: 185, enabled: true },
  { slump: 18, placement: 'B', waterTD: 195, waterBomb: 195, enabled: true },
  { slump: 8, placement: 'D', waterTD: 175, waterBomb: 160, enabled: false },
];

// Default additive system configuration
export const DEFAULT_ADDITIVE_SYSTEM_CONFIG: AdditiveSystemConfig = {
  totalCCPerKgCement: 5.0, // Total 5 cc per kg of cement
  additiveRules: [
    {
      additiveId: 0, // Primary additive (PLASTOL 5000)
      ccPercentage: 100, // 100% of the cc for cement amounts 0-400 kg/m³
      minCement: 0,
      maxCement: 400,
      priority: 1
    },
    {
      additiveId: 0, // Primary additive (PLASTOL 5000) - 80% for higher cement
      ccPercentage: 80, // 80% of the cc for cement amounts 400-600 kg/m³
      minCement: 400,
      maxCement: 600,
      priority: 1
    },
    {
      additiveId: 1, // Secondary additive (SUPERPLASTIFICANTE) - 20% for higher cement
      ccPercentage: 20, // 20% of the cc for cement amounts 400-600 kg/m³
      minCement: 400,
      maxCement: 600,
      priority: 2
    },
    {
      additiveId: 0, // Primary additive (PLASTOL 5000) - 60% for very high cement
      ccPercentage: 60, // 60% of the cc for cement amounts 600+ kg/m³
      minCement: 600,
      maxCement: 1000,
      priority: 1
    },
    {
      additiveId: 1, // Secondary additive (SUPERPLASTIFICANTE) - 40% for very high cement
      ccPercentage: 40, // 40% of the cc for cement amounts 600+ kg/m³
      minCement: 600,
      maxCement: 1000,
      priority: 2
    }
  ]
};