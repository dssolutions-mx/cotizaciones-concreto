import { ScannerConfig, CannyParams, ContourInfo, Point } from './scanner-types';

/**
 * Advanced Canny algorithm optimizer for document detection
 * Implements multiple strategies to improve document edge detection reliability
 */
export class CannyOptimizer {
  private config: ScannerConfig;

  constructor(config: ScannerConfig) {
    this.config = config;
  }

  /**
   * Apply optimized Canny edge detection with multiple parameter combinations
   * Returns the best contour found across all parameter sets
   */
  async findBestDocumentContour(
    imageData: ImageData,
    canvas: HTMLCanvasElement
  ): Promise<{ contour: ContourInfo | null; params: CannyParams }> {
    const parameterSets = this.generateOptimizedParameterSets();
    let bestContour: ContourInfo | null = null;
    let bestParams: CannyParams = parameterSets[0];
    let bestScore = 0;

    console.log('🔄 Testing multiple Canny parameter combinations...');

    for (const params of parameterSets) {
      try {
        const result = await this.applyCannyWithParams(imageData, canvas, params);
        if (result.contour) {
          const score = this.scoreContour(result.contour);

          if (score > bestScore) {
            bestScore = score;
            bestContour = result.contour;
            bestParams = params;
            console.log(`✅ Better contour found with score ${score.toFixed(3)} using params: ${params.low}-${params.high}`);
          }
        }
      } catch (error) {
        console.warn(`⚠️ Failed to process with params ${params.low}-${params.high}:`, error);
      }
    }

    if (bestContour) {
      console.log(`🏆 Best contour found with score ${bestScore.toFixed(3)}`);
    } else {
      console.warn('❌ No valid document contours found with any parameter set');
    }

    return { contour: bestContour, params: bestParams };
  }

  /**
   * Generate optimized parameter sets based on image characteristics
   */
  private generateOptimizedParameterSets(): CannyParams[] {
    const baseSets = [
      { low: 50, high: 150, apertureSize: 3, l2gradient: true },
      { low: 30, high: 100, apertureSize: 3, l2gradient: true },
      { low: 80, high: 200, apertureSize: 3, l2gradient: true },
      { low: 20, high: 80, apertureSize: 5, l2gradient: false },
      { low: 100, high: 250, apertureSize: 5, l2gradient: false },
    ];

    // Add adaptive parameters based on image analysis
    const adaptiveSets = this.generateAdaptiveParameters();

    return [...baseSets, ...adaptiveSets];
  }

  /**
   * Generate adaptive parameters based on image characteristics
   */
  private generateAdaptiveParameters(): CannyParams[] {
    // These will be enhanced with actual image analysis in the future
    return [
      { low: 40, high: 120, apertureSize: 3, l2gradient: true },
      { low: 60, high: 180, apertureSize: 3, l2gradient: true },
      { low: 25, high: 90, apertureSize: 5, l2gradient: false },
    ];
  }

  /**
   * Apply Canny edge detection with specific parameters
   */
  private async applyCannyWithParams(
    imageData: ImageData,
    canvas: HTMLCanvasElement,
    params: CannyParams
  ): Promise<{ contour: ContourInfo | null; edges?: any }> {
    return new Promise((resolve, reject) => {
      try {
        // Create OpenCV matrices
        const src = window.cv.matFromImageData(imageData);
        const gray = new window.cv.Mat();
        const blurred = new window.cv.Mat();
        const edges = new window.cv.Mat();

        // Convert to grayscale
        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

        // Apply Gaussian blur to reduce noise
        const blurSize = this.config.blurSize;
        window.cv.GaussianBlur(gray, blurred, new window.cv.Size(blurSize, blurSize), 0);

        // Apply Canny edge detection with specified parameters
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

        // Find the best document contour
        const bestContour = this.findBestContour(contours);

        // Clean up OpenCV matrices
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        contours.delete();
        hierarchy.delete();

        resolve({ contour: bestContour });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Find the best document contour from detected contours
   */
  private findBestContour(contours: any): ContourInfo | null {
    let bestContour: ContourInfo | null = null;
    let bestScore = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const contourInfo = this.analyzeContour(contour);

      if (this.isValidDocumentContour(contourInfo)) {
        const score = this.scoreContour(contourInfo);

        if (score > bestScore) {
          bestScore = score;
          bestContour = contourInfo;
        }
      }
    }

    return bestContour;
  }

  /**
   * Analyze a contour and extract useful information
   */
  private analyzeContour(contour: any): ContourInfo {
    const area = window.cv.contourArea(contour);
    const perimeter = window.cv.arcLength(contour, true);
    const boundingRect = window.cv.boundingRect(contour);

    // Calculate aspect ratio
    const aspectRatio = boundingRect.width / boundingRect.height;

    // Calculate solidity (area / convex hull area)
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
   * Find corner points of a contour using approximation
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
   * Check if a contour is a valid document candidate
   */
  private isValidDocumentContour(contourInfo: ContourInfo): boolean {
    const { area, aspectRatio, solidity, corners } = contourInfo;

    // Check area constraints
    if (area < this.config.minContourArea || area > this.config.maxContourArea) {
      return false;
    }

    // Check aspect ratio (documents are usually rectangular)
    if (aspectRatio < this.config.minAspectRatio || aspectRatio > this.config.maxAspectRatio) {
      return false;
    }

    // Check solidity (documents should be fairly solid)
    if (solidity < this.config.minSolidity) {
      return false;
    }

    // Check number of corners (documents usually have 4 corners)
    if (corners.length < 4 || corners.length > 8) {
      return false;
    }

    return true;
  }

  /**
   * Score a contour based on how likely it is to be a document
   */
  private scoreContour(contourInfo: ContourInfo): number {
    const { area, aspectRatio, solidity, corners } = contourInfo;

    // Base score from area (larger contours get higher scores)
    const areaScore = Math.min(area / this.config.maxContourArea, 1) * 0.3;

    // Aspect ratio score (closer to 1:1 or common document ratios)
    const targetRatio = 0.7; // Slightly rectangular
    const ratioScore = 1 - Math.abs(aspectRatio - targetRatio) / targetRatio;
    const aspectScore = Math.max(0, ratioScore) * 0.3;

    // Solidity score
    const solidityScore = solidity * 0.2;

    // Corner score (4 corners is ideal for documents)
    const cornerScore = corners.length === 4 ? 1 : Math.max(0, 1 - Math.abs(corners.length - 4) * 0.2);
    const cornerBonus = cornerScore * 0.2;

    return areaScore + aspectScore + solidityScore + cornerBonus;
  }

  /**
   * Apply advanced image preprocessing before Canny
   */
  preprocessImage(imageData: ImageData): ImageData {
    if (!this.config.enhanceContrast) {
      return imageData;
    }

    // Create canvas for preprocessing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);

    // Apply contrast enhancement
    const imageDataCopy = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageDataCopy.data;

    // Simple contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
      // Enhance contrast for each channel
      for (let j = 0; j < 3; j++) {
        const value = data[i + j];
        // Simple contrast stretching
        data[i + j] = Math.max(0, Math.min(255, (value - 128) * 1.2 + 128));
      }
    }

    return imageDataCopy;
  }
}
