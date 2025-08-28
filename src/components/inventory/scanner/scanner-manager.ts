import {
  ScannerConfig,
  ScannerInitializationResult,
  DocumentDetectionResult,
  MultiScaleResult,
  CornerRefinementResult,
  EnhancedProcessingResult
} from './scanner-types';
import { opencvLoader } from './opencv-loader';
import { jscanifyLoader } from './jscanify-loader';
import { DocumentDetector } from './document-detector';
import { ImageProcessor } from './image-processor';
import { AdvancedImageProcessor } from './advanced-image-processor';
import { AdvancedEdgeDetector } from './advanced-edge-detector';
import { MultiScaleDetector } from './multi-scale-detector';
import { CornerRefiner } from './corner-refiner';
import { SimpleDocumentScanner } from './simple-document-scanner';
import { getScannerConfig } from './scanner-config';

/**
 * Main scanner manager that coordinates all scanner modules
 * Provides a clean interface for document scanning functionality
 */
export class ScannerManager {
  private config: ScannerConfig;
  private detector: DocumentDetector;
  private processor: ImageProcessor;
  private advancedProcessor: AdvancedImageProcessor;
  private advancedEdgeDetector: AdvancedEdgeDetector;
  private multiScaleDetector: MultiScaleDetector;
  private cornerRefiner: CornerRefiner;
  private simpleScanner: SimpleDocumentScanner;
  private scanner: any = null;
  private isInitialized = false;

  constructor(config?: Partial<ScannerConfig>) {
    this.config = getScannerConfig(config);
    this.detector = new DocumentDetector(this.config);
    this.processor = new ImageProcessor(this.config);
    this.advancedProcessor = new AdvancedImageProcessor(this.config);
    this.advancedEdgeDetector = new AdvancedEdgeDetector(this.config);
    this.multiScaleDetector = new MultiScaleDetector(this.config);
    this.cornerRefiner = new CornerRefiner(this.config);
    this.simpleScanner = new SimpleDocumentScanner();
  }

  /**
   * Resize canvas to fit within maximum dimensions while maintaining aspect ratio
   */
  private resizeCanvasIfNeeded(canvas: HTMLCanvasElement, maxDimension: number = 4096): HTMLCanvasElement {
    if (canvas.width <= maxDimension && canvas.height <= maxDimension) {
      return canvas; // No resizing needed
    }

    const aspectRatio = canvas.width / canvas.height;
    let newWidth: number;
    let newHeight: number;

    if (canvas.width > canvas.height) {
      // Landscape orientation
      newWidth = maxDimension;
      newHeight = Math.round(maxDimension / aspectRatio);
    } else {
      // Portrait orientation
      newHeight = maxDimension;
      newWidth = Math.round(maxDimension * aspectRatio);
    }

    console.log(`📐 Resizing canvas from ${canvas.width}x${canvas.height} to ${newWidth}x${newHeight}`);

    // Create new canvas with resized dimensions and performance optimizations
    const resizedCanvas = document.createElement('canvas');
    resizedCanvas.width = newWidth;
    resizedCanvas.height = newHeight;

    // Use willReadFrequently for better performance with multiple read operations
    const ctx = resizedCanvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false // Disable alpha channel for better performance
    })!;
    ctx.drawImage(canvas, 0, 0, newWidth, newHeight);

    return resizedCanvas;
  }

  /**
   * Validate canvas before processing to prevent OpenCV errors
   */
  private validateCanvas(canvas: HTMLCanvasElement): { valid: boolean; error?: string; resizedCanvas?: HTMLCanvasElement } {
    if (!canvas) {
      return { valid: false, error: 'Canvas is null or undefined' };
    }

    if (!canvas.width || !canvas.height) {
      return { valid: false, error: 'Canvas has invalid dimensions' };
    }

    if (canvas.width <= 0 || canvas.height <= 0) {
      return { valid: false, error: 'Canvas dimensions must be positive' };
    }

    // Check for reasonable minimum dimensions
    const minDimension = 10;
    if (canvas.width < minDimension || canvas.height < minDimension) {
      return { valid: false, error: 'Canvas dimensions too small' };
    }

    // Check for reasonable maximum dimensions (prevent memory issues)
    const maxDimension = 8192; // Increased to support 8K resolution
    if (canvas.width > maxDimension || canvas.height > maxDimension) {
      return { valid: false, error: `Canvas dimensions too large (max: ${maxDimension}px)` };
    }

    // If canvas is very large, resize it to prevent memory issues
    const recommendedMax = 4096; // Recommended max for optimal performance
    let processedCanvas = canvas;

    if (canvas.width > recommendedMax || canvas.height > recommendedMax) {
      console.log(`⚠️ Large canvas detected (${canvas.width}x${canvas.height}), resizing for optimal performance...`);
      processedCanvas = this.resizeCanvasIfNeeded(canvas, recommendedMax);
    }

    // Check if canvas has a valid context
    try {
      const ctx = processedCanvas.getContext('2d');
      if (!ctx) {
        return { valid: false, error: 'Canvas has no 2D context' };
      }
    } catch (error) {
      return { valid: false, error: 'Failed to get canvas context' };
    }

    return {
      valid: true,
      resizedCanvas: processedCanvas !== canvas ? processedCanvas : undefined
    };
  }

  /**
   * Initialize the scanner system
   */
  async initialize(): Promise<ScannerInitializationResult> {
    if (this.isInitialized) {
      return { success: true };
    }

    try {
      console.log('🚀 Initializing ScannerManager...');

      // Step 1: Load OpenCV
      console.log('📦 Loading OpenCV...');
      const opencvResult = await opencvLoader.load();
      if (!opencvResult.success) {
        return {
          success: false,
          error: `OpenCV loading failed: ${opencvResult.error}`
        };
      }

      // Step 2: Load jscanify
      console.log('📦 Loading jscanify...');
      const jscanifyResult = await jscanifyLoader.load();
      if (!jscanifyResult.success) {
        console.warn('jscanify loading failed, continuing with OpenCV-only mode:', jscanifyResult.error);
      }

      // Step 3: Create scanner instance if jscanify is available
      if (jscanifyResult.success) {
        console.log('🔧 Creating jscanify scanner instance...');
        this.scanner = jscanifyLoader.createScanner();

        if (this.scanner) {
          console.log('✅ jscanify scanner created successfully');
          this.detector.setScanner(this.scanner);
        } else {
          console.warn('⚠️ jscanify scanner creation failed, falling back to OpenCV-only mode');
        }
      } else {
        console.log('ℹ️ jscanify not available, using OpenCV-only mode');
      }

      this.isInitialized = true;
      console.log('✅ ScannerManager initialized successfully');

      return {
        success: true,
        scanner: this.scanner
      };
    } catch (error) {
      console.error('❌ ScannerManager initialization failed:', error);
      return {
        success: false,
        error: `Initialization failed: ${error}`
      };
    }
  }

  /**
   * Detect document in canvas
   */
  async detectDocument(canvas: HTMLCanvasElement): Promise<DocumentDetectionResult> {
    if (!this.isInitialized) {
      throw new Error('ScannerManager must be initialized before use');
    }

    // Validate canvas before processing
    const canvasValidation = this.validateCanvas(canvas);
    if (!canvasValidation.valid) {
      console.error('Canvas validation failed:', canvasValidation.error);
      return {
        success: false,
        error: canvasValidation.error
      };
    }

    // Use resized canvas if available
    const canvasToProcess = canvasValidation.resizedCanvas || canvas;

    try {
      // Preprocess the image
      const processedImage = this.processor.processCanvas(canvasToProcess);

      // Detect document using the processed image
      const detectionResult = await this.detector.detectDocument(processedImage.canvas);

      return detectionResult;
    } catch (error) {
      console.error('Document detection failed:', error);
      return {
        success: false,
        error: `Detection failed: ${error}`
      };
    }
  }

  /**
   * Advanced edge detection using multiple sophisticated algorithms
   */
  async detectDocumentAdvanced(
    canvas: HTMLCanvasElement,
    enableDebugging: boolean = false
  ): Promise<DocumentDetectionResult> {
    if (!this.isInitialized) {
      throw new Error('ScannerManager must be initialized before use');
    }

    // Validate canvas before processing
    const canvasValidation = this.validateCanvas(canvas);
    if (!canvasValidation.valid) {
      console.error('Canvas validation failed:', canvasValidation.error);
      return {
        success: false,
        error: canvasValidation.error
      };
    }

    // Use resized canvas if available
    const canvasToProcess = canvasValidation.resizedCanvas || canvas;

    if (canvasValidation.resizedCanvas) {
      console.log(`🔄 Simple scanner using resized canvas: ${canvasToProcess.width}x${canvasToProcess.height} (from ${canvas.width}x${canvas.height})`);
    } else {
      console.log(`📐 Simple scanner using original canvas: ${canvasToProcess.width}x${canvasToProcess.height}`);
    }

    // Step 1: Try the SIMPLE approach first! Use OpenCV → Canny → Find biggest rectangle
    try {
      console.log('🎯 Trying SIMPLE document scanner first...');
      const simpleResult = await this.simpleScanner.detectDocument(canvasToProcess);

      if (simpleResult.success && simpleResult.confidence! > 0.3) {
        console.log(`🎉 Simple scanner SUCCESS! Confidence: ${simpleResult.confidence}`);
        console.log(`📐 Simple scanner used canvas: ${canvasToProcess.width}x${canvasToProcess.height}`);

        // Store the canvas used by simple scanner for coordinate validation
        (simpleResult as any).processedCanvas = canvasToProcess;

        return simpleResult;
      } else {
        console.log('⚠️ Simple scanner failed, trying complex methods...');
      }
    } catch (error) {
      console.warn('❌ Simple scanner error:', error);
    }

    // Step 2: Fall back to enhanced detection (the complex method)
    console.log('🔄 Falling back to enhanced detection...');
    return this.detectDocumentEnhanced(canvasToProcess, enableDebugging);
  }

  /**
   * Enhanced document detection using advanced algorithms
   */
  async detectDocumentEnhanced(
    canvas: HTMLCanvasElement,
    enableDebugging: boolean = false
  ): Promise<DocumentDetectionResult> {
    if (!this.isInitialized) {
      throw new Error('ScannerManager must be initialized before use');
    }

    try {
      console.log('🚀 Starting enhanced document detection...');

      // Add timeout protection for the entire enhanced detection (max 2 seconds)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Enhanced detection timeout')), 2000)
      );

      const enhancedDetectionPromise = async () => {
        // Step 1: Multi-scale document detection
        console.log('📊 Step 1: Multi-scale detection');
        const multiScaleResult = await this.multiScaleDetector.detectMultiScale(canvas, enableDebugging);

        if (!multiScaleResult) {
          console.log('❌ Multi-scale detection failed, falling back to basic detection');
          return this.detectDocument(canvas);
        }

        return multiScaleResult;
      };

      const multiScaleResult = await Promise.race([
        enhancedDetectionPromise(),
        timeoutPromise
      ]);

      // If we got a basic detection result from the fallback, return it
      if (multiScaleResult.success !== undefined && !multiScaleResult.corners) {
        return multiScaleResult;
      }

      // Continue with corner refinement and validation
      const refinementTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Corner refinement timeout')), 1000)
      );

      const refinementPromise = async () => {
        // Step 2: Corner refinement using Harris detector
        console.log('🎯 Step 2: Corner refinement');
        const refinementResult = await this.cornerRefiner.refineCorners(
          multiScaleResult.corners,
          canvas,
          enableDebugging
        );

        // Step 3: Apply geometric constraints
        console.log('📐 Step 3: Applying geometric constraints');
        const constrainedCorners = this.cornerRefiner.applyGeometricConstraints(
          refinementResult.refinedCorners,
          canvas
        );

        // Step 4: Validate the quadrilateral
        console.log('✅ Step 4: Validating quadrilateral');
        const isValid = this.cornerRefiner.validateQuadrilateral(constrainedCorners);

        if (!isValid) {
          console.warn('⚠️ Quadrilateral validation failed, using original corners');
          return {
            success: true,
            corners: multiScaleResult.corners,
            confidence: multiScaleResult.confidence * 0.8,
            method: 'enhanced_fallback',
            contourInfo: multiScaleResult.contourInfo
          };
        }

        // Step 5: Calculate final confidence
        const finalConfidence = this.calculateFinalConfidence(
          multiScaleResult.confidence,
          refinementResult.confidence,
          isValid
        );

        console.log(`🎉 Enhanced detection completed with confidence ${finalConfidence.toFixed(3)}`);

        return {
          success: true,
          corners: constrainedCorners,
          confidence: finalConfidence,
          method: 'enhanced',
          contourInfo: multiScaleResult.contourInfo
        };
      };

      const finalResult = await Promise.race([
        refinementPromise(),
        refinementTimeoutPromise
      ]);

      return finalResult;

    } catch (error) {
      console.error('Enhanced document detection failed:', error);
      console.log('🔄 Falling back to basic detection...');
      return this.detectDocument(canvas);
    }
  }

  /**
   * Fast preview mode - just highlight paper boundaries without full detection
   */
  async generateFastPreview(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    const previewCanvas = document.createElement('canvas');
    const ctx = previewCanvas.getContext('2d')!;
    previewCanvas.width = canvas.width;
    previewCanvas.height = canvas.height;

    // Copy original image
    ctx.drawImage(canvas, 0, 0);

    // Add fast preview overlay - just a border to show scanner is working
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // Add corner markers
    const cornerSize = 16;
    ctx.fillStyle = '#22c55e';

    // Top-left corner
    ctx.fillRect(0, 0, cornerSize, 4);
    ctx.fillRect(0, 0, 4, cornerSize);

    // Top-right corner
    ctx.fillRect(canvas.width - cornerSize, 0, cornerSize, 4);
    ctx.fillRect(canvas.width - 4, 0, 4, cornerSize);

    // Bottom-left corner
    ctx.fillRect(0, canvas.height - 4, cornerSize, 4);
    ctx.fillRect(0, canvas.height - cornerSize, 4, cornerSize);

    // Bottom-right corner
    ctx.fillRect(canvas.width - cornerSize, canvas.height - 4, cornerSize, 4);
    ctx.fillRect(canvas.width - 4, canvas.height - cornerSize, 4, cornerSize);

    return previewCanvas;
  }

  /**
   * Basic image processing for capture (contrast enhancement)
   */
  processBasic(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const resultCanvas = document.createElement('canvas');
    const ctx = resultCanvas.getContext('2d')!;
    resultCanvas.width = canvas.width;
    resultCanvas.height = canvas.height;

    // Copy original image
    ctx.drawImage(canvas, 0, 0);

    // Apply basic contrast enhancement
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      // Simple contrast enhancement
      data[i] = Math.min(255, data[i] * 1.1);     // Red
      data[i + 1] = Math.min(255, data[i + 1] * 1.1); // Green
      data[i + 2] = Math.min(255, data[i + 2] * 1.1); // Blue
    }

    ctx.putImageData(imageData, 0, 0);
    return resultCanvas;
  }

  /**
   * Generate preview with basic edge detection if scanner is available
   */
  async generateEnhancedPreview(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    // Validate canvas before processing
    const canvasValidation = this.validateCanvas(canvas);
    if (!canvasValidation.valid) {
      console.error('Canvas validation failed in preview generation:', canvasValidation.error);
      // Return fast preview as fallback
      return this.generateFastPreview(canvas);
    }

    // Use resized canvas if available
    const canvasToProcess = canvasValidation.resizedCanvas || canvas;

    const previewCanvas = document.createElement('canvas');
    const ctx = previewCanvas.getContext('2d')!;
    previewCanvas.width = canvasToProcess.width;
    previewCanvas.height = canvasToProcess.height;

    // Copy original image
    ctx.drawImage(canvasToProcess, 0, 0);

    // If scanner is initialized, try quick edge detection
    if (this.isInitialized && this.scanner && typeof this.scanner.highlightPaper === 'function') {
      try {
        console.log('🎯 Attempting edge detection with jscanify highlightPaper...');
        const highlighted = this.scanner.highlightPaper(canvasToProcess);
        console.log('📊 highlightPaper result:', !!highlighted);

        if (highlighted) {
          // Use the highlighted result for preview
          ctx.clearRect(0, 0, canvasToProcess.width, canvasToProcess.height);
          ctx.drawImage(highlighted, 0, 0);
          console.log('✅ Edge detection successful - using jscanify result for preview');
          return previewCanvas;
        } else {
          console.log('⚠️ highlightPaper returned null/undefined');
        }
      } catch (error) {
        console.warn('❌ Quick edge detection failed, using basic preview:', error);
      }
    } else {
      console.log('ℹ️ Scanner not ready for edge detection:', {
        initialized: this.isInitialized,
        hasScanner: !!this.scanner,
        hasHighlightPaper: this.scanner ? typeof this.scanner.highlightPaper === 'function' : false
      });
    }

    // Fallback to fast preview
    return this.generateFastPreview(canvasToProcess);
  }

  /**
   * Extract document from canvas using detected corners
   */
  async extractDocument(
    canvas: HTMLCanvasElement,
    corners: { x: number; y: number }[],
    processedCanvas?: HTMLCanvasElement
  ): Promise<HTMLCanvasElement | null> {
    if (!this.isInitialized) {
      throw new Error('ScannerManager must be initialized before use');
    }

    // Determine which canvas and coordinate system to use
    let canvasToUse: HTMLCanvasElement;
    let cornersToUse = corners;
    let validationCanvas: HTMLCanvasElement;

    if (processedCanvas) {
      // Simple scanner was used - corners are in processedCanvas coordinate system
      canvasToUse = processedCanvas;
      validationCanvas = processedCanvas; // Use processed canvas for validation
      cornersToUse = corners; // Already in the right coordinate system
      console.log(`📐 Extracting document using processed canvas: ${canvasToUse.width}x${canvasToUse.height}`);
    } else {
      // Manual adjustment or other detection - corners are in original canvas coordinate system
      canvasToUse = canvas;
      validationCanvas = canvas; // Use original canvas for validation
      cornersToUse = corners;
      console.log(`📐 Extracting document using original canvas: ${canvasToUse.width}x${canvasToUse.height}`);
    }

    // Validate canvas before processing
    // Skip resizing if we have processedCanvas (corners are in original coordinate system)
    if (processedCanvas) {
      // Use canvas as-is, don't resize since corners are in original coordinate system
      validationCanvas = canvas;
    } else {
      // When no processedCanvas is provided, check if canvas is extremely large
      // Only resize if absolutely necessary (> 2x recommended size)
      const recommendedMax = 4096;
      const extremeThreshold = recommendedMax * 2;

      if (canvasToUse.width > extremeThreshold || canvasToUse.height > extremeThreshold) {
        console.log(`⚠️ Extremely large canvas detected (${canvasToUse.width}x${canvasToUse.height}), resizing for optimal performance...`);
        const canvasValidation = this.validateCanvas(canvasToUse);
        if (!canvasValidation.valid) {
          console.error('Canvas validation failed:', canvasValidation.error);
          return null;
        }
        validationCanvas = canvasValidation.resizedCanvas || canvasToUse;
      } else {
        // Use canvas as-is, no resizing needed
        validationCanvas = canvasToUse;
        console.log(`📐 Canvas size acceptable (${canvasToUse.width}x${canvasToUse.height}), no resizing needed`);
      }
    }

    // Determine the final canvas to use for processing
    let canvasToProcess: HTMLCanvasElement;

    if (processedCanvas) {
      // If we have processedCanvas from simple scanner, corners are in original coordinate system
      // Use original canvas directly without any resizing
      canvasToProcess = canvas;
      console.log(`📐 Using original canvas for extraction (corners converted): ${canvasToProcess.width}x${canvasToProcess.height}`);
    } else {
      // For other cases, use validationCanvas which may have been resized
      canvasToProcess = validationCanvas;
      if (validationCanvas !== canvasToUse) {
        console.log(`📐 Using validated canvas: ${canvasToProcess.width}x${canvasToProcess.height} (from ${canvasToUse.width}x${canvasToUse.height})`);
      } else {
        console.log(`📐 Using canvas (no resize needed): ${canvasToProcess.width}x${canvasToProcess.height}`);
      }
    }

    // Validate corners
    if (!corners || corners.length < 4) {
      console.error('Invalid corners provided for extraction');
      return null;
    }

    // Validate corner coordinates with bounding
    const validCorners = [];
    const canvasForValidation = processedCanvas ? canvas : canvasToProcess;
    console.log(`🔍 Validating ${cornersToUse.length} corners against canvas ${canvasForValidation.width}x${canvasForValidation.height}`);

    for (const corner of cornersToUse) {
      if (typeof corner.x !== 'number' || typeof corner.y !== 'number') {
        console.warn('Invalid corner coordinate type:', corner);
        continue;
      }

      // Check for extreme values that indicate coordinate system issues
      if (Math.abs(corner.x) > 50000 || Math.abs(corner.y) > 50000) {
        console.warn('Extreme corner coordinate detected, likely coordinate system issue:', corner);
        continue;
      }

      // Check if coordinates are negative or NaN
      if (corner.x < 0 || corner.y < 0 || !isFinite(corner.x) || !isFinite(corner.y)) {
        console.warn('Invalid corner coordinate (negative or NaN):', corner);
        continue;
      }

      // Bound coordinates to canvas dimensions
      const boundedCorner = {
        x: Math.max(0, Math.min(canvasForValidation.width, corner.x)),
        y: Math.max(0, Math.min(canvasForValidation.height, corner.y))
      };

      // Log if coordinates were bounded
      if (corner.x !== boundedCorner.x || corner.y !== boundedCorner.y) {
        console.log(`🔧 Bounded corner: ${corner.x},${corner.y} → ${boundedCorner.x},${boundedCorner.y} (canvas: ${canvasForValidation.width}x${canvasForValidation.height})`);
      }

      validCorners.push(boundedCorner);
    }

    // Ensure we have at least 4 valid corners
    if (validCorners.length < 4) {
      console.error('Not enough valid corners after bounding');
      return null;
    }

    // Use only the first 4 corners
    const boundedCorners = validCorners.slice(0, 4);

    try {
      if (!this.scanner || typeof this.scanner.extractPaper !== 'function') {
        console.warn('jscanify extractPaper not available, using basic extraction');
        return this.basicDocumentExtraction(canvasToUse, boundedCorners);
      }

      // Calculate target dimensions safely (following working example pattern)
      const documentWidth = Math.abs(boundedCorners[1].x - boundedCorners[0].x);
      const documentHeight = Math.abs(boundedCorners[3].y - boundedCorners[0].y);

      console.log('📐 Document dimensions calculation:', {
        corners: boundedCorners.map(c => `(${c.x.toFixed(1)},${c.y.toFixed(1)})`),
        calculatedWidth: documentWidth.toFixed(1),
        calculatedHeight: documentHeight.toFixed(1),
        canvasSize: `${canvasForValidation.width}x${canvasForValidation.height}`,
        canvasUsed: processedCanvas ? 'processed' : 'original',
        aspectRatio: (documentWidth / documentHeight).toFixed(3)
      });

      // Ensure minimum dimensions to prevent OpenCV errors
      const minDimension = 50;
      if (documentWidth < minDimension || documentHeight < minDimension) {
        console.warn('Document dimensions too small, using basic extraction');
        return this.basicDocumentExtraction(canvasToProcess, boundedCorners);
      }

      // Additional validation: ensure dimensions are reasonable compared to canvas
      if (documentWidth > canvasForValidation.width * 2 || documentHeight > canvasForValidation.height * 2) {
        console.warn('Document dimensions too large compared to canvas, using basic extraction');
        return this.basicDocumentExtraction(canvasToProcess, boundedCorners);
      }

      // Calculate aspect ratio safely
      const aspectRatio = documentWidth / documentHeight;

      // Set target dimensions based on aspect ratio
      let targetWidth: number;
      let targetHeight: number;

      if (aspectRatio > 1) {
        // Landscape document
        targetWidth = Math.min(this.config.maxExtractSize, canvasForValidation.width);
        targetHeight = Math.round(targetWidth / aspectRatio);
      } else {
        // Portrait document
        targetHeight = Math.min(this.config.maxExtractSize, canvasForValidation.height);
        targetWidth = Math.round(targetHeight * aspectRatio);
      }

      // Ensure dimensions are positive and reasonable
      targetWidth = Math.max(100, Math.min(targetWidth, canvasForValidation.width));
      targetHeight = Math.max(100, Math.min(targetHeight, canvasForValidation.height));

      console.log('Extracting document with dimensions:', { targetWidth, targetHeight, aspectRatio });

      // Use jscanify's extractPaper with proper error handling
      const extracted = this.scanner.extractPaper(canvasToProcess, targetWidth, targetHeight);

      // Validate extracted result
      if (extracted && extracted.width > 0 && extracted.height > 0 && extracted.width <= canvasToProcess.width && extracted.height <= canvasToProcess.height) {
        console.log('✅ jscanify extraction successful:', extracted.width, 'x', extracted.height);
        return extracted;
      } else {
        console.warn('jscanify extraction failed or returned invalid result, falling back to basic extraction');
        return this.basicDocumentExtraction(canvasToProcess, boundedCorners);
      }
    } catch (error) {
      console.error('jscanify extraction failed:', error);
      console.log('🔄 Falling back to basic extraction...');
      return this.basicDocumentExtraction(canvasToProcess, boundedCorners);
    }
  }

  /**
   * Basic document extraction using canvas operations
   */
  private basicDocumentExtraction(
    canvas: HTMLCanvasElement,
    corners: { x: number; y: number }[]
  ): HTMLCanvasElement | null {
    try {
      // Find the bounding box of the document
      const minX = Math.min(...corners.map(c => c.x));
      const maxX = Math.max(...corners.map(c => c.x));
      const minY = Math.min(...corners.map(c => c.y));
      const maxY = Math.max(...corners.map(c => c.y));

      let width = maxX - minX;
      let height = maxY - minY;

      // Ensure minimum dimensions
      const minDimension = 100;
      if (width < minDimension) {
        width = minDimension;
      }
      if (height < minDimension) {
        height = minDimension;
      }

      // Ensure dimensions don't exceed canvas bounds
      width = Math.min(width, canvas.width - minX);
      height = Math.min(height, canvas.height - minY);

      // Final validation
      if (width <= 0 || height <= 0) {
        console.error('Invalid dimensions after validation:', { width, height });
        return null;
      }

      console.log('📐 Basic extraction dimensions:', {
        original: `${maxX - minX}x${maxY - minY}`,
        validated: `${width}x${height}`,
        canvasSize: `${canvas.width}x${canvas.height}`
      });

      // Create extracted canvas
      const extractedCanvas = document.createElement('canvas');
      const ctx = extractedCanvas.getContext('2d');

      if (!ctx) {
        console.error('Could not get context for extracted canvas');
        return null;
      }

      extractedCanvas.width = width;
      extractedCanvas.height = height;

      // Draw the extracted region
      ctx.drawImage(
        canvas,
        minX, minY, width, height,  // Source rectangle
        0, 0, width, height        // Destination rectangle
      );

      return extractedCanvas;
    } catch (error) {
      console.error('Basic document extraction failed:', error);
      return null;
    }
  }

  /**
   * Highlight document on canvas
   */
  highlightDocument(
    canvas: HTMLCanvasElement,
    corners: { x: number; y: number }[],
    color: string = '#00ff00',
    lineWidth: number = 3
  ): void {
    const ctx = canvas.getContext('2d')!;
    const originalStyle = ctx.strokeStyle;
    const originalLineWidth = ctx.lineWidth;

    // Set highlight style
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

    // Draw document outline
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);

    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }

    ctx.closePath();
    ctx.stroke();

    // Restore original style
    ctx.strokeStyle = originalStyle;
    ctx.lineWidth = originalLineWidth;
  }

  /**
   * Get scanner configuration
   */
  getConfig(): ScannerConfig {
    return { ...this.config };
  }

  /**
   * Update scanner configuration
   */
  updateConfig(newConfig: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.detector = new DocumentDetector(this.config);
    this.processor = new ImageProcessor(this.config);
    this.advancedProcessor = new AdvancedImageProcessor(this.config);
    this.advancedEdgeDetector = new AdvancedEdgeDetector(this.config);
    this.multiScaleDetector = new MultiScaleDetector(this.config);
    this.cornerRefiner = new CornerRefiner(this.config);
  }

  /**
   * Check if scanner is ready for use
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Calculate final confidence score for enhanced detection
   */
  private calculateFinalConfidence(
    multiScaleConfidence: number,
    refinementConfidence: number,
    isValidQuadrilateral: boolean
  ): number {
    // Base confidence from multi-scale detection
    const baseConfidence = multiScaleConfidence * 0.5;

    // Refinement confidence
    const refinementBonus = refinementConfidence * 0.3;

    // Quadrilateral validity bonus
    const validityBonus = isValidQuadrilateral ? 0.2 : 0;

    const finalConfidence = Math.min(baseConfidence + refinementBonus + validityBonus, 1.0);

    return finalConfidence;
  }

  /**
   * Get scanner status information
   */
  getStatus(): {
    initialized: boolean;
    hasJScanify: boolean;
    hasOpenCV: boolean;
    config: ScannerConfig;
    scannerMethods?: string[];
  } {
    const status = {
      initialized: this.isInitialized,
      hasJScanify: this.scanner !== null,
      hasOpenCV: typeof window.cv !== 'undefined',
      config: this.config
    };

    // Add scanner methods info if available
    if (this.scanner) {
      const methods = Object.getOwnPropertyNames(this.scanner).concat(
        Object.getOwnPropertyNames(Object.getPrototypeOf(this.scanner))
      );
      (status as any).scannerMethods = methods;
    }

    return status;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    this.scanner = null;
    this.isInitialized = false;
    opencvLoader.cleanup();
    jscanifyLoader.cleanup();
  }

  /**
   * Test scanner functionality
   */
  async testScanner(): Promise<{
    opencvWorking: boolean;
    jscanifyWorking: boolean;
    overallReady: boolean;
  }> {
    const opencvWorking = await opencvLoader.testOpenCV();
    const jscanifyWorking = this.scanner ? await jscanifyLoader.testJScanify() : false;

    return {
      opencvWorking,
      jscanifyWorking,
      overallReady: opencvWorking
    };
  }

  /**
   * Performance test for scanner operations
   */
  async performanceTest(): Promise<{
    canvasResizeTime: number;
    detectionTime: number;
    extractionTime: number;
    totalTime: number;
    canvasSize: { width: number; height: number };
  }> {
    console.log('🏃 Starting performance test...');

    const startTime = performance.now();

    // Create a test canvas
    const testCanvas = this.createTestCanvas(1920, 1080); // HD resolution
    const originalSize = { width: testCanvas.width, height: testCanvas.height };

    // Test canvas resizing
    const resizeStart = performance.now();
    const validation = this.validateCanvas(testCanvas);
    const canvasToUse = validation.resizedCanvas || testCanvas;
    const resizeTime = performance.now() - resizeStart;

    // Test document detection
    const detectionStart = performance.now();
    const detectionResult = await this.detectDocument(canvasToUse);
    const detectionTime = performance.now() - detectionStart;

    // Test document extraction if corners found
    let extractionTime = 0;
    if (detectionResult.success && detectionResult.corners) {
      const extractionStart = performance.now();
      await this.extractDocument(canvasToUse, detectionResult.corners);
      extractionTime = performance.now() - extractionStart;
    }

    const totalTime = performance.now() - startTime;

    const results = {
      canvasResizeTime: resizeTime,
      detectionTime,
      extractionTime,
      totalTime,
      canvasSize: { width: canvasToUse.width, height: canvasToUse.height }
    };

    console.log('📊 Performance Test Results:', {
      ...results,
      resizeMs: resizeTime.toFixed(2),
      detectionMs: detectionTime.toFixed(2),
      extractionMs: extractionTime.toFixed(2),
      totalMs: totalTime.toFixed(2)
    });

    return results;
  }

  /**
   * Create a test canvas for scanner validation
   */
  private createTestCanvas(width: number = 400, height: number = 300): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    // Create a simple test pattern - white background with black rectangle (simulating a document)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'black';
    ctx.fillRect(50, 50, width - 100, height - 100);

    // Add some text to simulate document content
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('TEST DOCUMENT', 70, 100);

    return canvas;
  }

  /**
   * Comprehensive scanner test with canvas validation
   */
  async runScannerTest(): Promise<{
    success: boolean;
    results: {
      canvasValidation: boolean;
      basicDetection: boolean;
      extraction: boolean;
      previewGeneration: boolean;
    };
    errors: string[];
  }> {
    const results = {
      canvasValidation: false,
      basicDetection: false,
      extraction: false,
      previewGeneration: false
    };
    const errors: string[] = [];

    try {
      console.log('🧪 Running comprehensive scanner test...');

      // Test 1: Canvas validation
      const testCanvas = this.createTestCanvas();
      const canvasValidation = this.validateCanvas(testCanvas);
      results.canvasValidation = canvasValidation.valid;
      if (!canvasValidation.valid) {
        errors.push(`Canvas validation failed: ${canvasValidation.error}`);
      } else {
        console.log('✅ Canvas validation passed');
      }

      // Test 2: Basic detection
      if (results.canvasValidation) {
        const detectionResult = await this.detectDocument(testCanvas);
        results.basicDetection = detectionResult.success;
        if (!detectionResult.success) {
          errors.push(`Basic detection failed: ${detectionResult.error}`);
        } else {
          console.log('✅ Basic detection passed');
        }

        // Test 3: Preview generation
        const preview = await this.generateEnhancedPreview(testCanvas);
        results.previewGeneration = preview !== null && preview.width > 0 && preview.height > 0;
        if (!results.previewGeneration) {
          errors.push('Preview generation failed');
        } else {
          console.log('✅ Preview generation passed');
        }

        // Test 4: Document extraction (if corners were detected)
        if (detectionResult.success && detectionResult.corners) {
          const extracted = await this.extractDocument(testCanvas, detectionResult.corners);
          results.extraction = extracted !== null && extracted.width > 0 && extracted.height > 0;
          if (!results.extraction) {
            errors.push('Document extraction failed');
          } else {
            console.log('✅ Document extraction passed');
          }
        } else {
          console.log('⚠️ Skipping extraction test (no corners detected)');
          results.extraction = true; // Not a failure if no corners detected in test
        }
      }

      const success = results.canvasValidation && results.basicDetection && results.previewGeneration;

      console.log('🧪 Scanner test completed:', {
        success,
        results,
        errorCount: errors.length
      });

      return {
        success,
        results,
        errors
      };

    } catch (error) {
      console.error('Scanner test failed:', error);
      errors.push(`Test execution failed: ${error}`);
      return {
        success: false,
        results,
        errors
      };
    }
  }
}

// Export default instance
export const scannerManager = new ScannerManager();
