// TypeScript types and interfaces for the scanner module

export interface ScannerConfig {
  // OpenCV and jscanify settings
  useExtractPaper: boolean;
  qualityThreshold: number;
  maxExtractSize: number;

  // Canny algorithm parameters
  cannyLowThreshold: number;
  cannyHighThreshold: number;
  cannyApertureSize: number;
  cannyL2Gradient: boolean;

  // Document detection settings
  minContourArea: number;
  maxContourArea: number;
  minAspectRatio: number;
  maxAspectRatio: number;
  minSolidity: number;

  // Image preprocessing
  blurSize: number;
  autoCrop: boolean;
  enhanceContrast: boolean;

  // Advanced preprocessing options
  useClahe: boolean;
  claheClipLimit: number;
  claheTileGridSize: number;
  useLabColorSpace: boolean;
  useAdaptiveThresholding: boolean;
  adaptiveThresholdBlockSize: number;
  adaptiveThresholdC: number;
  useMorphologicalOperations: boolean;
  morphologicalKernelSize: number;

  // Multi-scale detection
  enableMultiScaleDetection: boolean;
  scaleFactors: number[];
  useAdaptiveCannyParams: boolean;

  // Corner detection
  useHarrisCorners: boolean;
  harrisBlockSize: number;
  harrisKSize: number;
  harrisK: number;
  cornerRefinementWindowSize: number;

  // Quality enhancement
  enableQualityEnhancement: boolean;
  qualityEnhancementClipLimit: number;
}

export interface CannyParams {
  low: number;
  high: number;
  apertureSize?: number;
  l2gradient?: boolean;
}

export interface ContourInfo {
  contour: any; // OpenCV contour object
  area: number;
  perimeter: number;
  boundingRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  aspectRatio: number;
  solidity: number;
  corners: Point[];
}

export interface Point {
  x: number;
  y: number;
}

export interface DocumentDetectionResult {
  success: boolean;
  corners?: Point[];
  confidence?: number;
  method?: 'jscanify' | 'opencv_canny' | 'hybrid';
  contourInfo?: ContourInfo;
  error?: string;
}

export interface ImageProcessingResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  processed: boolean;
}

export interface OpenCVLoadResult {
  success: boolean;
  version?: string;
  error?: string;
}

export interface JScanifyLoadResult {
  success: boolean;
  version?: string;
  error?: string;
}

export interface ScannerInitializationResult {
  success: boolean;
  scanner?: any;
  error?: string;
}

// Advanced edge detection interfaces
export interface AdaptiveThresholds {
  lower: number;
  upper: number;
}

export interface MultiScaleResult {
  corners: Point[];
  confidence: number;
  scale: number;
  contourInfo: ContourInfo;
}

export interface CornerRefinementResult {
  refinedCorners: Point[];
  confidence: number;
  method: 'harris' | 'contour_approx';
}

export interface EnhancedProcessingResult {
  processedCanvas: HTMLCanvasElement;
  confidence: number;
  preprocessingSteps: string[];
  qualityScore: number;
}

export interface DocumentQualityMetrics {
  brightness: number;
  contrast: number;
  sharpness: number;
  overallQuality: number;
}

// Global type declarations for OpenCV and jscanify
declare global {
  interface Window {
    cv: any;
    jscanify: any;
  }
}
