import {
  ScannerConfig,
  Point,
  ContourInfo,
  DocumentDetectionResult
} from './scanner-types';

/**
 * Advanced Edge Detection System
 * Implements multiple sophisticated edge detection algorithms for robust document boundary detection
 */
export class AdvancedEdgeDetector {
  private config: ScannerConfig;

  constructor(config: ScannerConfig) {
    this.config = config;
  }

  /**
   * Main edge detection pipeline with multiple algorithms
   */
  async detectDocumentEdges(
    canvas: HTMLCanvasElement,
    imageData?: ImageData
  ): Promise<DocumentDetectionResult> {
    const startTime = performance.now();
    console.log('🔍 Starting advanced edge detection pipeline...');

    const imgData = imageData || this.getImageDataFromCanvas(canvas);

    // Strategy 1: Hough Line Detection (best for clear boundaries) - FASTEST FIRST
    try {
      console.log('📐 Trying Hough line-based detection...');
      const houghResult = await this.executeWithTimeout(
        () => this.detectWithHoughLines(canvas, imgData),
        'Hough line detection',
        500 // Reduced to 500ms for faster failure
      );
      if (houghResult.success && houghResult.confidence! > 0.7) {
        console.log('✅ Hough line detection successful');
        return houghResult;
      }
    } catch (error) {
      console.warn('⚠️ Hough line detection failed:', error);
    }

    // Strategy 2: Adaptive Multi-Scale Canny - Only try if we have enough time
    const currentTime = performance.now();
    const elapsedTime = currentTime - startTime;

    if (elapsedTime < 1000) { // Only try if less than 1 second elapsed
      try {
        console.log('🔄 Trying adaptive multi-scale Canny...');
        const cannyResult = await this.executeWithTimeout(
          () => this.detectWithAdaptiveCanny(canvas, imgData),
          'Adaptive Canny detection',
          Math.max(300, 800 - elapsedTime) // Reduce timeout based on elapsed time
        );
        if (cannyResult.success && cannyResult.confidence! > 0.6) {
          console.log('✅ Adaptive Canny detection successful');
          return cannyResult;
        }
      } catch (error) {
        console.warn('⚠️ Adaptive Canny detection failed:', error);
      }
    } else {
      console.log('⏰ Skipping Adaptive Canny - insufficient time remaining');
    }

    // Strategy 3: Gradient-based Edge Detection - Only try if very fast
    const timeAfterCanny = performance.now() - startTime;
    if (timeAfterCanny < 800) {
      try {
        console.log('📊 Trying gradient-based detection...');
        const gradientResult = await this.executeWithTimeout(
          () => this.detectWithGradientAnalysis(canvas, imgData),
          'Gradient-based detection',
          Math.max(200, 600 - timeAfterCanny)
        );
        if (gradientResult.success && gradientResult.confidence! > 0.5) {
          console.log('✅ Gradient-based detection successful');
          return gradientResult;
        }
      } catch (error) {
        console.warn('⚠️ Gradient-based detection failed:', error);
      }
    }

    // Strategy 4: Skip advanced contour analysis if taking too long
    const finalTime = performance.now() - startTime;
    if (finalTime < 1200) {
      try {
        console.log('🔍 Trying advanced contour analysis...');
        const contourResult = await this.executeWithTimeout(
          () => this.detectWithAdvancedContours(canvas, imgData),
          'Advanced contour detection',
          Math.max(300, 1000 - finalTime)
        );
        if (contourResult.success) {
          console.log('✅ Advanced contour detection successful');
          return contourResult;
        }
      } catch (error) {
        console.warn('⚠️ Advanced contour detection failed:', error);
      }
    } else {
      console.log('⏰ Skipping advanced contour analysis - time limit exceeded');
    }

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`⏱️ Advanced edge detection pipeline completed in ${duration.toFixed(2)}ms`);

    return {
      success: false,
      error: 'All advanced edge detection methods failed'
    };
  }

  /**
   * Execute detection method with timeout to prevent hanging
   */
  private async executeWithTimeout<T>(
    method: () => Promise<T>,
    methodName: string,
    timeoutMs: number = 3000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn(`⏰ ${methodName} timed out after ${timeoutMs}ms`);
        reject(new Error(`${methodName} timed out`));
      }, timeoutMs);

      method()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Hough Line-based document detection
   */
  private async detectWithHoughLines(
    canvas: HTMLCanvasElement,
    imageData: ImageData
  ): Promise<DocumentDetectionResult> {
    return new Promise((resolve) => {
      try {
        const src = window.cv.matFromImageData(imageData);
        const gray = new window.cv.Mat();
        const edges = new window.cv.Mat();
        const lines = new window.cv.Mat();

        // Convert to grayscale
        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

        // Apply Gaussian blur
        const blurred = new window.cv.Mat();
        window.cv.GaussianBlur(gray, blurred, new window.cv.Size(3, 3), 0);

        // Apply Canny edge detection
        window.cv.Canny(blurred, edges, 50, 150, 3);

        // Apply morphological operations to clean edges
        const kernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(3, 3));
        const cleaned = new window.cv.Mat();
        window.cv.morphologyEx(edges, cleaned, window.cv.MORPH_CLOSE, kernel);

        // Apply Hough line detection
        window.cv.HoughLines(cleaned, lines, 1, Math.PI / 180, 80);

        const detectedLines = this.extractLinesFromHough(lines);

        // Find document boundaries from lines
        const corners = this.findDocumentCornersFromLines(detectedLines, canvas);

        // Clean up
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        cleaned.delete();
        kernel.delete();
        lines.delete();

        if (corners.length === 4) {
          const confidence = this.calculateLineBasedConfidence(corners, canvas);

          resolve({
            success: true,
            corners,
            confidence,
            method: 'hough_lines'
          });
        } else {
          resolve({
            success: false,
            error: 'Could not find 4 document corners from Hough lines'
          });
        }

      } catch (error) {
        resolve({
          success: false,
          error: `Hough line detection error: ${error}`
        });
      }
    });
  }

  /**
   * Adaptive Multi-Scale Canny Detection
   */
  private async detectWithAdaptiveCanny(
    canvas: HTMLCanvasElement,
    imageData: ImageData
  ): Promise<DocumentDetectionResult> {
    return new Promise((resolve) => {
      try {
        const scales = [1.0, 0.8, 0.6, 0.4];
        let bestResult: DocumentDetectionResult | null = null;
        let bestScore = 0;

        for (const scale of scales) {
          const scaledCanvas = this.scaleCanvas(canvas, scale);
          const scaledImageData = this.getImageDataFromCanvas(scaledCanvas);

          const src = window.cv.matFromImageData(scaledImageData);
          const gray = new window.cv.Mat();

          window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

          // Calculate adaptive thresholds for this scale
          const thresholds = this.calculateAdaptiveThresholdsForScale(gray);

          // Apply multi-threshold Canny
          const edges1 = new window.cv.Mat();
          const edges2 = new window.cv.Mat();
          const combinedEdges = new window.cv.Mat();

          window.cv.Canny(gray, edges1, thresholds.lower, thresholds.upper, 3);
          window.cv.Canny(gray, edges2, thresholds.lower * 0.7, thresholds.upper * 1.3, 5);

          // Combine edge detections
          window.cv.bitwiseOr(edges1, edges2, combinedEdges);

          // Find contours
          const contours = new window.cv.MatVector();
          const hierarchy = new window.cv.Mat();
          window.cv.findContours(combinedEdges, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

          // Find best document contour
          for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = window.cv.contourArea(contour);

            if (area > scaledCanvas.width * scaledCanvas.height * 0.1) {
              const perimeter = window.cv.arcLength(contour, true);
              const approx = new window.cv.Mat();
              window.cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

              if (approx.rows >= 4 && approx.rows <= 8) {
                const scaledCorners = this.extractCornersFromContour(approx);
                const originalCorners = this.scaleCornersBack(scaledCorners, scale, canvas);

                const confidence = this.scoreDocumentContour(originalCorners, canvas);

                if (confidence > bestScore) {
                  bestScore = confidence;
                  bestResult = {
                    success: true,
                    corners: originalCorners,
                    confidence,
                    method: 'adaptive_canny'
                  };
                }
              }
              approx.delete();
            }
          }

          // Clean up
          src.delete();
          gray.delete();
          edges1.delete();
          edges2.delete();
          combinedEdges.delete();
          contours.delete();
          hierarchy.delete();
        }

        resolve(bestResult || {
          success: false,
          error: 'No suitable document found with adaptive Canny'
        });

      } catch (error) {
        resolve({
          success: false,
          error: `Adaptive Canny detection error: ${error}`
        });
      }
    });
  }

  /**
   * Gradient-based document detection
   */
  private async detectWithGradientAnalysis(
    canvas: HTMLCanvasElement,
    imageData: ImageData
  ): Promise<DocumentDetectionResult> {
    return new Promise((resolve) => {
      try {
        const src = window.cv.matFromImageData(imageData);
        const gray = new window.cv.Mat();

        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

        // Calculate gradients using Sobel
        const gradX = new window.cv.Mat();
        const gradY = new window.cv.Mat();
        const absGradX = new window.cv.Mat();
        const absGradY = new window.cv.Mat();
        const gradient = new window.cv.Mat();

        window.cv.Sobel(gray, gradX, window.cv.CV_16S, 1, 0, 3);
        window.cv.Sobel(gray, gradY, window.cv.CV_16S, 0, 1, 3);

        window.cv.convertScaleAbs(gradX, absGradX);
        window.cv.convertScaleAbs(gradY, absGradY);

        window.cv.addWeighted(absGradX, 0.5, absGradY, 0.5, 0, gradient);

        // Apply threshold to get strong edges
        const thresholded = new window.cv.Mat();
        window.cv.threshold(gradient, thresholded, 50, 255, window.cv.THRESH_BINARY);

        // Find contours
        const contours = new window.cv.MatVector();
        const hierarchy = new window.cv.Mat();
        window.cv.findContours(thresholded, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

        let bestCorners: Point[] = [];
        let bestScore = 0;

        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i);
          const area = window.cv.contourArea(contour);

          if (area > canvas.width * canvas.height * 0.15) {
            const perimeter = window.cv.arcLength(contour, true);
            const approx = new window.cv.Mat();
            window.cv.approxPolyDP(contour, approx, 0.02 * perimeter, true);

            if (approx.rows >= 4 && approx.rows <= 8) {
              const corners = this.extractCornersFromContour(approx);
              const score = this.scoreDocumentContour(corners, canvas);

              if (score > bestScore) {
                bestScore = score;
                bestCorners = corners;
              }
            }
            approx.delete();
          }
        }

        // Clean up
        src.delete();
        gray.delete();
        gradX.delete();
        gradY.delete();
        absGradX.delete();
        absGradY.delete();
        gradient.delete();
        thresholded.delete();
        contours.delete();
        hierarchy.delete();

        if (bestCorners.length === 4) {
          resolve({
            success: true,
            corners: bestCorners,
            confidence: bestScore,
            method: 'gradient_based'
          });
        } else {
          resolve({
            success: false,
            error: 'No suitable document found with gradient analysis'
          });
        }

      } catch (error) {
        resolve({
          success: false,
          error: `Gradient-based detection error: ${error}`
        });
      }
    });
  }

  /**
   * Advanced contour analysis with better filtering
   */
  private async detectWithAdvancedContours(
    canvas: HTMLCanvasElement,
    imageData: ImageData
  ): Promise<DocumentDetectionResult> {
    return new Promise((resolve) => {
      try {
        const src = window.cv.matFromImageData(imageData);
        const gray = new window.cv.Mat();

        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);

        // Apply multiple preprocessing techniques
        const preprocessed = this.applyAdvancedPreprocessing(gray);

        // Try different threshold values
        const thresholdValues = [30, 50, 70, 90, 110];
        let bestCorners: Point[] = [];
        let bestScore = 0;

        for (const thresh of thresholdValues) {
          const thresholded = new window.cv.Mat();
          window.cv.threshold(preprocessed, thresholded, thresh, 255, window.cv.THRESH_BINARY);

          // Apply morphological operations
          const kernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(3, 3));
          const morphed = new window.cv.Mat();
          window.cv.morphologyEx(thresholded, morphed, window.cv.MORPH_CLOSE, kernel);

          // Find contours
          const contours = new window.cv.MatVector();
          const hierarchy = new window.cv.Mat();
          window.cv.findContours(morphed, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

          for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = window.cv.contourArea(contour);

            // More sophisticated area filtering
            const minArea = canvas.width * canvas.height * 0.08;
            const maxArea = canvas.width * canvas.height * 0.95;

            if (area > minArea && area < maxArea) {
              const perimeter = window.cv.arcLength(contour, true);

              // Try different approximation accuracies
              for (const epsilon of [0.01, 0.02, 0.03, 0.05]) {
                const approx = new window.cv.Mat();
                window.cv.approxPolyDP(contour, approx, epsilon * perimeter, true);

                if (approx.rows >= 4 && approx.rows <= 8) {
                  const corners = this.extractCornersFromContour(approx);
                  const score = this.scoreDocumentContourAdvanced(corners, canvas, area, perimeter);

                  if (score > bestScore && this.validateQuadrilateralGeometry(corners, canvas)) {
                    bestScore = score;
                    bestCorners = corners;
                  }
                }
                approx.delete();
              }
            }
          }

          // Clean up
          thresholded.delete();
          morphed.delete();
          kernel.delete();
          contours.delete();
          hierarchy.delete();
        }

        // Clean up
        src.delete();
        gray.delete();
        preprocessed.delete();

        if (bestCorners.length === 4) {
          resolve({
            success: true,
            corners: bestCorners,
            confidence: bestScore,
            method: 'advanced_contours'
          });
        } else {
          resolve({
            success: false,
            error: 'No suitable document found with advanced contour analysis'
          });
        }

      } catch (error) {
        resolve({
          success: false,
          error: `Advanced contour detection error: ${error}`
        });
      }
    });
  }

  /**
   * Advanced preprocessing for better edge detection
   */
  private applyAdvancedPreprocessing(grayImage: any): any {
    // Apply CLAHE for better contrast
    const clahe = new window.cv.CLAHE(3.0, new window.cv.Size(8, 8));
    const enhanced = new window.cv.Mat();
    clahe.apply(grayImage, enhanced);

    // Apply bilateral filter to reduce noise while keeping edges
    const filtered = new window.cv.Mat();
    window.cv.bilateralFilter(enhanced, filtered, 9, 75, 75);

    // Apply morphological gradient to enhance edges
    const kernel = window.cv.getStructuringElement(window.cv.MORPH_RECT, new window.cv.Size(3, 3));
    const gradient = new window.cv.Mat();
    window.cv.morphologyEx(filtered, gradient, window.cv.MORPH_GRADIENT, kernel);

    // Combine enhanced image with gradient
    const combined = new window.cv.Mat();
    window.cv.addWeighted(filtered, 0.7, gradient, 0.3, 0, combined);

    // Clean up
    clahe.delete();
    enhanced.delete();
    filtered.delete();
    gradient.delete();
    kernel.delete();

    return combined;
  }

  /**
   * Extract lines from Hough transform results
   */
  private extractLinesFromHough(lines: any): Array<{ rho: number; theta: number }> {
    const detectedLines: Array<{ rho: number; theta: number }> = [];

    for (let i = 0; i < lines.rows; i++) {
      const line = lines.row(i);
      detectedLines.push({
        rho: line.doubleAt(0, 0),
        theta: line.doubleAt(0, 1)
      });
    }

    return detectedLines;
  }

  /**
   * Find document corners from detected lines
   */
  private findDocumentCornersFromLines(lines: Array<{ rho: number; theta: number }>, canvas: HTMLCanvasElement): Point[] {
    // Group lines by orientation (horizontal vs vertical)
    const horizontalLines: Array<{ rho: number; theta: number }> = [];
    const verticalLines: Array<{ rho: number; theta: number }> = [];

    for (const line of lines) {
      const angle = (line.theta * 180) / Math.PI;
      if (Math.abs(angle - 90) < 30 || Math.abs(angle + 90) < 30) {
        verticalLines.push(line);
      } else if (Math.abs(angle) < 30 || Math.abs(angle - 180) < 30) {
        horizontalLines.push(line);
      }
    }

    if (horizontalLines.length < 2 || verticalLines.length < 2) {
      return [];
    }

    // Find intersection points
    const corners: Point[] = [];

    for (const hLine of horizontalLines.slice(0, 2)) {
      for (const vLine of verticalLines.slice(0, 2)) {
        const intersection = this.findLineIntersection(hLine, vLine);
        if (intersection &&
            intersection.x >= 0 && intersection.x <= canvas.width &&
            intersection.y >= 0 && intersection.y <= canvas.height) {
          corners.push(intersection);
        }
      }
    }

    return corners.slice(0, 4);
  }

  /**
   * Find intersection point of two lines
   */
  private findLineIntersection(
    line1: { rho: number; theta: number },
    line2: { rho: number; theta: number }
  ): Point | null {
    const a1 = Math.cos(line1.theta);
    const b1 = Math.sin(line1.theta);
    const c1 = line1.rho;

    const a2 = Math.cos(line2.theta);
    const b2 = Math.sin(line2.theta);
    const c2 = line2.rho;

    const determinant = a1 * b2 - a2 * b1;

    if (Math.abs(determinant) < 1e-6) {
      return null; // Lines are parallel
    }

    const x = (b2 * c1 - b1 * c2) / determinant;
    const y = (a1 * c2 - a2 * c1) / determinant;

    return { x, y };
  }

  /**
   * Calculate confidence for line-based detection
   */
  private calculateLineBasedConfidence(corners: Point[], canvas: HTMLCanvasElement): number {
    if (corners.length !== 4) return 0;

    // Check if corners form a reasonable quadrilateral
    const area = this.calculateQuadrilateralArea(corners);
    const canvasArea = canvas.width * canvas.height;
    const areaRatio = area / canvasArea;

    // Check corner distribution
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    let cornerSpread = 0;
    for (const corner of corners) {
      const distance = Math.sqrt(
        Math.pow(corner.x - centerX, 2) + Math.pow(corner.y - centerY, 2)
      );
      cornerSpread += distance;
    }
    const avgSpread = cornerSpread / 4;
    const maxSpread = Math.sqrt(centerX * centerX + centerY * centerY);
    const spreadRatio = avgSpread / maxSpread;

    return Math.min((areaRatio * 0.6 + spreadRatio * 0.4), 1.0);
  }

  /**
   * Calculate adaptive thresholds for different scales
   */
  private calculateAdaptiveThresholdsForScale(grayImage: any): { lower: number; upper: number } {
    // Calculate image statistics
    const mean = new window.cv.Mat();
    const stddev = new window.cv.Mat();
    window.cv.meanStdDev(grayImage, mean, stddev);

    const meanValue = mean.data64F[0];
    const stdValue = stddev.data64F[0];

    // Adaptive thresholds based on image statistics
    const lowerThresh = Math.max(20, meanValue - stdValue * 0.5);
    const upperThresh = Math.min(255, meanValue + stdValue * 1.5);

    mean.delete();
    stddev.delete();

    return { lower: lowerThresh, upper: upperThresh };
  }

  /**
   * Advanced contour scoring with multiple factors
   */
  private scoreDocumentContourAdvanced(
    corners: Point[],
    canvas: HTMLCanvasElement,
    area: number,
    perimeter: number
  ): number {
    if (corners.length !== 4) return 0;

    // Area score
    const canvasArea = canvas.width * canvas.height;
    const areaRatio = area / canvasArea;
    const areaScore = areaRatio > 0.1 && areaRatio < 0.9 ? 1.0 : 0.5;

    // Aspect ratio score
    const width = Math.max(...corners.map(c => c.x)) - Math.min(...corners.map(c => c.x));
    const height = Math.max(...corners.map(c => c.y)) - Math.min(...corners.map(c => c.y));
    const aspectRatio = width / height;
    const aspectScore = aspectRatio > 0.2 && aspectRatio < 5.0 ? 1.0 : 0.7;

    // Corner distribution score
    const cornerScore = this.scoreCornerDistribution(corners, canvas);

    // Perimeter to area ratio (compactness)
    const compactness = (perimeter * perimeter) / area;
    const compactnessScore = compactness > 10 && compactness < 100 ? 1.0 : 0.8;

    // Geometric regularity score
    const regularityScore = this.scoreGeometricRegularity(corners);

    return (areaScore * 0.25 + aspectScore * 0.2 + cornerScore * 0.2 + compactnessScore * 0.15 + regularityScore * 0.2);
  }

  /**
   * Score corner distribution across canvas
   */
  private scoreCornerDistribution(corners: Point[], canvas: HTMLCanvasElement): number {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Check if corners are in different quadrants
    const quadrants = new Set<string>();

    for (const corner of corners) {
      const quadrant = (corner.x < centerX ? 'L' : 'R') + (corner.y < centerY ? 'T' : 'B');
      quadrants.add(quadrant);
    }

    return quadrants.size === 4 ? 1.0 : 0.6;
  }

  /**
   * Score geometric regularity of quadrilateral
   */
  private scoreGeometricRegularity(corners: Point[]): number {
    if (corners.length !== 4) return 0;

    // Calculate angles at each corner
    let totalAngleDeviation = 0;

    for (let i = 0; i < 4; i++) {
      const prev = corners[(i - 1 + 4) % 4];
      const curr = corners[i];
      const next = corners[(i + 1) % 4];

      const angle = this.calculateAngle(prev, curr, next);
      const deviation = Math.abs(angle - 90); // Ideal angle for rectangle
      totalAngleDeviation += deviation;
    }

    const avgDeviation = totalAngleDeviation / 4;
    return Math.max(0, 1 - avgDeviation / 45); // Score decreases with deviation
  }

  /**
   * Calculate angle at corner between three points
   */
  private calculateAngle(p1: Point, p2: Point, p3: Point): number {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

    return (angle * 180) / Math.PI;
  }

  /**
   * Validate quadrilateral geometry
   */
  private validateQuadrilateralGeometry(corners: Point[], canvas: HTMLCanvasElement): boolean {
    if (corners.length !== 4) return false;

    // Check minimum distances between corners
    const minDistance = Math.min(canvas.width, canvas.height) * 0.05;

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        const distance = Math.sqrt(
          Math.pow(corners[i].x - corners[j].x, 2) +
          Math.pow(corners[i].y - corners[j].y, 2)
        );
        if (distance < minDistance) {
          return false;
        }
      }
    }

    // Check that corners are not collinear
    for (let i = 0; i < 4; i++) {
      const p1 = corners[i];
      const p2 = corners[(i + 1) % 4];
      const p3 = corners[(i + 2) % 4];

      const area = Math.abs(
        (p2.x - p1.x) * (p3.y - p1.y) -
        (p3.x - p1.x) * (p2.y - p1.y)
      );

      if (area < 100) { // Points are nearly collinear
        return false;
      }
    }

    return true;
  }

  // Utility methods
  private getImageDataFromCanvas(canvas: HTMLCanvasElement): ImageData {
    const ctx = canvas.getContext('2d')!;
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  private scaleCanvas(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
    const scaledCanvas = document.createElement('canvas');
    const ctx = scaledCanvas.getContext('2d')!;

    scaledCanvas.width = Math.floor(canvas.width * scale);
    scaledCanvas.height = Math.floor(canvas.height * scale);

    ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

    return scaledCanvas;
  }

  private scaleCornersBack(corners: Point[], scale: number, originalCanvas: HTMLCanvasElement): Point[] {
    return corners.map(corner => ({
      x: corner.x / scale,
      y: corner.y / scale
    }));
  }

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

  private scoreDocumentContour(corners: Point[], canvas: HTMLCanvasElement): number {
    if (corners.length !== 4) return 0;

    const area = this.calculateQuadrilateralArea(corners);
    const canvasArea = canvas.width * canvas.height;
    const areaRatio = area / canvasArea;

    return areaRatio > 0.1 && areaRatio < 0.9 ? 1.0 : 0.5;
  }

  private calculateQuadrilateralArea(corners: Point[]): number {
    if (corners.length !== 4) return 0;

    let area = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      area += corners[i].x * corners[j].y;
      area -= corners[j].x * corners[i].y;
    }

    return Math.abs(area) / 2;
  }
}
