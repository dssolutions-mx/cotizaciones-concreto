import {
  ScannerConfig,
  MultiScaleResult,
  ContourInfo,
  Point,
  CannyParams,
  AdaptiveThresholds
} from './scanner-types';
import { AdvancedImageProcessor } from './advanced-image-processor';

/**
 * Multi-scale edge detection using pyramid approach
 * Processes images at multiple scales to catch edges missed at single scale
 */
export class MultiScaleDetector {
  private config: ScannerConfig;
  private advancedProcessor: AdvancedImageProcessor;
  private canvas: HTMLCanvasElement | null = null;

  constructor(config: ScannerConfig) {
    this.config = config;
    this.advancedProcessor = new AdvancedImageProcessor(config);
  }

  /**
   * Detect document using multi-scale approach
   */
  async detectMultiScale(
    canvas: HTMLCanvasElement,
    enableDebugging: boolean = false
  ): Promise<MultiScaleResult | null> {
    // Store canvas for use in other methods
    this.canvas = canvas;

    const scales = this.config.scaleFactors;
    let bestResult: MultiScaleResult | null = null;
    let bestScore = 0;

    console.log('🔍 Starting multi-scale document detection...');
    console.log(`📊 Testing ${scales.length} scales: ${scales.join(', ')}`);
    console.log(`📐 Canvas size: ${canvas.width}x${canvas.height}`);

    for (const scale of scales) {
      try {
        console.log(`🔄 Processing scale: ${scale}`);

        const scaleResult = await this.processAtScale(canvas, scale, enableDebugging);
        if (scaleResult) {
          const score = this.scoreMultiScaleResult(scaleResult);

          console.log(`✅ Scale ${scale} result: confidence=${scaleResult.confidence.toFixed(3)}, score=${score.toFixed(3)}`);

          if (score > bestScore) {
            bestScore = score;
            bestResult = scaleResult;
            console.log(`🏆 New best result from scale ${scale} with score ${score.toFixed(3)}`);
          }
        } else {
          console.log(`⚠️ Scale ${scale} returned no result`);
        }
      } catch (error) {
        console.warn(`❌ Failed to process scale ${scale}:`, error);
      }
    }

    if (bestResult) {
      console.log(`🎯 Best result from scale ${bestResult.scale} with confidence ${bestResult.confidence.toFixed(3)}`);
    } else {
      console.warn('❌ No valid document detected at any scale');
    }

    return bestResult;
  }

  /**
   * Process image at specific scale
   */
  private async processAtScale(
    canvas: HTMLCanvasElement,
    scale: number,
    enableDebugging: boolean
  ): Promise<MultiScaleResult | null> {
    // Resize canvas for current scale
    const scaledCanvas = this.resizeCanvas(canvas, scale);

    // Apply advanced preprocessing
    const processedResult = await this.advancedProcessor.applyAdvancedPreprocessing(scaledCanvas, enableDebugging);

    // Detect document at this scale
    const detectionResult = await this.detectDocumentAtScale(processedResult.processedCanvas, scale);

    if (!detectionResult) {
      return null;
    }

    // Scale coordinates back to original size
    const originalCorners = this.scaleCornersBack(detectionResult.corners, scale);

    return {
      corners: originalCorners,
      confidence: detectionResult.confidence,
      scale,
      contourInfo: detectionResult.contourInfo
    };
  }

  /**
   * Detect document at specific scale using optimized Canny
   */
  private async detectDocumentAtScale(
    canvas: HTMLCanvasElement,
    scale: number
  ): Promise<{ corners: Point[]; confidence: number; contourInfo: ContourInfo } | null> {
    return new Promise((resolve) => {
      try {
        // Get adaptive thresholds for this scale
        const adaptiveThresholds = this.advancedProcessor.calculateAdaptiveThresholds(canvas);

        // Generate parameter sets optimized for this scale
        const parameterSets = this.generateScaleOptimizedParameters(scale, adaptiveThresholds);

        let bestContour: ContourInfo | null = null;
        let bestScore = 0;
        let bestParams: CannyParams = parameterSets[0];

        for (const params of parameterSets) {
          const result = this.applyCannyAtScale(canvas, params);

          // Check if this result should be skipped
          if (result.skip) {
            continue;
          }

          if (result.contour) {
            const score = this.scoreContour(result.contour, scale);

            if (score > bestScore) {
              bestScore = score;
              bestContour = result.contour;
              bestParams = params;
            }
          }
        }

        if (bestContour && bestContour.corners.length >= 4) {
          const confidence = this.calculateScaleConfidence(bestContour, canvas, scale);

          resolve({
            corners: bestContour.corners,
            confidence,
            contourInfo: bestContour
          });
        } else {
          resolve(null);
        }
      } catch (error) {
        console.warn(`Document detection at scale ${scale} failed:`, error);
        resolve(null);
      }
    });
  }

  /**
   * Apply Canny edge detection at specific scale
   */
  private applyCannyAtScale(
    canvas: HTMLCanvasElement,
    params: CannyParams
  ): { contour: ContourInfo | null; edges?: any; skip?: boolean } {
    try {
      // Use optimized canvas context for better performance
      const ctx = canvas.getContext('2d', {
        willReadFrequently: true,
        alpha: false
      })!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Create OpenCV matrices
      const src = window.cv.matFromImageData(imageData);
      const gray = new window.cv.Mat();
      const blurred = new window.cv.Mat();
      const edges = new window.cv.Mat();

      // Convert to grayscale
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

      // Apply Gaussian blur
      const blurSize = Math.max(3, Math.floor(this.config.blurSize));
      window.cv.GaussianBlur(gray, blurred, new window.cv.Size(blurSize, blurSize), 0);

      // Apply Canny with specified parameters
      window.cv.Canny(
        blurred,
        edges,
        params.low,
        params.high,
        params.apertureSize || 3,
        params.l2gradient !== false
      );

      // Find contours
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();

      window.cv.findContours(
        edges,
        contours,
        hierarchy,
        window.cv.RETR_EXTERNAL,
        window.cv.CHAIN_APPROX_SIMPLE
      );

      // Find best document contour
      let bestContour: ContourInfo | null = null;

      try {
        bestContour = this.findBestContour(contours);
      } catch (error) {
        console.error('❌ Error in findBestContour:', error);
        // Clean up and return skip flag
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
        return { contour: null, skip: true };
      }

      // Check if findBestContour returned null (canvas not available or other error)
      if (!bestContour) {
        console.warn('⚠️ findBestContour returned null, skipping this result');
        // Clean up and return skip flag
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();
        return { contour: null, skip: true };
      }

      // Clean up
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();

      return { contour: bestContour };
    } catch (error) {
      console.error('Canny application failed:', error);
      return { contour: null };
    }
  }

  /**
   * Generate parameter sets optimized for specific scale
   */
  private generateScaleOptimizedParameters(scale: number, thresholds: AdaptiveThresholds): CannyParams[] {
    const baseParams = [
      // Conservative parameters for large scales (more detail)
      { low: thresholds.lower * 0.8, high: thresholds.upper * 0.9, apertureSize: 3, l2gradient: true },
      { low: thresholds.lower * 0.6, high: thresholds.upper * 0.8, apertureSize: 3, l2gradient: true },

      // Standard parameters
      { low: thresholds.lower, high: thresholds.upper, apertureSize: 3, l2gradient: true },

      // Aggressive parameters for small scales (less noise)
      { low: thresholds.lower * 1.2, high: thresholds.upper * 1.1, apertureSize: 5, l2gradient: false },
      { low: thresholds.lower * 1.5, high: thresholds.upper * 1.3, apertureSize: 5, l2gradient: false },
    ];

    // Scale-specific adjustments
    if (scale < 0.7) {
      // Smaller scales need more aggressive parameters
      return baseParams.map(params => ({
        ...params,
        low: params.low * 1.2,
        high: params.high * 1.1
      }));
    } else if (scale > 1.2) {
      // Larger scales can use more conservative parameters
      return baseParams.map(params => ({
        ...params,
        low: params.low * 0.9,
        high: params.high * 0.95
      }));
    }

    return baseParams;
  }

  /**
   * Find best contour from detected contours
   */
  private findBestContour(contours: any): ContourInfo | null {
    let bestContour: ContourInfo | null = null;
    let bestScore = 0;
    const totalContours = contours.size();

    console.log(`🔍 Analyzing ${totalContours} contours...`);

    // Check if canvas is available
    if (!this.canvas) {
      console.error('❌ Canvas not available in findBestContour');
      return null;
    }

    // Performance optimization: limit contour analysis for very large numbers
    const maxContoursToAnalyze = Math.min(totalContours, 1000); // Analyze at most 1000 contours
    const stepSize = totalContours > maxContoursToAnalyze ? Math.floor(totalContours / maxContoursToAnalyze) : 1;

    console.log(`⚡ Performance optimization: analyzing every ${stepSize}th contour (max ${maxContoursToAnalyze})`);

    let analyzedCount = 0;

    for (let i = 0; i < totalContours; i += stepSize) {
      const contour = contours.get(i);

      // Quick area check to filter out tiny contours immediately
      const area = window.cv.contourArea(contour);
      const canvasArea = this.canvas.width * this.canvas.height;

      // More reasonable area filtering for document detection
      const minArea = Math.max(
        canvasArea * 0.001, // 0.1% of canvas area (much more reasonable)
        100 // Minimum 100 pixels (reduced from 500)
      );

      if (area < minArea) {
        continue; // Skip tiny contours
      }

      // Filter out contours that are too large (likely entire image/background)
      const maxArea = canvasArea * 0.9; // 90% of canvas area (reduced from 95%)
      if (area > maxArea) {
        continue; // Skip huge contours (likely background)
      }

      // Filter by perimeter (too small or too large contours are likely noise)
      const perimeter = window.cv.arcLength(contour, true);
      const canvasPerimeter = (this.canvas.width + this.canvas.height) * 2;

      // More reasonable perimeter filtering
      const minPerimeter = Math.min(this.canvas.width, this.canvas.height) * 0.05; // 5% of smaller dimension
      const maxPerimeter = canvasPerimeter * 0.7; // 70% of canvas perimeter

      if (perimeter < minPerimeter || perimeter > maxPerimeter) {
        continue;
      }

      const contourInfo = this.analyzeContour(contour);
      analyzedCount++;

      if (analyzedCount <= 10) { // Only log first 10 for performance
        console.log(`Contour ${i}: area=${contourInfo.area.toFixed(0)}, aspect=${contourInfo.aspectRatio.toFixed(2)}, solidity=${contourInfo.solidity.toFixed(2)}, corners=${contourInfo.corners.length}`);
      }

      if (this.isValidDocumentContour(contourInfo)) {
        const score = this.scoreContour(contourInfo, 1.0);

        if (analyzedCount <= 10) { // Only log first 10 for performance
          console.log(`✅ Valid contour ${i} with score ${score.toFixed(3)}`);
        }

        if (score > bestScore) {
          bestScore = score;
          bestContour = contourInfo;
        }
      }
    }

    console.log(`📊 Analyzed ${analyzedCount} contours out of ${totalContours} total`);

    if (bestContour) {
      console.log(`🏆 Selected best contour with score ${bestScore.toFixed(3)}`);
    } else {
      console.log(`⚠️ No valid contours found`);
    }

    return bestContour;
  }

  /**
   * Analyze contour and extract information
   */
  private analyzeContour(contour: any): ContourInfo {
    const area = window.cv.contourArea(contour);
    const perimeter = window.cv.arcLength(contour, true);
    const boundingRect = window.cv.boundingRect(contour);
    const aspectRatio = boundingRect.width / boundingRect.height;

    // Calculate solidity
    const hull = new window.cv.Mat();
    window.cv.convexHull(contour, hull);
    const hullArea = window.cv.contourArea(hull);
    const solidity = hullArea > 0 ? area / hullArea : 0;

    // Find corner points
    const corners = this.findContourCorners(contour);

    hull.delete();

    return {
      contour,
      area,
      perimeter,
      boundingRect,
      aspectRatio,
      solidity,
      corners,
    };
  }

  /**
   * Find corner points of contour using approximation
   */
  private findContourCorners(contour: any): Point[] {
    const epsilon = 0.02 * window.cv.arcLength(contour, true);
    const approx = new window.cv.Mat();

    window.cv.approxPolyDP(contour, approx, epsilon, true);

    const corners: Point[] = [];
    for (let i = 0; i < approx.rows; i++) {
      const point = approx.row(i);
      corners.push({
        x: point.doubleAt(0, 0),
        y: point.doubleAt(0, 1),
      });
    }

    approx.delete();
    return corners;
  }

  /**
   * Check if contour is valid document candidate
   */
  private isValidDocumentContour(contourInfo: ContourInfo): boolean {
    const { area, aspectRatio, solidity, corners } = contourInfo;

    // Scale-adjusted area constraints
    if (area < this.config.minContourArea * 0.5 || area > this.config.maxContourArea) {
      console.log(`❌ Area check failed: ${area.toFixed(0)} (min: ${(this.config.minContourArea * 0.5).toFixed(0)}, max: ${this.config.maxContourArea})`);
      return false;
    }

    // Aspect ratio constraints
    if (aspectRatio < this.config.minAspectRatio || aspectRatio > this.config.maxAspectRatio) {
      console.log(`❌ Aspect ratio check failed: ${aspectRatio.toFixed(2)} (min: ${this.config.minAspectRatio}, max: ${this.config.maxAspectRatio})`);
      return false;
    }

    // Solidity constraints
    if (solidity < this.config.minSolidity) {
      console.log(`❌ Solidity check failed: ${solidity.toFixed(2)} (min: ${this.config.minSolidity})`);
      return false;
    }

    // Corner count constraints
    if (corners.length < 4 || corners.length > 8) {
      console.log(`❌ Corner count check failed: ${corners.length} (required: 4-8)`);
      return false;
    }

    console.log(`✅ Contour passed all validation checks`);
    return true;
  }

  /**
   * Score contour based on document likelihood
   */
  private scoreContour(contourInfo: ContourInfo, scale: number): number {
    const { area, aspectRatio, solidity, corners } = contourInfo;

    // Area score (scale-adjusted)
    const areaScore = Math.min(area / (this.config.maxContourArea * scale), 1) * 0.3;

    // Aspect ratio score
    const targetRatio = 0.7;
    const ratioScore = 1 - Math.abs(aspectRatio - targetRatio) / targetRatio;
    const aspectScore = Math.max(0, ratioScore) * 0.3;

    // Solidity score
    const solidityScore = solidity * 0.2;

    // Corner score
    const cornerScore = corners.length === 4 ? 1 : Math.max(0, 1 - Math.abs(corners.length - 4) * 0.2);
    const cornerBonus = cornerScore * 0.2;

    return areaScore + aspectScore + solidityScore + cornerBonus;
  }

  /**
   * Score multi-scale result
   */
  private scoreMultiScaleResult(result: MultiScaleResult): number {
    const { confidence, scale, contourInfo } = result;

    // Base confidence score
    const confidenceScore = confidence * 0.4;

    // Scale preference score (prefer medium scales)
    const scaleScore = 1 - Math.abs(scale - 1.0) * 0.3;
    const scaleBonus = scaleScore * 0.2;

    // Contour quality score
    const qualityScore = this.scoreContour(contourInfo, scale) * 0.4;

    return confidenceScore + scaleBonus + qualityScore;
  }

  /**
   * Calculate confidence for scale-specific detection
   */
  private calculateScaleConfidence(contourInfo: ContourInfo, canvas: HTMLCanvasElement, scale: number): number {
    const canvasArea = canvas.width * canvas.height;
    const coverageRatio = contourInfo.area / canvasArea;

    // Scale-adjusted coverage
    const adjustedCoverage = coverageRatio / scale;

    // Shape regularity score
    const shapeScore = contourInfo.solidity * 0.3 +
                      (contourInfo.corners.length === 4 ? 0.3 : 0.1) +
                      (this.isReasonableAspectRatio(contourInfo.aspectRatio) ? 0.4 : 0.1);

    return Math.min(adjustedCoverage * 0.6 + shapeScore * 0.4, 1.0);
  }

  /**
   * Check if aspect ratio is reasonable for document
   */
  private isReasonableAspectRatio(ratio: number): boolean {
    return ratio >= this.config.minAspectRatio && ratio <= this.config.maxAspectRatio;
  }

  /**
   * Resize canvas by scale factor
   */
  private resizeCanvas(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
    const resizedCanvas = document.createElement('canvas');
    const ctx = resizedCanvas.getContext('2d')!;

    resizedCanvas.width = Math.floor(canvas.width * scale);
    resizedCanvas.height = Math.floor(canvas.height * scale);

    ctx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);

    return resizedCanvas;
  }

  /**
   * Scale corner coordinates back to original size
   */
  private scaleCornersBack(corners: Point[], scale: number): Point[] {
    return corners.map(corner => ({
      x: corner.x / scale,
      y: corner.y / scale
    }));
  }
}
