import { ScannerConfig, CannyParams } from './scanner-types';

/**
 * Centralized configuration for the scanner module
 * This allows easy tuning and optimization of document detection parameters
 */
export const defaultScannerConfig: ScannerConfig = {
  // OpenCV and jscanify settings
  useExtractPaper: true,
  qualityThreshold: 0.7,
  maxExtractSize: 1200,

  // Canny algorithm parameters - optimized for document detection
  cannyLowThreshold: 50,
  cannyHighThreshold: 150,
  cannyApertureSize: 3,
  cannyL2Gradient: true,

  // Document detection settings - relaxed for better detection
  minContourArea: 1000, // Reduced from 10000 - Minimum area for a valid document contour
  maxContourArea: 10000000, // Maximum area to avoid detecting entire image
  minAspectRatio: 0.2, // Reduced from 0.3 - Minimum aspect ratio (width/height)
  maxAspectRatio: 5.0, // Increased from 3.0 - Maximum aspect ratio
  minSolidity: 0.5, // Reduced from 0.7 - Minimum solidity (contour area / convex hull area)

  // Image preprocessing
  blurSize: 3,
  autoCrop: true,
  enhanceContrast: true,

  // Advanced preprocessing options
  useClahe: true,
  claheClipLimit: 2.0,
  claheTileGridSize: 8,
  useLabColorSpace: true,
  useAdaptiveThresholding: true,
  adaptiveThresholdBlockSize: 11,
  adaptiveThresholdC: 2,
  useMorphologicalOperations: true,
  morphologicalKernelSize: 3,

  // Multi-scale detection - optimized for performance
  enableMultiScaleDetection: true,
  scaleFactors: [1.0], // Single scale for maximum performance - multi-scale can be too slow
  useAdaptiveCannyParams: true,

  // Corner detection
  useHarrisCorners: true,
  harrisBlockSize: 2,
  harrisKSize: 3,
  harrisK: 0.04,
  cornerRefinementWindowSize: 15,

  // Quality enhancement
  enableQualityEnhancement: true,
  qualityEnhancementClipLimit: 3.0,
};

/**
 * Multiple Canny parameter combinations for robust document detection
 * These are tried in order until a good document is found
 */
export const cannyParameterSets: CannyParams[] = [
  // Primary - optimized for most documents
  { low: 50, high: 150, apertureSize: 3, l2gradient: true },

  // Secondary - more sensitive for low contrast documents
  { low: 30, high: 100, apertureSize: 3, l2gradient: true },

  // Tertiary - less sensitive for high contrast/noisy documents
  { low: 80, high: 200, apertureSize: 3, l2gradient: true },

  // Fallback - very sensitive for difficult cases
  { low: 20, high: 80, apertureSize: 5, l2gradient: false },

  // Last resort - very insensitive for very noisy images
  { low: 100, high: 250, apertureSize: 5, l2gradient: false },
];

/**
 * Get scanner configuration with optional overrides
 */
export function getScannerConfig(overrides?: Partial<ScannerConfig>): ScannerConfig {
  return {
    ...defaultScannerConfig,
    ...overrides,
  };
}

/**
 * Configuration presets for different document types
 */
export const scannerPresets = {
  receipt: {
    minContourArea: 5000,
    maxContourArea: 500000,
    minAspectRatio: 0.5,
    maxAspectRatio: 2.5,
    cannyLowThreshold: 40,
    cannyHighThreshold: 120,
  },

  invoice: {
    minContourArea: 15000,
    maxContourArea: 2000000,
    minAspectRatio: 0.4,
    maxAspectRatio: 3.0,
    cannyLowThreshold: 50,
    cannyHighThreshold: 150,
  },

  document: {
    minContourArea: 10000,
    maxContourArea: 10000000,
    minAspectRatio: 0.3,
    maxAspectRatio: 3.0,
    cannyLowThreshold: 50,
    cannyHighThreshold: 150,
  },
};

/**
 * Validate scanner configuration
 */
export function validateScannerConfig(config: ScannerConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.cannyLowThreshold >= config.cannyHighThreshold) {
    errors.push('Low threshold must be less than high threshold');
  }

  if (config.minContourArea >= config.maxContourArea) {
    errors.push('Minimum contour area must be less than maximum contour area');
  }

  if (config.minAspectRatio >= config.maxAspectRatio) {
    errors.push('Minimum aspect ratio must be less than maximum aspect ratio');
  }

  if (config.minSolidity < 0 || config.minSolidity > 1) {
    errors.push('Solidity must be between 0 and 1');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
