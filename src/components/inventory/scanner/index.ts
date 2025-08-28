// Main exports for the scanner module
export { ScannerManager, scannerManager } from './scanner-manager';
export { DocumentDetector } from './document-detector';
export { CannyOptimizer } from './canny-optimizer';
export { ImageProcessor } from './image-processor';
export { AdvancedImageProcessor } from './advanced-image-processor';
export { AdvancedEdgeDetector } from './advanced-edge-detector';
export { MultiScaleDetector } from './multi-scale-detector';
export { CornerRefiner } from './corner-refiner';
export { SimpleDocumentScanner } from './simple-document-scanner';
export { opencvLoader } from './opencv-loader';
export { jscanifyLoader } from './jscanify-loader';
export { SimpleScanner, simpleScanner } from './simple-scanner';
export { getScannerConfig, cannyParameterSets, scannerPresets, validateScannerConfig } from './scanner-config';

// Re-export types
export type {
  ScannerConfig,
  CannyParams,
  ContourInfo,
  Point,
  DocumentDetectionResult,
  ImageProcessingResult,
  OpenCVLoadResult,
  JScanifyLoadResult,
  ScannerInitializationResult,
  AdaptiveThresholds,
  MultiScaleResult,
  CornerRefinementResult,
  EnhancedProcessingResult,
  DocumentQualityMetrics
} from './scanner-types';
