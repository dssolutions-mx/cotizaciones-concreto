import { ScannerConfig, DocumentDetectionResult, ContourInfo, Point } from './scanner-types';
import { CannyOptimizer } from './canny-optimizer';

/**
 * Main document detection coordinator
 * Combines jscanify and custom Canny optimization for robust document detection
 */
export class DocumentDetector {
  private config: ScannerConfig;
  private cannyOptimizer: CannyOptimizer;
  private scanner: any = null;

  constructor(config: ScannerConfig) {
    this.config = config;
    this.cannyOptimizer = new CannyOptimizer(config);
  }

  /**
   * Set the jscanify scanner instance
   */
  setScanner(scanner: any): void {
    this.scanner = scanner;
  }

  /**
   * Detect document using hybrid approach: jscanify + custom Canny + robust fallback
   */
  async detectDocument(
    canvas: HTMLCanvasElement,
    imageData?: ImageData
  ): Promise<DocumentDetectionResult> {
    console.log('🔍 Starting hybrid document detection...');

    // Strategy 1: Try jscanify first (if available and enabled)
    if (this.config.useExtractPaper && this.scanner) {
      try {
        const jscanifyResult = await this.detectWithJScanify(canvas);
        if (jscanifyResult.success && jscanifyResult.confidence! > this.config.qualityThreshold) {
          console.log('✅ jscanify detection successful');
          return jscanifyResult;
        }
      } catch (error) {
        console.warn('⚠️ jscanify detection failed:', error);
      }
    }

    // Strategy 2: Try robust OpenCV-based detection first
    try {
      console.log('🔄 Trying robust OpenCV document detection...');
      const robustResult = await this.detectWithRobustOpenCV(canvas, imageData);
      if (robustResult.success && robustResult.confidence! > 0.3) {
        console.log('✅ Robust OpenCV detection successful');
        return robustResult;
      }
    } catch (error) {
      console.warn('⚠️ Robust OpenCV detection failed:', error);
    }

    // Strategy 3: Use custom Canny optimization
    try {
      console.log('🔄 Falling back to optimized Canny detection...');
      const cannyResult = await this.detectWithOptimizedCanny(canvas, imageData);
      if (cannyResult.success) {
        console.log('✅ Canny detection successful');
        return cannyResult;
      }
    } catch (error) {
      console.warn('⚠️ Canny detection failed:', error);
    }

    // Strategy 4: Try basic contour detection as last resort
    try {
      console.log('🔄 Last resort: basic contour detection...');
      const basicResult = await this.detectBasicContours(canvas, imageData);
      if (basicResult.success) {
        console.log('✅ Basic contour detection successful');
        return basicResult;
      }
    } catch (error) {
      console.warn('⚠️ Basic contour detection failed:', error);
    }

    return {
      success: false,
      error: 'All document detection methods failed'
    };
  }

  /**
   * Robust OpenCV-based document detection
   */
  private async detectWithRobustOpenCV(
    canvas: HTMLCanvasElement,
    imageData?: ImageData
  ): Promise<DocumentDetectionResult> {
    try {
      const imgData = imageData || this.getImageDataFromCanvas(canvas);

      // Create OpenCV matrices
      const src = window.cv.matFromImageData(imgData);
      const gray = new window.cv.Mat();
      const blurred = new window.cv.Mat();
      const edges = new window.cv.Mat();
      const dilated = new window.cv.Mat();

      // Convert to grayscale
      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

      // Apply Gaussian blur to reduce noise
      window.cv.GaussianBlur(gray, blurred, new window.cv.Size(5, 5), 0);

      // Apply Canny edge detection with adaptive thresholds
      const adaptiveThresholds = this.calculateAdaptiveThresholds(blurred);
      window.cv.Canny(blurred, edges, adaptiveThresholds.lower, adaptiveThresholds.upper, 3, true);

      // Dilate edges to connect broken lines
      const kernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(3, 3));
      window.cv.dilate(edges, dilated, kernel);

      // Find contours
      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();
      window.cv.findContours(dilated, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

      // Find the best document contour
      let bestContour: ContourInfo | null = null;
      let bestScore = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);

        // Skip contours that are too small or too large
        if (area < canvas.width * canvas.height * 0.1 || area > canvas.width * canvas.height * 0.9) {
          continue;
        }

        const perimeter = window.cv.arcLength(contour, true);
        const approx = new window.cv.Mat();
        window.cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

        // Look for quadrilateral shapes
        if (approx.rows >= 4 && approx.rows <= 8) {
          const boundingRect = window.cv.boundingRect(contour);
          const aspectRatio = boundingRect.width / boundingRect.height;

          // Check if aspect ratio is reasonable for a document
          if (aspectRatio > 0.2 && aspectRatio < 5.0) {
            const contourInfo: ContourInfo = {
              contour,
              area,
              perimeter,
              boundingRect,
              aspectRatio,
              solidity: 1.0, // Approximation
              corners: this.extractCornersFromContour(approx)
            };

            const score = this.scoreRobustContour(contourInfo, canvas);
            if (score > bestScore) {
              bestScore = score;
              if (bestContour) {
                // Clean up previous best contour
                bestContour.contour.delete();
              }
              bestContour = contourInfo;
            } else {
              // Clean up this contour
              contour.delete();
            }
          } else {
            contour.delete();
          }
        } else {
          contour.delete();
        }

        approx.delete();
      }

      // Clean up
      src.delete();
      gray.delete();
      blurred.delete();
      edges.delete();
      dilated.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();

      if (bestContour && bestContour.corners.length >= 4) {
        const confidence = Math.min(bestScore, 1.0);

        return {
          success: true,
          corners: bestContour.corners,
          confidence,
          method: 'opencv_robust',
          contourInfo: bestContour
        };
      }

      return {
        success: false,
        error: 'No suitable document contour found with robust OpenCV detection'
      };

    } catch (error) {
      return {
        success: false,
        error: `Robust OpenCV detection error: ${error}`
      };
    }
  }

  /**
   * Calculate adaptive thresholds for Canny
   */
  private calculateAdaptiveThresholds(grayImage: any): { lower: number; upper: number } {
    try {
      // Calculate histogram
      const hist = new window.cv.Mat();
      const histSize = [256];
      const ranges = [0, 256];
      const mask = new window.cv.Mat();

      window.cv.calcHist([grayImage], [0], mask, hist, histSize, ranges);

      // Find optimal threshold using Otsu-like method
      let totalPixels = 0;
      let sum = 0;
      const histogram = [];

      for (let i = 0; i < 256; i++) {
        const value = hist.data32F[i] || 0;
        histogram.push(value);
        totalPixels += value;
        sum += i * value;
      }

      let sumB = 0;
      let wB = 0;
      let max = 0;
      let threshold = 0;

      for (let i = 0; i < 256; i++) {
        wB += histogram[i];
        if (wB === 0) continue;

        const wF = totalPixels - wB;
        if (wF === 0) break;

        sumB += i * histogram[i];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * (mB - mF) * (mB - mF);

        if (between > max) {
          max = between;
          threshold = i;
        }
      }

      hist.delete();
      mask.delete();

      const lowerThresh = Math.max(10, threshold * 0.3);
      const upperThresh = Math.min(255, threshold * 0.8);

      return { lower: lowerThresh, upper: upperThresh };

    } catch (error) {
      // Fallback thresholds
      return { lower: 50, upper: 150 };
    }
  }

  /**
   * Score contour for robust detection
   */
  private scoreRobustContour(contourInfo: ContourInfo, canvas: HTMLCanvasElement): number {
    const { area, aspectRatio, corners } = contourInfo;

    // Area coverage score (prefer contours that cover reasonable portion of image)
    const canvasArea = canvas.width * canvas.height;
    const areaRatio = area / canvasArea;
    const areaScore = areaRatio > 0.15 && areaRatio < 0.85 ? 1.0 : 0.5;

    // Shape regularity score (prefer 4 corners for documents)
    const cornerScore = corners.length === 4 ? 1.0 : Math.max(0, 1 - Math.abs(corners.length - 4) * 0.2);

    // Aspect ratio score (prefer reasonable document proportions)
    const aspectScore = aspectRatio > 0.3 && aspectRatio < 3.0 ? 1.0 : 0.7;

    return (areaScore * 0.4 + cornerScore * 0.4 + aspectScore * 0.2);
  }

  /**
   * Extract corners from contour approximation
   */
  private extractCornersFromContour(approx: any): Point[] {
    const corners: Point[] = [];
    for (let i = 0; i < approx.rows; i++) {
      const point = approx.row(i);
      corners.push({
        x: point.doubleAt(0, 0),
        y: point.doubleAt(0, 1),
      });
    }
    return corners;
  }

  /**
   * Detect document using jscanify
   */
  private async detectWithJScanify(canvas: HTMLCanvasElement): Promise<DocumentDetectionResult> {
    return new Promise((resolve) => {
      try {
        if (!this.scanner || typeof this.scanner.findPaperContour !== 'function') {
          resolve({
            success: false,
            error: 'jscanify scanner not available or missing findPaperContour method'
          });
          return;
        }

        // Use jscanify to find paper contour
        const paperContour = this.scanner.findPaperContour(canvas);

        if (paperContour && paperContour.length >= 8) { // At least 4 points (x,y each)
          const corners = this.extractCornersFromJScanifyContour(paperContour);
          const confidence = this.calculateJScanifyConfidence(corners, canvas);

          resolve({
            success: true,
            corners,
            confidence,
            method: 'jscanify'
          });
        } else {
          resolve({
            success: false,
            error: 'jscanify could not find a valid paper contour'
          });
        }
      } catch (error) {
        resolve({
          success: false,
          error: `jscanify detection error: ${error}`
        });
      }
    });
  }

  /**
   * Detect document using optimized Canny algorithm
   */
  private async detectWithOptimizedCanny(
    canvas: HTMLCanvasElement,
    imageData?: ImageData
  ): Promise<DocumentDetectionResult> {
    try {
      // Get image data if not provided
      const imgData = imageData || this.getImageDataFromCanvas(canvas);

      // Apply preprocessing
      const preprocessedData = this.cannyOptimizer.preprocessImage(imgData);

      // Find best contour using optimized Canny
      const result = await this.cannyOptimizer.findBestDocumentContour(preprocessedData, canvas);

      if (result.contour && result.contour.corners.length >= 4) {
        const confidence = this.calculateContourConfidence(result.contour, canvas);

        return {
          success: true,
          corners: result.contour.corners,
          confidence,
          method: 'opencv_canny',
          contourInfo: result.contour
        };
      }

      return {
        success: false,
        error: 'No valid document contour found with optimized Canny'
      };
    } catch (error) {
      return {
        success: false,
        error: `Optimized Canny detection error: ${error}`
      };
    }
  }

  /**
   * Basic contour detection as fallback
   */
  private async detectBasicContours(
    canvas: HTMLCanvasElement,
    imageData?: ImageData
  ): Promise<DocumentDetectionResult> {
    try {
      const imgData = imageData || this.getImageDataFromCanvas(canvas);

      // Simple Canny with default parameters
      const src = window.cv.matFromImageData(imgData);
      const gray = new window.cv.Mat();
      const edges = new window.cv.Mat();

      window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
      window.cv.Canny(gray, edges, 50, 150, 3, true);

      const contours = new window.cv.MatVector();
      const hierarchy = new window.cv.Mat();

      window.cv.findContours(edges, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

      // Find largest rectangular contour
      let bestContour: ContourInfo | null = null;
      let maxArea = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);

        if (area > maxArea) {
          maxArea = area;
          const contourInfo = this.analyzeContour(contour);
          if (contourInfo.corners.length >= 4) {
            bestContour = contourInfo;
          }
        }
      }

      // Clean up
      src.delete();
      gray.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();

      if (bestContour) {
        return {
          success: true,
          corners: bestContour.corners,
          confidence: 0.5, // Lower confidence for basic method
          method: 'hybrid',
          contourInfo: bestContour
        };
      }

      return {
        success: false,
        error: 'No valid contours found with basic detection'
      };
    } catch (error) {
      return {
        success: false,
        error: `Basic contour detection error: ${error}`
      };
    }
  }

  /**
   * Extract corners from jscanify contour format
   */
  private extractCornersFromJScanifyContour(contour: number[]): Point[] {
    const corners: Point[] = [];
    for (let i = 0; i < contour.length; i += 2) {
      corners.push({
        x: contour[i],
        y: contour[i + 1]
      });
    }
    return corners;
  }

  /**
   * Calculate confidence score for jscanify result
   */
  private calculateJScanifyConfidence(corners: Point[], canvas: HTMLCanvasElement): number {
    if (corners.length < 4) return 0;

    // Calculate coverage area relative to canvas
    const canvasArea = canvas.width * canvas.height;
    const contourArea = this.calculatePolygonArea(corners);

    if (contourArea === 0 || canvasArea === 0) return 0;

    const coverageRatio = contourArea / canvasArea;

    // Check if corners form a reasonable quadrilateral
    const isReasonableShape = this.isReasonableQuadrilateral(corners, canvas);

    // Combine factors
    const confidence = coverageRatio * 0.7 + (isReasonableShape ? 0.3 : 0);

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate confidence for contour-based detection
   */
  private calculateContourConfidence(contourInfo: ContourInfo, canvas: HTMLCanvasElement): number {
    const canvasArea = canvas.width * canvas.height;
    const coverageRatio = contourInfo.area / canvasArea;

    // Factor in shape regularity and other metrics
    const shapeScore = contourInfo.solidity * 0.3 +
                      (contourInfo.corners.length === 4 ? 0.3 : 0.1) +
                      (this.isReasonableAspectRatio(contourInfo.aspectRatio) ? 0.4 : 0.1);

    return Math.min(coverageRatio * 0.6 + shapeScore * 0.4, 1.0);
  }

  /**
   * Check if corners form a reasonable quadrilateral
   */
  private isReasonableQuadrilateral(corners: Point[], canvas: HTMLCanvasElement): boolean {
    if (corners.length !== 4) return false;

    // Check if points are reasonably spread out
    const canvasArea = canvas.width * canvas.height;
    const contourArea = this.calculatePolygonArea(corners);
    const minAreaRatio = 0.1; // At least 10% of canvas area

    return contourArea / canvasArea >= minAreaRatio;
  }

  /**
   * Check if aspect ratio is reasonable for a document
   */
  private isReasonableAspectRatio(ratio: number): boolean {
    return ratio >= this.config.minAspectRatio && ratio <= this.config.maxAspectRatio;
  }

  /**
   * Calculate area of a polygon using shoelace formula
   */
  private calculatePolygonArea(points: Point[]): number {
    if (points.length < 3) return 0;

    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    return Math.abs(area) / 2;
  }

  /**
   * Analyze contour (similar to CannyOptimizer but for basic detection)
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

    // Approximate polygon to find corners
    const epsilon = 0.02 * perimeter;
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

    hull.delete();
    approx.delete();

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
   * Get ImageData from canvas
   */
  private getImageDataFromCanvas(canvas: HTMLCanvasElement): ImageData {
    // Use optimized canvas context for better performance
    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false
    })!;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}
